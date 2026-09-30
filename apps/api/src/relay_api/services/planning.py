"""The plan board's work: propose a depot's run with the engine, keep the dispatcher's edits, explain the
deferrals, check the plan before it goes out, and publish it to the dock, the drivers and the stores.

The plan lives in the database as trips and stops; the engine re-checks it on every read, so the meters and
the eleven rules on the board always describe what is stored.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import (
    AppUser,
    AuditLog,
    CaseType,
    Deferral,
    DeferralKind,
    LoadLine,
    Order,
    OrderStatus,
    Outlet,
    Plan,
    PlanStatus,
    ServiceHistory,
    Stop,
    Trip,
    TripStatus,
)
from relay_api.services import network as adapters
from relay_api.services.notify import notify_store
from relay_api.services.ordering import next_operating_day
from relay_engine.clock import sequence_stops
from relay_engine.model import Deferred, GroupAnalysis, TripReport
from relay_engine.model import Trip as EngineTrip
from relay_engine.network import Brand
from relay_engine.propose import RunInput, propose
from relay_engine.rules import Context, ampm, evaluate

DEPOT_LABEL = {"Kandy": "Kandy hub", "Peliyagoda": "Peliyagoda"}

REASONS = {
    "reefer_short": "Refrigerated capacity short",
    "dry_short": "Dry-box capacity short",
    "window_full": "Fresh window full",
    "workshop": "Vehicle in the workshop",
    "van_access": "Van-only access",
    "store_asked": "Store asked to move it",
    "other": "Other (with a note)",
}


class PlanError(Exception):
    """A request the plan can't take, in words for the dispatcher."""


# ------------------------------------------------------------------------------------------------ loading
def get_plan(db: Session, depot: str, run_date: date) -> Plan:
    plan = db.scalar(select(Plan).where(Plan.depot == depot, Plan.run_date == run_date))
    if plan is None:
        plan = Plan(depot=depot, run_date=run_date, status=PlanStatus.DRAFT, version=0, summary={})
        db.add(plan)
        db.flush()
    return plan


def run_orders(db: Session, depot: str, run_date: date) -> list[Order]:
    """Every order this run must decide on: the depot's orders for the run that have not moved to another day."""
    return list(
        db.scalars(
            select(Order)
            .join(Outlet, Outlet.outlet_id == Order.outlet_id)
            .where(Outlet.depot == depot, Order.run_date == run_date)
            .order_by(Order.order_ref)
        )
    )


def protected_refs(db: Session, run_date: date, orders: Sequence[Order]) -> set[str]:
    """Rule 2: orders from stores whose last order of the same temperature waited."""
    waited = {
        (h.outlet_id, h.temp)
        for h in db.scalars(select(ServiceHistory).where(ServiceHistory.deferred_on.is_not(None)))
        if h.deferred_on and 0 < (run_date - h.deferred_on).days <= 7
    }
    for d in db.scalars(select(Deferral).where(Deferral.kind == DeferralKind.CAPACITY, Deferral.to_date == run_date)):
        order = db.get(Order, d.order_id)
        if order is not None:
            waited.add((order.outlet_id, order.temp))
    return {o.order_ref for o in orders if (o.outlet_id, o.temp) in waited}


def context(db: Session, plan: Plan, orders: Sequence[Order]) -> Context:
    net = adapters.network(db)
    return Context(
        network=net,
        orders={o.order_ref: adapters.engine_order(o) for o in orders},
        vehicles={v.vehicle_id: v for v in adapters.vehicle_days(db, plan.run_date)},
        conditions=adapters.conditions(db, plan.run_date),
        usual=adapters.usual(db, plan.run_date),
    )


