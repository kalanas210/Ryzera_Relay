"""The story autopilot: the steps the four judge characters take in the story, played only when a judge skips
past them.

A judge can walk the whole day, or jump straight to the dock at 2:40 AM, or to the driver on the road. When the
demo bar moves the clock forward, every story step whose time has passed and that nobody took is played as the
story wrote it, in order, through the same services a person uses: Dilani's orders, the plan and its deferral,
publishing, the 9:12 PM swap, Rizwan's loading and flag, Nuwan's answer, the handover. A step the judge already
took, or one that no longer fits what the judge did (an order moved, a stop swapped by hand), is left alone. When
time simply runs, nothing is played: the characters wait for the judge.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO, DELIVERY_DAY, MOMENTS, PLANNING_DAY, Moment, at
from relay_api.config import get_settings
from relay_api.models import (
    AppUser,
    Deferral,
    LoadLine,
    LoadLineStatus,
    Order,
    OrderSource,
    Outlet,
    Plan,
    PlanChange,
    PlanStatus,
    Role,
    Shortfall,
    ShortfallDecision,
    ShortfallKind,
    Stop,
    Trip,
    Workspace,
)
from relay_api.seed.story import judge_order_rows, parse_lines
from relay_api.services import changes, dock, planning
from relay_api.services.ordering import LineInput, place_order

log = logging.getLogger("relay.story")

DRY_ORDER = "ORD0098595"
"""Dilani's dry order: the story follows the truck that carries it."""
SWAP_WITH = "ORD0098597"
"""Mawanella's dry order, which Nuwan moves ahead of Dilani's at 9:12 PM."""
SWAP_NOTE = "Mawanella's curb is a bus stop from 5:30 AM, so the store asked to be served earlier."
SHORT_CASE = "rice_dhal"
SHORT_QTY = 6


@dataclass(frozen=True)
class Cast:
    dispatcher: AppUser
    loader: AppUser
    driver: AppUser
    store: AppUser


@dataclass(frozen=True)
class Step:
    key: str
    label: str
    when: Callable[[Session], datetime | None]
    """The step's time in the story, or None while it cannot apply (no plan yet, say)."""
    play: Callable[[Session, datetime, Cast], bool]
    """Take the step at `now`. False when there was nothing to do: the judge had already done it."""


# ------------------------------------------------------------------------------------------------ helpers
def cast(db: Session) -> Cast | None:
    judges = {u.role: u for u in db.scalars(select(AppUser).where(AppUser.judge_account.is_(True)))}
    try:
        return Cast(judges[Role.DISPATCHER], judges[Role.LOADER], judges[Role.DRIVER], judges[Role.STORE_MANAGER])
    except KeyError:
        return None


def _day(iso: str) -> date:
    return date.fromisoformat(iso)


def _plan(db: Session, depot: str) -> Plan:
    return planning.get_plan(db, depot, _day(DELIVERY_DAY))


def story_trip(db: Session) -> Trip | None:
    """The published trip carrying Dilani's dry order."""
    order = db.scalar(select(Order).where(Order.order_ref == DRY_ORDER))
    if order is None:
        return None
    stop = db.scalar(
        select(Stop)
        .join(Trip, Trip.id == Stop.trip_id)
        .join(Plan, Plan.id == Trip.plan_id)
        .where(Stop.order_id == order.id, Plan.status == PlanStatus.PUBLISHED, Trip.is_backup.is_(False))
    )
    return db.get(Trip, stop.trip_id) if stop else None


def _lines_of_stop(db: Session, trip: Trip, order_ref: str) -> list[LoadLine]:
    order = db.scalar(select(Order).where(Order.order_ref == order_ref))
    stop = next((s for s in trip.stops if order and s.order_id == order.id), None)
    if stop is None:
        return []
    return list(db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id).order_by(LoadLine.load_order)))


def _judge_untouched(trip: Trip) -> bool:
    return trip.claimed_at is None


def _fixed(day: str, clock: str) -> Callable[[Session], datetime]:
    moment = at(day, clock)
    return lambda _db: moment


def _from_departure(minutes: int, latest: str | None = None) -> Callable[[Session], datetime | None]:
    """A time set by the story truck's departure: `minutes` after it (or before, if negative), and no later
    than `latest` on the delivery day."""

    def when(db: Session) -> datetime | None:
        trip = story_trip(db)
        if trip is None:
            return None
        moment = trip.planned_depart + timedelta(minutes=minutes)
        if latest is not None:
            moment = min(moment, at(DELIVERY_DAY, latest))
        return moment

    return when


