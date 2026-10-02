"""What drivers record on the road, arriving from the phone's outbox in the order it was made.

Every record carries the id the phone gave it, so a resend is harmless: Relay answers "duplicate" and writes nothing.
A record is stamped with the time it happened on the phone, never the time it reached Relay, so a delivery recorded
offline at 6:36 AM reads 6:36 AM when it arrives at 7:14. A stop record that clashes with a change the office made
while the phone was silent (the stop was moved to a backup vehicle, or cancelled) is kept with its evidence and opens
one question to the driver; every other record is applied as it is. The first answer to that question, the driver's
or the dispatcher's, settles it.
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import (
    AppUser,
    AuditLog,
    Conflict,
    ConflictStatus,
    DeviceContact,
    FeedItem,
    FeedKind,
    FieldEvent,
    FieldEventKind,
    FieldEventOutcome,
    Handover,
    LoadLine,
    Notification,
    Order,
    OrderStatus,
    Outlet,
    Photo,
    Plan,
    ProblemReason,
    ProblemReport,
    Proof,
    Stop,
    StopStatus,
    Trip,
    TripStatus,
    VehicleDay,
)
from relay_api.services import dock, words
from relay_api.services.notify import add_feed_item, notify_store

ANSWER_WITHIN = timedelta(minutes=10)
"""A question nobody answers goes to the top of the dispatcher's feed after this long."""
MAX_PHOTO_BYTES = dock.MAX_PHOTO_BYTES
STOP_KINDS = (FieldEventKind.ARRIVED, FieldEventKind.DELIVERED, FieldEventKind.FAILED)


class FieldError(Exception):
    """A record Relay cannot take, with the reason kept for the audit and shown on the phone."""


@dataclass
class RecordIn:
    id: uuid.UUID
    kind: FieldEventKind
    trip_id: uuid.UUID | None
    stop_id: uuid.UUID | None
    occurred_at: datetime
    base_version: int | None = None
    lat: float | None = None
    lng: float | None = None
    accuracy_m: float | None = None
    payload: dict[str, Any] = field(default_factory=dict)


@dataclass
class Result:
    id: uuid.UUID
    outcome: FieldEventOutcome
    reason: str = ""


# ------------------------------------------------------------------------------------------------ the batch
def receive(db: Session, now: datetime, user: AppUser, device_id: str, records: list[RecordIn]) -> list[Result]:
    """Apply a batch from one phone, in the order the phone saved it."""
    back_from = touch_contact(db, now, user, device_id, records)
    results = []
    for record in records:
        with db.begin_nested():  # one bad record never takes the rest of the batch with it
            try:
                results.append(_one(db, now, user, device_id, record))
            except FieldError as exc:
                results.append(_reject(db, now, user, device_id, record, str(exc)))
        db.flush()
    if back_from is not None:
        back_in_contact(
            db, now, user, back_from, sum(1 for r in results if r.outcome is not FieldEventOutcome.DUPLICATE)
        )
    return results


def touch_contact(
    db: Session, now: datetime, user: AppUser, device_id: str, records: list[RecordIn] | None = None
) -> datetime | None:
    """The phone reached Relay. Returns when contact was lost if this ends a silence on a running trip."""
    from relay_api.services.estimates import SILENCE_MINUTES

    contact = db.scalar(select(DeviceContact).where(DeviceContact.user_id == user.id).with_for_update())
    gap_from = None
    if contact is None:
        contact = DeviceContact(user_id=user.id, last_contact_at=now, pending_records=0)
        db.add(contact)
    elif now - contact.last_contact_at >= timedelta(minutes=SILENCE_MINUTES) and running_trip(db, user) is not None:
        gap_from = contact.last_contact_at
    contact.last_contact_at = now
    contact.device_id = device_id
    if records:
        latest = max(r.occurred_at for r in records)
        if contact.last_record_at is None or latest > contact.last_record_at:
            contact.last_record_at = latest
    if gap_from is not None:
        contact.gap_from, contact.gap_to = gap_from, now
    return gap_from


