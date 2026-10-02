"""Changing a plan after it is published.

Once the plan is out, the dock is loading from it, drivers have their run sheets and stores have a time. A change
still happens (a store asks, a road closes), so Relay shows the dispatcher what it costs before it is confirmed,
and then tells everyone it touches: the dock sees a banner and moved tags, the driver's run updates, and each store
whose time moved gets the new one, on the vehicle's later trip too. A new order that breaks a rule on any trip of the
vehicle is refused, and so is one for a truck that is already loaded.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import (
    AppUser,
    AuditLog,
    CaseType,
    Handover,
    LoadLine,
    Notification,
    Order,
    Plan,
    PlanChange,
    PlanStatus,
    Stop,
    Trip,
    TripStatus,
)
from relay_api.schemas.common import Schema
from relay_api.services import network as adapters
from relay_api.services import words
from relay_api.services.dock import DEPOT_LABEL, Lookup, quiet_until
from relay_api.services.notify import notify_store
from relay_api.services.planning import PlanError, context, run_orders, stored_trips
from relay_engine.model import Trip as EngineTrip
from relay_engine.model import TripReport
from relay_engine.rules import evaluate


class StopShift(Schema):
    order_ref: str
    outlet_id: str
    place: str
    from_seq: int
    to_seq: int
    closes: str
    expected_before: datetime
    expected_after: datetime
    margin_before: int
    margin_after: int


class ReorderPreview(Schema):
    vehicle_id: str
    trip_no: int
    stops: list[StopShift]
    broken: list[str]
    costs: list[str]
    told: list[str]


@dataclass(frozen=True)
class _Retimed:
    """A store on the vehicle's later trip: that trip leaves once this one is back, so its expected time moves."""

    trip: Trip
    stop: Stop
    order: Order
    place: str
    before: datetime
    after: datetime


@dataclass(frozen=True)
class _Outcome:
    preview: ReorderPreview
    report: TripReport
    """The changed trip, timed in its new order."""
    others: list[tuple[Trip, TripReport]]
    """The vehicle's other trips, timed after the change."""
    retimed: list[_Retimed]


def preview_reorder(db: Session, plan: Plan, trip: Trip, order_refs: Sequence[str]) -> ReorderPreview:
    """What a new stop order costs, with the departure kept: each store's expected time and margin, before and
    after, the rules it would break on any of the vehicle's trips, and who Relay will tell."""
    return _work_out(db, plan, trip, order_refs).preview


def _ensure_open(db: Session, trip: Trip) -> None:
    """The truck is packed for the stop order (the last stop goes in first), so a new order can only reach a load
    that is still open. The dock locks a load the same way once it is marked complete."""
    if trip.departed_at is not None:
        raise PlanError(f"{trip.vehicle_id} has left the hub. Change its run from Live runs.")
    handover = db.scalar(select(Handover).where(Handover.trip_id == trip.id))
    if trip.status is TripStatus.LOADED or (handover is not None and handover.completed_at is not None):
        raise PlanError(
            f"{trip.vehicle_id} is already loaded for this stop order. A new order would mean unloading the truck, "
            "so Relay keeps this one."
        )


