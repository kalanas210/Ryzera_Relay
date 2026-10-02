"""The store manager: place an order, follow it, read notices, confirm receipt."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import or_, select

from relay_api.clock import COLOMBO
from relay_api.models import (
    AppUser,
    CaseType,
    Deferral,
    Notification,
    Order,
    OrderSource,
    Outlet,
    Role,
)
from relay_api.schemas.store import (
    CaseTypeOut,
    ChangeOrder,
    DeferralOut,
    IssuesIn,
    LineIn,
    LineOut,
    NoticeOut,
    OutletOut,
    PlaceOrder,
    ReceiptIn,
    StoreHome,
    StoreOrderOut,
)
from relay_api.security import require
from relay_api.services import ordering, tracker
from relay_api.services.ordering import (
    LineInput,
    closed_run,
    cutoff_for,
    delivery_day_for,
    next_operating_day,
    place_order,
)
from relay_api.workspaces import ScopeDep

router = APIRouter(prefix="/api/store", tags=["store manager"])

# The order a store counts its cases in (STM-02), which is not the heaviest-first loading order.
ORDER_FORM = ["rice_dhal", "packet_foods", "tea_biscuit", "dairy", "produce", "meat_fish"]
StoreUser = Annotated[AppUser, Depends(require(Role.STORE_MANAGER))]


def _outlet(scope: ScopeDep, user: AppUser) -> Outlet:
    outlet = scope.db.get(Outlet, user.outlet_id) if user.outlet_id else None
    if outlet is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No store is linked to this account")
    return outlet


def _my_order(scope: ScopeDep, user: AppUser, order_ref: str) -> Order:
    outlet = _outlet(scope, user)
    order = scope.db.scalar(select(Order).where(Order.order_ref == order_ref, Order.outlet_id == outlet.outlet_id))
    if order is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such order at your store")
    return order


def _order_out(order: Order, names: dict[str, str], deferral: Deferral | None, now: datetime) -> StoreOrderOut:
    return StoreOrderOut(
        id=order.id,
        order_ref=order.order_ref,
        temp=order.temp,
        brand=order.brand,
        requested_date=order.requested_date,
        run_date=order.run_date,
        units=order.units,
        weight_kg=order.weight_kg,
        volume_m3=order.volume_m3,
        status=order.status.value,
        placed_at=order.placed_at.astimezone(COLOMBO),
        locked=now >= cutoff_for(order.requested_date),
        locks_at=cutoff_for(order.requested_date),
        lines=[
            LineOut(
                case_type=line.case_type,
                name=names.get(line.case_type, line.case_type),
                qty=line.qty,
                carried_qty=line.carried_qty,
                carried_from=line.carried_from,
            )
            for line in order.lines
        ],
        deferral=DeferralOut.model_validate(deferral) if deferral else None,
    )


@router.get("/home", response_model=StoreHome)
def home(scope: ScopeDep, user: StoreUser) -> StoreHome:
    db, now = scope.db, scope.now
    outlet = _outlet(scope, user)
    ordering_for = delivery_day_for(db, now)
    closed_for = closed_run(db, now)
    local = now.astimezone(COLOMBO)
    today = local.date()
    form_order = {code: i for i, code in enumerate(ORDER_FORM)}
    types = sorted(
        db.scalars(select(CaseType).where(CaseType.brand == outlet.brand)),
        key=lambda c: (c.temp, form_order.get(c.code, 99)),
    )
    names = {c.code: c.name for c in db.scalars(select(CaseType))}
    orders = list(
        db.scalars(
            select(Order)
            .where(Order.outlet_id == outlet.outlet_id, or_(Order.requested_date >= today, Order.run_date >= today))
            .order_by(Order.requested_date, Order.order_ref)
        )
    )
    # Until midday on a delivery day, "this morning's run" is the one a store is following; a store that had a
    # delivery this morning keeps it in view until 4:00 PM, while it can still report a problem with it.
    runs_today = next_operating_day(db, today - timedelta(days=1)) == today
    delivered_today = any(o.run_date == today for o in orders)
    keep_today = local.hour < 12 or (local.hour < tracker.ISSUES_UNTIL.hour and delivered_today)
    next_run = today if keep_today and runs_today else next_operating_day(db, today)
    deferrals = {
        d.order_id: d for d in db.scalars(select(Deferral).where(Deferral.order_id.in_([o.id for o in orders])))
    }
    unread = len(
        db.scalars(
            select(Notification.id).where(
                Notification.outlet_id == outlet.outlet_id,
                Notification.read_at.is_(None),
                Notification.created_at <= now,
            )
        ).all()
    )
    return StoreHome(
        outlet=OutletOut.model_validate(outlet),
        now=now,
        ordering_for=ordering_for,
        cutoff=cutoff_for(ordering_for),
        closed_for=closed_for,
        closed_at=cutoff_for(closed_for) if closed_for else None,
        next_run=next_run,
        orders=[_order_out(o, names, deferrals.get(o.id), now) for o in orders],
        case_types=[CaseTypeOut.model_validate(c) for c in types],
        unread_notices=unread,
    )


def _lines(types: dict[str, CaseType], outlet: Outlet, temp: str, lines: list[LineIn]) -> list[LineInput]:
    """The store's lines, each a case type of its own brand and, for a Fresh store, of the order's temperature."""
    for line in lines:
        case = types.get(line.case_type)
        if case is None or case.brand != outlet.brand or (outlet.brand == "Fresh" and case.temp != temp):
            raise HTTPException(
                status.HTTP_422_UNPROCESSABLE_CONTENT, f"{line.case_type} does not belong in this order"
            )
    if len({line.case_type for line in lines}) < len(lines):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_CONTENT, "Each case type goes on one line")
    return [LineInput(line.case_type, line.qty) for line in lines]


@router.post("/orders", response_model=StoreOrderOut, status_code=status.HTTP_201_CREATED)
def create_order(body: PlaceOrder, scope: ScopeDep, user: StoreUser) -> StoreOrderOut:
    """STM-02. The order goes on the run the store's form showed, unless it reaches Relay after that run's cutoff:
    then it goes on the run taking orders now, and the store is told so in the same answer."""
    db, now = scope.db, scope.now
    outlet = _outlet(scope, user)
    types = {c.code: c for c in db.scalars(select(CaseType))}
    ordering_for = delivery_day_for(db, now)
    requested = body.for_date or ordering_for
    if requested > ordering_for:
        raise HTTPException(
            status.HTTP_422_UNPROCESSABLE_CONTENT,
            f"Orders for {requested:%A} {requested.day} {requested:%B} are not open yet",
        )
    order = place_order(
        db,
        now,
        outlet,
        body.temp,
        _lines(types, outlet, body.temp, body.lines),
        requested_date=requested,
        source=OrderSource.STORE,
        placed_by=user,
        client_ref=body.client_ref,
    )
    db.commit()
    deferral = db.scalar(select(Deferral).where(Deferral.order_id == order.id))
    return _order_out(order, {c: t.name for c, t in types.items()}, deferral, now)


@router.patch("/orders/{order_ref}", response_model=StoreOrderOut)
def change_order(order_ref: str, body: ChangeOrder, scope: ScopeDep, user: StoreUser) -> StoreOrderOut:
    """STM-01 Change this order: new counts until 4:00 PM the day before its run, refused from then on."""
    db, now = scope.db, scope.now
    order = _my_order(scope, user, order_ref)
    types = {c.code: c for c in db.scalars(select(CaseType))}
    lines = _lines(types, _outlet(scope, user), order.temp, body.lines)
    try:
        ordering.change_order(db, now, order, lines, changed_by=user)
    except ordering.OrderClosed as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    db.commit()
    return _order_out(order, {c: t.name for c, t in types.items()}, None, now)


@router.get("/notices", response_model=list[NoticeOut])
def notices(scope: ScopeDep, user: StoreUser) -> list[Notification]:
    outlet = _outlet(scope, user)
    return list(
        scope.db.scalars(
            select(Notification)
            .where(Notification.outlet_id == outlet.outlet_id, Notification.created_at <= scope.now)
            .order_by(Notification.created_at.desc())
        )
    )


def _my_notice(scope: ScopeDep, user: AppUser, notice_id: uuid.UUID) -> Notification:
    outlet = _outlet(scope, user)
    notice = scope.db.get(Notification, notice_id)
    if notice is None or notice.outlet_id != outlet.outlet_id or notice.created_at > scope.now:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such notice")
    return notice


@router.post("/notices/{notice_id}/read", response_model=NoticeOut)
def read_notice(notice_id: uuid.UUID, scope: ScopeDep, user: StoreUser) -> Notification:
    """The store opened the notice: the dispatcher's records can say when it was read. Got it is still the store's
    own word that it has seen it."""
    notice = _my_notice(scope, user, notice_id)
    notice.read_at = notice.read_at or scope.now
    scope.db.commit()
    return notice


@router.post("/notices/{notice_id}/ack", response_model=NoticeOut)
def acknowledge(notice_id: uuid.UUID, scope: ScopeDep, user: StoreUser) -> Notification:
    notice = _my_notice(scope, user, notice_id)
    notice.read_at = notice.read_at or scope.now
    notice.acknowledged_at = notice.acknowledged_at or scope.now
    deferral_id = notice.data.get("deferral_id")
    deferral = scope.db.get(Deferral, uuid.UUID(str(deferral_id))) if deferral_id else None
    if deferral is not None and deferral.acknowledged_at is None:
        deferral.acknowledged_at = scope.now  # the dispatcher's "Seen 6:41 PM"
    scope.db.commit()
    return notice


# ------------------------------------------------------------------------------------------------ on the way
@router.get("/orders/{order_ref}/tracker")
def track(order_ref: str, scope: ScopeDep, user: StoreUser) -> dict[str, object]:
    """STM-04: where the delivery is and when it is expected, from the driver's own records. While the driver's
    phone is silent, a likely range; once the estimate has passed, the store can confirm receipt itself."""
    return tracker.tracker(scope.db, scope.now, _my_order(scope, user, order_ref)).as_dict()


@router.post("/orders/{order_ref}/receipt")
def confirm(order_ref: str, body: ReceiptIn, scope: ScopeDep, user: StoreUser) -> dict[str, object]:
    """STM-05: everything arrived, or what did not. It counts as the delivery for Relay's estimates even before the
    driver's proof arrives."""
    order = _my_order(scope, user, order_ref)
    try:
        tracker.confirm_receipt(
            scope.db, scope.now, user, order, [i.model_dump() for i in body.issues], body.client_ref
        )
    except tracker.TrackerError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    scope.db.commit()
    return tracker.tracker(scope.db, scope.now, order).as_dict()


@router.post("/orders/{order_ref}/issues")
def report_issues(order_ref: str, body: IssuesIn, scope: ScopeDep, user: StoreUser) -> dict[str, object]:
    """STM-05 after confirming: a problem found later with the goods, until 4:00 PM on the delivery day."""
    order = _my_order(scope, user, order_ref)
    try:
        tracker.report_issues(scope.db, scope.now, user, order, [i.model_dump() for i in body.issues], body.client_ref)
    except tracker.TrackerError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    scope.db.commit()
    return tracker.tracker(scope.db, scope.now, order).as_dict()