def running_trip(db: Session, user: AppUser) -> Trip | None:
    vehicle_ids = [d.vehicle_id for d in db.scalars(select(VehicleDay).where(VehicleDay.driver_id == user.id))]
    if user.vehicle_id:
        vehicle_ids.append(user.vehicle_id)
    return db.scalar(
        select(Trip).where(Trip.vehicle_id.in_(vehicle_ids), Trip.departed_at.is_not(None), Trip.finished_at.is_(None))
    )


def _one(db: Session, now: datetime, user: AppUser, device_id: str, record: RecordIn) -> Result:
    existing = db.get(FieldEvent, record.id)
    if existing is not None:
        return Result(record.id, FieldEventOutcome.DUPLICATE)
    if db.scalar(select(FieldEvent.id).where(FieldEvent.id == record.id).execution_options(all_workspaces=True)):
        raise FieldError("This record belongs to another copy of the day.")
    if record.occurred_at > now + timedelta(minutes=5):
        raise FieldError("This record is stamped later than now.")
    if record.kind is FieldEventKind.CHECKIN:
        return _store(db, now, user, device_id, record, FieldEventOutcome.APPLIED)

    trip = db.get(Trip, record.trip_id) if record.trip_id else None
    if trip is None:
        raise FieldError("No such trip.")
    if not _drives(db, user, trip):
        raise FieldError(f"{trip.vehicle_id} is not your vehicle today.")
    stop = db.get(Stop, record.stop_id) if record.stop_id else None
    if record.kind in STOP_KINDS:
        if stop is None or stop.trip_id != trip.id:
            raise FieldError("That stop is not on this trip.")
        backup = _clash(db, stop, record.base_version)
        if backup is not None:
            event = _store(db, now, user, device_id, record, FieldEventOutcome.CONFLICT)
            if record.kind is FieldEventKind.DELIVERED:
                _proof(db, stop, event, record)
            _open_question(db, now, user, trip, stop, backup, event)
            return Result(record.id, FieldEventOutcome.CONFLICT)

    handler = {
        FieldEventKind.LOAD_ACCEPTED: _load_accepted,
        FieldEventKind.LOAD_DIFFERENCE: _load_difference,
        FieldEventKind.DEPARTED: _departed,
        FieldEventKind.ARRIVED: _arrived,
        FieldEventKind.DELIVERED: _delivered,
        FieldEventKind.FAILED: _failed,
        FieldEventKind.PROBLEM: _problem,
        FieldEventKind.TRIP_FINISHED: _finished,
        FieldEventKind.CONFLICT_ANSWER: _answer,
    }[record.kind]
    event = _store(db, now, user, device_id, record, FieldEventOutcome.APPLIED)
    handler(db, now, user, trip, stop, record, event)
    return Result(record.id, FieldEventOutcome.APPLIED)


def _store(
    db: Session, now: datetime, user: AppUser, device_id: str, record: RecordIn, outcome: FieldEventOutcome
) -> FieldEvent:
    event = FieldEvent(
        id=record.id,
        user_id=user.id,
        device_id=device_id,
        kind=record.kind,
        trip_id=record.trip_id,
        stop_id=record.stop_id,
        occurred_at=record.occurred_at,
        received_at=now,
        base_version=record.base_version,
        lat=record.lat,
        lng=record.lng,
        accuracy_m=record.accuracy_m,
        payload=record.payload,
        outcome=outcome,
        applied_at=now if outcome is FieldEventOutcome.APPLIED else None,
    )
    db.add(event)
    db.flush()
    return event


def _reject(db: Session, now: datetime, user: AppUser, device_id: str, record: RecordIn, reason: str) -> Result:
    """Kept for the audit, so a rejected record never vanishes; the stop is unchanged."""
    if db.get(FieldEvent, record.id) is None and not db.scalar(
        select(FieldEvent.id).where(FieldEvent.id == record.id).execution_options(all_workspaces=True)
    ):
        trip = db.get(Trip, record.trip_id) if record.trip_id else None
        stop = db.get(Stop, record.stop_id) if record.stop_id else None
        rec = RecordIn(
            **{**record.__dict__, "trip_id": trip.id if trip else None, "stop_id": stop.id if stop else None}
        )
        event = _store(db, now, user, device_id, rec, FieldEventOutcome.REJECTED)
        event.reject_reason = reason
    return Result(record.id, FieldEventOutcome.REJECTED, reason)


