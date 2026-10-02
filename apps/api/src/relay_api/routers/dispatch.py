"""The dispatcher's desk: the order queue (DSP-01) and the capacity outlook (DSP-05). The plan board, deferrals and
live runs have routers of their own."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import (
    AppUser,
    Deferral,
    DeferralKind,
    Order,
    OrderStream,
    Outlet,
    Role,
    ServiceHistory,
    Vehicle,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.schemas.common import Schema
from relay_api.schemas.outlook import OutlookOut
from relay_api.security import require
from relay_api.services.notify import last_reminders, remind_to_order
from relay_api.services.ordering import current_run, cutoff_for, next_operating_day
from relay_api.services.outlook import capacity_outlook
from relay_api.workspaces import ScopeDep

router = APIRouter(prefix="/api/dispatch", tags=["dispatcher"])
Dispatcher = Annotated[AppUser, Depends(require(Role.DISPATCHER))]


class Flag(Schema):
    kind: str
    """waited, van_only, large_truck, truck_only, mall"""
    label: str


class QueueOrder(Schema):
    id: uuid.UUID
    order_ref: str
    outlet_id: str
    outlet_name: str
    short_name: str
    depot: str
    district: str
    brand: str
    temp: str
    units: int
    weight_kg: float
    volume_m3: float
    window_open: str
    window_close: str
    placed_at: datetime
    status: str
    flags: list[Flag]


class LateOrder(QueueOrder):
    moved_to: date
    store_told_at: datetime | None


class NotOrdered(Schema):
    outlet_id: str
    outlet_name: str
    short_name: str
    depot: str
    temps: list[str]
    pattern: str
    reminded_at: datetime | None
    """The last Remind for this run, if the dispatcher sent one."""
    phone: str | None
    """The store manager's number, when the store's record has one; Call needs it."""


class ChilledSummary(Schema):
    depot: str
    orders: int
    weight_kg: float
    volume_m3: float
    reefers_free: int
    reefers_total: int
    in_workshop: list[str]


class Queue(Schema):
    run_date: date
    now: datetime
    cutoff: datetime
    locked: bool
    orders: list[QueueOrder]
    late: list[LateOrder]
    not_ordered: list[NotOrdered]
    fresh_outlets_expected: int
    fresh_outlets_ordered: int
    chilled: list[ChilledSummary]


def _flags(
    order: Order, outlet: Outlet, history: ServiceHistory | None, van_limits: dict[str, tuple[float, float]]
) -> list[Flag]:
    flags: list[Flag] = []
    if history and history.deferred_on:
        flags.append(Flag(kind="waited", label=f"Waited {_day_name(history.deferred_on)}"))
    if outlet.parking_constraint == "van_only":
        flags.append(Flag(kind="van_only", label="Van only"))
    max_kg, max_m3 = van_limits.get(outlet.depot, (0.0, 0.0))
    if order.volume_m3 > max_m3:
        flags.append(Flag(kind="large_truck", label="Large truck"))
    elif order.weight_kg > max_kg:
        flags.append(Flag(kind="truck_only", label="Truck only"))
    if outlet.parking_constraint == "mall_dock" and outlet.mall_window:
        flags.append(Flag(kind="mall", label="Mall window"))
    return flags


# Needs attention first: waited last run, then orders that need a truck, chilled van-only, other van-only,
# then everything else by the time the store's window closes.
def _attention_rank(row: QueueOrder) -> tuple[int, str, str]:
    kinds = {f.kind for f in row.flags}
    if "waited" in kinds:
        rank = 0
    elif kinds & {"large_truck", "truck_only"}:
        rank = 1
    elif "van_only" in kinds and row.temp == "chilled":
        rank = 2
    elif "van_only" in kinds:
        rank = 3
    else:
        rank = 4
    return rank, row.window_close, row.order_ref


@router.get("/queue", response_model=Queue)
def queue(scope: ScopeDep, _user: Dispatcher, run_date: Annotated[date | None, Query()] = None) -> Queue:
    db, now = scope.db, scope.now
    day = run_date or current_run(db, now)
    cutoff = cutoff_for(day)
    outlets = {o.outlet_id: o for o in db.scalars(select(Outlet))}
    history = {(h.outlet_id, h.temp): h for h in db.scalars(select(ServiceHistory))}
    van_limits: dict[str, tuple[float, float]] = {}
    for v in db.scalars(select(Vehicle).where(Vehicle.type == "van")):
        kg, m3 = van_limits.get(v.depot, (0.0, 0.0))
        van_limits[v.depot] = (max(kg, v.weight_cap_kg), max(m3, v.volume_cap_m3))

    def row(order: Order) -> QueueOrder:
        o = outlets[order.outlet_id]
        return QueueOrder(
            id=order.id,
            order_ref=order.order_ref,
            outlet_id=o.outlet_id,
            outlet_name=o.name,
            short_name=o.short_name,
            depot=o.depot,
            district=o.district,
            brand=order.brand,
            temp=order.temp,
            units=order.units,
            weight_kg=order.weight_kg,
            volume_m3=order.volume_m3,
            window_open=o.window_open,
            window_close=o.window_close,
            placed_at=order.placed_at.astimezone(COLOMBO),
            status=order.status.value,
            flags=_flags(order, o, history.get((o.outlet_id, order.temp)), van_limits),
        )

    orders = list(db.scalars(select(Order).where(Order.run_date == day, Order.requested_date == day)))
    rows = sorted((row(o) for o in orders), key=_attention_rank)

    late = [
        LateOrder(
            **row(order).model_dump(),
            moved_to=order.run_date,
            store_told_at=deferral.notified_at.astimezone(COLOMBO) if deferral.notified_at else None,
        )
        for order, deferral in db.execute(
            select(Order, Deferral)
            .join(Deferral, Deferral.order_id == Order.id)
            .where(Order.requested_date == day, Deferral.kind == DeferralKind.CUTOFF)
            .order_by(Order.placed_at)
        ).all()
    ]

    expected = _expected_fresh(db, day, outlets)
    in_time = {o.outlet_id for o in orders}
    reminded = last_reminders(db, day, now)
    phones = _store_phones(db)
    not_ordered = [
        NotOrdered(
            outlet_id=oid,
            outlet_name=outlets[oid].name,
            short_name=outlets[oid].short_name,
            depot=outlets[oid].depot,
            temps=sorted(temps),
            pattern=f"Orders {_what(temps)} on {_day_name(day)}s",
            reminded_at=reminded[oid].astimezone(COLOMBO) if oid in reminded else None,
            phone=phones.get(oid),
        )
        for oid, temps in _not_ordered(db, day, expected).items()
    ]

    days = {vd.vehicle_id: vd for vd in db.scalars(select(VehicleDay).where(VehicleDay.run_date == day))}
    chilled = []
    for depot in ("Peliyagoda", "Kandy"):
        ch = [o for o in orders if o.temp == "chilled" and outlets[o.outlet_id].depot == depot]
        reefers = list(db.scalars(select(Vehicle.vehicle_id).where(Vehicle.depot == depot, Vehicle.temp == "reefer")))
        workshop = sorted(v for v in reefers if v in days and days[v].status is VehicleDayStatus.WORKSHOP)
        chilled.append(
            ChilledSummary(
                depot=depot,
                orders=len(ch),
                weight_kg=round(sum(o.weight_kg for o in ch), 1),
                volume_m3=round(sum(o.volume_m3 for o in ch), 3),
                reefers_free=len(reefers) - len(workshop),
                reefers_total=len(reefers),
                in_workshop=workshop,
            )
        )

    return Queue(
        run_date=day,
        now=now,
        cutoff=cutoff,
        locked=now >= cutoff,
        orders=rows,
        late=late,
        not_ordered=not_ordered,
        fresh_outlets_expected=len(expected),
        fresh_outlets_ordered=len(expected.keys() & in_time),
        chilled=chilled,
    )


def _day_name(d: date) -> str:
    return d.strftime("%A")


def _expected_fresh(db: Session, day: date, outlets: dict[str, Outlet]) -> dict[str, set[str]]:
    """The Fresh outlets that usually order on this weekday, with the temperatures they order."""
    expected: dict[str, set[str]] = {}
    for s in db.scalars(select(OrderStream).where(OrderStream.dow_name == day.strftime("%a"))):
        if outlets[s.outlet_id].brand == "Fresh":
            expected.setdefault(s.outlet_id, set()).add(s.temp)
    return expected


def _not_ordered(db: Session, day: date, expected: dict[str, set[str]]) -> dict[str, set[str]]:
    """Expected Fresh outlets with no order for the run yet, in outlet order."""
    ordered = {o.outlet_id for o in db.scalars(select(Order).where(Order.requested_date == day))}
    return {oid: temps for oid, temps in sorted(expected.items()) if oid not in ordered}


def _what(temps: set[str]) -> str:
    return "dry and chilled" if len(temps) == 2 else "dry only" if "ambient" in temps else "chilled only"


def _usual(temps: set[str]) -> str:
    """What the store's reminder says it usually sends: "dry and chilled orders", "chilled order"."""
    return "dry and chilled orders" if len(temps) == 2 else "dry order" if "ambient" in temps else "chilled order"