def stored_trips(db: Session, plan: Plan) -> list[EngineTrip]:
    trips = db.scalars(select(Trip).where(Trip.plan_id == plan.id, Trip.is_backup.is_(False))).all()
    out = []
    for t in sorted(trips, key=lambda t: (t.vehicle_id, t.trip_no)):
        refs = [db.get(Order, s.order_id).order_ref for s in sorted(t.stops, key=lambda s: s.seq)]  # type: ignore[union-attr]
        out.append(
            EngineTrip(t.vehicle_id, t.trip_no, refs, round(adapters.minutes_of(plan.run_date, t.planned_depart)))
        )
    return out


# ------------------------------------------------------------------------------------------------ proposing
def propose_plan(db: Session, now: datetime, plan: Plan, *, forced: Iterable[str] = ()) -> Plan:
    if plan.status is PlanStatus.PUBLISHED:
        raise PlanError("This plan is published. Change it trip by trip instead.")
    orders = run_orders(db, plan.depot, plan.run_date)
    by_ref = {o.order_ref: o for o in orders}
    ctx = context(db, plan, orders)
    forced = set(forced)
    protected = protected_refs(db, plan.run_date, orders) - forced
    run = RunInput(
        network=ctx.network,
        depot=plan.depot,
        orders=[ctx.orders[o.order_ref] for o in orders if o.order_ref not in forced],
        vehicles=list(ctx.vehicles.values()),
        usual=ctx.usual,
        conditions=ctx.conditions,
        protected=protected,
    )
    result = propose(run)
    _write_trips(db, plan, result.trips, by_ref)
    _write_deferrals(db, now, plan, result.deferred, result.analyses, by_ref, forced)
    plan.version += 1
    plan.proposed_at = now
    plan.summary = {
        **{k: v for k, v in plan.summary.items() if k not in {"undo", "edited_at"}},
        "analyses": [_analysis_json(a) for a in result.analyses],
        "protected": sorted(protected),
        "overridden": sorted(forced),
        "undo": [],
    }
    db.add(
        AuditLog(
            at=now,
            actor_label="Relay",
            action="plan.proposed",
            entity="plan",
            entity_id=str(plan.id),
            summary=f"Proposed the {DEPOT_LABEL[plan.depot]} plan for {plan.run_date:%A %d %B}",
        )
    )
    return plan


def _analysis_json(a: GroupAnalysis) -> dict[str, Any]:
    return {
        "temp_class": a.temp_class,
        "orders": a.orders,
        "max_served": a.max_served,
        "unavoidable": a.unavoidable,
        "pool": a.pool,
        "pool_keeping_usual_runs": a.pool_keeping_usual_runs,
        "protected": a.protected,
        "limiting": a.limiting,
    }


def _write_trips(db: Session, plan: Plan, trips: Sequence[EngineTrip], by_ref: dict[str, Order]) -> None:
    for t in db.scalars(select(Trip).where(Trip.plan_id == plan.id)).all():
        db.delete(t)
    db.flush()
    orders = list(by_ref.values())
    ctx = context(db, plan, orders)
    reports, _ = evaluate(ctx, trips)
    for report in reports:
        t = report.trip
        row = Trip(
            plan_id=plan.id,
            vehicle_id=t.vehicle_id,
            trip_no=t.trip_no,
            brand=report.brand.value,
            temp=report.temp.value,
            district=report.district,
            planned_depart=adapters.at_minutes(plan.run_date, report.depart),
            planned_back=adapters.at_minutes(plan.run_date, report.back),
            expected_back=adapters.at_minutes(plan.run_date, report.expected_back),
            std_minutes=report.standard_minutes,
            fuel_l=report.litres,
            status=TripStatus.PLANNED,
        )
        row.stops = [
            Stop(
                order_id=by_ref[p.order_id].id,
                outlet_id=p.outlet_id,
                seq=i + 1,
                planned_arrival=adapters.at_minutes(plan.run_date, p.arrive),
                expected_arrival=adapters.at_minutes(plan.run_date, e.arrive),
            )
            for i, (p, e) in enumerate(zip(report.planned, report.expected, strict=True))
        ]
        db.add(row)
    for order in orders:
        if order.status in (OrderStatus.RECEIVED, OrderStatus.ALLOCATED):
            order.status = OrderStatus.RECEIVED
    db.flush()


