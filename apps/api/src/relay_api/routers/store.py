"""The store manager: place an order, follow it, read notices, confirm receipt."""

from __future__ import annotations

import uuid
from datetime import date, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from relay_api.clock import COLOMBO
from relay_api.models import (
    AppUser,
    CaseType,
    Deferral,
    DeferralKind,
    Notification,
    Order,
    OrderSource,
    Outlet,
    Role,
)
from relay_api.schemas.common import Schema
from relay_api.security import require
from relay_api.services.ordering import (
    LineInput,
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


class CaseTypeOut(Schema):
    code: str
    name: str
    temp: str
    kg: float
    m3: float


class OutletOut(Schema):
    outlet_id: str
    name: str
    short_name: str
    brand: str
    district: str
    depot: str
    dock_type: str
    parking_constraint: str
    window_open: str
    window_close: str


class LineOut(Schema):
    case_type: str
    name: str
    qty: int
    carried_qty: int
    carried_from: str | None


class DeferralOut(Schema):
    id: uuid.UUID
    kind: DeferralKind
    from_date: date
    to_date: date
    store_notice: str
    notified_at: datetime | None
    acknowledged_at: datetime | None


class StoreOrderOut(Schema):
    id: uuid.UUID
    order_ref: str
    temp: str
    brand: str
    requested_date: date
    run_date: date
    units: int
    weight_kg: float
    volume_m3: float
    status: str
    placed_at: datetime
    locked: bool
    lines: list[LineOut]
    deferral: DeferralOut | None


class StoreHome(Schema):
    outlet: OutletOut
    now: datetime
    ordering_for: date
    """The run a new order joins right now."""
    cutoff: datetime
    """When orders for `ordering_for` close."""
    next_run: date
    orders: list[StoreOrderOut]
    case_types: list[CaseTypeOut]
    unread_notices: int


def _outlet(scope: ScopeDep, user: AppUser) -> Outlet:
    outlet = scope.db.get(Outlet, user.outlet_id) if user.outlet_id else None
    if outlet is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No store is linked to this account")
    return outlet


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
    local = now.astimezone(COLOMBO)
    today = local.date()
    # Until midday on a delivery day, "this morning's run" is the one a store is following.
    runs_today = next_operating_day(db, today - timedelta(days=1)) == today
    next_run = today if local.hour < 12 and runs_today else next_operating_day(db, today)
    form_order = {code: i for i, code in enumerate(ORDER_FORM)}
    types = sorted(
        db.scalars(select(CaseType).where(CaseType.brand == outlet.brand)),
        key=lambda c: (c.temp, form_order.get(c.code, 99)),
    )
    names = {c.code: c.name for c in db.scalars(select(CaseType))}
    orders = list(
        db.scalars(
            select(Order)
            .where(Order.outlet_id == outlet.outlet_id, Order.requested_date >= today)
            .order_by(Order.requested_date, Order.order_ref)
        )
    )
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
        next_run=next_run,
        orders=[_order_out(o, names, deferrals.get(o.id), now) for o in orders],
        case_types=[CaseTypeOut.model_validate(c) for c in types],
        unread_notices=unread,
    )


class LineIn(BaseModel):
    case_type: str
    qty: int = Field(ge=1, le=999)


class PlaceOrder(BaseModel):
    temp: Literal["ambient", "chilled"]
    lines: list[LineIn] = Field(min_length=1, max_length=12)
    client_ref: str = Field(min_length=8, max_length=64)
    """Generated on the store's device, so pressing Try again never sends a second order."""


@router.post("/orders", response_model=StoreOrderOut, status_code=status.HTTP_201_CREATED)
def create_order(body: PlaceOrder, scope: ScopeDep, user: StoreUser) -> StoreOrderOut:
    db, now = scope.db, scope.now
    outlet = _outlet(scope, user)
    types = {c.code: c for c in db.scalars(select(CaseType))}
    for line in body.lines:
        case = types.get(line.case_type)
        if case is None or case.brand != outlet.brand or (outlet.brand == "Fresh" and case.temp != body.temp):
            raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, f"{line.case_type} does not belong in this order")
    order = place_order(
        db,
        now,
        outlet,
        body.temp,
        [LineInput(line.case_type, line.qty) for line in body.lines],
        requested_date=delivery_day_for(db, now),
        source=OrderSource.STORE,
        placed_by=user,
        client_ref=body.client_ref,
    )
    db.commit()
    deferral = db.scalar(select(Deferral).where(Deferral.order_id == order.id))
    return _order_out(order, {c: t.name for c, t in types.items()}, deferral, now)


class NoticeOut(Schema):
    id: uuid.UUID
    kind: str
    title: str
    body: str
    data: dict[str, object]
    created_at: datetime
    read_at: datetime | None
    acknowledged_at: datetime | None


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


@router.post("/notices/{notice_id}/ack", response_model=NoticeOut)
def acknowledge(notice_id: uuid.UUID, scope: ScopeDep, user: StoreUser) -> Notification:
    outlet = _outlet(scope, user)
    notice = scope.db.get(Notification, notice_id)
    if notice is None or notice.outlet_id != outlet.outlet_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such notice")
    notice.read_at = notice.read_at or scope.now
    notice.acknowledged_at = notice.acknowledged_at or scope.now
    scope.db.commit()
    return notice
