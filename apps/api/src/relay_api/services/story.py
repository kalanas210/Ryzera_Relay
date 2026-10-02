"""The story autopilot: the steps the four judge characters take in the story, played only when a judge skips
past them.

A judge can walk the whole day, or jump straight to the dock at 2:40 AM, or to the driver on the road. When the
demo bar moves the clock forward, every story step whose time has passed and that nobody took is played as the
story wrote it, in order, through the same services a person uses: Dilani's orders, the plan and its deferral,
publishing, the 9:12 PM swap, Rizwan's loading and flag, Nuwan's answer, the handover, and then Kasun's morning on
the road: the stops, the signal lost near Mawanella, Nuwan's backup, Dilani's receipt, and the one question when the
phone comes back. A step the judge already took, or one that no longer fits what the judge did (an order moved, a
stop swapped by hand, a backup already sent or called off), is left alone. When time simply runs, nothing is played:
the characters wait for the judge.

On the road Kasun keeps the story's own times (Kegalle at 4:52 AM, and so on), later only when the truck left too
late for them. The thunderstorm is not a character: from 5:41 to 7:14 AM Kasun's phone has no network whoever holds
it, and Relay takes nothing from it in that window. Outside it the phone checks in each minute while the truck is
out. What Kasun records inside it waits in the phone's outbox (one scheduled event) until the signal returns, then
reaches Relay in the order it was saved, each record with its own time. A judge's phone in the storm hands what it
saves to that same outbox (the demo's stand-in for the phone's own memory, never shown to the office), so a jump
leaves those stops to it and plays only what nobody did; the phone reads the outbox back, so the stops a jump played
show on it as saved there. A step already recorded, by either phone, is never played again.
"""

from __future__ import annotations

import logging
import struct
import uuid
import zlib
from collections.abc import Callable
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import cache
from itertools import groupby
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO, DELIVERY_DAY, MOMENTS, PLANNING_DAY, Moment, at
from relay_api.config import get_settings
from relay_api.models import (
    AppUser,
    Conflict,
    ConflictStatus,
    Deferral,
    DeviceContact,
    FeedItem,
    FeedKind,
    FieldEvent,
    FieldEventKind,
    FieldEventOutcome,
    LoadLine,
    LoadLineStatus,
    Order,
    OrderSource,
    Outlet,
    Plan,
    PlanChange,
    PlanStatus,
    Receipt,
    Role,
    ScheduledEvent,
    Shortfall,
    ShortfallDecision,
    ShortfallKind,
    Stop,
    StopStatus,
    Trip,
    Workspace,
)
from relay_api.seed.story import judge_order_rows, parse_lines
from relay_api.services import backup, changes, dock, planning, tracker, world
from relay_api.services import field as records
from relay_api.services import network as adapters
from relay_api.services.estimates import run_estimate
from relay_api.services.ordering import LineInput, next_operating_day, place_order
from relay_engine.clock import expected
from relay_engine.network import Brand

log = logging.getLogger("relay.story")

DRY_ORDER = "ORD0098595"
"""Dilani's dry order: the story follows the truck that carries it."""
SWAP_WITH = "ORD0098597"
"""Mawanella's dry order, which Nuwan moves ahead of Dilani's at 9:12 PM."""
SWAP_NOTE = "Mawanella's curb is a bus stop from 5:30 AM, so the store asked to be served earlier."
SHORT_CASE = "rice_dhal"
SHORT_QTY = 6

OUTAGE = (at(DELIVERY_DAY, "05:41"), at(DELIVERY_DAY, "07:14"))
"""The thunderstorm that takes Kasun's network down around Mawanella and the hill roads, 93 minutes."""
DEVICE = "relay-story"
"""The phone the autopilot carries for Kasun when a judge skips ahead on the road."""
RELEASE = "phone_back"
"""The scheduled event that holds what the phone saved with no signal, and sends it when the signal returns."""
GRACE = timedelta(minutes=1)
"""How long a judge who lands on a step that is theirs to take has before a later jump plays it."""
STOP_RECORDS = (FieldEventKind.ARRIVED, FieldEventKind.DELIVERED, FieldEventKind.FAILED)