def _drives(db: Session, user: AppUser, trip: Trip) -> bool:
    plan = db.get(Plan, trip.plan_id)
    if plan is None:
        return False
    day = db.scalar(
        select(VehicleDay).where(VehicleDay.vehicle_id == trip.vehicle_id, VehicleDay.run_date == plan.run_date)
    )
    if day is not None and day.driver_id is not None:
        return day.driver_id == user.id
    return user.vehicle_id == trip.vehicle_id


# ------------------------------------------------------------------------------------------------ clashes
def _clash(db: Session, stop: Stop, base_version: int | None) -> Stop | None:
    """The live backup copy (or the cancelled stop itself) when the office changed this stop while the phone was
    silent in a way the record contradicts. Time changes and notes never clash."""
    if base_version is None or stop.version <= base_version:
        return None
    if stop.status is StopStatus.MOVED:
        return db.scalar(select(Stop).where(Stop.backup_of == stop.id, Stop.status != StopStatus.CANCELLED))
    if stop.status is StopStatus.CANCELLED:
        return stop
    return None


def _open_question(
    db: Session, now: datetime, user: AppUser, trip: Trip, stop: Stop, backup: Stop, event: FieldEvent
) -> Conflict:
    existing = db.scalar(
        select(Conflict).where(Conflict.stop_id == stop.id, Conflict.status != ConflictStatus.RESOLVED)
    )
    if existing is not None:
        return existing
    outlet = db.get(Outlet, stop.outlet_id)
    place = outlet.short_name if outlet else stop.outlet_id
    backup_trip = db.get(Trip, backup.trip_id) if backup.id != stop.id else None
    moved_at = backup_trip.planned_depart if backup_trip else None
    change = db.scalar(
        select(AuditLog.at)
        .where(AuditLog.action == "stop.moved", AuditLog.entity_id == str(stop.id))
        .order_by(AuditLog.at.desc())
    )
    when = words.clock(change or moved_at or now)
    by = f" to {backup_trip.vehicle_id}" if backup_trip else ""
    conflict = Conflict(
        stop_id=stop.id,
        backup_stop_id=backup.id if backup.id != stop.id else None,
        driver_id=user.id,
        event_id=event.id,
        status=ConflictStatus.WAITING_FOR_DRIVER,
        question=(
            f"Stop {stop.seq}, {place}, was moved{by} at {when} while your phone had no signal. "
            "Your phone saved a delivery there. Did you deliver it?"
        ),
        opened_at=now,
    )
    db.add(conflict)
    db.flush()
    plan = db.get(Plan, trip.plan_id)
    add_feed_item(
        db,
        now,
        kind=FeedKind.CONFLICT,
        depot=plan.depot if plan else "Kandy",
        title=f"Stop {stop.seq} has two copies",
        body=f"{user.display_name}'s phone recorded {place} while "
        f"{backup_trip.vehicle_id if backup_trip else 'a backup'} still has it. Relay has asked the driver.",
        ref={"conflict_id": str(conflict.id), "trip_id": str(trip.id), "stop_id": str(stop.id), "place": place},
    )
    return conflict


