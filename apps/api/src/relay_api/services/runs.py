"""Live runs on the dispatcher's desk (DSP-04, DEG-03, DEG-05): every run of the depot's published plan, stop by stop,
built from the drivers' own records and the stores' receipts, never from tracking. Each row says when the phone last
reached Relay, so a silent run is never read as trouble or as progress; while a phone is silent, the stops still to
come show Relay's estimate and likely range from the one rule in services/estimates.py.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import (
    Conflict,
    ConflictStatus,
    FieldEvent,
    FieldEventKind,
    FieldEventOutcome,
    Plan,
    PlanStatus,
    ProblemReason,
    ProblemReport,
    Stop,
    StopStatus,
    Trip,
    TripStatus,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.services import backup, words
from relay_api.services import network as adapters
from relay_api.services.dock import DEPOT_LABEL, Lookup
from relay_api.services.estimates import RunEstimate, run_estimate
from relay_api.services.ordering import current_run


@dataclass
class Marker:
    stop_id: str
    seq: int
    outlet_id: str
    place: str
    state: str
    """delivered, arrived, failed, moved, conflict, cancelled, next, pending"""
    planned: datetime
    closes: datetime
    recorded: datetime | None = None
    arrived: datetime | None = None
    estimate: datetime | None = None
    range: tuple[datetime, datetime] | None = None
    passed: bool = False
    late_risk: bool = False
    receipt_at: datetime | None = None
    moved_to: str | None = None
    backup_of: str | None = None
    held: datetime | None = None
    """While the stop has two copies: when the driver's phone says it was delivered, held until it is settled."""
    denied: bool = False
    """While the stop has two copies: the driver answered no, so the delivery the phone holds was not made."""
    store_contact: str | None = None
    """The store's manager, who reads the same estimate."""
    handed_over: bool = False
    """A moved stop that is now the backup's alone: its two-copy question was settled by keeping the backup's copy."""


@dataclass
class RunRow:
    trip_id: str
    vehicle_id: str
    trip_no: int
    is_backup: bool
    vehicle_kind: str
    driver: str | None
    district: str
    temp: str
    brand: str
    status: str
    planned_depart: datetime
    departed_at: datetime | None
    finished_at: datetime | None
    """When the driver tapped Finish trip, often at the last store's dock: never read as back at the hub."""
    expected_back: datetime | None
    """When the hub expects the vehicle back, the same time the driver's phone shows. Relay never records the return."""
    last_contact_at: datetime | None
    out_of_contact: bool
    silent_minutes: int
    position: str
    caption: str
    risk: str
    """Every stop still to come that is expected after its close, in words; empty when none is. The desk says a
    later trip's risk with it."""
    delivered: int
    stops: int
    attention: int
    """0 nothing, 1 watch, 2 needs the dispatcher: sorts the panel."""
    markers: list[Marker] = field(default_factory=list)


@dataclass
class Panel:
    depot: str
    depot_label: str
    run_date: str
    published: bool
    now: datetime
    running: int
    delivered: int
    stops: int
    out_of_contact: int
    standby_free: int
    standby: list[str]
    rows: list[RunRow]

    def as_dict(self) -> dict[str, Any]:
        return asdict(self)


def panel(db: Session, now: datetime, depot: str) -> Panel:
    run_date = current_run(db, now)
    plan = db.scalar(select(Plan).where(Plan.depot == depot, Plan.run_date == run_date))
    look = Lookup(db)
    out = Panel(
        depot=depot,
        depot_label=DEPOT_LABEL.get(depot, depot),
        run_date=run_date.isoformat(),
        published=bool(plan and plan.status is PlanStatus.PUBLISHED),
        now=now,
        running=0,
        delivered=0,
        stops=0,
        out_of_contact=0,
        standby_free=0,
        standby=[],
        rows=[],
    )
    if plan is None or plan.status is not PlanStatus.PUBLISHED:
        return out
    conditions = adapters.conditions(db, run_date)
    trips = [
        t
        for t in db.scalars(select(Trip).where(Trip.plan_id == plan.id))
        if t.brand == "Fresh" and t.status is not TripStatus.CANCELLED
    ]
    conflicts = {c.stop_id: c for c in db.scalars(select(Conflict).where(Conflict.status != ConflictStatus.RESOLVED))}
    copies = {
        s.backup_of: s
        for s in db.scalars(select(Stop).where(Stop.backup_of.is_not(None), Stop.status != StopStatus.CANCELLED))
        if s.backup_of is not None
    }
    handed = set(
        db.scalars(
            select(Conflict.stop_id).where(Conflict.status == ConflictStatus.RESOLVED, Conflict.resolution == "backup")
        )
    )
    for trip in sorted(trips, key=lambda t: (t.planned_depart, t.vehicle_id, t.trip_no)):
        estimate = run_estimate(db, trip, now, conditions)
        row = _row(db, look, plan, trip, estimate, Seen(conflicts, copies, handed), now)
        out.rows.append(row)
        if trip.departed_at is not None and trip.finished_at is None:
            out.running += 1
        if estimate.out_of_contact:
            out.out_of_contact += 1
        if not trip.is_backup:
            out.stops += row.stops
            out.delivered += row.delivered
    busy = {t.vehicle_id for t in trips if t.is_backup and t.finished_at is None}
    for day in db.scalars(
        select(VehicleDay).where(VehicleDay.run_date == run_date, VehicleDay.status == VehicleDayStatus.STANDBY)
    ):
        vehicle = look.vehicles.get(day.vehicle_id)
        if vehicle is None or vehicle.depot != depot:
            continue
        out.standby.append(day.vehicle_id)
        if day.vehicle_id not in busy:
            out.standby_free += 1
    out.rows.sort(key=lambda r: (-r.attention, r.planned_depart, r.vehicle_id, r.trip_no))
    return out