@dataclass(frozen=True)
class Visit:
    """Kasun at the stops of the run, in order, at the story's times."""

    arrive: str
    deliver: str


VISITS = (Visit("04:52", "05:11"), Visit("05:30", "05:59"), Visit("06:21", "06:36"), Visit("06:56", "07:09"))
ANSWER_AT = "07:15"
FINISH_AT = "07:17"
RECEIVERS = {"OUT119": "P. Silva", "OUT118": "N. Wijesinghe", "OUT117": "W. Rathnayake", "OUT116": "K. Herath"}
"""Who signs for the goods at each of Kasun's stores."""
SIGNATURE = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 80">'
    '<path d="M12 54c10-26 22-38 28-22s-8 30 4 24 16-40 28-32-2 32 10 28 20-26 32-18 8 18 24 10 28-14 40-8" '
    'fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg>'
)
"""The receiver's signature at a street stop, where the goods go in through the front and no photo is taken."""
MOVE_AT = "06:15"
RECEIPT_AT = "06:42"
KEEP_AT = "06:44"
DELAY_HANDLED_AT = "04:35"


@dataclass(frozen=True)
class Cast:
    dispatcher: AppUser
    loader: AppUser
    driver: AppUser
    store: AppUser


@dataclass(frozen=True)
class Step:
    key: str
    label: str | Callable[[Session], str]
    """What the demo bar says was played; worked out from the day when it names a place."""
    when: Callable[[Session], datetime | None]
    """The step's time in the story, or None while it cannot apply (no plan yet, say)."""
    play: Callable[[Session, datetime, Cast], bool]
    """Take the step at `now`. False when there was nothing to do: the judge had already done it."""
    after: bool = False
    """Played only once the clock is a minute past its time, so a jump that lands on it leaves the step to the judge;
    played, it still happens at its own time."""


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


# ------------------------------------------------------------------------------------------------ on the road
def _stops(trip: Trip) -> list[Stop]:
    return sorted(trip.stops, key=lambda s: s.seq)


def _running(db: Session) -> Trip | None:
    """The story truck while it is on the road."""
    trip = story_trip(db)
    return trip if trip is not None and trip.departed_at is not None and trip.finished_at is None else None


def _late(db: Session, trip: Trip) -> timedelta:
    """How much later than the story Kasun's day runs: nothing, unless the truck left too late to reach the first
    stop at the story's time on Relay's expected clock. Every time Kasun keeps moves by this much. Worked out once
    per session for a departure: every stop of the run is in one district, so the first leg is the same to each."""
    first = next((s for s in _stops(trip) if s.status not in (StopStatus.MOVED, StopStatus.CANCELLED)), None)
    plan = db.get(Plan, trip.plan_id)
    if trip.departed_at is None or first is None or plan is None:
        return timedelta(0)
    known: dict[tuple[uuid.UUID, datetime], timedelta] = db.info.setdefault("story_late", {})
    key = (trip.id, trip.departed_at)
    if key not in known:
        depart = adapters.minutes_of(plan.run_date, trip.departed_at)
        conditions = adapters.conditions(db, plan.run_date)
        rows, _ = expected(adapters.network(db), conditions, [first.outlet_id], depart, Brand(trip.brand))
        earliest = adapters.at_minutes(plan.run_date, rows[0].arrive)
        known[key] = max(timedelta(0), earliest - at(DELIVERY_DAY, VISITS[0].arrive))
    return known[key]


def _on_the_road(clock: str) -> Callable[[Session], datetime | None]:
    """A time on Kasun's road: the story's, moved by how late the truck left. None until it has left."""

    def when(db: Session) -> datetime | None:
        trip = story_trip(db)
        if trip is None or trip.departed_at is None:
            return None
        return at(DELIVERY_DAY, clock) + _late(db, trip)

    return when


def offline(now: datetime) -> bool:
    return OUTAGE[0] <= now < OUTAGE[1]


