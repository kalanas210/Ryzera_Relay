"""Sending a stop with a backup vehicle while its driver is out of contact (DEG-03), and what becomes of the backup.

The dispatcher sees how long a run has been silent and when each store can expect it, picks a free vehicle, and
Relay checks the move against the same rules as the plan: the vehicle's temperature and access, its room, and whether
it can reach the store before the window closes. The original stop is marked moved and its version goes up, so a
record the silent phone later sends for it is recognised as a clash and settled with one question. The backup is
picked at the dock like any other load; when the original driver turns out to have delivered, the backup's copy is
withdrawn: a backup still at the dock is cancelled, one on the road turns back.
"""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from relay_api.models import (
    AppUser,
    AuditLog,
    CaseType,
    FeedItem,
    FeedKind,
    LoadLine,
    Notification,
    Order,
    Outlet,
    Plan,
    PlanChange,
    Stop,
    StopStatus,
    Trip,
    TripStatus,
    Vehicle,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.services import field as records
from relay_api.services import network as adapters
from relay_api.services import words
from relay_api.services.dock import DEPOT_LABEL, Lookup
from relay_api.services.notify import add_feed_item, notify_store
from relay_engine.clock import expected, free_flow
from relay_engine.network import Brand, DockType
from relay_engine.rules import trip_litres
from relay_engine.standard import trip_minutes

PICK_RATE = 4.0
"""Cases a minute when the dock picks a backup load."""


class BackupError(Exception):
    """A move Relay cannot make, in words for the dispatcher."""


@dataclass
class Option:
    vehicle_id: str
    vehicle_kind: str
    driver: str | None
    status: str
    """standby, available or busy"""
    departs: datetime
    arrives: datetime
    """Expected, to the minute."""
    closes: datetime
    fits: bool
    blocked: list[str]
    checks: list[str]
    weight_kg: float
    volume_m3: float
    weight_cap_kg: float
    volume_cap_m3: float


def _stop_load(db: Session, stop: Stop) -> tuple[int, float, float, list[LoadLine]]:
    lines = list(db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id).order_by(LoadLine.load_order)))
    types = {c.code: c for c in db.scalars(select(CaseType))}
    cases = sum(line.loaded_qty or line.planned_qty for line in lines)
    kg = round(sum((line.loaded_qty or line.planned_qty) * types[line.case_type].kg for line in lines), 1)
    m3 = round(sum((line.loaded_qty or line.planned_qty) * types[line.case_type].m3 for line in lines), 3)
    return cases, kg, m3, lines


def _busy(db: Session, plan: Plan, vehicle_id: str, now: datetime) -> bool:
    """On the road now (a finished trip too, until it is back from its last stop), or about to leave on a trip of
    its own."""
    for trip in db.scalars(select(Trip).where(Trip.plan_id == plan.id, Trip.vehicle_id == vehicle_id)):
        if trip.status is TripStatus.FINISHED:
            back = records.back_at_hub(trip)
            if back is not None and back > now:
                return True
            continue
        if trip.status is TripStatus.CANCELLED:
            continue
        if trip.departed_at is not None and trip.finished_at is None:
            return True
        if trip.departed_at is None and trip.planned_depart <= now + timedelta(hours=1):
            return True
    return False