def settle(db: Session, now: datetime, conflict: Conflict, *, by: AppUser | None, how: str) -> None:
    """The driver said yes, or the dispatcher cancelled the backup's copy: the driver's records stand, the backup
    turns back and everyone is told. The first answer wins; later ones change nothing."""
    if conflict.status is ConflictStatus.RESOLVED:
        return
    stop = db.get(Stop, conflict.stop_id)
    assert stop is not None
    events = db.scalars(
        select(FieldEvent)
        .where(FieldEvent.stop_id == stop.id, FieldEvent.outcome == FieldEventOutcome.CONFLICT)
        .order_by(FieldEvent.occurred_at)
    ).all()
    for event in events:
        event.applied_at = now
        if event.kind is FieldEventKind.ARRIVED:
            stop.arrived_at = stop.arrived_at or event.occurred_at
        elif event.kind is FieldEventKind.DELIVERED:
            stop.arrived_at = stop.arrived_at or event.occurred_at
            stop.completed_at = event.occurred_at
    delivered = any(e.kind is FieldEventKind.DELIVERED for e in events)
    stop.status = StopStatus.DELIVERED if delivered else StopStatus.ARRIVED if events else StopStatus.PENDING
    stop.version += 1
    conflict.status = ConflictStatus.RESOLVED
    conflict.answer = "yes"
    conflict.answered_at = now
    conflict.resolved_at = now
    conflict.resolved_by = by.id if by else None
    conflict.resolution = how
    from relay_api.services import backup as backups

    if conflict.backup_stop_id is not None:
        copy = db.get(Stop, conflict.backup_stop_id)
        if copy is not None:
            backups.withdraw_copy(db, now, copy, by=by, reason="settled")
    order = db.get(Order, stop.order_id)
    if order is not None and delivered and order.status is not OrderStatus.CONFIRMED:
        order.status = OrderStatus.DELIVERED
    if delivered:
        _tell_delivered(db, now, stop, settled=True)
    for item in _items(db, FeedKind.CONFLICT, "conflict_id", conflict.id):
        item.handled_at = now
        item.handled_by = by.id if by else None
        item.title = f"Stop {stop.seq} conflict resolved"
        item.outcome = (
            "The driver answered yes: delivered. The backup's copy is cancelled."
            if how == "driver"
            else "You cancelled the backup's copy. The driver's delivery stands."
        )
    db.add(
        AuditLog(
            at=now,
            actor_id=by.id if by else None,
            actor_label=by.display_name if by else "Relay",
            action="conflict.settled",
            entity="stop",
            entity_id=str(stop.id),
            summary=f"Stop {stop.seq} settled ({how})",
        )
    )


def escalate(db: Session, now: datetime, conflict: Conflict, reason: str) -> None:
    """The driver said no, or nobody answered in 10 minutes: the backup carries on and the dispatcher decides."""
    if conflict.status is not ConflictStatus.WAITING_FOR_DRIVER:
        return
    conflict.status = ConflictStatus.ESCALATED
    conflict.escalated_at = now
    for item in _items(db, FeedKind.CONFLICT, "conflict_id", conflict.id):
        item.body = f"{reason} The backup carries on until you settle it."
        item.created_at = now  # back to the top of Now


def escalate_unanswered(db: Session, now: datetime) -> None:
    """Called on every tick: questions open for 10 minutes go to the dispatcher."""
    for conflict in db.scalars(
        select(Conflict).where(
            Conflict.status == ConflictStatus.WAITING_FOR_DRIVER, Conflict.opened_at <= now - ANSWER_WITHIN
        )
    ):
        escalate(db, now, conflict, "No answer from the driver in 10 minutes.")


def _items(db: Session, kind: FeedKind, key: str, value: object) -> list[FeedItem]:
    return [i for i in db.scalars(select(FeedItem).where(FeedItem.kind == kind)) if i.ref.get(key) == str(value)]


# ------------------------------------------------------------------------------------------------ the kinds
def _load_accepted(db: Session, now: datetime, user: AppUser, trip: Trip, _stop, record: RecordIn, _e) -> None:  # type: ignore[no-untyped-def]
    try:
        dock.accept(db, record.occurred_at, user, trip, on="phone")
    except dock.DockError as exc:
        raise FieldError(str(exc)) from exc
    for order in _orders(db, trip):
        if order.status in (OrderStatus.ALLOCATED, OrderStatus.RECEIVED):
            order.status = OrderStatus.LOADED


def _load_difference(db: Session, now: datetime, user: AppUser, trip: Trip, _stop, record: RecordIn, _e) -> None:  # type: ignore[no-untyped-def]
    note = str(record.payload.get("note", "")).strip()[:500]
    handover = db.scalar(select(Handover).where(Handover.trip_id == trip.id))
    if handover is None:
        raise FieldError("The load is not marked complete yet.")
    handover.difference = note
    plan = db.get(Plan, trip.plan_id)
    add_feed_item(
        db,
        now,
        kind=FeedKind.PROBLEM,
        depot=plan.depot if plan else "Kandy",
        title=f"{user.display_name} says {trip.vehicle_id}'s load does not match",
        body=note,
        ref={"trip_id": str(trip.id), "kind": "load_difference"},
    )