def outage(workspace: Workspace, user: AppUser) -> dict[str, datetime] | None:
    """The loss of signal the story scripts for this driver's phone, whoever holds it. The judges' driver has it from
    the start of the day, so the phone can obey it the minute it begins."""
    window = (workspace.state.get("outages") or {}).get(user.username)
    if window:
        return {k: datetime.fromisoformat(v) for k, v in window.items()}
    if user.judge_account and user.role is Role.DRIVER:
        return {"from": OUTAGE[0], "to": OUTAGE[1]}
    return None


def no_signal(workspace: Workspace, user: AppUser, now: datetime) -> dict[str, datetime] | None:
    """The outage this driver's phone is inside at `now`: nothing it sends reaches Relay until it ends."""
    window = outage(workspace, user)
    return window if window is not None and window["from"] <= now < window["to"] else None


def _outbox(db: Session) -> ScheduledEvent | None:
    return db.scalar(select(ScheduledEvent).where(ScheduledEvent.kind == RELEASE, ScheduledEvent.done_at.is_(None)))


def _open_outbox(db: Session, driver: AppUser, trip: Trip) -> ScheduledEvent:
    """The phone's outbox for the outage. It remembers each stop as the phone last saw it before the signal went,
    so what Kasun records offline carries that version, as a real phone's records do."""
    event = _outbox(db)
    if event is None:
        event = ScheduledEvent(
            due_at=OUTAGE[1],
            kind=RELEASE,
            payload={
                "username": driver.username,
                "device_id": DEVICE,
                "seen": {str(s.id): [s.version, s.status.value] for s in trip.stops},
                "records": [],
                "photos": [],
            },
        )
        db.add(event)
        db.flush()
    return event


def _held(db: Session, stop: Stop) -> set[FieldEventKind]:
    """What the phone's outbox already holds for a stop, whichever phone saved it."""
    event = _outbox(db)
    rows = event.payload.get("records", []) if event is not None else []
    return {FieldEventKind(r["kind"]) for r in rows if r["stop_id"] == str(stop.id)}


def memory(db: Session) -> dict[str, Any] | None:
    """The phone's outbox while the storm lasts: each stop as the phone last saw it, and what it holds."""
    event = _outbox(db)
    return event.payload if event is not None else None


def hold(
    db: Session, user: AppUser, device_id: str, saved: list[records.RecordIn], photos: list[dict[str, Any]]
) -> None:
    """What a judge's phone saved in the storm joins the phone's outbox, where the autopilot sees it and leaves those
    stops alone, and which sends it when the signal returns. Idempotent by each record's and photo's id."""
    people = cast(db)
    trip = _running(db)
    if people is None or trip is None or user.id != people.driver.id:
        return
    event = _open_outbox(db, user, trip)
    held = event.payload.get("records", [])
    pictures = event.payload.get("photos", [])
    known = {r["id"] for r in held} | {p["id"] for p in pictures}
    rows = [{**_dump(r), "device_id": device_id} for r in saved if str(r.id) not in known]
    pics = [{**p, "device_id": device_id} for p in photos if str(p["id"]) not in known]
    if rows or pics:
        event.payload = {**event.payload, "records": [*held, *rows], "photos": [*pictures, *pics]}


def stand_in(db: Session, photo_id: uuid.UUID) -> bytes | None:
    """The photo the autopilot's Kasun took at a rear dock, for the phone that shows it as saved there."""
    payload = memory(db) or {}
    photo = next((p for p in payload.get("photos", []) if p["id"] == str(photo_id) and "piles" in p), None)
    return stand_in_photo(photo["piles"]) if photo else None


def _check_in(db: Session, driver: AppUser, moment: datetime) -> DeviceContact:
    """One of the phone's minute check-ins: it reached Relay at `moment`."""
    minute = moment.astimezone(COLOMBO).replace(second=0, microsecond=0)
    contact = records.contact_of(db, driver.id)
    if contact is None:
        contact = DeviceContact(user_id=driver.id, last_contact_at=minute, pending_records=0, device_id=DEVICE)
        db.add(contact)
    elif contact.last_contact_at < minute:
        contact.last_contact_at = minute
        contact.device_id = DEVICE
    return contact