def move_options(db: Session, now: datetime, trip: Trip, stop: Stop) -> list[Option]:
    """Every vehicle of the depot that could take the stop now, best first, with why the others cannot."""
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    net = adapters.network(db)
    conditions = adapters.conditions(db, plan.run_date)
    look = Lookup(db)
    outlet = net.outlets[stop.outlet_id]
    order = db.get(Order, stop.order_id)
    assert order is not None
    cases, kg, m3, _ = _stop_load(db, stop)
    days = {d.vehicle_id: d for d in db.scalars(select(VehicleDay).where(VehicleDay.run_date == plan.run_date))}
    vehicles = db.scalars(select(Vehicle).where(Vehicle.depot == plan.depot).order_by(Vehicle.vehicle_id)).all()
    brand = Brand(trip.brand)
    pick = max(10, math.ceil(cases / PICK_RATE))
    depart_min = adapters.minutes_of(plan.run_date, now) + pick
    out = []
    for vehicle in vehicles:
        if vehicle.vehicle_id == trip.vehicle_id:
            continue
        day = days.get(vehicle.vehicle_id)
        status = day.status.value if day else "available"
        if status == VehicleDayStatus.WORKSHOP.value:
            continue
        blocked, checks = [], []
        if order.temp == "chilled" and vehicle.temp != "reefer":
            blocked.append("Chilled goods need a refrigerated vehicle.")
        if outlet.van_only and vehicle.type != "van":
            blocked.append(f"{stop.outlet_id} takes vans only.")
        if kg > vehicle.weight_cap_kg or m3 > vehicle.volume_cap_m3:
            blocked.append("Not enough room for the load.")
        busy = _busy(db, plan, vehicle.vehicle_id, now)
        if busy:
            blocked.append("Already on a run.")
        rows, _ = expected(net, conditions, [stop.outlet_id], depart_min, brand)
        arrive = rows[0].arrive
        close = outlet.receiving_window[1]
        arrive_text = words.clock(adapters.at_minutes(plan.run_date, arrive))
        close_text = words.clock(adapters.at_minutes(plan.run_date, close))
        if arrive > close:
            checks.append(f"Expected {arrive_text}, after the {close_text} close.")
        else:
            checks.append(f"Expected {arrive_text}, {round(close - arrive)} min before the {close_text} close.")
        checks.append(f"{words.cases('Case', cases)}, {kg:,.1f} of {vehicle.weight_cap_kg:,.0f} kg.")
        driver = look.users.get(day.driver_id) if day and day.driver_id else None
        out.append(
            Option(
                vehicle_id=vehicle.vehicle_id,
                vehicle_kind=words.vehicle_kind(vehicle.type, vehicle.temp),
                driver=driver.display_name if driver else None,
                status="busy" if busy else status,
                departs=adapters.at_minutes(plan.run_date, depart_min),
                arrives=adapters.at_minutes(plan.run_date, arrive),
                closes=adapters.at_minutes(plan.run_date, close),
                fits=not blocked,
                blocked=blocked,
                checks=checks,
                weight_kg=kg,
                volume_m3=m3,
                weight_cap_kg=vehicle.weight_cap_kg,
                volume_cap_m3=vehicle.volume_cap_m3,
            )
        )
    return sorted(out, key=lambda o: (not o.fits, o.status != "standby", o.arrives, o.vehicle_id))


