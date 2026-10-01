"""The world simulator: the people a judge is not playing.

A copy of the day has people on every side of Relay: the other loaders at the dock, the other drivers, the
other stores. The simulator moves them with the scenario clock, through the same rows a person's actions write.
It is a function of time: `advance(db, now)` brings the world to where it should be at `now`, never backwards,
and can run any number of times. Loads a person has touched (`Trip.claimed_at`) and the loads of the judges' own
driver are left alone; the story autopilot plays those only when a judge skips ahead.
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
        trips = [
            t for t in plan.trips if t.status is not TripStatus.CANCELLED and not t.is_backup and t.id not in judged
        ]
        loads = loads_for(db, trips)
        slots = dock_slots(trips, {t.id: loads[t.id].cases for t in trips}, loaders)
        back = {t.vehicle_id: t.planned_back for t in trips if t.trip_no == 1}
        for trip in trips:
            if trip.claimed_at is not None or trip.departed_at is not None:
                continue
            slot = slots[trip.id]
            if trip.trip_no > 1 and trip.vehicle_id in back:
                # the second trip's load waits at the bay until the vehicle is back from its first
                slot = DockSlot(
                    slot.loader, slot.start, slot.ready, max(slot.accept, back[trip.vehicle_id]), slot.depart
                )
            _bring_forward(db, look, plan, trip, loads[trip.id], slot, now)


def _bring_forward(
    db: Session, look: Lookup, plan: Plan, trip: Trip, load: Load, slot: DockSlot, now: datetime
) -> None:
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
    if now < slot.ready:
        return
    handover = load.handover
    if handover is None:
        handover = Handover(
            trip_id=trip.id,
            planned_cases=load.cases,
            loaded_cases=sum(line.loaded_qty for line in load.lines),
            completed_at=slot.ready,
            completed_by=loader_id,
        )
        db.add(handover)
        load.handover = handover
    if now >= slot.accept and handover.accepted_at is None:
        driver = look.driver_of(trip, plan.run_date)
        handover.accepted_at = slot.accept
        handover.accepted_by = driver.id if driver else None
        handover.accepted_on = "phone"
        trip.status = TripStatus.LOADED
    if now >= slot.depart and handover.accepted_at is not None and trip.departed_at is None:
        trip.departed_at = slot.depart
        trip.status = TripStatus.DEPARTED