def phone(db: Session, workspace: Workspace, now: datetime) -> None:
    """Kasun's phone as the clock runs, on every tick and jump. The storm is recorded for that phone whoever holds it,
    so a judge's phone obeys it too. While the truck is out the phone checks in each minute, holds at the last
    check-in before the storm, and opens its outbox there; the outbox sends itself when the signal returns."""
    people = cast(db)
    if people is None:
        return
    driver = people.driver
    outages = workspace.state.get("outages") or {}
    if now >= OUTAGE[0] and driver.username not in outages:
        window = {"from": OUTAGE[0].isoformat(), "to": OUTAGE[1].isoformat()}
        workspace.state = {**workspace.state, "outages": {**outages, driver.username: window}}
    trip = _running(db)
    if trip is None:
        return
    if offline(now):
        _check_in(db, driver, min(now, OUTAGE[0]))
        _open_outbox(db, driver, trip)
    elif now < OUTAGE[0] or _outbox(db) is None:
        _check_in(db, driver, now)


def release(db: Session, event: ScheduledEvent) -> None:
    """The signal is back: the phone sends what it saved, stop records first in the order they were saved, then the
    photos (a judge's phone sends its own photo files itself). With nothing saved it simply checks in, and Relay sees
    it is back in contact."""
    payload = event.payload
    driver = db.scalar(select(AppUser).where(AppUser.username == payload.get("username")))
    if driver is None:
        return
    rows = sorted(payload.get("records", []), key=lambda r: r["occurred_at"])
    photos = payload.get("photos", [])

    def device(row: dict[str, Any]) -> str:
        return str(row.get("device_id") or payload["device_id"])

    saved = [_record(row) for row in rows]
    back_from = records.touch_contact(
        db, event.due_at, driver, device(rows[-1]) if rows else payload["device_id"], saved
    )
    results: list[records.Result] = []
    for phone_id, group in groupby(rows, key=device):
        results += records.apply(db, event.due_at, driver, phone_id, [_record(row) for row in group])
    for photo in photos:
        if "piles" in photo:
            _send_photo(db, event.due_at, driver, photo)
    if back_from is not None:
        records.back_in_contact(db, event.due_at, driver, back_from, records.received(results) + len(photos))


def _dump(record: records.RecordIn) -> dict[str, Any]:
    return {
        "id": str(record.id),
        "kind": record.kind.value,
        "trip_id": str(record.trip_id) if record.trip_id else None,
        "stop_id": str(record.stop_id) if record.stop_id else None,
        "occurred_at": record.occurred_at.isoformat(),
        "base_version": record.base_version,
        "lat": record.lat,
        "lng": record.lng,
        "accuracy_m": record.accuracy_m,
        "payload": record.payload,
    }


def _record(row: dict[str, Any]) -> records.RecordIn:
    return records.RecordIn(
        id=uuid.UUID(row["id"]),
        kind=FieldEventKind(row["kind"]),
        trip_id=uuid.UUID(row["trip_id"]) if row["trip_id"] else None,
        stop_id=uuid.UUID(row["stop_id"]) if row["stop_id"] else None,
        occurred_at=datetime.fromisoformat(row["occurred_at"]),
        base_version=row["base_version"],
        lat=row.get("lat"),
        lng=row.get("lng"),
        accuracy_m=row.get("accuracy_m"),
        payload=row["payload"],
    )


def _send_photo(db: Session, now: datetime, driver: AppUser, photo: dict[str, Any]) -> None:
    data = stand_in_photo(photo["piles"])
    try:
        records.store_photo(
            db,
            now,
            driver,
            uuid.UUID(photo["id"]),
            data,
            "image/png",
            stop_id=uuid.UUID(photo["stop_id"]),
            event_id=uuid.UUID(photo["event_id"]),
            taken_at=datetime.fromisoformat(photo["taken_at"]),
            width=PHOTO_SIZE[0],
            height=PHOTO_SIZE[1],
        )
    except records.FieldError as exc:
        log.info("Story photo not stored: %s", exc)


