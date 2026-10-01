"""The dispatcher's live view (DSP-04): the feed of things that need him once the plan is out, each carrying what
changed and who was told. On the phone it is the only thing shown, so a flag from the dock at 2:47 AM reaches him
at home with the decision it needs."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import FeedItem, LoadLine, Order, Plan, Shortfall, Stop, Trip
from relay_api.schemas.live import FeedItemOut, FeedOut, ShortfallDetailOut
from relay_api.services import words
from relay_api.services.dock import DEPOT_LABEL, Lookup, next_order
from relay_api.services.ordering import current_run


def feed(db: Session, now: datetime, depot: str) -> FeedOut:
    look = Lookup(db)
    items = db.scalars(
        select(FeedItem).where(FeedItem.depot == depot, FeedItem.created_at <= now).order_by(FeedItem.created_at.desc())
    ).all()
    out = FeedOut(
        depot=depot, depot_label=DEPOT_LABEL.get(depot, depot), run_date=current_run(db, now), now=[], earlier=[]
    )
    for item in items:
        row = FeedItemOut(
            id=item.id,
            kind=item.kind.value,
            depot=item.depot,
            title=item.title,
            body=item.body,
            created_at=item.created_at,
            handled_at=item.handled_at,
            handled_by=look.name(item.handled_by),
            outcome=item.outcome,
            shortfall=shortfall_detail(look, item.ref.get("shortfall_id")),
        )
        (out.earlier if item.handled_at else out.now).append(row)
    return out


def shortfall_detail(look: Lookup, shortfall_id: str | None) -> ShortfallDetailOut | None:
    db = look.db
    shortfall = db.get(Shortfall, shortfall_id) if shortfall_id else None
    if shortfall is None:
        return None
    line = db.get(LoadLine, shortfall.load_line_id)
    assert line is not None
    stop = db.get(Stop, line.stop_id)
    assert stop is not None
    trip = db.get(Trip, line.trip_id)
    assert trip is not None
    order = db.get(Order, stop.order_id)
    assert order is not None
    plan = db.get(Plan, trip.plan_id)
    assert plan is not None
    outlet = look.outlets[stop.outlet_id]
    case_type = look.case_types[line.case_type]
    nxt = (
        db.scalar(select(Order).where(Order.order_ref == shortfall.added_to_order_ref))
        if shortfall.added_to_order_ref
        else next_order(db, order, plan.run_date)
    )
    stop_cases = sum(other.planned_qty for other in db.scalars(select(LoadLine).where(LoadLine.stop_id == stop.id)))
    driver = look.driver_of(trip, plan.run_date)
    manager = look.store_manager(stop.outlet_id)
    return ShortfallDetailOut(
        id=shortfall.id,
        kind=shortfall.kind.value,
        qty=shortfall.qty,
        planned=line.planned_qty,
        case_type=line.case_type,
        case_name=words.short_case_name(case_type.name),
        temp_label=words.load_kind(order.brand, order.temp),
        vehicle_id=trip.vehicle_id,
        trip_no=trip.trip_no,
        stop_seq=stop.seq,
        order_ref=order.order_ref,
        outlet_id=outlet.outlet_id,
        place=outlet.short_name,
        flagged_at=shortfall.flagged_at,
        flagged_by=look.name(shortfall.flagged_by),
        departs=trip.planned_depart,
        driver=driver.display_name if driver else None,
        stop_cases=stop_cases,
        next_order_ref=nxt.order_ref if nxt else None,
        next_day=nxt.run_date if nxt else None,
        window=words.window(outlet.window_open, outlet.window_close),
        store_contact=manager.display_name if manager else None,
        decision=shortfall.decision.value if shortfall.decision else None,
        decided_at=shortfall.decided_at,
        decided_by=look.name(shortfall.decided_by),
        added_to_order_ref=shortfall.added_to_order_ref,
    )