def move_stop(db: Session, now: datetime, user: AppUser | None, stop: Stop, vehicle_id: str, reason: str) -> Trip:
    """Send one stop with another vehicle. The original driver keeps the rest of the run."""
    trip = db.get(Trip, stop.trip_id)
    assert trip is not None
    if stop.status not in (StopStatus.PENDING, StopStatus.ARRIVED):
        raise BackupError(f"Stop {stop.seq} is {stop.status.value}; only a stop still to come can move.")
    if trip.departed_at is None:
        raise BackupError("The trip has not left yet. Change it on the plan board instead.")
    if not reason.strip():
        raise BackupError("Say why, for the record.")
    option = next((o for o in move_options(db, now, trip, stop) if o.vehicle_id == vehicle_id), None)
    if option is None or not option.fits:
        raise BackupError(option.blocked[0] if option and option.blocked else f"{vehicle_id} cannot take this stop.")
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    net = adapters.network(db)
    conditions = adapters.conditions(db, plan.run_date)
    brand = Brand(trip.brand)
    depart_min = adapters.minutes_of(plan.run_date, option.departs)
    planned_rows, back = free_flow(net, [stop.outlet_id], depart_min, brand)
    _, expected_back = expected(net, conditions, [stop.outlet_id], depart_min, brand)
    trip_no = (
        db.scalar(select(func.max(Trip.trip_no)).where(Trip.plan_id == plan.id, Trip.vehicle_id == vehicle_id)) or 0
    ) + 1
    outlet = net.outlets[stop.outlet_id]
    backup = Trip(
        plan_id=plan.id,
        vehicle_id=vehicle_id,
        trip_no=trip_no,
        brand=trip.brand,
        temp=trip.temp,
        district=trip.district,
        planned_depart=option.departs,
        planned_back=adapters.at_minutes(plan.run_date, back),
        expected_back=adapters.at_minutes(plan.run_date, expected_back),
        std_minutes=trip_minutes(net, trip.district, brand, [DockType(outlet.dock_type)]),
        fuel_l=round(trip_litres(net, vehicle_id, trip.district, 1), 1),
        status=TripStatus.PLANNED,
        is_backup=True,
        note=f"Backup for {trip.vehicle_id} stop {stop.seq}: {reason.strip()}",
    )
    backup.stops = [
        Stop(
            order_id=stop.order_id,
            outlet_id=stop.outlet_id,
            seq=1,
            planned_arrival=adapters.at_minutes(plan.run_date, planned_rows[0].arrive),
            expected_arrival=option.arrives,
            backup_of=stop.id,
        )
    ]
    db.add(backup)
    db.flush()
    _, _, _, lines = _stop_load(db, stop)
    types = {c.code: c for c in db.scalars(select(CaseType))}
    for n, line in enumerate(sorted(lines, key=lambda x: (types[x.case_type].load_rank, x.load_order)), start=1):
        db.add(
            LoadLine(
                trip_id=backup.id,
                stop_id=backup.stops[0].id,
                case_type=line.case_type,
                load_order=n,
                planned_qty=line.loaded_qty or line.planned_qty,
            )
        )
    stop.status = StopStatus.MOVED
    stop.version += 1
    stop.reason = reason.strip()

    look = Lookup(db)
    place = look.outlets[stop.outlet_id].short_name
    cases, _, _, _ = _stop_load(db, stop)
    driver = look.driver_of(trip, plan.run_date)
    backup_driver = look.driver_of(backup, plan.run_date)
    by = user.display_name if user else "The dispatcher"
    if driver is not None:
        _tell_driver(
            db,
            now,
            driver,
            "stop_moved",
            f"Stop {stop.seq} moved to {vehicle_id} at {words.clock(now)}",
            f"{place} goes with {vehicle_id} now. Carry on with your other stops.",
            {"trip_id": str(trip.id), "stop_id": str(stop.id), "vehicle_id": vehicle_id},
        )
    if backup_driver is not None:
        _tell_driver(
            db,
            now,
            backup_driver,
            "new_trip",
            f"New stop: {place}",
            f"Pick up {cases} cases at the {DEPOT_LABEL.get(plan.depot, plan.depot)} dock, leave at "
            f"{words.clock(option.departs)} and take them to {stop.outlet_id} {place}, open until "
            f"{words.clock(option.closes)}.",
            {"trip_id": str(backup.id)},
        )
    order = db.get(Order, stop.order_id)
    if order is not None:
        kind = "chilled" if order.temp == "chilled" else "dry" if order.brand == "Fresh" else order.brand
        notify_store(
            db,
            stop.outlet_id,
            now,
            kind="backup_sent",
            title=f"Your {kind} order now comes with another vehicle",
            body=f"{vehicle_id} is bringing your {kind} order {order.order_ref}, expected around "
            f"{words.clock(words.round5(option.arrives))}.",
            data={"order_ref": order.order_ref, "expected": option.arrives.isoformat(), "vehicle_id": vehicle_id},
        )
    db.add(
        PlanChange(
            plan_id=plan.id,
            trip_id=backup.id,
            kind="stop_moved",
            summary=f"{trip.vehicle_id} stop {stop.seq}, {place}, moved to {vehicle_id}",
            detail={"from_trip": str(trip.id), "stop_id": str(stop.id), "reason": reason.strip(), "place": place},
            created_at=now,
            created_by=user.id if user else None,
        )
    )
    item = add_feed_item(
        db,
        now,
        kind=FeedKind.STOP_MOVED,
        depot=plan.depot,
        title=f"Stop {stop.seq} moved to {vehicle_id}",
        body=f"{by} moved {place} from {trip.vehicle_id} at {words.clock(now)}: {reason.strip()}",
        ref={"trip_id": str(trip.id), "stop_id": str(stop.id), "backup_trip_id": str(backup.id)},
    )
    item.handled_at = now
    item.handled_by = user.id if user else None
    item.outcome = f"{vehicle_id} leaves {words.clock(option.departs)}, expected {words.clock(option.arrives)}."
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id if user else None,
            actor_label=user.display_name if user else "Relay",
            action="stop.moved",
            entity="stop",
            entity_id=str(stop.id),
            summary=f"{trip.vehicle_id} stop {stop.seq} moved to {vehicle_id}: {reason.strip()}",
        )
    )
    return backup


def backup_for(db: Session, stop: Stop) -> Stop | None:
    return db.scalar(select(Stop).where(Stop.backup_of == stop.id, Stop.status != StopStatus.CANCELLED))


def carrier(db: Session, copy: Stop | None) -> str | None:
    """The vehicle that carries a backup's copy of a stop."""
    trip = db.get(Trip, copy.trip_id) if copy is not None else None
    return trip.vehicle_id if trip is not None else None


def keep_backup(db: Session, now: datetime, user: AppUser | None, item: FeedItem, note: str) -> None:
    """After a store's receipt, the dispatcher keeps the backup on the road: nobody is told, the note is kept."""
    item.handled_at = now
    item.handled_by = user.id if user else None
    item.outcome = f"You kept the backup at {words.clock(now)}." + (f" {note.strip()}" if note.strip() else "")
    trip_id = item.ref.get("backup_trip_id")
    backup = db.get(Trip, trip_id) if trip_id else None
    if backup is not None:
        db.add(
            PlanChange(
                plan_id=backup.plan_id,
                trip_id=backup.id,
                kind="backup_kept",
                summary=f"Kept {backup.vehicle_id}'s backup run",
                detail={"note": note.strip()},
                created_at=now,
                created_by=user.id if user else None,
            )
        )