@dataclass
class Seen:
    """What the panel reads once for every row: open two-copy questions, the backups' live copies and the moved
    stops settled in the backup's favour, each by the stop they are about."""

    conflicts: dict[uuid.UUID, Conflict]
    copies: dict[uuid.UUID, Stop]
    handed: set[uuid.UUID]


def _row(
    db: Session,
    look: Lookup,
    plan: Plan,
    trip: Trip,
    estimate: RunEstimate,
    seen: Seen,
    now: datetime,
) -> RunRow:
    net = adapters.network(db)
    vehicle = look.vehicles[trip.vehicle_id]
    driver = look.driver_of(trip, plan.run_date)
    by_id = {e.stop_id: e for e in estimate.stops}
    markers: list[Marker] = []
    next_marked = False
    late = False
    for stop in sorted(trip.stops, key=lambda s: s.seq):
        e = by_id.get(stop.id)
        close_min = net.outlets[stop.outlet_id].receiving_window[1]
        closes = adapters.at_minutes(plan.run_date, close_min)
        state = {
            StopStatus.DELIVERED: "delivered",
            StopStatus.ARRIVED: "arrived",
            StopStatus.FAILED: "failed",
            StopStatus.MOVED: "moved",
            StopStatus.CANCELLED: "cancelled",
        }.get(stop.status, "pending")
        conflict = seen.conflicts.get(stop.id)
        if conflict is not None:
            state = "conflict"
        if state == "pending" and e is not None and e.receipt_at is not None:
            state = "delivered"
        if state == "pending" and not next_marked and trip.departed_at is not None:
            state = "next"
            next_marked = True
        copy = seen.copies.get(stop.id)
        manager = look.store_manager(stop.outlet_id)
        # the desk shows Expected to the minute; while the phone is silent it says "around" with the store's time
        shown = (e.estimate if estimate.out_of_contact else e.exact) if e else None
        marker = Marker(
            stop_id=str(stop.id),
            seq=stop.seq,
            outlet_id=stop.outlet_id,
            place=look.outlets[stop.outlet_id].short_name,
            state=state,
            planned=stop.planned_arrival,
            closes=closes,
            recorded=stop.completed_at or stop.arrived_at,
            arrived=stop.arrived_at,
            estimate=shown,
            range=e.range if e else None,
            passed=shown is not None and shown < now,
            receipt_at=e.receipt_at if e else None,
            moved_to=backup.carrier(db, copy),
            backup_of=str(stop.backup_of) if stop.backup_of else None,
            denied=conflict is not None and conflict.answer == "no",
            handed_over=state == "moved" and stop.id in seen.handed,
            store_contact=manager.display_name if manager else None,
        )
        if marker.estimate is not None and marker.estimate > closes and state in ("next", "pending"):
            marker.late_risk = True
            late = True
        if state == "conflict":
            marker.held = db.scalar(
                select(FieldEvent.occurred_at)
                .where(
                    FieldEvent.stop_id == stop.id,
                    FieldEvent.kind == FieldEventKind.DELIVERED,
                    FieldEvent.outcome == FieldEventOutcome.CONFLICT,
                )
                .order_by(FieldEvent.occurred_at.desc())
                .limit(1)
            )
        markers.append(marker)
    delivered = sum(1 for m in markers if m.state == "delivered")
    countable = sum(1 for m in markers if m.state not in ("cancelled",))
    attention = 2 if (estimate.out_of_contact or any(m.state == "conflict" for m in markers)) else 1 if late else 0
    status = trip.status.value
    if trip.departed_at and not trip.finished_at and trip.status is not TripStatus.RETURNING:
        status = "on_the_road"
    return RunRow(
        trip_id=str(trip.id),
        vehicle_id=trip.vehicle_id,
        trip_no=trip.trip_no,
        is_backup=trip.is_backup,
        vehicle_kind=words.vehicle_kind(vehicle.type, vehicle.temp),
        driver=driver.display_name if driver else None,
        district=trip.district,
        temp=trip.temp,
        brand=trip.brand,
        status=status,
        planned_depart=trip.planned_depart,
        departed_at=trip.departed_at,
        finished_at=trip.finished_at,
        expected_back=_expected_back(trip, estimate),
        last_contact_at=estimate.last_contact_at,
        out_of_contact=estimate.out_of_contact,
        silent_minutes=estimate.silent_minutes,
        position=_position_text(look, estimate),
        caption=_caption(look, plan, trip, estimate, markers, driver.display_name if driver else None),
        risk=late_words([m for m in markers if m.late_risk]),
        delivered=delivered,
        stops=countable,
        attention=attention,
        markers=markers,
    )