def _departed(db: Session, now: datetime, user: AppUser, trip: Trip, _stop, record: RecordIn, _e) -> None:  # type: ignore[no-untyped-def]
    dock.depart(db, record.occurred_at, trip, user)
    for order in _orders(db, trip):
        if order.status in (OrderStatus.ALLOCATED, OrderStatus.LOADED, OrderStatus.RECEIVED):
            order.status = OrderStatus.ON_THE_WAY


def _arrived(db: Session, now: datetime, user: AppUser, trip: Trip, stop: Stop, record: RecordIn, _e) -> None:  # type: ignore[no-untyped-def]
    if trip.departed_at is None:
        dock.depart(db, record.occurred_at, trip, user)
    stop.arrived_at = stop.arrived_at or record.occurred_at
    if stop.status in (StopStatus.PENDING, StopStatus.MOVED):
        stop.status = StopStatus.ARRIVED
    _refresh_times(db, now, trip)


def _delivered(db: Session, now: datetime, user: AppUser, trip: Trip, stop: Stop, record: RecordIn, event) -> None:  # type: ignore[no-untyped-def]
    if trip.departed_at is None:
        dock.depart(db, record.occurred_at, trip, user)
    stop.arrived_at = stop.arrived_at or record.occurred_at
    stop.completed_at = record.occurred_at
    stop.status = StopStatus.DELIVERED
    _proof(db, stop, event, record)
    order = db.get(Order, stop.order_id)
    if order is not None and order.status is not OrderStatus.CONFIRMED:
        order.status = OrderStatus.DELIVERED
    _tell_delivered(db, now, stop)
    _refresh_times(db, now, trip)


def _failed(db: Session, now: datetime, user: AppUser, trip: Trip, stop: Stop, record: RecordIn, _e) -> None:  # type: ignore[no-untyped-def]
    reason = str(record.payload.get("reason", "")).strip()[:200]
    stop.status = StopStatus.FAILED
    stop.completed_at = record.occurred_at
    stop.reason = reason
    order = db.get(Order, stop.order_id)
    if order is not None:
        order.status = OrderStatus.FAILED
    outlet = db.get(Outlet, stop.outlet_id)
    plan = db.get(Plan, trip.plan_id)
    add_feed_item(
        db,
        now,
        kind=FeedKind.FAILED_STOP,
        depot=plan.depot if plan else "Kandy",
        title=f"{trip.vehicle_id} could not deliver stop {stop.seq}, {outlet.short_name if outlet else stop.outlet_id}",
        body=reason,
        ref={"trip_id": str(trip.id), "stop_id": str(stop.id)},
    )
    _refresh_times(db, now, trip)


def _problem(db: Session, now: datetime, user: AppUser, trip: Trip, stop: Stop | None, record: RecordIn, event) -> None:  # type: ignore[no-untyped-def]
    try:
        reason = ProblemReason(str(record.payload.get("reason")))
    except ValueError as exc:
        raise FieldError("Choose what happened.") from exc
    delay = record.payload.get("delay_min")
    note = str(record.payload.get("note", "")).strip()[:500]
    db.add(
        ProblemReport(
            event_id=event.id,
            trip_id=trip.id,
            stop_id=stop.id if stop else None,
            reason=reason,
            delay_min=int(delay) if isinstance(delay, int | float) else None,
            note=note,
            reported_at=record.occurred_at,
            lines=list(record.payload.get("lines", []))[:20],
            urgent=bool(record.payload.get("urgent", False)),
        )
    )
    plan = db.get(Plan, trip.plan_id)
    label = {
        ProblemReason.DELAYED: f"Delayed, {int(delay)} min" if isinstance(delay, int | float) else "Delayed",
        ProblemReason.OUTLET_CLOSED: "Store closed",
        ProblemReason.ACCESS_BLOCKED: "Access blocked",
        ProblemReason.GOODS_REFUSED: "Goods refused",
        ProblemReason.DAMAGED_IN_TRANSIT: "Damaged in transit",
        ProblemReason.VEHICLE_PROBLEM: "Vehicle problem",
    }[reason]
    add_feed_item(
        db,
        now,
        kind=FeedKind.DELAY if reason is ProblemReason.DELAYED else FeedKind.PROBLEM,
        depot=plan.depot if plan else "Kandy",
        title=f"{user.display_name} reports: {label}",
        body=note,
        ref={"trip_id": str(trip.id), "stop_id": str(stop.id) if stop else None, "event_id": str(event.id)},
    )