def _save(
    db: Session, now: datetime, people: Cast, trip: Trip, record: records.RecordIn, photo: dict[str, Any] | None
) -> bool:
    """Kasun records something on the phone at `now`. With signal it reaches Relay at once; inside the storm it
    waits in the outbox, against the version of the stop the phone last saw."""
    if offline(now):
        event = _open_outbox(db, people.driver, trip)
        seen = event.payload.get("seen", {}).get(str(record.stop_id)) if record.stop_id else None
        if seen is not None:
            record.base_version = seen[0]
        event.payload = {
            **event.payload,
            "records": [*event.payload.get("records", []), _dump(record)],
            "photos": [*event.payload.get("photos", []), *([photo] if photo else [])],
        }
        return True
    [result] = records.receive(db, now, people.driver, DEVICE, [record])
    if photo is not None and result.outcome is not FieldEventOutcome.REJECTED:
        _send_photo(db, now, people.driver, photo)
    return result.outcome is not FieldEventOutcome.REJECTED


def _to_do(db: Session, trip: Trip, stop: Stop, now: datetime) -> StopStatus:
    """Where a stop stands for Kasun: as Relay has it while the phone has signal, as the phone last saw it inside
    the storm. A stop moved while the phone had no signal is still Kasun's to drive to: nobody could say."""
    if offline(now):
        event = _outbox(db)
        seen = event.payload.get("seen", {}).get(str(stop.id)) if event is not None else None
        if seen is not None:
            return StopStatus(seen[1])
    return stop.status


def _arrive(n: int) -> Callable[[Session, datetime, Cast], bool]:
    def play(db: Session, now: datetime, people: Cast) -> bool:
        trip = _running(db)
        stops = _stops(trip) if trip is not None else []
        if trip is None or n >= len(stops):
            return False
        stop = stops[n]
        if _to_do(db, trip, stop, now) is not StopStatus.PENDING or stop.arrived_at is not None:
            return False
        if _held(db, stop) & set(STOP_RECORDS):
            return False
        record = records.RecordIn(
            id=uuid.uuid5(stop.id, "story arrived"),
            kind=FieldEventKind.ARRIVED,
            trip_id=trip.id,
            stop_id=stop.id,
            occurred_at=now,
            base_version=stop.version,
        )
        return _save(db, now, people, trip, record, None)

    return play


def _deliver(n: int) -> Callable[[Session, datetime, Cast], bool]:
    def play(db: Session, now: datetime, people: Cast) -> bool:
        trip = _running(db)
        stops = _stops(trip) if trip is not None else []
        if trip is None or n >= len(stops):
            return False
        stop = stops[n]
        if _to_do(db, trip, stop, now) not in (StopStatus.PENDING, StopStatus.ARRIVED) or stop.completed_at:
            return False
        if _held(db, stop) & {FieldEventKind.DELIVERED, FieldEventKind.FAILED}:
            return False
        outlet = db.get(Outlet, stop.outlet_id)
        payload: dict[str, Any] = {"receiver": RECEIVERS.get(stop.outlet_id, ""), "all_delivered": True}
        record_id = uuid.uuid5(stop.id, "story delivered")
        photo = None
        if outlet is not None and outlet.dock_type == "street":
            payload["signature_svg"] = SIGNATURE
        else:
            cases = sum(line.loaded_qty for line in db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id)))
            photo_id = uuid.uuid5(stop.id, "story photo")
            payload["photo_id"] = str(photo_id)
            photo = {
                "id": str(photo_id),
                "stop_id": str(stop.id),
                "event_id": str(record_id),
                "taken_at": now.isoformat(),
                "piles": 3 if cases >= 90 else 2,
            }
        record = records.RecordIn(
            id=record_id,
            kind=FieldEventKind.DELIVERED,
            trip_id=trip.id,
            stop_id=stop.id,
            occurred_at=now,
            base_version=stop.version,
            payload=payload,
        )
        return _save(db, now, people, trip, record, photo)

    return play


