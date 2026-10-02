"""The dock: tonight's loads at a hub (LDR-01), one load in the order it goes on the truck (LDR-02), a shortfall
flagged for the dispatcher and the answer (LDR-03), and the handover the driver accepts (LDR-04).

Publishing writes the load lines: one per case type per stop, the last stop first and the heaviest case type
first within a stop. Every count on these screens is a sum over those lines, so the dock, the dispatcher and the
driver read the same numbers.
"""

from __future__ import annotations

import uuid
from collections import defaultdict
from collections.abc import Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from functools import cached_property

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import (
    AppUser,
    AuditLog,
    CaseType,
    FeedItem,
    FeedKind,
    Handover,
    LoadLine,
    LoadLineStatus,
    Notification,
    Order,
    OrderLine,
    OrderSource,
    OrderStatus,
    Outlet,
    Photo,
    Plan,
    PlanChange,
    PlanStatus,
    Role,
    Shortfall,
    ShortfallDecision,
    ShortfallKind,
    Stop,
    Trip,
    TripStatus,
    Vehicle,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.schemas.dock import (
    DepartedOut,
    DockNoticeOut,
    GroupState,
    HandoverOut,
    HandoverStopOut,
    LoadCardOut,
    LoadLineOut,
    LoadState,
    PersonOut,
    ShortfallOut,
    StopGroupOut,
    TonightOut,
    TripLoadOut,
    WorkshopOut,
)
from relay_api.services import words
from relay_api.services.notify import add_feed_item, notify_store
from relay_api.services.ordering import current_run, next_operating_day, order_ref_for

DEPOT_LABEL = {"Kandy": "Kandy hub", "Peliyagoda": "Peliyagoda"}
DONE = (LoadLineStatus.CHECKED, LoadLineStatus.DECIDED)
OPEN = (LoadLineStatus.TO_LOAD, LoadLineStatus.IN_PROGRESS)
"""Lines with cases still to go on. A flagged line waits for the dispatcher instead."""
FLAGGED = (LoadLineStatus.FLAG_WAITING, LoadLineStatus.DECIDED)
QUIET_FROM, QUIET_UNTIL = 22, 5
MAX_PHOTO_BYTES = 1_500_000
PHOTO_TYPES = ("image/jpeg", "image/webp", "image/png")


class DockError(Exception):
    """A request the dock can't take, in words for the loader."""


def quiet_until(now: datetime) -> datetime:
    """Store notices sent between 10:00 PM and 5:00 AM arrive silently and ring at 5:00 AM."""
    local = now.astimezone(COLOMBO)
    if QUIET_UNTIL <= local.hour < QUIET_FROM:
        return now
    day = local.date() if local.hour < QUIET_UNTIL else local.date() + timedelta(days=1)
    return datetime(day.year, day.month, day.day, QUIET_UNTIL, tzinfo=COLOMBO)


# ------------------------------------------------------------------------------------------------ reading
@dataclass
class Load:
    """One trip's load: its lines, flags and handover, with the counts every dock screen shows."""

    trip: Trip
    lines: list[LoadLine] = field(default_factory=list)
    refs: dict[uuid.UUID, str] = field(default_factory=dict)
    """Each stop's order number."""
    shortfalls: dict[uuid.UUID, Shortfall] = field(default_factory=dict)
    """By load line."""
    handover: Handover | None = None

    @property
    def cases(self) -> int:
        return sum(line.planned_qty for line in self.lines)

    @property
    def loaded(self) -> int:
        return sum(line.loaded_qty for line in self.lines)

    @property
    def short(self) -> int:
        return sum(line.planned_qty - line.loaded_qty for line in self.lines if line.status is LoadLineStatus.DECIDED)

    @property
    def flags_waiting(self) -> int:
        return sum(1 for line in self.lines if line.status is LoadLineStatus.FLAG_WAITING)

    @property
    def lines_done(self) -> int:
        return sum(1 for line in self.lines if line.status in DONE)

    @property
    def complete(self) -> bool:
        return bool(self.handover and self.handover.completed_at)

    @property
    def state(self) -> LoadState:
        if self.trip.departed_at:
            return "left"
        if self.complete:
            return "ready"
        if self.trip.loading_started_at or any(
            line.loaded_qty or line.status is not LoadLineStatus.TO_LOAD for line in self.lines
        ):
            return "loading"
        return "not_started"


class Lookup:
    """Names and reference rows the dock screens need, read once per request."""

    def __init__(self, db: Session) -> None:
        self.db = db

    @cached_property
    def users(self) -> dict[uuid.UUID, AppUser]:
        return {u.id: u for u in self.db.scalars(select(AppUser))}

    @cached_property
    def case_types(self) -> dict[str, CaseType]:
        return {c.code: c for c in self.db.scalars(select(CaseType))}

    @cached_property
    def vehicles(self) -> dict[str, Vehicle]:
        return {v.vehicle_id: v for v in self.db.scalars(select(Vehicle))}

    @cached_property
    def outlets(self) -> dict[str, Outlet]:
        return {o.outlet_id: o for o in self.db.scalars(select(Outlet))}

    def name(self, user_id: uuid.UUID | None) -> str | None:
        user = self.users.get(user_id) if user_id else None
        return user.display_name if user else None

    def driver_of(self, trip: Trip, run_date: date) -> AppUser | None:
        day = self.db.scalar(
            select(VehicleDay).where(VehicleDay.vehicle_id == trip.vehicle_id, VehicleDay.run_date == run_date)
        )
        if day is not None and day.driver_id in self.users:
            return self.users[day.driver_id]
        return next((u for u in self.users.values() if u.role is Role.DRIVER and u.vehicle_id == trip.vehicle_id), None)

    def dispatcher(self) -> AppUser | None:
        """The dispatcher on call tonight: flags reach their phone."""
        people = [u for u in self.users.values() if u.role is Role.DISPATCHER]
        return min(people, key=lambda u: (not u.judge_account, u.display_name), default=None)

    def store_manager(self, outlet_id: str) -> AppUser | None:
        return next((u for u in self.users.values() if u.role is Role.STORE_MANAGER and u.outlet_id == outlet_id), None)


def published_plan(db: Session, depot: str, run_date: date) -> Plan | None:
    return db.scalar(
        select(Plan).where(Plan.depot == depot, Plan.run_date == run_date, Plan.status == PlanStatus.PUBLISHED)
    )


def loads_for(db: Session, trips: Sequence[Trip], *, fresh: bool = False) -> dict[uuid.UUID, Load]:
    """The loads of these trips. `fresh` reads lines, flags and handovers again even when the session holds them
    already: a caller that has just locked the trips sees what others committed before the lock."""
    ids = [t.id for t in trips]
    loads = {t.id: Load(t) for t in trips}
    order_ids = [s.order_id for t in trips for s in t.stops]
    refs = dict(db.execute(select(Order.id, Order.order_ref).where(Order.id.in_(order_ids))).all())
    for t in trips:
        loads[t.id].refs = {s.id: refs[s.order_id] for s in t.stops}
    trip_of_line: dict[uuid.UUID, uuid.UUID] = {}
    for line in db.scalars(
        select(LoadLine)
        .where(LoadLine.trip_id.in_(ids))
        .order_by(LoadLine.load_order)
        .execution_options(populate_existing=fresh)
    ):
        loads[line.trip_id].lines.append(line)
        trip_of_line[line.id] = line.trip_id
    for shortfall in db.scalars(
        select(Shortfall)
        .where(Shortfall.load_line_id.in_(list(trip_of_line)))
        .execution_options(populate_existing=fresh)
    ):
        loads[trip_of_line[shortfall.load_line_id]].shortfalls[shortfall.load_line_id] = shortfall
    for handover in db.scalars(
        select(Handover).where(Handover.trip_id.in_(ids)).execution_options(populate_existing=fresh)
    ):
        loads[handover.trip_id].handover = handover
    return loads


def lock_trip(db: Session, trip_id: uuid.UUID) -> Trip:
    """Hold a load's trip row until the request commits, and read it again under the lock. The world simulator
    locks the loads it plays the same way and passes over one that is held, so a person's action and the
    simulator's tick never write over each other. FOR NO KEY UPDATE leaves rows that only point at the trip free."""
    trip = db.scalar(
        select(Trip).where(Trip.id == trip_id).with_for_update(key_share=True).execution_options(populate_existing=True)
    )
    assert trip is not None
    return trip


def changes_after_publish(db: Session, plan: Plan) -> dict[uuid.UUID, list[PlanChange]]:
    out: dict[uuid.UUID, list[PlanChange]] = defaultdict(list)
    if plan.published_at is None:
        return out
    for change in db.scalars(
        select(PlanChange)
        .where(PlanChange.plan_id == plan.id, PlanChange.created_at >= plan.published_at)
        .order_by(PlanChange.created_at)
    ):
        if change.trip_id is not None:
            out[change.trip_id].append(change)
    return out


def tonight(db: Session, now: datetime, depot: str) -> TonightOut:
    """LDR-01: every Fresh load at the hub for the run on tonight, grouped the way the dock works through them."""
    look = Lookup(db)
    run_date = current_run(db, now)
    plan = published_plan(db, depot, run_date)
    loaders = sorted(
        (u for u in look.users.values() if u.role is Role.LOADER and u.depot == depot),
        key=lambda u: (not u.judge_account, u.display_name),
    )
    dispatcher = look.dispatcher()
    out = TonightOut(
        depot=depot,
        depot_label=DEPOT_LABEL.get(depot, depot),
        run_date=run_date,
        published_at=plan.published_at if plan else None,
        loads=0,
        loading=[],
        ready=[],
        to_load=[],
        left=[],
        left_count=0,
        workshop=_workshop(db, look, depot, run_date),
        daytime=0,
        notices=[],
        loaders=[
            PersonOut(username=u.username, display_name=u.display_name, initials=words.initials(u.display_name))
            for u in loaders
        ],
        dispatcher=dispatcher.display_name if dispatcher else None,
    )
    if plan is None:
        return out
    trips = db.scalars(select(Trip).where(Trip.plan_id == plan.id, Trip.status != TripStatus.CANCELLED)).all()
    fresh = [t for t in trips if t.brand == "Fresh"]
    out.daytime = len(trips) - len(fresh)
    loads = loads_for(db, fresh)
    changes = changes_after_publish(db, plan)
    first_back = {t.vehicle_id: t.planned_back for t in fresh if t.trip_no == 1}
    # one row per departure time: the loads that left in the same minute for the same district share it
    departed: dict[tuple[datetime, str], list[str]] = defaultdict(list)
    for trip in sorted(fresh, key=lambda t: (t.planned_depart, t.vehicle_id)):
        load = loads[trip.id]
        state = load.state
        if state == "left" and trip.departed_at:
            departed[(trip.departed_at.replace(second=0, microsecond=0), trip.district)].append(trip.vehicle_id)
            continue
        card = _card(look, plan, load, changes.get(trip.id, []), first_back.get(trip.vehicle_id))
        {"loading": out.loading, "ready": out.ready, "not_started": out.to_load}[state].append(card)
    out.loads = len(fresh)
    out.left = [
        DepartedOut(at=at, district=district, vehicles=sorted(vehicles))
        for (at, district), vehicles in sorted(departed.items())
    ]
    out.left_count = sum(len(v) for v in departed.values())
    for trip in fresh:
        load = loads[trip.id]
        if load.complete or trip.departed_at:
            continue
        for change in changes.get(trip.id, []):
            notice = dock_notice(look, load, change)
            if notice is not None:
                out.notices.append(notice)
    return out


def _card(
    look: Lookup, plan: Plan, load: Load, changes: Sequence[PlanChange], first_back: datetime | None
) -> LoadCardOut:
    trip = load.trip
    vehicle = look.vehicles[trip.vehicle_id]
    driver = look.driver_of(trip, plan.run_date)
    return LoadCardOut(
        trip_id=trip.id,
        vehicle_id=trip.vehicle_id,
        vehicle_type=vehicle.type,
        vehicle_kind=words.vehicle_kind(vehicle.type, vehicle.temp),
        trip_no=trip.trip_no,
        temp=trip.temp,
        brand=trip.brand,
        district=trip.district,
        stops=len(trip.stops),
        cases=load.cases,
        loaded=load.loaded,
        short=load.short,
        flags_waiting=load.flags_waiting,
        state=load.state,
        planned_depart=trip.planned_depart,
        departed_at=trip.departed_at,
        completed_at=load.handover.completed_at if load.handover else None,
        accepted_at=load.handover.accepted_at if load.handover else None,
        accepted_by=look.name(load.handover.accepted_by) if load.handover else None,
        driver=driver.display_name if driver else None,
        loader=look.name(trip.loader_id),
        plan_changed_at=changes[-1].created_at if changes else None,
        pick_before=first_back if trip.trip_no > 1 else None,
    )


def _workshop(db: Session, look: Lookup, depot: str, run_date: date) -> list[WorkshopOut]:
    days = db.scalars(
        select(VehicleDay).where(VehicleDay.run_date == run_date, VehicleDay.status == VehicleDayStatus.WORKSHOP)
    ).all()
    out = []
    for day in sorted(days, key=lambda d: d.vehicle_id):
        vehicle = look.vehicles.get(day.vehicle_id)
        if vehicle is None or vehicle.depot != depot:
            continue
        later = db.scalars(
            select(VehicleDay).where(VehicleDay.vehicle_id == day.vehicle_id, VehicleDay.run_date > run_date)
        ).all()
        blocked = {d.run_date for d in later if d.status is VehicleDayStatus.WORKSHOP}
        back = next_operating_day(db, run_date)
        while back in blocked:
            back = next_operating_day(db, back)
        out.append(
            WorkshopOut(
                vehicle_id=vehicle.vehicle_id,
                vehicle_type=vehicle.type,
                vehicle_kind=words.vehicle_kind(vehicle.type, vehicle.temp),
                back_on=back,
            )
        )
    return out


def dock_notice(look: Lookup, load: Load, change: PlanChange) -> DockNoticeOut | None:
    """The banner the dock reads when the plan changed after the loading lists went out."""
    moves = change.detail.get("moves", [])
    by = look.name(change.created_by) or "the dispatcher"
    head = f"Plan changed {words.clock(change.created_at)} by {by}."
    tail = "Lists printed before then are wrong for this truck."
    vehicle = load.trip.vehicle_id
    if change.kind == "stops_reordered" and len(moves) == 2:
        a, b = sorted(moves, key=lambda m: m["from"])
        # the stop that now comes later on the road now goes onto the truck earlier
        first = a if a["to"] > b["to"] else b
        other = b if first is a else a
        stop_count = len(load.trip.stops)
        done = _stop_done(load, first["order_ref"])
        where = "first" if first["to"] == stop_count else f"before {other['place']}"
        body = f"{head} {first['place']} now loads {where}{' (done)' if done else ''}. {tail}"
        return DockNoticeOut(
            id=change.id,
            trip_id=load.trip.id,
            vehicle_id=vehicle,
            kind="swap",
            stops=[a["from"], b["from"]],
            by=look.name(change.created_by),
            first_place=first["place"],
            other_place=other["place"],
            loads_first=first["to"] == stop_count,
            done=done,
            title=f"{vehicle} stops {a['from']} and {b['from']} swapped",
            body=body,
            at=change.created_at,
        )
    if change.kind == "stops_reordered":
        return DockNoticeOut(
            id=change.id,
            trip_id=load.trip.id,
            vehicle_id=vehicle,
            kind="reorder",
            stops=sorted(m["from"] for m in moves),
            by=look.name(change.created_by),
            first_place=None,
            other_place=None,
            loads_first=False,
            done=False,
            title=f"{vehicle} stop order changed",
            body=f"{head} Load in the order on this tablet. {tail}",
            at=change.created_at,
        )
    return None


def _stop_done(load: Load, order_ref: str) -> bool:
    stop_id = next((sid for sid, ref in load.refs.items() if ref == order_ref), None)
    lines = [line for line in load.lines if line.stop_id == stop_id]
    return bool(lines) and all(line.status in DONE for line in lines)


def trip_load(db: Session, trip: Trip) -> TripLoadOut:
    """LDR-02 and LDR-04: one load, stop groups in the order they go on (the last stop first)."""
    look = Lookup(db)
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    load = loads_for(db, [trip])[trip.id]
    changes = changes_after_publish(db, plan).get(trip.id, [])
    # A stop's label names the place it held until its latest move: "Was stop 3 until 2:53 AM", even when an
    # earlier change had moved it there from somewhere else.
    moved: dict[str, tuple[int, datetime]] = {}
    for change in changes:
        for move in change.detail.get("moves", []):
            if move["from"] != move["to"]:
                moved[move["order_ref"]] = (move["from"], change.created_at)
    groups = []
    in_order = sorted(trip.stops, key=lambda s: -s.seq)
    lines_of = {stop.id: [line for line in load.lines if line.stop_id == stop.id] for stop in in_order}
    # Loading now is one stop: the first, in loading order, with cases still to go on. A stop whose only open line
    # waits for the dispatcher is not it, so the dock moves on while the flag waits.
    loading_now = next((s.id for s in in_order if any(line.status in OPEN for line in lines_of[s.id])), None)
    for stop in in_order:
        order_ref = load.refs[stop.id]
        lines = lines_of[stop.id]
        state: GroupState
        if lines and all(line.status in DONE for line in lines):
            state = "done"
        elif stop.id == loading_now:
            state = "loading"
        else:
            state = "to_load"
        move = moved.get(order_ref)
        groups.append(
            StopGroupOut(
                stop_id=stop.id,
                seq=stop.seq,
                outlet_id=stop.outlet_id,
                place=look.outlets[stop.outlet_id].short_name,
                order_ref=order_ref,
                cases=sum(line.planned_qty for line in lines),
                loaded=sum(line.loaded_qty for line in lines),
                short=sum(
                    line.planned_qty - line.loaded_qty for line in lines if line.status is LoadLineStatus.DECIDED
                ),
                moved_from=move[0] if move and move[0] != stop.seq else None,
                moved_at=move[1] if move and move[0] != stop.seq else None,
                state=state,
                lines=[_line(look, line, load.shortfalls.get(line.id)) for line in lines],
            )
        )
    vehicle = look.vehicles[trip.vehicle_id]
    driver = look.driver_of(trip, plan.run_date)
    dispatcher = look.dispatcher()
    return TripLoadOut(
        trip_id=trip.id,
        vehicle_id=trip.vehicle_id,
        vehicle_kind=words.vehicle_kind(vehicle.type, vehicle.temp),
        trip_no=trip.trip_no,
        temp=trip.temp,
        brand=trip.brand,
        district=trip.district,
        driver=driver.display_name if driver else None,
        loader=look.name(trip.loader_id),
        planned_depart=trip.planned_depart,
        departed_at=trip.departed_at,
        state=load.state,
        plan_changed_at=changes[-1].created_at if changes else None,
        cases=load.cases,
        loaded=load.loaded,
        short=load.short,
        lines_total=len(load.lines),
        lines_done=load.lines_done,
        # a flagged line keeps its mark but waits on the dispatcher, so only the lines a loader can confirm count
        lines_to_check=sum(1 for line in load.lines if line.changed_by_plan and line.status not in FLAGGED),
        flags_waiting=load.flags_waiting,
        groups=groups,
        handover=_handover(look, trip, load),
        dispatcher=dispatcher.display_name if dispatcher else None,
        dispatcher_phone=dispatcher.phone if dispatcher else None,
        plan_changed_by=look.name(changes[-1].created_by) if changes else None,
    )


def _line(look: Lookup, line: LoadLine, shortfall: Shortfall | None) -> LoadLineOut:
    return LoadLineOut(
        id=line.id,
        case_type=line.case_type,
        qty=line.planned_qty,
        loaded=line.loaded_qty,
        status=line.status.value,
        changed_by_plan=line.changed_by_plan,
        shortfall=_shortfall(look, shortfall) if shortfall else None,
    )


def _shortfall(look: Lookup, s: Shortfall) -> ShortfallOut:
    added_day = None
    if s.added_to_order_ref:
        order = look.db.scalar(select(Order).where(Order.order_ref == s.added_to_order_ref))
        added_day = order.run_date if order else None
    line = look.db.get(LoadLine, s.load_line_id)
    stop = look.db.get(Stop, line.stop_id) if line else None
    manager = look.store_manager(stop.outlet_id) if stop else None
    return ShortfallOut(
        id=s.id,
        kind=s.kind.value,
        qty=s.qty,
        flagged_at=s.flagged_at,
        flagged_by=look.name(s.flagged_by),
        decision=s.decision.value if s.decision else None,
        decided_at=s.decided_at,
        decided_by=look.name(s.decided_by),
        added_to_order_ref=s.added_to_order_ref,
        added_to_day=added_day,
        store_contact=manager.display_name if manager else None,
        photo_id=s.photo_id,
    )


def _handover(look: Lookup, trip: Trip, load: Load) -> HandoverOut:
    types = look.case_types
    stops = []
    for stop in sorted(trip.stops, key=lambda s: s.seq):
        lines = [line for line in load.lines if line.stop_id == stop.id]
        stops.append(
            HandoverStopOut(
                seq=stop.seq,
                place=look.outlets[stop.outlet_id].short_name,
                planned=sum(line.planned_qty for line in lines),
                loaded=sum(line.loaded_qty for line in lines),
            )
        )
    h = load.handover
    return HandoverOut(
        completed_at=h.completed_at if h else None,
        completed_by=look.name(h.completed_by) if h else None,
        accepted_at=h.accepted_at if h else None,
        accepted_by=look.name(h.accepted_by) if h else None,
        accepted_on=h.accepted_on if h else None,
        difference=h.difference if h else "",
        stops=stops,
        planned_cases=load.cases,
        loaded_cases=load.loaded,
        planned_kg=round(sum(line.planned_qty * types[line.case_type].kg for line in load.lines), 1),
        loaded_kg=round(sum(line.loaded_qty * types[line.case_type].kg for line in load.lines), 1),
        planned_m3=round(sum(line.planned_qty * types[line.case_type].m3 for line in load.lines), 3),
        loaded_m3=round(sum(line.loaded_qty * types[line.case_type].m3 for line in load.lines), 3),
    )


# ------------------------------------------------------------------------------------------------ loading
def _reread(db: Session, line: LoadLine) -> None:
    db.scalar(select(LoadLine).where(LoadLine.id == line.id).execution_options(populate_existing=True))


def _open_trip(db: Session, line: LoadLine) -> Trip:
    """The line's trip, locked, with the line read again under the lock, so an action changes what the simulator
    or another tablet committed meanwhile rather than what this request read before it waited."""
    trip = lock_trip(db, line.trip_id)
    _reread(db, line)
    if trip.departed_at:
        raise DockError(f"{trip.vehicle_id} has left the hub.")
    handover = db.scalar(select(Handover).where(Handover.trip_id == trip.id).execution_options(populate_existing=True))
    if handover is not None and handover.completed_at:
        raise DockError("This load is marked complete, so its lines can no longer change.")
    return trip


def claim(trip: Trip, user: AppUser | None, now: datetime, *, scripted: bool = False) -> None:
    """Someone is working on this load. A person's work claims it, so the world simulator leaves it alone; the
    story autopilot's work (`scripted`) does not."""
    if user is not None:
        trip.loader_id = user.id
        if trip.claimed_at is None and not scripted:
            trip.claimed_at = now
    if trip.loading_started_at is None:
        trip.loading_started_at = now
    if trip.status is TripStatus.PLANNED:
        trip.status = TripStatus.LOADING


def set_loaded(
    db: Session, now: datetime, user: AppUser | None, line: LoadLine, loaded: int, *, scripted: bool = False
) -> Trip:
    """Check a line (all its cases on), uncheck it, or count part of it on. Either way the loader has looked at
    it again, so a mark left by a plan change goes."""
    trip = _open_trip(db, line)
    if line.status in FLAGGED:
        raise DockError("This line is flagged. Open it to see where it stands.")
    loaded = max(0, min(loaded, line.planned_qty))
    line.loaded_qty = loaded
    line.status = (
        LoadLineStatus.CHECKED
        if loaded == line.planned_qty
        else LoadLineStatus.IN_PROGRESS
        if loaded
        else LoadLineStatus.TO_LOAD
    )
    line.changed_by_plan = False
    line.updated_at = now
    line.updated_by = user.id if user else None
    claim(trip, user, now, scripted=scripted)
    return trip


def flag(
    db: Session,
    now: datetime,
    user: AppUser | None,
    line: LoadLine,
    kind: ShortfallKind,
    qty: int,
    *,
    scripted: bool = False,
) -> Shortfall:
    """A line is missing cases, or some are damaged. Loading goes on while the dispatcher decides."""
    trip = _open_trip(db, line)
    if line.status in FLAGGED:
        raise DockError("This line is already flagged.")
    qty = max(1, min(qty, line.planned_qty))
    look = Lookup(db)
    stop = db.get(Stop, line.stop_id)
    assert stop is not None
    order = db.get(Order, stop.order_id)
    assert order is not None
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    line.loaded_qty = line.planned_qty - qty
    line.status = LoadLineStatus.FLAG_WAITING
    line.changed_by_plan = False
    line.updated_at = now
    line.updated_by = user.id if user else None
    shortfall = Shortfall(
        load_line_id=line.id, kind=kind, qty=qty, flagged_at=now, flagged_by=user.id if user else None, note=""
    )
    db.add(shortfall)
    db.flush()
    case_type = look.case_types[line.case_type]
    outlet = look.outlets[stop.outlet_id]
    what = "missing" if kind is ShortfallKind.MISSING else "damaged"
    add_feed_item(
        db,
        now,
        kind=FeedKind.SHORTFALL,
        depot=plan.depot,
        title=f"{words.cases(case_type.name, qty)} {what} on {trip.vehicle_id}, stop {stop.seq}",
        body=f"{line.planned_qty - qty} of {line.planned_qty} on the shelf"
        if kind is ShortfallKind.MISSING
        else f"{qty} of {line.planned_qty} damaged and kept off the truck",
        ref={
            "shortfall_id": str(shortfall.id),
            "trip_id": str(trip.id),
            "vehicle_id": trip.vehicle_id,
            "stop_seq": stop.seq,
            "order_ref": order.order_ref,
            "outlet_id": outlet.outlet_id,
            "place": outlet.short_name,
        },
    )
    _audit(
        db,
        now,
        user,
        "load.flagged",
        "shortfall",
        shortfall.id,
        f"Flagged {qty} {what} on {trip.vehicle_id} stop {stop.seq} ({order.order_ref})",
    )
    claim(trip, user, now, scripted=scripted)
    return shortfall


def cancel_flag(db: Session, now: datetime, user: AppUser | None, line: LoadLine) -> None:
    """The cases turned up before the dispatcher answered."""
    trip = _open_trip(db, line)
    shortfall = db.scalar(
        select(Shortfall).where(Shortfall.load_line_id == line.id).execution_options(populate_existing=True)
    )
    if shortfall is None or line.status is not LoadLineStatus.FLAG_WAITING:
        raise DockError("There is no flag waiting on this line.")
    for item in _feed_items(db, shortfall):
        item.handled_at = now
        item.handled_by = user.id if user else None
        item.outcome = "Withdrawn by the dock: the cases were found."
    photo_id = shortfall.photo_id
    db.delete(shortfall)
    if photo_id is not None:
        db.flush()
        db.execute(delete(Photo).where(Photo.id == photo_id))
    line.status = LoadLineStatus.IN_PROGRESS if line.loaded_qty else LoadLineStatus.TO_LOAD
    line.updated_at = now
    line.updated_by = user.id if user else None
    claim(trip, user, now)


def attach_photo(
    db: Session, now: datetime, user: AppUser | None, line: LoadLine, data: bytes, content_type: str
) -> Shortfall:
    """A photo of the damaged cases, sent after the flag so the flag never waits on it. The dispatcher sees what the
    dock saw; a second photo replaces the first."""
    trip = _open_trip(db, line)
    shortfall = db.scalar(
        select(Shortfall).where(Shortfall.load_line_id == line.id).execution_options(populate_existing=True)
    )
    if shortfall is None:
        raise DockError("Flag the line first, then add the photo.")
    if len(data) > MAX_PHOTO_BYTES:
        raise DockError("The photo is too large.")
    if content_type not in PHOTO_TYPES:
        raise DockError("Send the photo as a JPEG.")
    photo = Photo(
        id=uuid.uuid4(),
        content_type=content_type,
        data=data,
        taken_at=now,
        uploaded_at=now,
        uploaded_by=user.id if user else None,
    )
    db.add(photo)
    db.flush()
    before = shortfall.photo_id
    shortfall.photo_id = photo.id
    if before is not None:
        db.flush()
        db.execute(delete(Photo).where(Photo.id == before))
    _audit(db, now, user, "load.photo", "shortfall", shortfall.id, f"Photo of the flagged cases on {trip.vehicle_id}")
    return shortfall


def depot_of(db: Session, shortfall: Shortfall) -> str:
    line = db.get(LoadLine, shortfall.load_line_id)
    trip = db.get(Trip, line.trip_id) if line else None
    plan = db.get(Plan, trip.plan_id) if trip else None
    return plan.depot if plan else "Kandy"


def _feed_items(db: Session, shortfall: Shortfall) -> list[FeedItem]:
    return [
        item
        for item in db.scalars(select(FeedItem).where(FeedItem.kind == FeedKind.SHORTFALL))
        if item.ref.get("shortfall_id") == str(shortfall.id)
    ]


def decide(
    db: Session, now: datetime, user: AppUser | None, shortfall: Shortfall, decision: ShortfallDecision
) -> Shortfall:
    """The dispatcher's answer: send the rest now, and either add the missing cases to the store's next order or
    leave them out. The store is told either way; at night the notice waits quietly until 5:00 AM."""
    line = db.get(LoadLine, shortfall.load_line_id)
    assert line is not None
    trip = lock_trip(db, line.trip_id)
    # read again under the lock: the dock may have withdrawn the flag, or another phone answered it, meanwhile
    if (
        db.scalar(select(Shortfall).where(Shortfall.id == shortfall.id).execution_options(populate_existing=True))
        is None
    ):
        raise DockError("The dock withdrew this flag: the cases were found.")
    _reread(db, line)
    if shortfall.decision is not None:
        if shortfall.decision is decision:
            return shortfall
        raise DockError("This flag already has an answer.")
    look = Lookup(db)
    stop = db.get(Stop, line.stop_id)
    assert stop is not None
    order = db.get(Order, stop.order_id)
    assert order is not None
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    case_type = look.case_types[line.case_type]
    carried: Order | None = None
    if decision is ShortfallDecision.SEND_SHORT:
        carried = carry_over(db, now, order, line.case_type, shortfall.qty, plan.run_date)
        shortfall.added_to_order_ref = carried.order_ref
    shortfall.decision = decision
    shortfall.decided_at = now
    shortfall.decided_by = user.id if user else None
    line.status = LoadLineStatus.DECIDED
    line.updated_at = now

    kind = "chilled" if order.temp == "chilled" else "dry"
    one = shortfall.qty == 1
    count = words.cases(case_type.name, shortfall.qty)
    shelf = line.planned_qty - shortfall.qty
    what = "missing" if shortfall.kind is ShortfallKind.MISSING else "damaged"
    if carried is not None:
        day = f"{carried.run_date:%A} {carried.run_date.day} {carried.run_date:%B}"
        still = (
            f"We have added {'it' if one else 'them'} to your {carried.run_date:%A} {kind} order "
            f"({carried.order_ref}), marked from {plan.run_date:%A}."
        )
        gone = f"The {what} case" if one else f"The {shortfall.qty} {what} cases"
        outcome = (
            f"Send short, add to {carried.run_date:%A}. {gone} joined {carried.order_ref}, "
            f"marked from {plan.run_date:%A}."
        )
    else:
        day = None
        still = (
            "It will not be replaced. Order it again if you still need it."
            if one
            else "They will not be replaced. Order them again if you still need them."
        )
        outcome = "Send short, no replacement."
    hub = DEPOT_LABEL.get(plan.depot, plan.depot)
    yours = words.cases(case_type.name, line.planned_qty)
    if shortfall.kind is not ShortfallKind.MISSING:
        found = f"{shortfall.qty} of your {yours} {'was' if one else 'were'} found damaged"
    elif shelf:
        found = f"only {shelf} of your {yours} {'was' if shelf == 1 else 'were'} on the shelf"
    else:
        found = f"none of your {yours} {'was' if line.planned_qty == 1 else 'were'} on the shelf"
    why = f"While your order was being loaded at the {hub}, {found}."
    why += " The dispatcher chose to send the rest of your order on time rather than hold the truck."
    notify_store(
        db,
        order.outlet_id,
        now,
        kind="short_delivery",
        title=f"{count[:1].upper()}{count[1:]} {'is' if one else 'are'} short in today's {kind} order",
        body=f"{still} {why}",
        data={
            "order_ref": order.order_ref,
            "case_type": line.case_type,
            "qty": shortfall.qty,
            "planned": line.planned_qty,
            "kind": shortfall.kind.value,
            "added_to": carried.order_ref if carried else None,
            "added_day": carried.run_date.isoformat() if carried else None,
            "day_label": day,
            "still": still,
            "why": why,
        },
        show_after=quiet_until(now),
    )
    for item in _feed_items(db, shortfall):
        # once answered, the item reads as the record of a shortfall, no longer as cases missing
        item.title = f"Shortfall on {trip.vehicle_id}, stop {stop.seq}"
        item.handled_at = now
        item.handled_by = user.id if user else None
        item.outcome = outcome
    _audit(db, now, user, "load.decided", "shortfall", shortfall.id, f"{order.order_ref}: {outcome}")
    return shortfall


def next_order(db: Session, order: Order, after: date) -> Order | None:
    """The store's next order of the same kind after a run, if it has placed one."""
    return db.scalar(
        select(Order)
        .where(
            Order.outlet_id == order.outlet_id,
            Order.brand == order.brand,
            Order.temp == order.temp,
            Order.run_date > after,
            Order.status.in_([OrderStatus.RECEIVED, OrderStatus.ALLOCATED]),
        )
        .order_by(Order.run_date, Order.order_ref)
        .limit(1)
    )


def carry_over(db: Session, now: datetime, order: Order, case_type: str, qty: int, after: date) -> Order:
    """Add cases that went short to the store's next order of the same kind, or open one for the next run."""
    look = Lookup(db)
    nxt = next_order(db, order, after)
    if nxt is None:
        day = next_operating_day(db, after)
        nxt = Order(
            order_ref=order_ref_for(db, day, order.outlet_id, order.temp),
            outlet_id=order.outlet_id,
            brand=order.brand,
            temp=order.temp,
            requested_date=day,
            run_date=day,
            units=0,
            weight_kg=0.0,
            volume_m3=0.0,
            status=OrderStatus.RECEIVED,
            source=OrderSource.CARRIED,
            placed_at=now,
        )
        db.add(nxt)
        db.flush()
    existing = next((line for line in nxt.lines if line.case_type == case_type), None)
    if existing is not None:
        existing.qty += qty
        existing.carried_qty += qty
        existing.carried_from = order.order_ref
    else:
        nxt.lines.append(
            OrderLine(
                position=len(nxt.lines),
                case_type=case_type,
                qty=qty,
                carried_qty=qty,
                carried_from=order.order_ref,
            )
        )
    kind = look.case_types[case_type]
    nxt.units += qty
    nxt.weight_kg = round(nxt.weight_kg + qty * kind.kg, 1)
    nxt.volume_m3 = round(nxt.volume_m3 + qty * kind.m3, 3)
    db.flush()
    return nxt


# ------------------------------------------------------------------------------------------------ handover
def complete(db: Session, now: datetime, user: AppUser | None, trip: Trip, *, scripted: bool = False) -> Handover:
    """Load complete: every line is on or decided. The handover goes to the driver's phone to accept."""
    lock_trip(db, trip.id)
    if trip.departed_at:
        raise DockError(f"{trip.vehicle_id} has left the hub.")
    load = loads_for(db, [trip], fresh=True)[trip.id]
    if load.flags_waiting:
        raise DockError("A flag is still waiting for the dispatcher. Load complete opens once it is answered.")
    open_lines = [line for line in load.lines if line.status not in DONE]
    if open_lines:
        n = len(open_lines)
        raise DockError(f"{n} {'line is' if n == 1 else 'lines are'} not loaded yet.")
    handover = load.handover or Handover(trip_id=trip.id, planned_cases=0, loaded_cases=0, completed_at=now)
    if handover.completed_at and load.handover is not None:
        return handover
    handover.planned_cases = load.cases
    handover.loaded_cases = load.loaded
    handover.completed_at = now
    handover.completed_by = user.id if user else trip.loader_id
    if load.handover is None:
        db.add(handover)
    claim(trip, user, now, scripted=scripted)
    look = Lookup(db)
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    driver = look.driver_of(trip, plan.run_date)
    if driver is not None:
        db.add(
            Notification(
                user_id=driver.id,
                kind="load_ready",
                title=f"{trip.vehicle_id} is loaded. Check it and accept it.",
                body=f"{load.loaded} of {load.cases} {'case' if load.cases == 1 else 'cases'} on the truck"
                + (f", {load.short} short." if load.short else "."),
                data={"trip_id": str(trip.id)},
                created_at=now,
                show_after=now,
            )
        )
    _audit(
        db,
        now,
        user,
        "load.completed",
        "trip",
        trip.id,
        f"Load complete on {trip.vehicle_id} trip {trip.trip_no}: {load.loaded} of {load.cases} cases",
    )
    return handover


def accept(db: Session, now: datetime, driver: AppUser, trip: Trip, on: str) -> Handover:
    """The driver accepts the load: on their phone, or on the dock tablet with their own PIN."""
    lock_trip(db, trip.id)
    handover = db.scalar(select(Handover).where(Handover.trip_id == trip.id).execution_options(populate_existing=True))
    if handover is None or handover.completed_at is None:
        raise DockError("The load is not marked complete yet.")
    if handover.accepted_at is not None:
        return handover
    handover.accepted_at = now
    handover.accepted_by = driver.id
    handover.accepted_on = on
    trip.status = TripStatus.LOADED
    _audit(
        db,
        now,
        driver,
        "load.accepted",
        "trip",
        trip.id,
        f"{driver.display_name} accepted {trip.vehicle_id} trip {trip.trip_no} on the {on}",
    )
    return handover


def depart(db: Session, now: datetime, trip: Trip, actor: AppUser | None = None) -> None:
    if trip.departed_at is None:
        trip.departed_at = now
        trip.status = TripStatus.DEPARTED
        _audit(db, now, actor, "trip.departed", "trip", trip.id, f"{trip.vehicle_id} left the hub")


def _audit(
    db: Session, now: datetime, user: AppUser | None, action: str, entity: str, entity_id: object, summary: str
) -> None:
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id if user else None,
            actor_label=user.display_name if user else "Relay",
            action=action,
            entity=entity,
            entity_id=str(entity_id),
            summary=summary,
        )
    )
