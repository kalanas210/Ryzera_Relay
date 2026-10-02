"""The world simulator: the people a judge is not playing.

A copy of the day has people on every side of Relay: the other loaders at the dock, the other drivers, the
other stores. The simulator moves them with the scenario clock, through the same rows a person's actions write.
It is a function of time: `advance(db, now)` brings the world to where it should be at `now`, never backwards,
and can run any number of times. A load a person has touched (`Trip.claimed_at`) is theirs to finish, but its
simulated driver still accepts it once it is complete and leaves; the loads of the judges' own driver are left
alone, and the story autopilot plays those only when a judge skips ahead.
"""

from __future__ import annotations

import math
import zlib
from dataclasses import dataclass
from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import (
    AppUser,
    Handover,
    LoadLineStatus,
    Plan,
    PlanStatus,
    Role,
    Trip,
    TripStatus,
    VehicleDay,
)
from relay_api.services.dock import Load, Lookup, loads_for
from relay_api.services.ordering import current_run

LOAD_RATE = 4.0
"""Cases a minute for one loader working through a load."""
NIGHT_SLACK = 40
"""Minutes a Fresh load is ready before its truck leaves, so a late line never holds the truck."""
DAY_SLACK = 30
ACCEPT_AFTER = timedelta(minutes=2)
"""From a load marked complete to its driver accepting it on the phone, at the soonest."""


@dataclass(frozen=True)
class DockSlot:
    loader: AppUser | None
    start: datetime
    ready: datetime
    accept: datetime
    depart: datetime


def _jitter(trip: Trip, modulo: int) -> int:
    return zlib.crc32(f"{trip.vehicle_id}/{trip.trip_no}".encode()) % modulo


def dock_slots(trips: list[Trip], cases: dict[object, int], loaders: list[AppUser]) -> dict[object, DockSlot]:
    """When each load is picked, finished, accepted and leaves. The dock's two other loaders take the loads in
    departure order, in turn."""
    out = {}
    for n, trip in enumerate(sorted(trips, key=lambda t: (t.planned_depart, t.vehicle_id, t.trip_no))):
        minutes = max(10, math.ceil(cases[trip.id] / LOAD_RATE))
        slack = NIGHT_SLACK if trip.brand == "Fresh" else DAY_SLACK
        ready = trip.planned_depart - timedelta(minutes=slack - _jitter(trip, 7))
        out[trip.id] = DockSlot(
            loader=loaders[n % len(loaders)] if loaders else None,
            start=ready - timedelta(minutes=minutes),
            ready=ready,
            accept=ready + timedelta(minutes=2 + _jitter(trip, 3)),
            depart=trip.planned_depart + timedelta(minutes=_jitter(trip, 5)),
        )
    return out


def judge_trips(db: Session, plan: Plan) -> set[object]:
    """Trips driven by a judge account's driver: the story's own truck, which the judges load and drive."""
    judges = {
        u.id for u in db.scalars(select(AppUser).where(AppUser.judge_account.is_(True), AppUser.role == Role.DRIVER))
    }
    vehicles = {
        d.vehicle_id
        for d in db.scalars(select(VehicleDay).where(VehicleDay.run_date == plan.run_date))
        if d.driver_id in judges
    }
    return {t.id for t in plan.trips if t.vehicle_id in vehicles}


def advance(db: Session, now: datetime) -> None:
    """Bring every load the world plays up to `now`."""
    run_date = current_run(db, now)
    plans = db.scalars(select(Plan).where(Plan.run_date == run_date, Plan.status == PlanStatus.PUBLISHED)).all()
    look = Lookup(db)
    for plan in plans:
        loaders = sorted(
            (u for u in look.users.values() if u.role is Role.LOADER and u.depot == plan.depot and not u.judge_account),
            key=lambda u: u.display_name,
            reverse=True,
        )
        judged = judge_trips(db, plan)
        # each vehicle's trips in turn, so a first trip that leaves in this pass frees the vehicle for its second
        trips = sorted(
            (t for t in plan.trips if t.status is not TripStatus.CANCELLED and not t.is_backup and t.id not in judged),
            key=lambda t: (t.vehicle_id, t.trip_no),
        )
        held = _hold(db, trips)
        loads = loads_for(db, trips, fresh=True)
        slots = dock_slots(trips, {t.id: loads[t.id].cases for t in trips}, loaders)
        before: dict[str, Trip] = {}
        for trip in trips:
            previous = before.get(trip.vehicle_id)
            before[trip.vehicle_id] = trip
            if trip.id not in held or trip.departed_at is not None:
                continue
            slot = slots[trip.id]
            if trip.claimed_at is None:
                _load(db, trip, loads[trip.id], slot, now)
            # a second trip's load waits at the bay until the vehicle is back from the first
            at_bay = slot.start if previous is None else back_at_hub(previous)
            if at_bay is not None:
                _drive(look, plan, trip, loads[trip.id], slot, at_bay, now)