def _work_out(db: Session, plan: Plan, trip: Trip, order_refs: Sequence[str]) -> _Outcome:
    if plan.status is not PlanStatus.PUBLISHED:
        raise PlanError("Change the stop order on the board until the plan is published.")
    _ensure_open(db, trip)
    look = Lookup(db)
    orders = run_orders(db, plan.depot, plan.run_date)
    by_id = {o.id: o for o in orders}
    stops = sorted(trip.stops, key=lambda s: s.seq)
    current = [by_id[s.order_id].order_ref for s in stops]
    if sorted(order_refs) != sorted(current):
        raise PlanError("The new order must keep the same stops.")
    ctx = context(db, plan, orders)
    trips = [
        t
        if t.key != (trip.vehicle_id, trip.trip_no)
        else EngineTrip(t.vehicle_id, t.trip_no, list(order_refs), t.depart)
        for t in stored_trips(db, plan)
    ]
    reports, _ = evaluate(ctx, trips)
    # the vehicle's trips run one after another, so a trip that comes back later can break the next one's rules
    mine = {r.trip.trip_no: r for r in reports if r.trip.vehicle_id == trip.vehicle_id}
    report = mine[trip.trip_no]
    after = {e.order_id: e for e in report.expected}
    shifts = []
    for stop in stops:
        order = by_id[stop.order_id]
        outlet = look.outlets[stop.outlet_id]
        close = ctx.network.outlets[stop.outlet_id].receiving_window[1]
        before_min = adapters.minutes_of(plan.run_date, stop.expected_arrival or stop.planned_arrival)
        after_min = after[order.order_ref].arrive
        shifts.append(
            StopShift(
                order_ref=order.order_ref,
                outlet_id=stop.outlet_id,
                place=outlet.short_name,
                from_seq=stop.seq,
                to_seq=list(order_refs).index(order.order_ref) + 1,
                closes=words.clock(adapters.at_minutes(plan.run_date, close)),
                expected_before=stop.expected_arrival or stop.planned_arrival,
                expected_after=adapters.at_minutes(plan.run_date, after_min),
                margin_before=round(close - before_min),
                margin_after=round(close - after_min),
            )
        )
    others = [
        (t, mine[t.trip_no])
        for t in db.scalars(
            select(Trip)
            .where(
                Trip.plan_id == plan.id,
                Trip.vehicle_id == trip.vehicle_id,
                Trip.id != trip.id,
                Trip.is_backup.is_(False),
            )
            .order_by(Trip.trip_no)
        )
        if t.trip_no in mine
    ]
    retimed = []
    for other, other_report in others:
        if other.trip_no < trip.trip_no:
            continue  # an earlier trip is back before this one leaves
        expected = {e.order_id: e for e in other_report.expected}
        for stop in sorted(other.stops, key=lambda s: s.seq):
            order = by_id[stop.order_id]
            was = stop.expected_arrival or stop.planned_arrival
            will = adapters.at_minutes(plan.run_date, expected[order.order_ref].arrive)
            if will != was:
                retimed.append(_Retimed(other, stop, order, look.outlets[stop.outlet_id].short_name, was, will))

    costs = []
    dropped = [s for s in shifts if s.margin_after < s.margin_before]
    if dropped:
        worst = min(dropped, key=lambda s: s.margin_after)
        if worst.margin_after >= 0:
            costs.append(
                f"{worst.place}'s expected margin before its {worst.closes} close drops from "
                f"{worst.margin_before} to {worst.margin_after} min."
            )
        else:
            costs.append(f"{worst.place} is now expected {-worst.margin_after} min after its {worst.closes} close.")
    for s in shifts:
        if s.from_seq != s.to_seq:
            costs.append(
                f"{s.place} becomes stop {s.to_seq}: expected {words.clock(s.expected_after)}, "
                f"was {words.clock(s.expected_before)}."
            )
    for r in retimed:
        costs.append(
            f"{r.place} on trip {r.trip.trip_no}: expected {words.clock(r.after)}, was {words.clock(r.before)}."
        )

    told = []
    if trip.brand == "Fresh":  # the night loads are the ones the dock tablet lists, banner included
        told.append(f"The {DEPOT_LABEL.get(plan.depot, plan.depot)} dock sees the new loading order.")
    driver = look.driver_of(trip, plan.run_date)
    if driver is not None:
        told.append(f"{driver.display_name}'s run sheet updates.")
    moving = [(s.outlet_id, s.place, s.expected_before, s.expected_after) for s in shifts]
    moving += [(r.stop.outlet_id, r.place, r.before, r.after) for r in retimed]
    for outlet_id, place, was, will in moving:
        if words.round5(will) != words.round5(was):
            manager = look.store_manager(outlet_id)
            who = manager.display_name if manager else f"{outlet_id} {place}"
            told.append(f"{who} is told the new time, around {words.clock(words.round5(will))}.")

    preview = ReorderPreview(
        vehicle_id=trip.vehicle_id,
        trip_no=trip.trip_no,
        stops=sorted(shifts, key=lambda s: s.to_seq),
        broken=[b.message for b in report.broken]
        + [f"Trip {r.trip.trip_no}: {b.message}" for _, r in others for b in r.broken],
        costs=costs,
        told=told,
    )
    return _Outcome(preview, report, others, retimed)