def _place(n: int, verb: str) -> Callable[[Session], str]:
    def label(db: Session) -> str:
        trip = story_trip(db)
        stops = _stops(trip) if trip is not None else []
        outlet = db.get(Outlet, stops[n].outlet_id) if n < len(stops) else None
        return f"Kasun {verb} {outlet.short_name if outlet else f'stop {n + 1}'}"

    return label


def _handle_delay(db: Session, now: datetime, people: Cast) -> bool:
    """Nuwan marks the road delay a simulated driver reported as handled, from the on-call phone."""
    did = False
    for item in db.scalars(select(FeedItem).where(FeedItem.kind == FeedKind.DELAY, FeedItem.handled_at.is_(None))):
        event = db.get(FieldEvent, uuid.UUID(item.ref["event_id"])) if item.ref.get("event_id") else None
        if event is None or event.device_id != world.DEVICE or item.created_at > now:
            continue
        item.handled_at = now
        item.handled_by = people.dispatcher.id
        item.outcome = "Marked as handled."
        did = True
    return did


def _send_backup(db: Session, now: datetime, people: Cast) -> bool:
    """With Kasun silent, Nuwan sends the stop whose likely range runs past its close with the best free vehicle,
    the depot's standby in the story. Not if Kasun is in contact, or the judge already sent a stop of this run with
    a backup, even one called off since."""
    trip = _running(db)
    if trip is None or db.scalar(select(Stop.id).where(Stop.backup_of.in_([s.id for s in trip.stops]))) is not None:
        return False
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    estimate = run_estimate(db, trip, now)
    if not estimate.out_of_contact:
        return False
    net = adapters.network(db)
    stops = {s.id: s for s in trip.stops}
    at_risk = [
        stops[row.stop_id]
        for row in estimate.stops
        if row.range is not None
        and stops[row.stop_id].status is StopStatus.PENDING
        and row.range[1] > adapters.at_minutes(plan.run_date, net.outlets[row.outlet_id].receiving_window[1])
    ]
    if not at_risk:
        return False
    stop = at_risk[-1]
    option = next((o for o in backup.move_options(db, now, trip, stop) if o.fits), None)
    if option is None:
        return False
    name = people.driver.display_name.split()[0]
    reason = f"No contact from {name} for {estimate.silent_minutes} minutes. Backup in case {name} is stuck."
    backup.move_stop(db, now, people.dispatcher, stop, option.vehicle_id, reason)
    return True


def _backup_label(db: Session) -> str:
    trip = story_trip(db)
    for stop in _stops(trip) if trip is not None else []:
        copy = db.scalar(select(Stop).where(Stop.backup_of == stop.id))
        if copy is not None:
            outlet = db.get(Outlet, stop.outlet_id)
            van = db.get(Trip, copy.trip_id)
            place = outlet.short_name if outlet else stop.outlet_id
            return f"Nuwan sends {place} with {van.vehicle_id if van else 'a backup'}"
    return "Nuwan sends a backup"


def _receipt(db: Session, now: datetime, people: Cast) -> bool:
    """Dilani checks the goods at the store's dock and confirms everything arrived, once Kasun has been there: the
    record of the delivery may still be on Kasun's phone. Not if the store already confirmed."""
    order = db.scalar(select(Order).where(Order.order_ref == DRY_ORDER))
    trip = story_trip(db)
    if order is None or trip is None or trip.departed_at is None:
        return False
    if db.scalar(select(Receipt.id).where(Receipt.order_id == order.id)) is not None:
        return False
    stop = next((s for s in trip.stops if s.order_id == order.id), None)
    if stop is None or not (stop.status is StopStatus.DELIVERED or FieldEventKind.DELIVERED in _held(db, stop)):
        return False
    try:
        tracker.confirm_receipt(db, now, people.store, order, [], None)
    except tracker.TrackerError as exc:
        log.info("Story receipt skipped: %s", exc)
        return False
    return True