def _write_deferrals(
    db: Session,
    now: datetime,
    plan: Plan,
    deferred: Sequence[Deferred],
    analyses: Sequence[GroupAnalysis],
    by_ref: dict[str, Order],
    forced: set[str],
) -> None:
    db.execute(delete(Deferral).where(Deferral.plan_id == plan.id))
    next_day = next_operating_day(db, plan.run_date)
    for d in deferred:
        order = by_ref[d.order_id]
        analysis = next((a for a in analyses if (a.temp_class == "chilled") == (order.temp == "chilled")), None)
        db.add(
            Deferral(
                order_id=order.id,
                plan_id=plan.id,
                kind=DeferralKind.CAPACITY,
                from_date=plan.run_date,
                to_date=next_day,
                explanation={
                    "unavoidable": d.unavoidable,
                    "rule": d.rule,
                    "engine_reason": d.reason,
                    "analysis": _analysis_json(analysis) if analysis else None,
                    "suggested_reason": "reefer_short" if order.temp == "chilled" else "dry_short",
                },
                created_at=now,
            )
        )
    for ref in forced:
        order = by_ref.get(ref)
        if order is not None:
            db.add(
                Deferral(
                    order_id=order.id,
                    plan_id=plan.id,
                    kind=DeferralKind.MANUAL,
                    from_date=plan.run_date,
                    to_date=next_day,
                    explanation={"override": True, "suggested_reason": "other"},
                    created_at=now,
                )
            )
    db.flush()


# ------------------------------------------------------------------------------------------------ editing
@dataclass(frozen=True)
class Target:
    vehicle_id: str
    trip_no: int


def move_order(db: Session, now: datetime, plan: Plan, order_ref: str, target: Target | None, user: AppUser) -> None:
    """Move one order onto a trip, or off every trip. Relay never refuses the move; the board names what it
    breaks."""
    if plan.status is PlanStatus.PUBLISHED:
        raise PlanError("This plan is published. Change it from Live runs.")
    orders = run_orders(db, plan.depot, plan.run_date)
    by_ref = {o.order_ref: o for o in orders}
    if order_ref not in by_ref:
        raise PlanError(f"{order_ref} is not on this run")
    trips = stored_trips(db, plan)
    _remember(plan, trips)
    ctx = context(db, plan, orders)
    for t in trips:
        if order_ref in t.order_ids:
            t.order_ids.remove(order_ref)
            t.depart = None
    trips = [t for t in trips if t.order_ids]
    if target is not None:
        vehicle = ctx.network.vehicles.get(target.vehicle_id)
        if vehicle is None or vehicle.depot != plan.depot:
            raise PlanError(f"{target.vehicle_id} is not a {DEPOT_LABEL[plan.depot]} vehicle")
        day = ctx.vehicles.get(target.vehicle_id)
        if day is not None and day.status.value == "workshop":
            raise PlanError(f"{target.vehicle_id} is in the workshop")
        trip = next((t for t in trips if t.key == (target.vehicle_id, target.trip_no)), None)
        if trip is None:
            trip = EngineTrip(target.vehicle_id, target.trip_no, [])
            trips.append(trip)
        trip.order_ids.append(order_ref)
        trip.depart = None
        _resequence(ctx, trip)
    _renumber(trips)
    _write_trips(db, plan, trips, by_ref)
    # an order taken off every trip waits, and needs a reason; an order placed stops waiting
    placed = {o for t in trips for o in t.order_ids}
    for d in db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)).all():
        if db.get(Order, d.order_id).order_ref in placed:  # type: ignore[union-attr]
            db.delete(d)
    if target is None and not db.scalar(
        select(Deferral).where(Deferral.plan_id == plan.id, Deferral.order_id == by_ref[order_ref].id)
    ):
        db.add(
            Deferral(
                order_id=by_ref[order_ref].id,
                plan_id=plan.id,
                kind=DeferralKind.MANUAL,
                from_date=plan.run_date,
                to_date=next_operating_day(db, plan.run_date),
                explanation={"manual": True, "suggested_reason": "other"},
                created_at=now,
            )
        )
    plan.summary = {**plan.summary, "edited_at": now.isoformat()}
    plan.version += 1
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id,
            actor_label=user.display_name,
            action="plan.moved",
            entity="order",
            entity_id=order_ref,
            summary=f"Moved {order_ref} to "
            + (f"{target.vehicle_id} trip {target.trip_no}" if target else "Not placed"),
        )
    )