def cancel_backup(db: Session, now: datetime, user: AppUser | None, copy: Stop) -> None:
    """The dispatcher calls the backup off: its copy is withdrawn and the original stop is the driver's again."""
    original = db.get(Stop, copy.backup_of) if copy.backup_of else None
    withdraw_copy(db, now, copy, by=user, reason="cancelled")
    if original is not None and original.status is StopStatus.MOVED:
        original.status = StopStatus.PENDING
        original.version += 1


def withdraw_copy(db: Session, now: datetime, copy: Stop, *, by: AppUser | None, reason: str) -> None:
    """The backup's copy of a stop is no longer needed: a backup still at the dock is cancelled and its picks are
    withdrawn; one on the road turns back to the hub."""
    if copy.status is StopStatus.CANCELLED:
        return
    copy.status = StopStatus.CANCELLED
    copy.version += 1
    backup = db.get(Trip, copy.trip_id)
    if backup is None:
        return
    plan = db.get(Plan, backup.plan_id)
    assert plan is not None
    look = Lookup(db)
    place = look.outlets[copy.outlet_id].short_name
    cases = sum(line.planned_qty for line in db.scalars(select(LoadLine).where(LoadLine.stop_id == copy.id)))
    live = [s for s in backup.stops if s.status is not StopStatus.CANCELLED]
    if not live:
        if backup.departed_at is not None and backup.finished_at is None:
            backup.status = TripStatus.RETURNING
            backup.turned_back_at = now
            hub = DEPOT_LABEL.get(plan.depot, plan.depot)
            message = f"{place} is cancelled. Go back to the {hub} with the {cases} cases."
        else:
            backup.status = TripStatus.CANCELLED
            for line in db.scalars(select(LoadLine).where(LoadLine.trip_id == backup.id)):
                db.delete(line)
            message = f"The run to {place} is cancelled. Nothing to pick up."
        driver = look.driver_of(backup, plan.run_date)
        if driver is not None:
            _tell_driver(
                db, now, driver, "backup_cancelled", f"{place} is cancelled", message, {"trip_id": str(backup.id)}
            )
    db.add(
        PlanChange(
            plan_id=plan.id,
            trip_id=backup.id,
            kind="backup_cancelled",
            summary=f"{backup.vehicle_id}'s copy of {place} withdrawn ({reason})",
            detail={"stop_id": str(copy.id), "reason": reason, "place": place},
            created_at=now,
            created_by=by.id if by else None,
        )
    )


def _tell_driver(
    db: Session, now: datetime, driver: AppUser, kind: str, title: str, body: str, data: dict[str, Any]
) -> None:
    db.add(
        Notification(
            user_id=driver.id,
            kind=kind,
            title=title,
            body=body,
            data=data,
            created_at=now,
            show_after=now,
        )
    )


def receipt_question(db: Session, now: datetime, stop: Stop, receipt_at: datetime) -> FeedItem | None:
    """A store confirmed receipt from a silent run while a backup is on its way to a later stop of the same trip: the
    dispatcher is asked whether to keep the backup."""
    trip = db.get(Trip, stop.trip_id)
    if trip is None:
        return None
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    later = [s for s in trip.stops if s.seq > stop.seq and s.status is StopStatus.MOVED]
    copies = [c for s in later if (c := backup_for(db, s)) is not None]
    if not copies:
        return None
    look = Lookup(db)
    place = look.outlets[stop.outlet_id].short_name
    copy = copies[0]
    backup = db.get(Trip, copy.trip_id)
    later_place = look.outlets[copy.outlet_id].short_name
    return add_feed_item(
        db,
        now,
        kind=FeedKind.RECEIPT,
        depot=plan.depot,
        title=f"{place} confirmed receipt",
        body=f"{words.clock(receipt_at)}. The store counts it as delivered. "
        f"{backup.vehicle_id if backup else 'A backup'} is still taking {later_place}: keep it or cancel it.",
        ref={
            "trip_id": str(trip.id),
            "stop_id": str(stop.id),
            "copy_stop_id": str(copy.id),
            "backup_trip_id": str(copy.trip_id),
        },
    )


def outlet_name(db: Session, outlet_id: str) -> str:
    outlet = db.get(Outlet, outlet_id)
    return outlet.short_name if outlet else outlet_id
