"""The world simulator: the people a judge is not playing.

A copy of the day has people on every side of Relay: the other loaders at the dock, the other drivers, the
other stores. The simulator moves them with the scenario clock, through the same rows a person's actions write.
It is a function of time: `advance(db, now)` brings the world to where it should be at `now`, never backwards,
and can run any number of times. A load a person has touched (`Trip.claimed_at`) is theirs to finish, but its
simulated driver still accepts it once it is complete and leaves; the loads of the judges' own driver are left
alone, and the story autopilot plays those only when a judge skips ahead.

On the road, every other driver arrives and delivers at Relay's expected times from when the truck really left,
sends each record the way a phone does (services/field.py), checks in each minute so the office never reads the
run as silent, and finishes back at the hub. A backup the office sends is picked at the dock and leaves like any
other load; a backup turned back drives home and stops there, and one called off before it left never goes.
"""

from __future__ import annotations

import math
import uuid
import zlib
from dataclasses import dataclass, field
from datetime import date, datetime, time, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO, DELIVERY_DAY, at
from relay_api.models import (
    AppUser,
    DeviceContact,
    FieldEvent,
    FieldEventKind,
    Handover,
    LoadLineStatus,
    Notification,
    Plan,
    PlanStatus,
    ProblemReason,
    Role,
    Stop,
    StopStatus,
    Trip,
    TripStatus,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.services import field as records
from relay_api.services import network as adapters
from relay_api.services.dock import Load, Lookup, loads_for
from relay_api.services.ordering import current_run
from relay_engine.clock import Conditions
from relay_engine.network import Brand

LOAD_RATE = 4.0
"""Cases a minute for one loader working through a load."""
NIGHT_SLACK = 40
"""Minutes a Fresh load is ready before its truck leaves, so a late line never holds the truck."""
DAY_SLACK = 30
ACCEPT_AFTER = timedelta(minutes=2)
"""From a load marked complete to its driver accepting it on the phone, at the soonest."""
DEVICE = "relay-world"
"""The phone every simulated driver reports from."""
STANDBY_UNTIL = time(8, 0)
"""A standby driver is on call, phone in hand, from the first departure until the Fresh window closes."""


@dataclass(frozen=True)
class Report:
    """Something a simulated driver reports from the road, as the story's timeline has it."""

    vehicle_id: str
    trip_no: int
    day: str
    clock: str
    reason: ProblemReason
    delay_min: int
    note: str


REPORTS: tuple[Report, ...] = (
    Report("VEH042", 1, DELIVERY_DAY, "04:28", ProblemReason.DELAYED, 45, "Slow on the Matale road, one lane open."),
)
"""Sampath, slowed on the Matale road, tells the office at 4:28 AM; the story has Nuwan mark it handled."""


@dataclass(frozen=True)
class DockSlot:
    loader: AppUser | None
    start: datetime
    ready: datetime
    accept: datetime
    depart: datetime


@dataclass(frozen=True)
class Beat:
    """One record a driver on the road sends, at the time it happens."""

    at: datetime
    kind: FieldEventKind
    stop: Stop | None
    id: uuid.UUID
    payload: dict[str, Any] = field(default_factory=dict)

    def record(self, trip: Trip) -> records.RecordIn:
        return records.RecordIn(
            id=self.id,
            kind=self.kind,
            trip_id=trip.id,
            stop_id=self.stop.id if self.stop else None,
            occurred_at=self.at,
            base_version=self.stop.version if self.stop else None,  # the phone is in contact, so it is current
            payload=self.payload,
        )


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


def backup_slot(trip: Trip, cases: int, loaders: list[AppUser]) -> DockSlot:
    """A backup is picked from the moment the office sends it: its planned departure is the pick time after the move
    (services/backup.py), so the pick starts that long before it and the van leaves on time. Kept out of the
    night's turns, so no other load changes hands when a backup is added."""
    minutes = max(10, math.ceil(cases / LOAD_RATE))
    start = trip.planned_depart - timedelta(minutes=minutes)
    return DockSlot(
        loader=loaders[_jitter(trip, len(loaders))] if loaders else None,
        start=start,
        ready=max(start, trip.planned_depart - ACCEPT_AFTER),
        accept=trip.planned_depart,
        depart=trip.planned_depart,
    )


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
    """Bring every load and every run the world plays up to `now`: the current run's, and any run of an earlier day
    still on the road when the stores' day turned over at midday, which drives home and finishes."""
    run_date = current_run(db, now)
    plans = db.scalars(select(Plan).where(Plan.run_date == run_date, Plan.status == PlanStatus.PUBLISHED)).all()
    still_out = db.scalars(
        select(Plan)
        .join(Trip, Trip.plan_id == Plan.id)
        .where(
            Plan.run_date < run_date,
            Plan.status == PlanStatus.PUBLISHED,
            Trip.departed_at.is_not(None),
            Trip.finished_at.is_(None),
        )
        .distinct()
    ).all()
    look = Lookup(db)
    phones = Phones(db)
    for plan in [*still_out, *plans]:
        today = plan.run_date == run_date
        loaders = sorted(
            (u for u in look.users.values() if u.role is Role.LOADER and u.depot == plan.depot and not u.judge_account),
            key=lambda u: u.display_name,
            reverse=True,
        )
        judged = judge_trips(db, plan)
        # each vehicle's trips in turn, so a first trip that ends in this pass frees the vehicle for its second
        trips = sorted(
            (t for t in plan.trips if t.status is not TripStatus.CANCELLED and t.id not in judged),
            key=lambda t: (t.vehicle_id, t.trip_no),
        )
        held = _hold(db, trips)
        loads = loads_for(db, trips, fresh=True)
        cases = {t.id: loads[t.id].cases for t in trips}
        slots = dock_slots([t for t in trips if not t.is_backup], cases, loaders)
        slots.update({t.id: backup_slot(t, cases[t.id], loaders) for t in trips if t.is_backup})
        drivers = _drivers(db, look, plan)
        conditions: Conditions | None = None
        before: dict[str, Trip] = {}
        for trip in trips:
            previous = before.get(trip.vehicle_id)
            before[trip.vehicle_id] = trip
            if trip.id not in held:
                continue
            if trip.departed_at is None and today:
                slot = slots[trip.id]
                if trip.claimed_at is None:
                    _load(db, trip, loads[trip.id], slot, now)
                # a second trip's load waits at the bay until the vehicle is back from the first
                at_bay = slot.start if previous is None else back_at_hub(previous)
                if at_bay is not None:
                    _drive(look, plan, trip, loads[trip.id], slot, at_bay, now)
            if trip.departed_at is not None and trip.finished_at is None:
                conditions = conditions or adapters.conditions(db, plan.run_date)
                _road(db, plan, trip, drivers.get(trip.vehicle_id), conditions, phones, now)
        _on_duty(db, plan, trips, drivers, phones, now)


def back_at_hub(trip: Trip) -> datetime | None:
    """When a vehicle is back at the hub from a trip: its driver finishes the trip there. None while it is out, or
    has not left."""
    return trip.finished_at


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


# ------------------------------------------------------------------------------------------------ on the road
def road(db: Session, plan: Plan, trip: Trip, conditions: Conditions) -> list[Beat]:
    """What the driver of a trip on the road records from here on, at Relay's expected times from when the truck
    really left: each arrival and delivery not yet recorded, a report the story gives the driver, and the trip
    finished once the truck is back at the hub. A stop moved to another vehicle is skipped: the phone was told."""
    net = adapters.network(db)
    day = plan.run_date
    district = net.districts[trip.district]
    assert trip.departed_at is not None

    def minutes(moment: datetime) -> float:
        return adapters.minutes_of(day, moment)

    if trip.status is TripStatus.RETURNING:
        # turned back on the way out: home the way it came, as far as it had got
        turned = minutes(trip.turned_back_at or trip.departed_at)
        out = turned - minutes(trip.departed_at)
        whole = district.depot_to_district_min * conditions.factor(district.name, minutes(trip.departed_at))
        share = min(1.0, out / whole) if whole else 1.0
        back = turned + share * district.depot_to_district_min * conditions.factor(district.name, turned)
        return [Beat(adapters.at_minutes(day, back), FieldEventKind.TRIP_FINISHED, None, _id(trip.id, "finished"))]

    brand = Brand(trip.brand)
    beats: list[Beat] = []
    visits: list[tuple[Stop, float]] = []
    t = minutes(trip.departed_at)
    first = True
    for stop in sorted(trip.stops, key=lambda s: s.seq):
        if stop.status in (StopStatus.MOVED, StopStatus.CANCELLED):
            continue
        if stop.arrived_at is not None:
            arrive = minutes(stop.arrived_at)
        else:
            leg = district.depot_to_district_min if first else district.inter_stop_min
            arrive = float(round(t + leg * conditions.factor(district.name, t)))
            beats.append(Beat(adapters.at_minutes(day, arrive), FieldEventKind.ARRIVED, stop, _id(stop.id, "arrived")))
        first = False
        if stop.completed_at is not None:
            t = minutes(stop.completed_at)
        else:
            opens, _ = net.outlets[stop.outlet_id].receiving_window
            t = float(round(max(arrive, opens) + conditions.unloading(net, brand, stop.outlet_id)))
            beats.append(
                Beat(
                    adapters.at_minutes(day, t),
                    FieldEventKind.DELIVERED,
                    stop,
                    _id(stop.id, "delivered"),
                    {"all_delivered": True},
                )
            )
        visits.append((stop, t))
    back = t + district.depot_to_district_min * conditions.factor(district.name, t)
    beats.append(Beat(adapters.at_minutes(day, back), FieldEventKind.TRIP_FINISHED, None, _id(trip.id, "finished")))
    beats.extend(_reports(db, day, trip, visits))
    return sorted(beats, key=lambda b: b.at)  # stable: a report made in the minute of an arrival comes after it


def _reports(db: Session, day: date, trip: Trip, visits: list[tuple[Stop, float]]) -> list[Beat]:
    """The story's reports for this trip still to make: each about the stop the driver is at, or driving to."""
    out = []
    for report in REPORTS:
        if trip.is_backup or (trip.vehicle_id, trip.trip_no) != (report.vehicle_id, report.trip_no):
            continue
        if day != date.fromisoformat(report.day):
            continue
        moment = at(report.day, report.clock)
        event_id = _id(trip.id, f"report {report.clock}")
        if trip.departed_at is None or moment < trip.departed_at or db.get(FieldEvent, event_id) is not None:
            continue
        stop = next((s for s, leave in visits if adapters.at_minutes(day, leave) > moment), None)
        if stop is None:
            continue  # every stop done: on the way home, nothing to report
        payload = {"reason": report.reason.value, "delay_min": report.delay_min, "note": report.note}
        out.append(Beat(moment, FieldEventKind.PROBLEM, stop, event_id, payload))
    return out


def _road(
    db: Session,
    plan: Plan,
    trip: Trip,
    driver: AppUser | None,
    conditions: Conditions,
    phones: Phones,
    now: datetime,
) -> None:
    """Send what the driver has recorded by `now`, each record at its own time, as a phone in contact does."""
    if driver is None:
        return  # nobody on record drives it, so nobody records it
    for beat in road(db, plan, trip, conditions):
        if beat.at > now:
            break
        phones.check_in(driver, beat.at)
        records.receive(db, beat.at, driver, DEVICE, [beat.record(trip)])


def _id(key: uuid.UUID, what: str) -> uuid.UUID:
    """A record's id, the same every time the world plays it, so a replay is a duplicate. Rows of one copy have ids
    of their own, so these never meet another copy's."""
    return uuid.uuid5(key, what)


# ------------------------------------------------------------------------------------------------ phones
class Phones:
    """The simulated drivers' phones. Each checks in once a minute while its driver is on duty, so the office reads
    the run as in contact; Relay's messages reach it on the next check-in."""

    def __init__(self, db: Session) -> None:
        self.db = db
        # oldest first, so a driver's freshest row is the one kept
        self.contacts = {
            c.user_id: c for c in db.scalars(select(DeviceContact).order_by(DeviceContact.last_contact_at))
        }

    def check_in(self, user: AppUser, moment: datetime) -> None:
        minute = moment.astimezone(COLOMBO).replace(second=0, microsecond=0)
        contact = self.contacts.get(user.id)
        if contact is None:
            contact = DeviceContact(user_id=user.id, last_contact_at=minute, pending_records=0, device_id=DEVICE)
            self.db.add(contact)
            self.contacts[user.id] = contact
        elif contact.last_contact_at < minute:
            contact.last_contact_at = minute
            contact.device_id = DEVICE


def _drivers(db: Session, look: Lookup, plan: Plan) -> dict[str, AppUser]:
    """Each vehicle's driver for the day, judges left out: the judges' phones are their own."""
    out = {u.vehicle_id: u for u in look.users.values() if u.role is Role.DRIVER and u.vehicle_id}
    for day in db.scalars(select(VehicleDay).where(VehicleDay.run_date == plan.run_date)):
        if day.driver_id in look.users:
            out[day.vehicle_id] = look.users[day.driver_id]
    return {vehicle_id: u for vehicle_id, u in out.items() if not u.judge_account}


def _on_duty(
    db: Session, plan: Plan, trips: list[Trip], drivers: dict[str, AppUser], phones: Phones, now: datetime
) -> None:
    """Every simulated driver at the wheel, or at the truck with the load accepted, checks in; so does the depot's
    standby driver while on call. Messages waiting for them are picked up on the check-in."""
    duty: dict[uuid.UUID, AppUser] = {}
    for trip in trips:
        driver = drivers.get(trip.vehicle_id)
        if driver is None or trip.finished_at is not None:
            continue
        if trip.departed_at is not None or trip.status is TripStatus.LOADED:
            duty[driver.id] = driver
    starts = [t.planned_depart for t in plan.trips]
    until = datetime.combine(plan.run_date, STANDBY_UNTIL, tzinfo=COLOMBO)
    if starts and min(starts) <= now < until:
        for day in db.scalars(
            select(VehicleDay).where(
                VehicleDay.run_date == plan.run_date, VehicleDay.status == VehicleDayStatus.STANDBY
            )
        ):
            driver = drivers.get(day.vehicle_id)
            if driver is not None:
                duty[driver.id] = driver
    if not duty:
        return
    for driver in duty.values():
        phones.check_in(driver, now)
    for notice in db.scalars(
        select(Notification).where(
            Notification.user_id.in_(list(duty)),
            Notification.delivered_at.is_(None),
            Notification.created_at <= now,
        )
    ):
        # a message to the driver at the wheel is played aloud on arrival, so it is heard the minute it is sent
        notice.delivered_at = notice.created_at
        notice.read_at = notice.read_at or notice.created_at
