"""The driver's run as the phone reads it (DRV-01 to DRV-05): today's trip with its handover, every stop with the times
Relay last sent, any question waiting for the driver, and the messages held while the phone was silent.

The phone keeps the last snapshot in IndexedDB and works from it while offline, so everything a screen needs is in one
answer; the times in it are the ones Relay last told the stores, so the phone never pushes an expected time later.

Inside the story's scripted outage nothing the phone sends reaches Relay. The run it reads then is the demo's stand-in
for the phone's own memory: each stop as the phone last saw it before the signal went, with no message handed over,
and the records the story's phone outbox holds, so the stops a demo jump played for the driver show on this phone as
saved there.
"""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import (
    AppUser,
    AuditLog,
    CaseType,
    Conflict,
    FieldEvent,
    FieldEventKind,
    FieldEventOutcome,
    LoadLine,
    Notification,
    Order,
    Plan,
    PlanStatus,
    Proof,
    Shortfall,
    ShortfallDecision,
    Stop,
    StopStatus,
    Trip,
    TripStatus,
    VehicleDay,
    Workspace,
)
from relay_api.schemas.driver import (
    DriverLineOut,
    DriverRunOut,
    DriverStopOut,
    DriverTripOut,
    HeldOut,
    HeldPhotoOut,
    NoticeOut,
    QuestionOut,
    RecordIn,
)
from relay_api.services import dock, field, story, words
from relay_api.services.ordering import current_run

SENT_LATE = timedelta(minutes=2)
"""A stop record that reached Relay this long after it was made was saved on the phone with no signal."""


def vehicle_today(db: Session, user: AppUser, run_date) -> str | None:  # type: ignore[no-untyped-def]
    day = db.scalar(select(VehicleDay).where(VehicleDay.driver_id == user.id, VehicleDay.run_date == run_date))
    return day.vehicle_id if day else user.vehicle_id


def run(db: Session, now: datetime, user: AppUser, workspace: Workspace) -> DriverRunOut:
    look = dock.Lookup(db)
    run_date = current_run(db, now)
    vehicle_id = vehicle_today(db, user, run_date)
    trips: list[Trip] = []
    published = False
    if vehicle_id is not None:
        plans = db.scalars(select(Plan).where(Plan.run_date == run_date, Plan.status == PlanStatus.PUBLISHED)).all()
        published = bool(plans)
        trips = list(
            db.scalars(
                select(Trip)
                .where(
                    Trip.plan_id.in_([p.id for p in plans]),
                    Trip.vehicle_id == vehicle_id,
                    Trip.status != TripStatus.CANCELLED,
                )
                .order_by(Trip.trip_no)
            )
        )
    current = next((t for t in trips if t.finished_at is None), trips[-1] if trips else None)
    later = [t for t in trips if t is not current and t.finished_at is None]
    dispatcher = look.dispatcher()
    quiet = story.no_signal(workspace, user, now)
    memory = (story.memory(db) or {}) if quiet else {}
    seen: dict[str, list[Any]] = memory.get("seen", {})
    stop_ids = [s.id for t in trips for s in t.stops]
    questions = db.scalars(
        select(Conflict)
        .where(Conflict.driver_id == user.id, Conflict.stop_id.in_(stop_ids))
        .order_by(Conflict.opened_at)
    ).all()
    if quiet:
        # what the phone had heard before the signal went, and nothing since
        questions = [c for c in questions if c.opened_at < quiet["from"]]
        notices = db.scalars(
            select(Notification)
            .where(Notification.user_id == user.id, Notification.delivered_at < quiet["from"])
            .order_by(Notification.created_at.desc())
            .limit(30)
        ).all()
    else:
        notices = field.driver_notices(db, user, now)
    return DriverRunOut(
        run_date=run_date,
        now=now,
        driver=user.display_name,
        vehicle_id=vehicle_id,
        published=published,
        dispatcher=dispatcher.display_name if dispatcher else None,
        trip=_trip(db, look, t, len(trips), seen) if (t := current) is not None else None,
        later=[_trip(db, look, t, len(trips), seen) for t in later],
        questions=[_question(db, look, c) for c in questions],
        notices=[NoticeOut.model_validate(n) for n in notices],
        outage=story.outage(workspace, user),
        held=_held(memory) if quiet else None,
    )