# ------------------------------------------------------------------------------------------------ the steps
def _dilani_orders(db: Session, _now: datetime, people: Cast) -> bool:
    """Dilani's two Wednesday orders, at the story's 2:10 and 2:14 PM. Not once the Kandy plan exists: a plan
    proposed without them is the judge's own story."""
    store = people.store
    outlet = db.get(Outlet, store.outlet_id) if store.outlet_id else None
    if outlet is None or _plan(db, "Kandy").trips:
        return False
    placed = {
        o.temp
        for o in db.scalars(
            select(Order).where(Order.outlet_id == outlet.outlet_id, Order.requested_date == _day(DELIVERY_DAY))
        )
    }
    rows = [r for r in judge_order_rows(get_settings().seed_dir, outlet.outlet_id) if r["temp"] not in placed]
    for row in sorted(rows, key=lambda r: r["placed_at"]):
        place_order(
            db,
            datetime.fromisoformat(row["placed_at"]).replace(tzinfo=COLOMBO),
            outlet,
            row["temp"],
            [LineInput(code, qty) for code, qty in parse_lines(row["lines"])],
            requested_date=_day(DELIVERY_DAY),
            source=OrderSource.STORE,
            placed_by=store,
            order_ref=row["order_ref"],
        )
    return bool(rows)


def _propose(depot: str) -> Callable[[Session, datetime, Cast], bool]:
    def play(db: Session, now: datetime, _people: Cast) -> bool:
        plan = _plan(db, depot)
        if plan.status is PlanStatus.PUBLISHED or plan.trips:
            return False
        planning.propose_plan(db, now, plan)
        return True

    return play


def _confirm(db: Session, now: datetime, people: Cast, plan: Plan) -> bool:
    did = False
    for deferral in db.scalars(select(Deferral).where(Deferral.plan_id == plan.id, Deferral.confirmed_at.is_(None))):
        order = db.get(Order, deferral.order_id)
        if order is None:
            continue
        reason = deferral.explanation.get("suggested_reason") or "other"
        note = "" if reason != "other" else "Deferred as proposed."
        planning.confirm_deferral(db, now, plan, order.order_ref, reason, note, people.dispatcher)
        did = True
    return did


def _confirm_kandy(db: Session, now: datetime, people: Cast) -> bool:
    plan = _plan(db, "Kandy")
    if plan.status is PlanStatus.PUBLISHED:
        return False
    return _confirm(db, now, people, plan)


def _publish(depot: str) -> Callable[[Session, datetime, Cast], bool]:
    def play(db: Session, now: datetime, people: Cast) -> bool:
        plan = _plan(db, depot)
        if plan.status is PlanStatus.PUBLISHED:
            return False
        if not plan.trips:
            planning.propose_plan(db, now, plan)
        _confirm(db, now, people, plan)
        planning.publish(db, now, plan, people.dispatcher)
        return True

    return play


def _swap(db: Session, now: datetime, people: Cast) -> bool:
    trip = story_trip(db)
    if trip is None:
        return False
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    if db.scalar(select(PlanChange.id).where(PlanChange.trip_id == trip.id)) is not None:
        return False  # the dispatcher already changed this trip by hand
    orders = {
        o.id: o.order_ref for o in db.scalars(select(Order).where(Order.id.in_([s.order_id for s in trip.stops])))
    }
    refs = [orders[s.order_id] for s in sorted(trip.stops, key=lambda s: s.seq)]
    if DRY_ORDER not in refs or SWAP_WITH not in refs:
        return False
    i, j = refs.index(DRY_ORDER), refs.index(SWAP_WITH)
    if j != i + 1:
        return False
    refs[i], refs[j] = refs[j], refs[i]
    try:
        changes.reorder(db, now, plan, trip, refs, people.dispatcher, SWAP_NOTE)
    except planning.PlanError as exc:
        log.info("Story swap skipped: %s", exc)
        return False
    return True


def _load_last_stop(db: Session, now: datetime, people: Cast) -> bool:
    """Rizwan starts VEH045 at 2:20 and has the last stop on by 2:40."""
    trip = story_trip(db)
    if trip is None or not _judge_untouched(trip) or trip.loading_started_at is not None:
        return False
    last = max(trip.stops, key=lambda s: s.seq)
    lines = db.scalars(select(LoadLine).where(LoadLine.stop_id == last.id).order_by(LoadLine.load_order)).all()
    start = at(DELIVERY_DAY, "02:20")
    for n, line in enumerate(lines, start=1):
        dock.set_loaded(
            db, start + (now - start) * n / max(1, len(lines)), people.loader, line, line.planned_qty, scripted=True
        )
    trip.loading_started_at = start
    return True


def _flag(db: Session, now: datetime, people: Cast) -> bool:
    """At 2:47 Rizwan finds 30 of the 36 rice and dhal cases for Dilani's store and flags the other 6."""
    trip = story_trip(db)
    if trip is None or not _judge_untouched(trip):
        return False
    line = next((x for x in _lines_of_stop(db, trip, DRY_ORDER) if x.case_type == SHORT_CASE), None)
    if line is None or line.status is not LoadLineStatus.TO_LOAD:
        return False
    dock.flag(db, now, people.loader, line, ShortfallKind.MISSING, SHORT_QTY, scripted=True)
    return True