def _resequence(ctx: Context, trip: EngineTrip) -> None:
    """Put a changed trip's stops in Relay's order when some order keeps every window; otherwise keep the
    dispatcher's order, and the board shows what breaks."""
    orders = [ctx.orders[o] for o in trip.order_ids]
    brands = {o.brand for o in orders}
    districts = {ctx.network.outlets[o.outlet_id].district for o in orders}
    outlets = [o.outlet_id for o in orders]
    if len(brands) != 1 or len(districts) != 1 or len(set(outlets)) != len(outlets) or len(outlets) > 7:
        return
    brand = next(iter(brands))
    found = sequence_stops(
        ctx.network, ctx.conditions, outlets, brand, 120.0, latest=480 if brand is Brand.FRESH else 17 * 60
    )
    if found is not None:
        by_outlet = {o.outlet_id: o.order_id for o in orders}
        trip.order_ids[:] = [by_outlet[o] for o in found.outlets]


def _renumber(trips: list[EngineTrip]) -> None:
    by_vehicle: dict[str, list[EngineTrip]] = {}
    for t in trips:
        by_vehicle.setdefault(t.vehicle_id, []).append(t)
    for own in by_vehicle.values():
        own.sort(key=lambda t: t.trip_no)
        for i, t in enumerate(own, start=1):
            if t.trip_no != i:
                t.trip_no = i
                t.depart = None


def _remember(plan: Plan, trips: Sequence[EngineTrip]) -> None:
    snapshot = [{"v": t.vehicle_id, "n": t.trip_no, "o": list(t.order_ids), "d": t.depart} for t in trips]
    undo = list(plan.summary.get("undo", []))[-19:]
    plan.summary = {**plan.summary, "undo": [*undo, snapshot]}


def undo(db: Session, now: datetime, plan: Plan) -> None:
    stack = list(plan.summary.get("undo", []))
    if not stack:
        raise PlanError("Nothing to undo")
    snapshot = stack.pop()
    orders = run_orders(db, plan.depot, plan.run_date)
    by_ref = {o.order_ref: o for o in orders}
    trips = [EngineTrip(s["v"], s["n"], list(s["o"]), s["d"]) for s in snapshot]
    _write_trips(db, plan, trips, by_ref)
    placed = {o for t in trips for o in t.order_ids}
    for d in db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)).all():
        if db.get(Order, d.order_id).order_ref in placed:  # type: ignore[union-attr]
            db.delete(d)
    # an order the undo takes off every trip waits again, as the engine proposed it
    for ref, order in by_ref.items():
        if ref not in placed and not db.scalar(
            select(Deferral).where(Deferral.plan_id == plan.id, Deferral.order_id == order.id)
        ):
            db.add(
                Deferral(
                    order_id=order.id,
                    plan_id=plan.id,
                    kind=DeferralKind.CAPACITY,
                    from_date=plan.run_date,
                    to_date=next_operating_day(db, plan.run_date),
                    explanation=_proposed_explanation(plan, ref, order),
                    created_at=now,
                )
            )
    plan.summary = {**plan.summary, "undo": stack}
    plan.version += 1


def _proposed_explanation(plan: Plan, ref: str, order: Order) -> dict[str, Any]:
    analysis = next((a for a in plan.summary.get("analyses", []) if ref in a.get("pool", [])), None)
    rule = 2 if analysis and ref in analysis.get("pool_keeping_usual_runs", []) and analysis.get("protected") else None
    return {
        "unavoidable": not analysis,
        "rule": rule,
        "analysis": analysis,
        "suggested_reason": "reefer_short" if order.temp == "chilled" else "dry_short",
    }