def _held(memory: dict[str, Any]) -> HeldOut:
    return HeldOut(
        records=[RecordIn.model_validate(row) for row in memory.get("records", [])],
        photos=[HeldPhotoOut.model_validate({**p, "stand_in": "piles" in p}) for p in memory.get("photos", [])],
    )


def _sent_at(db: Session, stop: Stop) -> datetime | None:
    """When Relay had the stop's last record, if the phone held it for a while with no signal."""
    event = db.scalar(
        select(FieldEvent)
        .where(
            FieldEvent.stop_id == stop.id,
            FieldEvent.kind.in_([FieldEventKind.ARRIVED, FieldEventKind.DELIVERED, FieldEventKind.FAILED]),
            FieldEvent.outcome.in_([FieldEventOutcome.APPLIED, FieldEventOutcome.CONFLICT]),
        )
        .order_by(FieldEvent.occurred_at.desc())
        .limit(1)
    )
    if event is None or event.received_at - event.occurred_at < SENT_LATE:
        return None
    return event.received_at


def _trip(
    db: Session, look: dock.Lookup, trip: Trip, trips_today: int, seen: dict[str, list[Any]] | None = None
) -> DriverTripOut:
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    load = dock.trip_load(db, trip)
    vehicle = look.vehicles[trip.vehicle_id]
    handover = load.handover
    state = "accepted" if handover.accepted_at else "to_accept" if handover.completed_at else "loading"
    types = {c.code: c for c in db.scalars(select(CaseType))}
    shortfalls = []
    stops_out = []
    copies = {
        s.backup_of: s
        for s in db.scalars(select(Stop).where(Stop.backup_of.is_not(None), Stop.status != StopStatus.CANCELLED))
    }
    for stop in sorted(trip.stops, key=lambda s: s.seq):
        order = db.get(Order, stop.order_id)
        assert order is not None
        outlet = look.outlets[stop.outlet_id]
        lines = list(db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id).order_by(LoadLine.load_order)))
        ordered = {line.case_type: line.qty for line in order.lines}
        line_out = []
        for line in lines:
            shortfall = db.scalar(select(Shortfall).where(Shortfall.load_line_id == line.id))
            short = shortfall.qty if shortfall and shortfall.decision else 0
            until = None
            if shortfall and shortfall.decision is ShortfallDecision.SEND_SHORT and shortfall.added_to_order_ref:
                carried = db.scalar(select(Order).where(Order.order_ref == shortfall.added_to_order_ref))
                until = carried.run_date if carried else None
            if shortfall is not None and shortfall.decision is not None:
                shortfalls.append(
                    {
                        "stop_seq": stop.seq,
                        "place": outlet.short_name,
                        "case_type": line.case_type,
                        "case_name": words.short_case_name(types[line.case_type].name),
                        "qty": shortfall.qty,
                        "kind": shortfall.kind.value,
                        "decision": shortfall.decision.value,
                        "decided_at": shortfall.decided_at,
                        "decided_by": look.name(shortfall.decided_by),
                        "added_to": shortfall.added_to_order_ref,
                        "added_day": until,
                    }
                )
            line_out.append(
                DriverLineOut(
                    case_type=line.case_type,
                    name=words.short_case_name(types[line.case_type].name),
                    ordered=ordered.get(line.case_type, line.planned_qty),
                    loaded=line.loaded_qty if handover.completed_at else line.planned_qty,
                    short=short,
                    short_until=until,
                )
            )
        proof = db.scalar(select(Proof).where(Proof.stop_id == stop.id))
        copy = copies.get(stop.id)
        version, status = stop.version, stop.status.value
        if seen and str(stop.id) in seen:
            version, status = seen[str(stop.id)]  # as the phone last saw it: a move made since never reached it
            copy = None if status != StopStatus.MOVED.value else copy
        stops_out.append(
            DriverStopOut(
                stop_id=stop.id,
                seq=stop.seq,
                version=version,
                status=status,  # type: ignore[arg-type]
                order_ref=order.order_ref,
                outlet_id=stop.outlet_id,
                place=outlet.short_name,
                store_name=outlet.name,
                dock_type=outlet.dock_type,
                van_only=outlet.parking_constraint == "van_only",
                window_open=outlet.window_open,
                window_close=outlet.window_close,
                planned=stop.planned_arrival,
                expected=stop.expected_arrival,
                arrived_at=stop.arrived_at,
                completed_at=stop.completed_at,
                moved_to=db.get(Trip, copy.trip_id).vehicle_id if copy is not None else None,  # type: ignore[union-attr]
                cases=sum(x.loaded for x in line_out),
                lines=line_out,
                receiver=proof.receiver_name if proof else None,
                has_photo=bool(proof and proof.photo_id),
                sent_at=_sent_at(db, stop),
            )
        )
    return DriverTripOut(
        trip_id=trip.id,
        vehicle_id=trip.vehicle_id,
        vehicle_kind=words.vehicle_kind(vehicle.type, vehicle.temp),
        trip_no=trip.trip_no,
        trips_today=trips_today,
        is_backup=trip.is_backup,
        brand=trip.brand,
        temp=trip.temp,
        district=trip.district,
        depot=plan.depot,
        depot_label=dock.DEPOT_LABEL.get(plan.depot, plan.depot),
        status=trip.status.value,
        planned_depart=trip.planned_depart,
        departed_at=trip.departed_at,
        planned_back=trip.planned_back,
        expected_back=trip.expected_back,
        finished_at=trip.finished_at,
        load=state,  # type: ignore[arg-type]
        loader=load.loader,
        handover=handover,
        shortfalls=shortfalls,
        stops=stops_out,
    )