def _answer(db: Session, now: datetime, people: Cast) -> bool:
    """Nuwan answers any flag still waiting on the story truck: send short, add to the store's next order."""
    trip = story_trip(db)
    if trip is None:
        return False
    waiting = db.scalars(
        select(Shortfall)
        .join(LoadLine, LoadLine.id == Shortfall.load_line_id)
        .where(LoadLine.trip_id == trip.id, Shortfall.decision.is_(None))
    ).all()
    for shortfall in waiting:
        dock.decide(db, now, people.dispatcher, shortfall, ShortfallDecision.SEND_SHORT)
    return bool(waiting)


def _finish_loading(db: Session, now: datetime, people: Cast) -> bool:
    """Every line on or decided. Played even on a load the judge started, so the truck can leave on time."""
    trip = story_trip(db)
    if trip is None or trip.departed_at is not None:
        return False
    _answer(db, now, people)
    lines = db.scalars(select(LoadLine).where(LoadLine.trip_id == trip.id).order_by(LoadLine.load_order)).all()
    todo = [line for line in lines if line.status in (LoadLineStatus.TO_LOAD, LoadLineStatus.IN_PROGRESS)]
    for line in todo:
        dock.set_loaded(db, now, people.loader, line, line.planned_qty, scripted=True)
    return bool(todo)


def _handover(db: Session, now: datetime, people: Cast) -> bool:
    trip = story_trip(db)
    if trip is None or trip.departed_at is not None:
        return False
    did = False
    load = dock.loads_for(db, [trip])[trip.id]
    if not load.complete:
        dock.complete(db, now, people.loader, trip, scripted=True)
        did = True
    handover = dock.loads_for(db, [trip])[trip.id].handover
    if handover is not None and handover.accepted_at is None:
        dock.accept(db, now, people.driver, trip, on="phone")
        did = True
    return did


def _leave(db: Session, now: datetime, people: Cast) -> bool:
    trip = story_trip(db)
    if trip is None or trip.departed_at is not None:
        return False
    load = dock.loads_for(db, [trip])[trip.id]
    if load.handover is None or load.handover.accepted_at is None:
        return False
    dock.depart(db, now, trip, people.driver)
    return True


STEPS: tuple[Step, ...] = (
    Step("dilani_orders", "Dilani places her chilled and dry orders", _fixed(PLANNING_DAY, "14:14"), _dilani_orders),
    Step("propose_kandy", "Relay proposes the Kandy plan", _fixed(PLANNING_DAY, "16:35"), _propose("Kandy")),
    Step(
        "confirm_kandy",
        "Nuwan confirms the deferral with Relay's reason",
        _fixed(PLANNING_DAY, "16:52"),
        _confirm_kandy,
    ),
    Step("publish_peliyagoda", "Nuwan publishes Peliyagoda", _fixed(PLANNING_DAY, "18:31"), _publish("Peliyagoda")),
    Step("publish_kandy", "Nuwan publishes the Kandy plan", _fixed(PLANNING_DAY, "18:40"), _publish("Kandy")),
    Step("swap", "Nuwan swaps two stops on Kasun's run", _fixed(PLANNING_DAY, "21:12"), _swap),
    Step("load_last_stop", "Rizwan loads the last stop first", _fixed(DELIVERY_DAY, "02:40"), _load_last_stop),
    Step("flag", "Rizwan flags 6 rice and dhal cases missing", _fixed(DELIVERY_DAY, "02:47"), _flag),
    Step("answer", "Nuwan answers: send short, add to Thursday", _fixed(DELIVERY_DAY, "02:52"), _answer),
    Step("finish_loading", "Rizwan finishes loading", _from_departure(-14, latest="03:30"), _finish_loading),
    Step("handover", "Load complete, and Kasun accepts it", _from_departure(-12, latest="03:32"), _handover),
    Step("leave", "Kasun leaves the hub", _from_departure(4), _leave),
)


def pending(db: Session, workspace: Workspace, until: datetime) -> list[tuple[datetime, Step]]:
    """Story steps due by `until` that no jump has settled yet, in story order."""
    settled = workspace.state.get("story", {})
    out = []
    for step in STEPS:
        if step.key in settled:
            continue
        moment = step.when(db)
        if moment is not None and moment <= until:
            out.append((moment, step))
    return sorted(out, key=lambda pair: pair[0])


def settle(workspace: Workspace, step: Step, played: bool) -> None:
    workspace.state = {**workspace.state, "story": {**workspace.state.get("story", {}), step.key: played}}


def moments(db: Session) -> list[Moment]:
    """The demo bar's moments. Those at the dock follow the published story truck: the handover sits just before
    it leaves, whatever time the plan gave it."""
    handover = _from_departure(-13, latest="03:31")(db)
    out = []
    for m in MOMENTS:
        if m.key == "handover" and handover is not None:
            m = Moment(m.key, m.label, handover)
        out.append(m)
    return sorted(out, key=lambda m: m.at)


def moment_time(key: str) -> Callable[[Session], datetime] | None:
    """A moment's time as the day stands, for a jump to work out again after each step it plays: before the Kandy
    plan is published the handover only has its default time, and the steps on the way publish it."""
    if not any(m.key == key for m in MOMENTS):
        return None
    return lambda db: next(m.at for m in moments(db) if m.key == key)