# ------------------------------------------------------------------------------------------------ deferrals
def confirm_deferral(
    db: Session, now: datetime, plan: Plan, order_ref: str, reason: str, note: str, user: AppUser
) -> Deferral:
    order = next((o for o in run_orders(db, plan.depot, plan.run_date) if o.order_ref == order_ref), None)
    deferral = (
        db.scalar(select(Deferral).where(Deferral.plan_id == plan.id, Deferral.order_id == order.id)) if order else None
    )
    if order is None or deferral is None:
        raise PlanError(f"{order_ref} is not waiting on this plan")
    if reason not in REASONS:
        raise PlanError("Choose a reason")
    if reason == "other" and not note.strip():
        raise PlanError("Add a note for the record")
    deferral.reason = REASONS[reason] if reason != "other" else note.strip()
    deferral.store_notice = store_notice(db, plan, order, deferral, reason)
    deferral.confirmed_at = now
    deferral.confirmed_by = user.id
    deferral.explanation = {**deferral.explanation, "reason_code": reason, "note": note.strip()}
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id,
            actor_label=user.display_name,
            action="deferral.confirmed",
            entity="order",
            entity_id=order_ref,
            summary=f"{order_ref} waits: {deferral.reason}",
            data={"note": note.strip()},
        )
    )
    return deferral


def store_notice(db: Session, plan: Plan, order: Order, deferral: Deferral, reason: str) -> str:
    """The words the store reads, in the order STM-03 shows them."""
    day = f"{plan.run_date:%A}"
    analysis = deferral.explanation.get("analysis") or {}
    limiting = analysis.get("limiting", [])
    parts = []
    if reason in ("reefer_short", "workshop") and limiting:
        count = "Two" if len(limiting) == 2 else str(len(limiting)) if len(limiting) > 2 else "One"
        verb = "are" if len(limiting) > 1 else "is"
        parts.append(
            f"{count} of our refrigerated vehicles {verb} in the workshop this week, and the ones still running "
            f"can't fit your order on {day} morning."
        )
    elif reason == "reefer_short":
        parts.append(f"Our refrigerated vehicles are full for {day} morning.")
    elif reason == "dry_short":
        parts.append(f"Our dry-box trucks are full for {day} morning.")
    elif reason == "window_full":
        parts.append(f"We can't reach your store inside its window on {day} morning.")
    elif reason == "van_access":
        parts.append(f"Your store takes vans only, and our vans are full for {day} morning.")
    elif reason == "store_asked":
        parts.append("You asked us to move it.")
    else:
        parts.append(deferral.explanation.get("note") or "We had to move it.")
    if deferral.explanation.get("rule") == 2:
        parts.append(
            "Another store in your area had its chilled order wait on its last run, so it goes first this time. "
            "We avoid making any store wait twice in a row."
        )
    check = deferral.explanation.get("next_run")
    if check and check.get("fits"):
        vehicle = check.get("vehicle_kind", "vehicle")
        parts.append(f"Before moving your order, we checked {deferral.to_date:%A}: a {vehicle} has room for it.")
    return "\n\n".join(parts)