def _finished(db: Session, now: datetime, user: AppUser, trip: Trip, _stop, record: RecordIn, _e) -> None:  # type: ignore[no-untyped-def]
    trip.finished_at = record.occurred_at
    trip.status = TripStatus.FINISHED


def _answer(db: Session, now: datetime, user: AppUser, trip: Trip, _stop, record: RecordIn, _e) -> None:  # type: ignore[no-untyped-def]
    try:
        conflict_id = uuid.UUID(str(record.payload.get("conflict_id")))
    except ValueError as exc:
        raise FieldError("No such question.") from exc
    conflict = db.get(Conflict, conflict_id)
    if conflict is None or conflict.driver_id != user.id:
        raise FieldError("No such question.")
    answer = str(record.payload.get("answer", "")).lower()
    if answer == "yes":
        settle(db, now, conflict, by=user, how="driver")
    elif answer == "no":
        conflict.answer = "no"
        conflict.answered_at = record.occurred_at
        escalate(db, now, conflict, f"{user.display_name} answered no: the delivery was not made.")
    else:
        raise FieldError("Answer yes or no.")


# ------------------------------------------------------------------------------------------------ proof and times
def _proof(db: Session, stop: Stop, event: FieldEvent, record: RecordIn) -> None:
    proof = db.scalar(select(Proof).where(Proof.stop_id == stop.id))
    payload = record.payload
    lines = payload.get("lines")
    if not isinstance(lines, list):
        lines = [{"case_type": line.case_type, "qty": line.loaded_qty} for line in _lines(db, stop)]
    values = {
        "event_id": event.id,
        "receiver_name": str(payload.get("receiver", "")).strip()[:64],
        "lines": lines,
        "all_delivered": bool(payload.get("all_delivered", True)),
        "signature_svg": (str(payload["signature_svg"])[:20_000] if payload.get("signature_svg") else None),
        "recorded_at": record.occurred_at,
    }
    photo_id = payload.get("photo_id")
    if photo_id:
        photo = db.get(Photo, uuid.UUID(str(photo_id)))
        values["photo_id"] = photo.id if photo else None
    if proof is None:
        db.add(Proof(stop_id=stop.id, **values))
    else:
        for key, value in values.items():
            setattr(proof, key, value)


def _lines(db: Session, stop: Stop) -> list[LoadLine]:
    return list(db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id).order_by(LoadLine.load_order)))


def _orders(db: Session, trip: Trip) -> list[Order]:
    return list(db.scalars(select(Order).where(Order.id.in_([s.order_id for s in trip.stops]))))


def _tell_delivered(db: Session, now: datetime, stop: Stop, *, settled: bool = False) -> None:
    order = db.get(Order, stop.order_id)
    if order is None or stop.completed_at is None:
        return
    kind = "chilled" if order.temp == "chilled" else "dry" if order.brand == "Fresh" else order.brand
    tail = " The backup is cancelled." if settled else ""
    notify_store(
        db,
        stop.outlet_id,
        now,
        kind="delivered",
        title=f"Your {kind} order was delivered",
        body=f"Delivered {words.clock(stop.completed_at)}, proof attached.{tail}",
        data={"order_ref": order.order_ref, "delivered_at": stop.completed_at.isoformat(), "stop_id": str(stop.id)},
    )