def back_at_hub(trip: Trip) -> datetime | None:
    """When a vehicle is back at the hub from a trip: the planned time out and back, counted from when it really
    left. None while it has not left."""
    if trip.departed_at is None:
        return None
    return trip.departed_at + (trip.planned_back - trip.planned_depart)


def _hold(db: Session, trips: list[Trip]) -> set[object]:
    """Lock the loads this pass may write, reading each trip again under the lock so `claimed_at` is current. A load
    a person's request holds at this moment (`dock.lock_trip`) is passed over, and the next tick plays it."""
    if not trips:
        return set()
    return {
        trip.id
        for trip in db.scalars(
            select(Trip)
            .where(Trip.id.in_([t.id for t in trips]))
            .with_for_update(key_share=True, skip_locked=True)
            .execution_options(populate_existing=True)
        )
    }


def _load(db: Session, trip: Trip, load: Load, slot: DockSlot, now: datetime) -> None:
    """One of the dock's other loaders works through a load nobody has touched: cases go on at a steady rate from
    the slot's start, and the load is marked complete at its ready time."""
    if now < slot.start:
        return
    loader_id = slot.loader.id if slot.loader else None
    trip.loader_id = loader_id
    trip.loading_started_at = trip.loading_started_at or slot.start
    if trip.status is TripStatus.PLANNED:
        trip.status = TripStatus.LOADING
    span = (slot.ready - slot.start).total_seconds()
    share = 1.0 if now >= slot.ready else (now - slot.start).total_seconds() / span
    target = math.floor(load.cases * share)
    done = 0
    for line in load.lines:
        want = max(0, min(line.planned_qty, target - done))
        done += line.planned_qty
        if want <= line.loaded_qty or line.status in (LoadLineStatus.FLAG_WAITING, LoadLineStatus.DECIDED):
            continue
        line.loaded_qty = want
        line.status = LoadLineStatus.CHECKED if want == line.planned_qty else LoadLineStatus.IN_PROGRESS
        finished = slot.start + (slot.ready - slot.start) * min(1.0, done / max(1, load.cases))
        line.updated_at = min(now, finished)
        line.updated_by = loader_id
    if now < slot.ready or load.handover is not None:
        return
    load.handover = Handover(
        trip_id=trip.id,
        planned_cases=load.cases,
        loaded_cases=sum(line.loaded_qty for line in load.lines),
        completed_at=slot.ready,
        completed_by=loader_id,
    )
    db.add(load.handover)


def _drive(look: Lookup, plan: Plan, trip: Trip, load: Load, slot: DockSlot, at_bay: datetime, now: datetime) -> None:
    """The simulated driver accepts a complete load on the phone, no sooner than the vehicle is at the bay, and
    leaves at the planned time. This holds for a load a person completed too, since nobody plays its driver."""
    handover = load.handover
    if handover is None:
        return
    if handover.accepted_at is None:
        accept_at = max(slot.accept, handover.completed_at + ACCEPT_AFTER, at_bay)
        if now < accept_at:
            return
        driver = look.driver_of(trip, plan.run_date)
        handover.accepted_at = accept_at
        handover.accepted_by = driver.id if driver else None
        handover.accepted_on = "phone"
        trip.status = TripStatus.LOADED
    depart_at = max(slot.depart, handover.accepted_at)
    if now >= depart_at:
        trip.departed_at = depart_at
        trip.status = TripStatus.DEPARTED