def next_run_check(db: Session, plan: Plan, deferral: Deferral) -> dict[str, Any]:
    """Will the next run carry a waiting order? Plans the next day's orders of the same kind at the depot with
    this order added, and reports where it would ride."""
    order = db.get(Order, deferral.order_id)
    assert order is not None
    day = deferral.to_date
    others = [
        o
        for o in db.scalars(
            select(Order)
            .join(Outlet, Outlet.outlet_id == Order.outlet_id)
            .where(Outlet.depot == plan.depot, Order.run_date == day, Order.temp == order.temp)
        )
        if o.id != order.id
    ]
    net = adapters.network(db)
    orders = [adapters.engine_order(o) for o in [*others, order]]
    run = RunInput(
        network=net,
        depot=plan.depot,
        orders=orders,
        vehicles=adapters.vehicle_days(db, day),
        usual=adapters.usual(db, day),
        conditions=adapters.conditions(db, day),
        protected={order.order_ref},
    )
    result = propose(run, explain=False)
    for report in result.reports:
        for stop in report.planned:
            if stop.order_id == order.order_ref:
                vehicle = net.vehicles[report.trip.vehicle_id]
                kind = ("refrigerated " if vehicle.refrigerated else "") + ("van" if vehicle.is_van else "truck")
                return {
                    "fits": True,
                    "day": day.isoformat(),
                    "vehicle_id": report.trip.vehicle_id,
                    "vehicle_kind": kind,
                    "trip_no": report.trip.trip_no,
                    "planned": ampm(stop.arrive),
                    "depart": ampm(report.depart),
                    "back": ampm(report.back),
                    "stops": len(report.planned),
                    "weight_kg": report.weight_kg,
                    "weight_cap": vehicle.weight_cap_kg,
                    "volume_m3": report.volume_m3,
                    "volume_cap": vehicle.volume_cap_m3,
                    "orders_with_it": [s.order_id for s in report.planned if s.order_id != order.order_ref],
                }
    return {"fits": False, "day": day.isoformat()}


# ------------------------------------------------------------------------------------------------ checking
def publish_check(db: Session, plan: Plan) -> dict[str, Any]:
    orders = run_orders(db, plan.depot, plan.run_date)
    ctx = context(db, plan, orders)
    reports, _ = evaluate(ctx, stored_trips(db, plan))
    broken = [(r, b) for r in reports for b in r.broken]
    waits = db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)).all()
    unreasoned = [d for d in waits if not d.confirmed_at]
    fresh_stops = [(r, s) for r in reports if r.brand is Brand.FRESH for s in r.expected]
    late = []
    for r in reports:
        if r.brand is not Brand.FRESH:
            continue  # the morning windows are the ones at risk; daytime deliveries have hours of slack
        for p, e in zip(r.planned, r.expected, strict=True):
            close = ctx.network.outlets[e.outlet_id].receiving_window[1]
            if e.arrive > close:
                late.append(
                    {
                        "vehicle_id": r.trip.vehicle_id,
                        "trip_no": r.trip.trip_no,
                        "order_ref": e.order_id,
                        "outlet_id": e.outlet_id,
                        "closes": ampm(close),
                        "planned": ampm(p.arrive),
                        "expected": ampm(e.arrive),
                        "why": _why_kept(ctx, r, e.order_id, reports),
                    }
                )
    return {
        "fresh_stops": len(fresh_stops),
        "planned_late": sum(1 for r, b in broken if b.rule == 8),
        "broken": [
            {"vehicle_id": r.trip.vehicle_id, "trip_no": r.trip.trip_no, "message": b.message} for r, b in broken
        ],
        "waiting_without_reason": [db.get(Order, d.order_id).order_ref for d in unreasoned],  # type: ignore[union-attr]
        "expected_late": late,
        "can_publish": not broken and not unreasoned,
    }


def _why_kept(ctx: Context, report: TripReport, order_ref: str, reports: Sequence[TripReport]) -> str:
    net = ctx.network
    stops = [s.order_id for s in report.planned]
    position = stops.index(order_ref) + 1
    outlet = net.outlets[ctx.orders[order_ref].outlet_id]
    parts = []
    if report.trip.trip_no == 2:
        first = next((r for r in reports if r.trip.vehicle_id == report.trip.vehicle_id and r.trip.trip_no == 1), None)
        if first is not None:
            parts.append(
                f"{report.trip.vehicle_id}'s second trip leaves {round(report.depart - first.back)} min after "
                f"its first is back at {ampm(first.back)}."
            )
    if position == len(stops) and len(stops) > 1:
        parts.append(f"The last of {len(stops)} stores on the {report.district} run.")
    if not parts:
        parts.append(
            f"Relay's model expects slow roads in {outlet.district} at this hour; the plan keeps it inside its "
            "window on the published standard."
        )
    return " ".join(parts)