def reorder(
    db: Session, now: datetime, plan: Plan, trip: Trip, order_refs: Sequence[str], user: AppUser | None, note: str
) -> PlanChange:
    """Apply what the preview showed: the trip's new times and loading order, the later trip's expected times, and
    a word to the driver and to every store whose time moved."""
    outcome = _work_out(db, plan, trip, order_refs)
    preview = outcome.preview
    if preview.broken:
        raise PlanError(f"This order breaks a rule: {preview.broken[0]}")
    moved = [s for s in preview.stops if s.from_seq != s.to_seq]
    if not moved:
        raise PlanError("The stops are already in this order.")
    look = Lookup(db)
    by_ref = {s.order_ref: s for s in preview.stops}
    orders = {o.id: o for o in db.scalars(select(Order).where(Order.id.in_([s.order_id for s in trip.stops])))}
    report = outcome.report
    planned = {p.order_id: p for p in report.planned}
    for stop in trip.stops:
        ref = orders[stop.order_id].order_ref
        shift = by_ref[ref]
        if stop.seq != shift.to_seq:
            stop.version += 1
        stop.seq = shift.to_seq
        stop.planned_arrival = adapters.at_minutes(plan.run_date, planned[ref].arrive)
        stop.expected_arrival = shift.expected_after
    trip.planned_back = adapters.at_minutes(plan.run_date, report.back)
    trip.expected_back = adapters.at_minutes(plan.run_date, report.expected_back)
    for other, other_report in outcome.others:
        if other.trip_no > trip.trip_no:
            other.expected_back = adapters.at_minutes(plan.run_date, other_report.expected_back)
    for r in outcome.retimed:
        r.stop.expected_arrival = r.after
    _reload_order(db, trip, {s.order_ref for s in moved}, orders)

    if len(moved) == 2:
        a, b = sorted(moved, key=lambda s: s.from_seq)
        summary = f"{trip.vehicle_id} stops {a.from_seq} and {b.from_seq} swapped"
    else:
        summary = f"{trip.vehicle_id} stop order changed"
    change = PlanChange(
        plan_id=plan.id,
        trip_id=trip.id,
        kind="stops_reordered",
        summary=summary,
        detail={
            "moves": [
                {
                    "order_ref": s.order_ref,
                    "outlet_id": s.outlet_id,
                    "place": s.place,
                    "from": s.from_seq,
                    "to": s.to_seq,
                    "expected_before": s.expected_before.isoformat(),
                    "expected_after": s.expected_after.isoformat(),
                }
                for s in moved
            ],
            "retimed": [
                {
                    "order_ref": r.order.order_ref,
                    "outlet_id": r.stop.outlet_id,
                    "place": r.place,
                    "trip_no": r.trip.trip_no,
                    "expected_before": r.before.isoformat(),
                    "expected_after": r.after.isoformat(),
                }
                for r in outcome.retimed
            ],
            "note": note,
            "costs": preview.costs,
        },
        created_at=now,
        created_by=user.id if user else None,
    )
    db.add(change)
    plan.version += 1

    by_order_ref = {o.order_ref: o for o in orders.values()}
    moving = [(by_order_ref[s.order_ref], s.expected_before, s.expected_after) for s in preview.stops]
    moving += [(r.order, r.before, r.after) for r in outcome.retimed]
    for order, was, will in moving:
        old, new = words.round5(was), words.round5(will)
        if old == new:
            continue
        kind = "chilled" if order.temp == "chilled" else "dry" if order.brand == "Fresh" else order.brand
        way = "earlier" if new < old else "later"
        outlet = look.outlets[order.outlet_id]
        notify_store(
            db,
            order.outlet_id,
            now,
            kind="order_moved",
            title=f"Your {kind} order now comes {way}",
            body=f"Your {kind} order {order.order_ref} is now expected {way}, around {words.clock(new)}. "
            f"Your window is still {words.window(outlet.window_open, outlet.window_close)}.",
            data={
                "order_ref": order.order_ref,
                "expected": new.isoformat(),
                "previous": old.isoformat(),
                "direction": way,
                "change_id": str(change.id),
            },
            show_after=quiet_until(now),
        )
    driver = look.driver_of(trip, plan.run_date)
    if driver is not None:
        db.add(
            Notification(
                user_id=driver.id,
                kind="run_changed",
                title=f"Your run changed: {summary.split(' ', 1)[1]}",
                body=" ".join(f"{s.place} is now stop {s.to_seq}." for s in moved),
                data={"trip_id": str(trip.id), "change_id": str(change.id)},
                created_at=now,
                show_after=now,
            )
        )
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id if user else None,
            actor_label=user.display_name if user else "Relay",
            action="plan.changed",
            entity="trip",
            entity_id=str(trip.id),
            summary=f"{summary}{f'. {note}' if note else ''}",
            data={"costs": preview.costs},
        )
    )
    return change


def _reload_order(db: Session, trip: Trip, moved_refs: set[str], orders: dict[uuid.UUID, Order]) -> None:
    """Loading order follows the new stop order: the last stop first, heaviest case type first. A line already on
    the truck for a stop that moved is marked, because it may sit in the wrong place."""
    ranks = {c.code: c.load_rank for c in db.scalars(select(CaseType))}
    lines = db.scalars(select(LoadLine).where(LoadLine.trip_id == trip.id)).all()
    seq_of = {s.id: s.seq for s in trip.stops}
    ref_of = {s.id: orders[s.order_id].order_ref for s in trip.stops}
    ordered = sorted(lines, key=lambda line: (-seq_of[line.stop_id], ranks.get(line.case_type, 9), line.load_order))
    for n, line in enumerate(ordered, start=1):
        line.load_order = n
        if ref_of[line.stop_id] in moved_refs and line.loaded_qty > 0:
            line.changed_by_plan = True