def _keep_backup(db: Session, now: datetime, people: Cast) -> bool:
    """Nuwan keeps the backup on its way after the store's receipt, while Kasun is still silent."""
    trip = _running(db)
    if trip is None:
        return False
    waiting = db.scalars(select(FeedItem).where(FeedItem.kind == FeedKind.RECEIPT, FeedItem.handled_at.is_(None)))
    item = next((i for i in waiting if i.ref.get("trip_id") == str(trip.id) and i.ref.get("copy_stop_id")), None)
    if item is None or not run_estimate(db, trip, now).out_of_contact:
        return False
    copy = db.get(Stop, uuid.UUID(item.ref["copy_stop_id"]))
    plan = db.get(Plan, trip.plan_id)
    if copy is None or copy.status is StopStatus.CANCELLED or plan is None:
        return False
    outlet = db.get(Outlet, copy.outlet_id)
    name = people.driver.display_name.split()[0]
    then = next_operating_day(db, plan.run_date)
    note = (
        f"{name} still offline on the hill road. If the truck is stuck, "
        f"{outlet.short_name if outlet else copy.outlet_id} gets nothing until {then:%A}."
    )
    backup.keep_backup(db, now, people.dispatcher, item, note)
    return True


def _answer_yes(db: Session, now: datetime, people: Cast) -> bool:
    """At the dock, Kasun answers the one question about the stop with two copies: yes, delivered."""
    trip = _running(db)
    if trip is None or offline(now):
        return False
    question = db.scalar(
        select(Conflict).where(
            Conflict.driver_id == people.driver.id,
            Conflict.status == ConflictStatus.WAITING_FOR_DRIVER,
            Conflict.stop_id.in_([s.id for s in trip.stops]),
        )
    )
    if question is None:
        return False
    record = records.RecordIn(
        id=uuid.uuid5(question.id, "story answer"),
        kind=FieldEventKind.CONFLICT_ANSWER,
        trip_id=trip.id,
        stop_id=None,
        occurred_at=now,
        payload={"conflict_id": str(question.id), "answer": "yes"},
    )
    return _save(db, now, people, trip, record, None)


def _finish(db: Session, now: datetime, people: Cast) -> bool:
    """Kasun taps Finish trip at the last dock, once every stop is done, nothing waits on the phone and no question
    is open."""
    trip = _running(db)
    if trip is None or offline(now) or _outbox(db) is not None:
        return False
    if any(s.status in (StopStatus.PENDING, StopStatus.ARRIVED) for s in trip.stops):
        return False
    question = db.scalar(
        select(Conflict.id).where(
            Conflict.stop_id.in_([s.id for s in trip.stops]), Conflict.status != ConflictStatus.RESOLVED
        )
    )
    if question is not None:
        return False
    record = records.RecordIn(
        id=uuid.uuid5(trip.id, "story finished"),
        kind=FieldEventKind.TRIP_FINISHED,
        trip_id=trip.id,
        stop_id=None,
        occurred_at=now,
    )
    return _save(db, now, people, trip, record, None)


# ------------------------------------------------------------------------------------------------ the photo
PHOTO_SIZE = (480, 360)


@cache
def stand_in_photo(piles: int) -> bytes:
    """A plain drawing that stands in for the photo the autopilot's Kasun takes at a rear dock: cases in piles by a
    roller door, nobody in it. Drawn here as a PNG, so the story needs no image files."""
    width, height = PHOTO_SIZE
    rows = [bytearray(width * 3) for _ in range(height)]

    def fill(x0: int, y0: int, x1: int, y1: int, rgb: tuple[int, int, int]) -> None:
        span = bytes(rgb) * (x1 - x0)
        for y in range(max(0, y0), min(height, y1)):
            rows[y][x0 * 3 : x1 * 3] = span

    fill(0, 0, width, 200, (178, 174, 166))  # wall
    fill(0, 200, width, height, (124, 122, 118))  # dock floor
    fill(110, 34, 370, 200, (198, 200, 202))  # roller door
    for y in range(46, 200, 14):
        fill(110, y, 370, y + 2, (168, 170, 174))
    fill(0, 196, width, 204, (92, 90, 86))  # dock edge
    case_w, case_h, gap = 52, 38, 4
    pile_w = 2 * case_w + gap
    space = (width - piles * pile_w) // (piles + 1)
    for p in range(piles):
        left = space + p * (pile_w + space)
        for col in range(2):
            for level in range(3):
                x0 = left + col * (case_w + gap)
                y1 = 336 - level * (case_h + gap)
                fill(x0, y1 - case_h, x0 + case_w, y1, (142, 102, 62))  # carton edge
                fill(x0 + 2, y1 - case_h + 2, x0 + case_w - 2, y1 - 2, (178, 134, 86))
                fill(x0 + case_w // 2 - 3, y1 - case_h + 2, x0 + case_w // 2 + 3, y1 - 2, (212, 192, 150))  # tape

    raw = b"".join(b"\x00" + bytes(row) for row in rows)

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 9)) + chunk(b"IEND", b"")