# ------------------------------------------------------------------------------------------------ publishing
def publish(db: Session, now: datetime, plan: Plan, user: AppUser | None) -> None:
    check = publish_check(db, plan)
    if not check["can_publish"]:
        if check["broken"]:
            raise PlanError(f"{len(check['broken'])} rules are broken. Fix them to publish.")
        raise PlanError("Give every waiting order a reason to publish.")
    orders = run_orders(db, plan.depot, plan.run_date)
    by_id = {o.id: o for o in orders}
    trips = db.scalars(select(Trip).where(Trip.plan_id == plan.id)).all()
    types = {c.code: c for c in db.scalars(select(CaseType))}
    served: set[uuid.UUID] = set()
    for trip in trips:
        stops = sorted(trip.stops, key=lambda s: s.seq)
        load_order = 0
        for stop in reversed(stops):  # the last stop goes in first, at the cab end
            order = by_id[stop.order_id]
            served.add(order.id)
            order.status = OrderStatus.ALLOCATED
            for line in sorted(order.lines, key=lambda line: (types[line.case_type].load_rank, line.position)):
                load_order += 1
                db.add(
                    LoadLine(
                        trip_id=trip.id,
                        stop_id=stop.id,
                        case_type=line.case_type,
                        load_order=load_order,
                        planned_qty=line.qty,
                    )
                )
        for stop in stops:
            order = by_id[stop.order_id]
            outlet = db.get(Outlet, order.outlet_id)
            expected = _round5(stop.expected_arrival or stop.planned_arrival)
            kind = "chilled" if order.temp == "chilled" else "dry" if order.brand == "Fresh" else order.brand
            notify_store(
                db,
                order.outlet_id,
                now,
                kind="order_scheduled",
                title="Delivery time set",
                body=f"Your {kind} order {order.order_ref} is expected around {_clock(expected)}. "
                f"Your window is {_window(outlet)}.",
                data={"order_ref": order.order_ref, "expected": expected.isoformat()},
            )
    for deferral in db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)).all():
        order = by_id[deferral.order_id]
        order.status = OrderStatus.DEFERRED
        order.run_date = deferral.to_date
        deferral.notified_at = now
        notify_store(
            db,
            order.outlet_id,
            now,
            kind="order_deferred",
            title=f"Your {'chilled' if order.temp == 'chilled' else 'dry'} order now comes {deferral.to_date:%A}",
            body=deferral.store_notice,
            data={"order_ref": order.order_ref, "deferral_id": str(deferral.id)},
        )
    plan.status = PlanStatus.PUBLISHED
    plan.published_at = now
    plan.published_by = user.id if user else None
    plan.version += 1
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id if user else None,
            actor_label=user.display_name if user else "Relay",
            action="plan.published",
            entity="plan",
            entity_id=str(plan.id),
            summary=f"Published the {DEPOT_LABEL[plan.depot]} plan: {len(served)} orders on {len(trips)} trips",
        )
    )


def _round5(moment: datetime) -> datetime:
    local = moment.astimezone(COLOMBO)
    minutes = round((local.hour * 60 + local.minute + local.second / 60) / 5) * 5
    return local.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(minutes=minutes)


def _clock(moment: datetime) -> str:
    local = moment.astimezone(COLOMBO)
    return ampm(local.hour * 60 + local.minute)


def _window(outlet: Outlet | None) -> str:
    if outlet is None:
        return ""
    open_, close = outlet.window_open, outlet.window_close
    a = ampm(int(open_[:2]) * 60 + int(open_[3:]))
    b = ampm(int(close[:2]) * 60 + int(close[3:]))
    if a[-2:] == b[-2:]:
        return f"{a[:-3]} to {b}"
    return f"{a} to {b}"