def _refresh_times(db: Session, now: datetime, trip: Trip) -> None:
    """After a stop event, the stores still to come get their new time when it moved by 5 minutes or more. Their
    stop keeps the time they were last told, which is also what the driver's phone shows."""
    from relay_api.services.estimates import run_estimate

    estimate = run_estimate(db, trip, now)
    stops = {s.id: s for s in trip.stops}
    for row in estimate.stops:
        stop = stops.get(row.stop_id)
        if stop is None or row.estimate is None or row.done or stop.status is not StopStatus.PENDING:
            continue
        told = words.round5(stop.expected_arrival) if stop.expected_arrival else None
        if told is not None and abs((row.estimate - told).total_seconds()) < 5 * 60:
            continue
        stop.expected_arrival = row.estimate
        order = db.get(Order, stop.order_id)
        if order is None:
            continue
        kind = "chilled" if order.temp == "chilled" else "dry" if order.brand == "Fresh" else order.brand
        way = "later" if told is None or row.estimate > told else "earlier"
        notify_store(
            db,
            stop.outlet_id,
            now,
            kind="new_time",
            title=f"Your {kind} order now comes {way}",
            body=f"Your {kind} order {order.order_ref} is now expected around {words.clock(row.estimate)}.",
            data={"order_ref": order.order_ref, "expected": row.estimate.isoformat(), "direction": way},
        )


def back_in_contact(db: Session, now: datetime, user: AppUser, since: datetime, received: int) -> None:
    trip = running_trip(db, user)
    plan = db.get(Plan, trip.plan_id) if trip else None
    minutes = int((now - since).total_seconds() // 60)
    for item in _items(db, FeedKind.SILENCE, "user_id", user.id):
        if item.handled_at is None:
            item.handled_at = now
            item.outcome = f"Back in contact at {words.clock(now)}."
    item = add_feed_item(
        db,
        now,
        kind=FeedKind.BACK_IN_CONTACT,
        depot=plan.depot if plan else "Kandy",
        title=f"{user.display_name} back in contact",
        body=f"{words.clock(now)} · offline {minutes} min · {received} record{'s' if received != 1 else ''} received",
        ref={"user_id": str(user.id), "trip_id": str(trip.id) if trip else None},
    )
    item.handled_at = now


# ------------------------------------------------------------------------------------------------ photos
def store_photo(
    db: Session,
    now: datetime,
    user: AppUser,
    photo_id: uuid.UUID,
    data: bytes,
    content_type: str,
    *,
    stop_id: uuid.UUID | None,
    event_id: uuid.UUID | None,
    taken_at: datetime,
    width: int | None,
    height: int | None,
) -> FieldEventOutcome:
    """A proof photo, sent after its stop record. Idempotent by the phone's id; joins its proof when it lands."""
    if db.get(Photo, photo_id) is not None:
        return FieldEventOutcome.DUPLICATE
    if db.scalar(select(Photo.id).where(Photo.id == photo_id).execution_options(all_workspaces=True)):
        raise FieldError("This photo belongs to another copy of the day.")
    if len(data) > MAX_PHOTO_BYTES:
        raise FieldError("The photo is too large.")
    if content_type not in dock.PHOTO_TYPES:
        raise FieldError("Send the photo as a JPEG.")
    stop = db.get(Stop, stop_id) if stop_id else None
    if stop is not None:
        trip = db.get(Trip, stop.trip_id)
        if trip is None or not _drives(db, user, trip):
            raise FieldError("That stop is not on your run.")
    db.add(
        Photo(
            id=photo_id,
            content_type=content_type,
            data=data,
            width=width,
            height=height,
            taken_at=taken_at,
            uploaded_at=now,
            uploaded_by=user.id,
            stop_id=stop.id if stop else None,
            event_id=event_id,
        )
    )
    db.flush()
    if stop is not None:
        proof = db.scalar(select(Proof).where(Proof.stop_id == stop.id))
        if proof is not None and proof.photo_id is None:
            proof.photo_id = photo_id
    return FieldEventOutcome.APPLIED


# ------------------------------------------------------------------------------------------------ notices
def driver_notices(db: Session, user: AppUser, now: datetime) -> list[Notification]:
    """Messages for the driver, held while the phone is silent and handed over on the next contact."""
    rows = db.scalars(
        select(Notification)
        .where(Notification.user_id == user.id, Notification.created_at <= now)
        .order_by(Notification.created_at.desc())
        .limit(30)
    ).all()
    for row in rows:
        if row.delivered_at is None:
            row.delivered_at = now
    return list(rows)