def _store_phones(db: Session) -> dict[str, str]:
    return {
        u.outlet_id: u.phone
        for u in db.scalars(select(AppUser).where(AppUser.role == Role.STORE_MANAGER, AppUser.phone.is_not(None)))
        if u.outlet_id and u.phone
    }


class RemindIn(BaseModel):
    outlet_ids: list[str] = Field(min_length=1, max_length=200)


class Reminded(Schema):
    outlet_id: str
    reminded_at: datetime


@router.post("/reminders", response_model=list[Reminded])
def remind(body: RemindIn, scope: ScopeDep, _user: Dispatcher) -> list[Reminded]:
    """DSP-01 Remind and Remind all: a notice in each store's Relay app with the 4:00 PM cutoff. Only stores still
    missing an order for the run are reminded; one that ordered meanwhile is left out of the answer."""
    db, now = scope.db, scope.now
    day = current_run(db, now)
    cutoff = cutoff_for(day)
    if now >= cutoff:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"Orders for {_day_name(day)} closed at 4:00 PM. Late orders go on the next run by themselves.",
        )
    outlets = {o.outlet_id: o for o in db.scalars(select(Outlet))}
    missing = _not_ordered(db, day, _expected_fresh(db, day, outlets))
    last = last_reminders(db, day, now)
    then = next_operating_day(db, day)
    out = [
        Reminded(
            outlet_id=oid,
            reminded_at=remind_to_order(
                db, oid, now, run_date=day, cutoff=cutoff, then=then, usual=_usual(missing[oid]), last=last.get(oid)
            ).astimezone(COLOMBO),
        )
        for oid in dict.fromkeys(body.outlet_ids)
        if oid in missing
    ]
    db.commit()
    return out


@router.get("/outlook", response_model=OutlookOut)
def outlook(
    scope: ScopeDep, _user: Dispatcher, depot: Annotated[Literal["Kandy", "Peliyagoda"], Query()] = "Kandy"
) -> OutlookOut:
    """DSP-05: six ISO weeks from today against the depot's refrigerated fleet. Read-only."""
    return capacity_outlook(scope.db, scope.now, depot)
