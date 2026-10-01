"""The driver's run as the phone reads it (DRV-01 to DRV-05): today's trip with its handover, every stop with the times
Relay last sent, any question waiting for the driver, and the messages held while the phone was silent.

The phone keeps the last snapshot in IndexedDB and works from it while offline, so everything a screen needs is in one
answer; the times in it are the ones Relay last told the stores, so the phone never pushes an expected time later.
"""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import (
    AppUser,
    CaseType,
    Conflict,
    ConflictStatus,
    FieldEvent,
    LoadLine,
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
    NoticeOut,
    QuestionOut,
)
from relay_api.services import dock, field, words
from relay_api.services.ordering import current_run


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
    questions = db.scalars(
        select(Conflict).where(Conflict.driver_id == user.id, Conflict.status != ConflictStatus.RESOLVED)
    ).all()
    outage = (workspace.state.get("outages") or {}).get(user.username)
    return DriverRunOut(
        run_date=run_date,
        now=now,
        driver=user.display_name,
        vehicle_id=vehicle_id,
        published=published,
        dispatcher=dispatcher.display_name if dispatcher else None,
        trip=_trip(db, look, t, len(trips)) if (t := current) is not None else None,
        later=[_trip(db, look, t, len(trips)) for t in later],
        questions=[_question(db, look, c) for c in questions],
        notices=[NoticeOut.model_validate(n) for n in field.driver_notices(db, user, now)],
        outage={k: datetime.fromisoformat(v) for k, v in outage.items()} if outage else None,
    )


def _trip(db: Session, look: dock.Lookup, trip: Trip, trips_today: int) -> DriverTripOut:
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
        stops_out.append(
            DriverStopOut(
                stop_id=stop.id,
                seq=stop.seq,
                version=stop.version,
                status=stop.status.value,  # type: ignore[arg-type]
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
    stop = db.get(Stop, conflict.stop_id)
    assert stop is not None
    event = db.get(FieldEvent, conflict.event_id) if conflict.event_id else None
    cases = sum(line.loaded_qty for line in db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id)))
    return QuestionOut(
        id=conflict.id,
        stop_id=stop.id,
        seq=stop.seq,
        place=look.outlets[stop.outlet_id].short_name,
        question=conflict.question,
        status=conflict.status.value,  # type: ignore[arg-type]
        answer=conflict.answer,
        opened_at=conflict.opened_at,
        delivered_at=event.occurred_at if event else None,
        cases=cases,
    )