def _expected_back(trip: Trip, estimate: RunEstimate) -> datetime | None:
    """When the hub expects the vehicle back. A trip that turned back is no longer the run that time was made for."""
    return None if trip.turned_back_at is not None else estimate.expected_back


def _position_text(look: Lookup, estimate: RunEstimate) -> str:
    kind, outlet_id = estimate.position
    place = look.outlets[outlet_id].short_name if outlet_id else ""
    if kind == "unloading":
        return f"Probably still unloading at {place}."
    if kind == "on_the_road":
        return f"Probably on the road to {place}."
    return ""


def _caption(
    look: Lookup, plan: Plan, trip: Trip, estimate: RunEstimate, markers: list[Marker], driver: str | None
) -> str:
    who = driver.split()[0] if driver else trip.vehicle_id
    hub = DEPOT_LABEL.get(plan.depot, plan.depot)
    if trip.finished_at is not None:
        # Finish trip is tapped at the last dock: the way home is still Relay's estimate, never a record
        finished = f"Trip finished at {words.clock(trip.finished_at)}."
        back = _expected_back(trip, estimate)
        if back is not None and back > trip.finished_at:
            return f"{finished} Expected back at the {hub} around {words.clock(words.round5(back))}."
        return finished
    if trip.status is TripStatus.RETURNING:
        return f"Turned back to the {hub} at {words.clock(trip.turned_back_at or trip.planned_depart)}."
    if trip.departed_at is None:
        return f"Leaves {words.clock(trip.planned_depart)}."
    if estimate.out_of_contact and estimate.last_contact_at is not None:
        since = words.clock(estimate.last_contact_at)
        return f"No contact from {who} since {since}. {_position_text(look, estimate)}".strip()
    to_come = [m for m in markers if m.state in ("next", "pending")]
    clash = next((m for m in markers if m.state == "conflict"), None)
    if clash is not None:
        if clash.denied:
            return (
                f"{who} says stop {clash.seq}, {clash.place}, was not delivered. It has two copies until it is settled."
            )
        return f"Stop {clash.seq}, {clash.place}, has two copies until it is settled."
    if not to_come:
        # still unloading at the last stop is not on the way back yet
        here = next((m for m in markers if m.state == "arrived"), None)
        if here is not None and here.arrived is not None:
            return f"Reached {here.place}, the last stop, at {words.clock(here.arrived)}."
        # Finish trip is tapped at the last dock, so until it is, nothing says the truck has left
        handed = "".join(f" Stop {m.seq} is with {m.moved_to}." for m in markers if m.handed_over)
        return f"Every stop is done.{handed} {who} has not finished the trip yet."
    risky = [m for m in to_come if m.late_risk]
    windows = late_words(risky) or "Every stop still to come is expected inside its window."
    delay = look.db.scalar(
        select(ProblemReport)
        .where(ProblemReport.trip_id == trip.id, ProblemReport.reason == ProblemReason.DELAYED)
        .order_by(ProblemReport.reported_at.desc())
        .limit(1)
    )
    if delay is not None and delay.delay_min:
        places = ", ".join(m.place for m in to_come)
        stay = "stays inside its window" if len(to_come) == 1 else "stay inside their windows"
        tail = windows if risky else f"{places} {stay}."
        return f"{who} reported a {delay.delay_min} min delay at {words.clock(delay.reported_at)}. {tail}"
    reached = [(m, m.arrived) for m in markers if m.arrived is not None and m.state in ("arrived", "delivered")]
    if not reached:
        return f"Left at {words.clock(trip.departed_at)}. {windows}"
    last, arrived = reached[-1]
    behind = round((arrived - last.planned).total_seconds() / 60)
    against = f"{behind} min behind plan" if behind > 0 else f"{-behind} min ahead of plan" if behind < 0 else "on plan"
    return f"Reached {last.place} at {words.clock(arrived)}, {against}. {windows}"


def late_words(risky: list[Marker]) -> str:
    """Every stop expected after its close, by name: "Aranayake is expected after its 7:30 AM close.", "Suduhumpola
    and Ampitiya are expected after their 7:45 AM and 8:00 AM closes." Empty when none is."""
    if not risky:
        return ""
    if len(risky) == 1:
        return f"{risky[0].place} is expected after its {words.clock(risky[0].closes)} close."
    closes = [words.clock(m.closes) for m in risky]
    if len(set(closes)) == 1:
        return f"{_and([m.place for m in risky])} are expected after their {closes[0]} close."
    return f"{_and([m.place for m in risky])} are expected after their {_and(closes)} closes."


def _and(names: list[str]) -> str:
    return names[0] if len(names) == 1 else f"{', '.join(names[:-1])} and {names[-1]}"


def trip_uuid(value: str) -> uuid.UUID:
    return uuid.UUID(value)
