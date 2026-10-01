"""Live runs on the dispatcher's desk (DSP-04, DEG-03, DEG-05): every run of the depot's published plan, stop by stop,
built from the drivers' own records and the stores' receipts, never from tracking. Each row says when the phone last
reached Relay, so a silent run is never read as trouble or as progress; while a phone is silent, the stops still to
come show Relay's estimate and likely range from the one rule in services/estimates.py.
"""

from __future__ import annotations

import uuid
from dataclasses import asdict, dataclass, field
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import (
    Conflict,
    ConflictStatus,
    Plan,
    PlanStatus,
    Stop,
    StopStatus,
    Trip,
    TripStatus,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.services import network as adapters
from relay_api.services import words
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
    estimate: datetime | None = None
    range: tuple[datetime, datetime] | None = None
    passed: bool = False
    late_risk: bool = False
    receipt_at: datetime | None = None
    moved_to: str | None = None
    backup_of: str | None = None


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
    last_contact_at: datetime | None
    out_of_contact: bool
    silent_minutes: int
    position: str
    caption: str
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

    def as_dict(self) -> dict:  # type: ignore[type-arg]
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
    }
    for trip in sorted(trips, key=lambda t: (t.planned_depart, t.vehicle_id, t.trip_no)):
        estimate = run_estimate(db, trip, now, conditions)
        row = _row(db, look, plan, trip, estimate, conflicts, copies, now)
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


def _row(
    db: Session,
    look: Lookup,
    plan: Plan,
    trip: Trip,
    estimate: RunEstimate,
    conflicts: dict,  # type: ignore[type-arg]
    copies: dict,  # type: ignore[type-arg]
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
        if stop.id in conflicts:
            state = "conflict"
        if state == "pending" and e is not None and e.receipt_at is not None:
            state = "delivered"
        if state == "pending" and not next_marked and trip.departed_at is not None:
            state = "next"
            next_marked = True
        copy = copies.get(stop.id)
        marker = Marker(
            stop_id=str(stop.id),
            seq=stop.seq,
            outlet_id=stop.outlet_id,
            place=look.outlets[stop.outlet_id].short_name,
            state=state,
            planned=stop.planned_arrival,
            closes=closes,
            recorded=stop.completed_at or stop.arrived_at,
            estimate=e.estimate if e else None,
            range=e.range if e else None,
            passed=bool(e and e.passed),
            receipt_at=e.receipt_at if e else None,
            moved_to=db.get(Trip, copy.trip_id).vehicle_id if copy is not None else None,  # type: ignore[union-attr]
            backup_of=str(stop.backup_of) if stop.backup_of else None,
        )
        if marker.estimate is not None and marker.estimate > closes and state in ("next", "pending"):
            marker.late_risk = True
            late = True
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
        last_contact_at=estimate.last_contact_at,
        out_of_contact=estimate.out_of_contact,
        silent_minutes=estimate.silent_minutes,
        position=_position_text(look, estimate),
        caption=_caption(look, plan, trip, estimate, markers, driver.display_name if driver else None),
        delivered=delivered,
        stops=countable,
        attention=attention,
        markers=markers,
    )


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
    if trip.finished_at is not None:
        return f"Run finished at {words.clock(trip.finished_at)}."
    if trip.status is TripStatus.RETURNING:
        hub = DEPOT_LABEL.get(plan.depot, plan.depot)
        return f"Turned back to the {hub} at {words.clock(trip.turned_back_at or trip.planned_depart)}."
    if trip.departed_at is None:
        return f"Leaves {words.clock(trip.planned_depart)}."
    if estimate.out_of_contact and estimate.last_contact_at is not None:
        since = words.clock(estimate.last_contact_at)
        return f"No contact from {who} since {since}. {_position_text(look, estimate)}".strip()
    risky = [m for m in markers if m.late_risk]
    windows = (
        f"{risky[0].place} is expected after its {words.clock(risky[0].closes)} close."
        if risky
        else "Every stop is expected inside its window."
    )
    reached = [m for m in markers if m.recorded is not None and m.state in ("arrived", "delivered")]
    if not reached:
        return f"Left at {words.clock(trip.departed_at)}. {windows}"
    first = reached[-1]
    behind = round((first.recorded - first.planned).total_seconds() / 60)  # type: ignore[operator]
    against = f"{behind} min behind plan" if behind > 0 else f"{-behind} min ahead of plan" if behind < 0 else "on plan"
    verb = "Delivered at" if first.state == "delivered" else "Reached"
    return f"{verb} {first.place} at {words.clock(first.recorded)}, {against}. {windows}"  # type: ignore[arg-type]


def trip_uuid(value: str) -> uuid.UUID:
    return uuid.UUID(value)