def _question(db: Session, look: dock.Lookup, conflict: Conflict) -> QuestionOut:
    """The one question, with what the card says about it: the phone's own records for the stop, who is driving the
    second copy, and who moved it when."""
    stop = db.get(Stop, conflict.stop_id)
    assert stop is not None
    clashed = db.scalars(
        select(FieldEvent)
        .where(FieldEvent.stop_id == stop.id, FieldEvent.outcome == FieldEventOutcome.CONFLICT)
        .order_by(FieldEvent.occurred_at)
    ).all()
    arrived = next((e for e in clashed if e.kind is FieldEventKind.ARRIVED), None)
    delivered = next((e for e in reversed(clashed) if e.kind is FieldEventKind.DELIVERED), None)
    lines = delivered.payload.get("lines") if delivered else None
    cases = (
        sum(int(line.get("qty", 0)) for line in lines)
        if isinstance(lines, list)
        else sum(line.loaded_qty for line in db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id)))
    )
    copy = db.get(Stop, conflict.backup_stop_id) if conflict.backup_stop_id else None
    backup = db.get(Trip, copy.trip_id) if copy is not None else None
    plan = db.get(Plan, backup.plan_id) if backup is not None else None
    backup_driver = look.driver_of(backup, plan.run_date) if backup is not None and plan is not None else None
    moved = db.scalar(
        select(AuditLog)
        .where(AuditLog.action == "stop.moved", AuditLog.entity_id == str(stop.id))
        .order_by(AuditLog.at.desc())
        .limit(1)
    )
    payload = delivered.payload if delivered else {}
    return QuestionOut(
        id=conflict.id,
        stop_id=stop.id,
        seq=stop.seq,
        place=look.outlets[stop.outlet_id].short_name,
        question=conflict.question,
        status=conflict.status.value,  # type: ignore[arg-type]
        answer=conflict.answer,
        opened_at=conflict.opened_at,
        arrived_at=arrived.occurred_at if arrived else None,
        delivered_at=delivered.occurred_at if delivered else None,
        cases=cases,
        receiver=str(payload.get("receiver") or "") or None,
        has_photo=bool(payload.get("photo_id")),
        signed=bool(payload.get("signature_svg")),
        backup_vehicle=backup.vehicle_id if backup else None,
        backup_driver=backup_driver.display_name if backup_driver else None,
        moved_at=moved.at if moved else None,
        moved_by=moved.actor_label if moved else None,
        answered_at=conflict.answered_at,
        resolved_at=conflict.resolved_at,
        resolution=conflict.resolution or "",
    )