STEPS: tuple[Step, ...] = (
    Step("dilani_orders", "Dilani places the chilled and dry orders", _fixed(PLANNING_DAY, "14:14"), _dilani_orders),
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
    Step(
        "handle_delay",
        f"Nuwan marks {world.REPORTS[0].vehicle_id}'s delay as handled",
        _fixed(DELIVERY_DAY, DELAY_HANDLED_AT),
        _handle_delay,
    ),
    *(
        step
        for n, visit in enumerate(VISITS)
        for step in (
            Step(f"arrive_{n + 1}", _place(n, "arrives at"), _on_the_road(visit.arrive), _arrive(n)),
            Step(f"deliver_{n + 1}", _place(n, "delivers to"), _on_the_road(visit.deliver), _deliver(n)),
        )
    ),
    Step("send_backup", _backup_label, _fixed(DELIVERY_DAY, MOVE_AT), _send_backup, after=True),
    Step("receipt", "Dilani confirms everything arrived", _on_the_road(RECEIPT_AT), _receipt, after=True),
    Step("keep_backup", "Nuwan keeps the backup on its way", _on_the_road(KEEP_AT), _keep_backup),
    Step("answer_yes", "Kasun answers yes: delivered", _on_the_road(ANSWER_AT), _answer_yes, after=True),
    Step("finish_trip", "Kasun finishes the trip", _on_the_road(FINISH_AT), _finish, after=True),
)


def pending(db: Session, workspace: Workspace, until: datetime) -> list[tuple[datetime, Step]]:
    """Story steps due by `until` that no jump has settled yet, in story order."""
    settled = workspace.state.get("story", {})
    out = []
    for step in STEPS:
        if step.key in settled:
            continue
        moment = step.when(db)
        if moment is not None and moment + (GRACE if step.after else timedelta(0)) <= until:
            out.append((moment, step))
    return sorted(out, key=lambda pair: pair[0])


def settle(workspace: Workspace, step: Step, played: bool) -> None:
    workspace.state = {**workspace.state, "story": {**workspace.state.get("story", {}), step.key: played}}


def label(db: Session, step: Step) -> str:
    return step.label(db) if callable(step.label) else step.label


ON_THE_ROAD = ("first_stop", "on_the_road", "receipt", "settled")
"""Moments set by Kasun's own times, which move with them when the truck left late."""


def moments(db: Session) -> list[Moment]:
    """The demo bar's moments. Those at the dock follow the published story truck: the handover sits just before
    it leaves, whatever time the plan gave it. Those on the road follow Kasun's times; the storm's are fixed."""
    handover = _from_departure(-13, latest="03:31")(db)
    trip = story_trip(db)
    late = _late(db, trip) if trip is not None else timedelta(0)
    out = []
    for m in MOMENTS:
        if m.key == "handover" and handover is not None:
            m = Moment(m.key, m.label, handover)
        elif m.key in ON_THE_ROAD:
            m = Moment(m.key, m.label, m.at + late)
        out.append(m)
    return sorted(out, key=lambda m: m.at)


def moment_time(key: str) -> Callable[[Session], datetime] | None:
    """A moment's time as the day stands, for a jump to work out again after each step it plays: before the Kandy
    plan is published the handover only has its default time, and the steps on the way publish it."""
    if not any(m.key == key for m in MOMENTS):
        return None
    return lambda db: next(m.at for m in moments(db) if m.key == key)
