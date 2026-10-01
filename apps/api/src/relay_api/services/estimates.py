"""Live estimates for a run on the road: the engine's one rule (relay_engine.estimate) fed from what Relay has heard.

The last stop event comes from the driver's records (an arrival or a delivery Relay has applied) or a store's confirmed
receipt, which counts as a delivery at the receipt time; before the first stop it is the departure. The driver's phone
counts as out of contact once it has not reached Relay for a few minutes on a running trip. Nothing here writes: the
dispatcher, the store and the phone all read the same numbers through this module.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import (
    DeviceContact,
    FieldEvent,
    FieldEventKind,
    FieldEventOutcome,
    Order,
    Plan,
    Receipt,
    StopStatus,
    Trip,
    VehicleDay,
)
from relay_api.services import network as adapters
from relay_engine.clock import Conditions
from relay_engine.estimate import LastEvent, estimate_after, likely_range, position, round5
from relay_engine.network import Brand

SILENCE_MINUTES = 5
"""A running trip's phone counts as out of contact after this long without reaching Relay (it checks in each minute)."""


@dataclass
class StopEstimate:
    stop_id: uuid.UUID
    seq: int
    outlet_id: str
    status: StopStatus
    arrived_at: datetime | None = None
    delivered_at: datetime | None = None
    receipt_at: datetime | None = None
    estimate: datetime | None = None
    """Rounded to 5 minutes; None once the stop is done."""
    passed: bool = False
    """The estimate has gone by with no word; it is never pushed later."""
    range: tuple[datetime, datetime] | None = None
    """Only while the driver is out of contact."""

    @property
    def done(self) -> bool:
        return self.delivered_at is not None or self.receipt_at is not None or self.status is StopStatus.FAILED


@dataclass
class RunEstimate:
    trip_id: uuid.UUID
    last_kind: str | None
    last_at: datetime | None
    last_outlet_id: str | None
    last_contact_at: datetime | None
    out_of_contact: bool
    silent_minutes: int
    position: tuple[str, str | None]
    expected_back: datetime | None
    stops: list[StopEstimate] = field(default_factory=list)


def driver_of(db: Session, trip: Trip, run_date) -> uuid.UUID | None:  # type: ignore[no-untyped-def]
    day = db.scalar(select(VehicleDay).where(VehicleDay.vehicle_id == trip.vehicle_id, VehicleDay.run_date == run_date))
    return day.driver_id if day else None


def run_estimate(db: Session, trip: Trip, now: datetime, conditions: Conditions | None = None) -> RunEstimate:
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    run_date = plan.run_date
    net = adapters.network(db)
    conditions = conditions or adapters.conditions(db, run_date)
    stops = sorted((s for s in trip.stops if s.status is not StopStatus.CANCELLED), key=lambda s: s.seq)
    orders = {o.id: o for o in db.scalars(select(Order).where(Order.id.in_([s.order_id for s in stops])))}
    receipts = {
        r.order_id: r.confirmed_at for r in db.scalars(select(Receipt).where(Receipt.order_id.in_(list(orders))))
    }
    events = db.scalars(
        select(FieldEvent)
        .where(
            FieldEvent.trip_id == trip.id,
            FieldEvent.outcome == FieldEventOutcome.APPLIED,
            FieldEvent.kind.in_([FieldEventKind.ARRIVED, FieldEventKind.DELIVERED, FieldEventKind.FAILED]),
        )
        .order_by(FieldEvent.occurred_at)
    ).all()
    out = [StopEstimate(s.id, s.seq, s.outlet_id, s.status) for s in stops]
    by_stop = {e.stop_id: e for e in out}
    for event in events:
        row = by_stop.get(event.stop_id)  # type: ignore[arg-type]
        if row is None:
            continue
        if event.kind is FieldEventKind.ARRIVED:
            row.arrived_at = row.arrived_at or event.occurred_at
        else:
            row.delivered_at = event.occurred_at
    for s, row in zip(stops, out, strict=True):
        row.receipt_at = receipts.get(s.order_id)
        if s.status is StopStatus.DELIVERED and row.delivered_at is None:
            row.delivered_at = s.completed_at
        if s.status is StopStatus.ARRIVED and row.arrived_at is None:
            row.arrived_at = s.arrived_at

    # the last stop event: the furthest stop with anything recorded, its delivery before its arrival
    last: LastEvent | None = None
    last_dt: datetime | None = None
    for row in out:
        done_at = min((t for t in (row.delivered_at, row.receipt_at) if t is not None), default=None)
        if done_at is not None:
            last, last_dt = LastEvent("delivered", adapters.minutes_of(run_date, done_at), row.outlet_id), done_at
        elif row.arrived_at is not None:
            last, last_dt = (
                LastEvent("arrived", adapters.minutes_of(run_date, row.arrived_at), row.outlet_id),
                row.arrived_at,
            )
    if last is None and trip.departed_at is not None:
        last, last_dt = LastEvent("departed", adapters.minutes_of(run_date, trip.departed_at)), trip.departed_at

    contact = None
    driver_id = driver_of(db, trip, run_date)
    if driver_id is not None:
        contact = db.scalar(select(DeviceContact).where(DeviceContact.user_id == driver_id))
    running = trip.departed_at is not None and trip.finished_at is None
    last_contact = contact.last_contact_at if contact else None
    silent = _clock_minutes(now) - _clock_minutes(last_contact) if (running and last_contact) else 0
    out_of_contact = running and last_contact is not None and silent >= SILENCE_MINUTES

    brand = Brand(trip.brand)
    remaining = [row for row in out if not row.done and row.arrived_at is None]
    now_min = float(int(adapters.minutes_of(run_date, now)))  # the minute on the clock, as people read it
    if last is not None:
        times = estimate_after(net, conditions, brand, [r.outlet_id for r in remaining], last)
        for row, t in zip(remaining, times, strict=True):
            row.estimate = adapters.at_minutes(run_date, round5(t))
            row.passed = row.estimate < now
            if out_of_contact:
                low, high = likely_range(t, silent, now_min)
                row.range = (adapters.at_minutes(run_date, low), adapters.at_minutes(run_date, high))
        where = position(net, conditions, brand, last, [r.outlet_id for r in remaining], now_min)
    else:
        for row, s in zip(out, stops, strict=True):
            if not row.done and row.arrived_at is None:
                row.estimate = s.expected_arrival
        where = ("at_depot", None)
    return RunEstimate(
        trip_id=trip.id,
        last_kind=last.kind if last else None,
        last_at=last_dt,
        last_outlet_id=last.outlet_id if last else None,
        last_contact_at=last_contact,
        out_of_contact=out_of_contact,
        silent_minutes=silent,
        position=where,
        expected_back=trip.expected_back,
        stops=out,
    )


def _clock_minutes(moment: datetime) -> int:
    """Whole minutes on the clock, so 5:41 to 6:15 reads 34 minutes whatever the seconds."""
    return int(moment.timestamp() // 60)
