"""The plan board's work: propose a depot's run with the engine, keep the dispatcher's edits, explain the
deferrals, check the plan before it goes out, and publish it to the dock, the drivers and the stores.

The plan lives in the database as trips and stops; the engine re-checks it on every read, so the meters and
the eleven rules on the board always describe what is stored.
"""

from __future__ import annotations

import itertools
import uuid
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.exc import IntegrityError
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
    Vehicle,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.services import network as adapters
from relay_api.services import words
from relay_api.services.engine_cache import propose_cached
from relay_api.services.notify import notify_store
from relay_api.services.ordering import current_run, next_operating_day
from relay_engine.clock import expected, free_flow, sequence_stops
from relay_engine.model import RELOAD_MINUTES, Deferred, GroupAnalysis, StopTiming, TripReport, VehicleStatus
from relay_engine.model import Trip as EngineTrip
from relay_engine.network import Brand, VehicleType
from relay_engine.propose import RunInput, propose
from relay_engine.rules import Context, ampm, evaluate
from relay_engine.standard import FRESH_BUDGET_MIN

DEPOT_LABEL = {"Kandy": "Kandy hub", "Peliyagoda": "Peliyagoda"}

FLEET_DAYS_AHEAD = 13
"""How far past the run being planned the dispatcher can mark a vehicle in the workshop or on standby."""

REASONS = {
    "reefer_short": "Refrigerated capacity short",
    "dry_short": "Dry-box capacity short",
    "window_full": "Fresh window full",
    "workshop": "Vehicle in the workshop",
    "van_access": "Van-only access",
    "store_asked": "Store asked to move it",
    "other": "Other (with a note)",
}


def and_list(items: Iterable[str]) -> str:
    """'VEH039, VEH043 and VEH058': how every list in the dispatcher's sentences reads."""
    names = list(items)
    if len(names) < 2:
        return "".join(names)
    return f"{', '.join(names[:-1])} and {names[-1]}"


class PlanError(Exception):
    """A request the plan can't take, in words for the dispatcher."""


# ------------------------------------------------------------------------------------------------ loading
def get_plan(db: Session, depot: str, run_date: date) -> Plan:
    """The depot's plan for a run, made empty on the first read. Two first reads can arrive together (the board's
    poll and a depot switch): the unique key lets one insert win, and the other reads the winner's row."""
    found = select(Plan).where(Plan.depot == depot, Plan.run_date == run_date)
    plan = db.scalar(found)
    if plan is None:
        try:
            with db.begin_nested():
                plan = Plan(depot=depot, run_date=run_date, status=PlanStatus.DRAFT, version=0, summary={})
                db.add(plan)
        except IntegrityError:
            plan = db.scalars(found).one()
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


def order_ref_of(db: Session, order_id: uuid.UUID) -> str:
    """The order number of an order a stop or a deferral names by its id (a foreign key, so it is there)."""
    order = db.get(Order, order_id)
    if order is None:
        raise LookupError(f"No order {order_id}")
    return order.order_ref


def stored_trips(db: Session, plan: Plan) -> list[EngineTrip]:
    trips = db.scalars(select(Trip).where(Trip.plan_id == plan.id, Trip.is_backup.is_(False))).all()
    out = []
    for t in sorted(trips, key=lambda t: (t.vehicle_id, t.trip_no)):
        refs = [order_ref_of(db, s.order_id) for s in sorted(t.stops, key=lambda s: s.seq)]
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
    result = propose_cached(db, run)
    _write_trips(db, plan, result.trips, by_ref, ctx)
    _write_deferrals(db, now, plan, result.deferred, result.analyses, by_ref, forced)
    plan.version += 1
    plan.proposed_at = now
    fleet = sorted(
        f"{v}:{d.status.value}" for v, d in ctx.vehicles.items() if ctx.network.vehicles[v].depot == plan.depot
    )
    plan.summary = {
        **{k: v for k, v in plan.summary.items() if k not in {"undo", "edited_at", "fleet_changed_at"}},
        "analyses": [_analysis_json(a) for a in result.analyses],
        "analyses_before_override": _before_override(plan.summary, fleet) if forced else None,
        "fleet": fleet,
        "protected": sorted(protected),
        "overridden": sorted(forced),
        "proposal": _assignment(result.trips),
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


def _before_override(summary: dict[str, Any], fleet: list[str]) -> list[dict[str, Any]] | None:
    """What the engine found with every order in the run, kept through an override: the override plans without
    the overridden order, so its own analysis no longer counts what no plan could avoid. Only while the fleet is
    the same one that analysis saw."""
    if summary.get("fleet") != fleet:
        return None
    return summary.get("analyses_before_override") if summary.get("overridden") else summary.get("analyses")


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


def _write_trips(
    db: Session, plan: Plan, trips: Sequence[EngineTrip], by_ref: dict[str, Order], ctx: Context | None = None
) -> None:
    # One statement, the stops going with their trips in the database. Only a draft is ever rewritten, and nothing
    # hangs on a draft's trips yet; deleting them one by one through the session cost a round trip for every
    # relationship of every trip, about a second on each move.
    db.execute(delete(Trip).where(Trip.plan_id == plan.id))
    db.expire(plan, ["trips"])
    orders = list(by_ref.values())
    reports, _ = evaluate(ctx or context(db, plan, orders), trips)
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
        overridden = by_ref.get(ref)
        if overridden is not None:
            db.add(
                Deferral(
                    order_id=overridden.id,
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


def move_orders(
    db: Session, now: datetime, plan: Plan, order_refs: Sequence[str], target: Target | None, user: AppUser
) -> None:
    """Move orders onto a trip, or off every trip, as one step of the board's undo: one order from Not placed, or
    every order of a store when its stop is dragged. Relay never refuses the move; the board names what it
    breaks."""
    if plan.status is PlanStatus.PUBLISHED:
        raise PlanError("This plan is published. Change it from Live runs.")
    refs = list(dict.fromkeys(order_refs))
    if not refs:
        raise PlanError("Choose an order to move")
    orders = run_orders(db, plan.depot, plan.run_date)
    by_ref = {o.order_ref: o for o in orders}
    missing = [ref for ref in refs if ref not in by_ref]
    if missing:
        raise PlanError(f"{and_list(missing)} {'is' if len(missing) == 1 else 'are'} not on this run")
    trips = stored_trips(db, plan)
    _remember(plan, trips)
    ctx = context(db, plan, orders)
    for t in trips:
        if any(ref in t.order_ids for ref in refs):
            t.order_ids[:] = [o for o in t.order_ids if o not in refs]
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
        trip.order_ids.extend(refs)
        trip.depart = None
        resequence(ctx, trip, trips)
    _renumber(trips)
    _write_trips(db, plan, trips, by_ref, ctx)
    # an order taken off every trip waits, and needs a reason; an order placed stops waiting
    placed = {o for t in trips for o in t.order_ids}
    for d in db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)).all():
        if order_ref_of(db, d.order_id) in placed:
            db.delete(d)
    for ref in refs if target is None else ():
        if not db.scalar(select(Deferral).where(Deferral.plan_id == plan.id, Deferral.order_id == by_ref[ref].id)):
            db.add(
                Deferral(
                    order_id=by_ref[ref].id,
                    plan_id=plan.id,
                    kind=DeferralKind.MANUAL,
                    from_date=plan.run_date,
                    to_date=next_operating_day(db, plan.run_date),
                    explanation={"manual": True, "suggested_reason": "other"},
                    created_at=now,
                )
            )
    _mark_edited(plan, trips, now)
    plan.version += 1
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id,
            actor_label=user.display_name,
            action="plan.moved",
            entity="order",
            entity_id=refs[0],
            summary=f"Moved {and_list(refs)} to "
            + (f"{target.vehicle_id} trip {target.trip_no}" if target else "Not placed"),
            data={"order_refs": refs},
        )
    )


def _assignment(trips: Iterable[EngineTrip]) -> list[list[Any]]:
    """Which orders ride which trip, in stop order: what the board compares with Relay's proposal."""
    return sorted([t.vehicle_id, t.trip_no, list(t.order_ids)] for t in trips)


def _day(day: date) -> str:
    """ "Wednesday 8 April" (strftime has no portable day without its leading zero)."""
    return f"{day:%A} {day.day} {day:%B}"


def _mark_edited(plan: Plan, trips: Sequence[EngineTrip], now: datetime) -> None:
    """The board reads "Edited" from the first move until it is back to exactly what Relay proposed, by undo or by
    moving the orders back."""
    summary = {k: v for k, v in plan.summary.items() if k != "edited_at"}
    if _assignment(trips) != plan.summary.get("proposal"):
        summary["edited_at"] = now.isoformat()
    plan.summary = summary


def set_vehicle_status(
    db: Session, now: datetime, vehicle: Vehicle, run_date: date, status: VehicleDayStatus, note: str, user: AppUser
) -> Plan:
    """Send a vehicle to the workshop, back into service, or onto standby for one run. The plan keeps its trips
    until the dispatcher proposes again; a trip left on a vehicle in the workshop breaks rule 9, so it can't go
    out. Only a draft's fleet can change: once a plan is published its trucks are loaded and on the road."""
    today = current_run(db, now)
    if not today <= run_date <= today + timedelta(days=FLEET_DAYS_AHEAD):
        raise PlanError(f"The fleet can be changed for runs from {_day(today)} to two weeks after it.")
    plan = get_plan(db, vehicle.depot, run_date)
    if plan.status is PlanStatus.PUBLISHED:
        raise PlanError(
            f"The {DEPOT_LABEL[vehicle.depot]} plan for {run_date:%A} is published, so its fleet is set. "
            "Change a trip from Live runs instead."
        )
    day = db.scalar(
        select(VehicleDay).where(VehicleDay.vehicle_id == vehicle.vehicle_id, VehicleDay.run_date == run_date)
    )
    if day is None:
        day = VehicleDay(vehicle_id=vehicle.vehicle_id, run_date=run_date, status=status)
        db.add(day)
    day.status = status
    day.note = note.strip() if status is not VehicleDayStatus.AVAILABLE else ""
    if plan.version > 0:
        # the board says so, and asks for a new proposal, until Relay plans with this fleet
        plan.summary = {**plan.summary, "fleet_changed_at": now.isoformat()}
        plan.version += 1
    words_for = {
        VehicleDayStatus.AVAILABLE: "back in service",
        VehicleDayStatus.WORKSHOP: "in the workshop",
        VehicleDayStatus.STANDBY: "on standby",
    }
    db.add(
        AuditLog(
            at=now,
            actor_id=user.id,
            actor_label=user.display_name,
            action="vehicle.status",
            entity="vehicle",
            entity_id=vehicle.vehicle_id,
            summary=f"{vehicle.vehicle_id} {words_for[status]} for {_day(run_date)}",
            data={"status": status.value, "note": day.note},
        )
    )
    db.flush()
    return plan


def resequence(ctx: Context, trip: EngineTrip, trips: Sequence[EngineTrip] = ()) -> None:
    """Put a changed trip's stops in Relay's order when some order keeps every window, counted from when the
    vehicle can leave: 2:00 AM for a first trip, and for a second, once the first is back. Otherwise keep the
    dispatcher's order, and the board shows what breaks."""
    orders = [ctx.orders[o] for o in trip.order_ids]
    brands = {o.brand for o in orders}
    districts = {ctx.network.outlets[o.outlet_id].district for o in orders}
    outlets = [o.outlet_id for o in orders]
    if len(brands) != 1 or len(districts) != 1 or len(set(outlets)) != len(outlets) or len(outlets) > 7:
        return
    brand = next(iter(brands))
    ready = 120.0
    before = next((t for t in trips if t.vehicle_id == trip.vehicle_id and t.trip_no == trip.trip_no - 1), None)
    if before is not None:
        # a second trip starting at 2:00 AM would find an order the van can never drive
        (report,), _ = evaluate(ctx, [before])
        ready = report.back + RELOAD_MINUTES
    found = sequence_stops(
        ctx.network, ctx.conditions, outlets, brand, ready, latest=480 if brand is Brand.FRESH else 17 * 60
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
    """Put back the board as it was before the last move. Only before publishing: undo rewrites every trip, and on
    a published plan that would wipe what the dock has loaded, flagged and handed over."""
    if plan.status is PlanStatus.PUBLISHED:
        raise PlanError("This plan is published, so board moves can't be undone. Change it trip by trip instead.")
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
        if order_ref_of(db, d.order_id) in placed:
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
    _mark_edited(plan, trips, now)
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
    # the note goes in first: with "Other", the note is the words the store reads
    deferral.explanation = {**deferral.explanation, "reason_code": reason, "note": note.strip()}
    # the store is told the next run has room for it, whether or not the drawer was opened first
    check_next_run(db, plan)
    deferral.store_notice = store_notice(db, plan, order, deferral, reason)
    deferral.confirmed_at = now
    deferral.confirmed_by = user.id
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


_COUNTS = ("No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine")


def _counted(n: int) -> str:
    """A count that starts a sentence the store reads, in words while it is small: "Three of our ..."."""
    return _COUNTS[n] if 0 <= n < len(_COUNTS) else str(n)


def store_notice(db: Session, plan: Plan, order: Order, deferral: Deferral, reason: str) -> str:
    """The words the store reads, in the order STM-03 shows them."""
    day = f"{plan.run_date:%A}"
    analysis = deferral.explanation.get("analysis") or {}
    limiting = analysis.get("limiting", [])
    parts = []
    if reason in ("reefer_short", "workshop") and limiting:
        verb = "are" if len(limiting) > 1 else "is"
        parts.append(
            f"{_counted(len(limiting))} of our refrigerated vehicles {verb} in the workshop this week, and the ones "
            f"still running can't fit your order on {day} morning."
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
    if deferral.explanation.get("rule") == 2 and reason != "store_asked":
        # Relay's choice, told only when it is the reason: a store that asked for the move already knows why
        parts.append(
            f"Another store in your area had its {'chilled' if order.temp == 'chilled' else 'dry'} order wait on its "
            "last run, so it goes first this time. We avoid making any store wait twice in a row."
        )
    check = deferral.explanation.get("next_run")
    if check and check.get("fits"):
        vehicle = check.get("vehicle_kind", "vehicle")
        parts.append(f"Before moving your order, we checked {deferral.to_date:%A}: a {vehicle} has room for it.")
    return "\n\n".join(parts)


def check_next_run(db: Session, plan: Plan) -> None:
    """Will the next run carry the orders waiting on this plan? One plan of that day at the depot, with every
    waiting order added and protected (a store never waits twice in a row), so two waiting orders are never each
    checked onto the same trip in plans of their own. Kept on each deferral until the waiting orders change; a
    published plan keeps the check its stores were told about."""
    if plan.status is PlanStatus.PUBLISHED:
        return
    deferrals = list(db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)))
    waiting = {d.id: order for d in deferrals if (order := db.get(Order, d.order_id)) is not None}
    refs = sorted(o.order_ref for o in waiting.values())
    if all((d.explanation.get("next_run") or {}).get("checked_with") == refs for d in deferrals):
        return
    today = {v.vehicle_id: v.status for v in adapters.vehicle_days(db, plan.run_date)}
    for day in sorted({d.to_date for d in deferrals}):
        mine = [d for d in deferrals if d.to_date == day and d.id in waiting]
        found = _next_run(db, plan.depot, day, [waiting[d.id] for d in mine], today)
        for d in mine:
            order = waiting[d.id]
            d.explanation = {**d.explanation, "next_run": {**found[order.order_ref], "checked_with": refs}}
            if d.confirmed_at and d.explanation.get("reason_code"):
                # a reason already given keeps its words, with the check as it now stands
                d.store_notice = store_notice(db, plan, order, d, d.explanation["reason_code"])
    db.flush()


def _next_run(
    db: Session, depot: str, day: date, moving: Sequence[Order], today: dict[str, VehicleStatus]
) -> dict[str, dict[str, Any]]:
    ids = {o.id for o in moving}
    others = [
        o
        for o in db.scalars(
            select(Order)
            .join(Outlet, Outlet.outlet_id == Order.outlet_id)
            .where(Outlet.depot == depot, Order.run_date == day, Order.temp.in_({o.temp for o in moving}))
        )
        if o.id not in ids
    ]
    net = adapters.network(db)
    fleet_days = adapters.vehicle_days(db, day)
    status = {v.vehicle_id: v.status for v in fleet_days}
    run = RunInput(
        network=net,
        depot=depot,
        orders=[adapters.engine_order(o) for o in [*others, *moving]],
        vehicles=fleet_days,
        usual=adapters.usual(db, day),
        conditions=adapters.conditions(db, day),
        protected={o.order_ref for o in moving} | protected_refs(db, day, others),
    )
    result = propose(run, explain=False)
    where = {s.order_id: (r, s) for r in result.reports for s in r.planned}
    by_ref = {o.order_ref: o for o in [*others, *moving]}
    names = {
        o.outlet_id: o.short_name
        for o in db.scalars(select(Outlet).where(Outlet.outlet_id.in_({o.outlet_id for o in by_ref.values()})))
    }
    waiting = {o.order_ref for o in moving}
    out: dict[str, dict[str, Any]] = {}
    for order in moving:
        if order.order_ref not in where:
            out[order.order_ref] = {"fits": False, "day": day.isoformat()}
            continue
        report, stop = where[order.order_ref]
        vehicle_id = report.trip.vehicle_id
        vehicle = net.vehicles[vehicle_id]
        kind = ("refrigerated " if vehicle.refrigerated else "") + ("van" if vehicle.is_van else "truck")
        fleet = [v for v in net.vehicles.values() if v.depot == depot and v.refrigerated == vehicle.refrigerated]
        used = {r.trip.vehicle_id for r in result.reports if net.vehicles[r.trip.vehicle_id] in fleet}
        other = next((r for r in result.reports if r.trip.vehicle_id == vehicle_id and r is not report), None)
        out[order.order_ref] = {
            "fits": True,
            "day": day.isoformat(),
            "vehicle_id": vehicle_id,
            "vehicle_kind": kind,
            "back_from_workshop": today.get(vehicle_id) is VehicleStatus.WORKSHOP,
            "trip_no": report.trip.trip_no,
            "district": report.district,
            "usual": report.usual,
            # the time unloading starts: an early vehicle waits for the store to open
            "planned": ampm(stop.start),
            "arrives": ampm(stop.arrive) if stop.start - stop.arrive >= 1 else None,
            "depart": ampm(report.depart),
            "back": ampm(report.back),
            "stops": len(report.planned),
            "inside_windows": all(r.passed for r in report.rules if r.rule == 8),
            "weight_kg": report.weight_kg,
            "weight_cap": vehicle.weight_cap_kg,
            "volume_m3": report.volume_m3,
            "volume_cap": vehicle.volume_cap_m3,
            "trip_minutes": report.standard_minutes,
            "fresh_minutes": result.vehicles[vehicle_id].fresh_minutes,
            "fresh_budget": FRESH_BUDGET_MIN,
            "other_trip": {"trip_no": other.trip.trip_no, "district": other.district} if other else None,
            "orders_with_it": [s.order_id for s in report.planned if s.order_id != order.order_ref],
            "with": [
                {
                    "order_ref": s.order_id,
                    "outlet_id": s.outlet_id,
                    "short_name": names.get(s.outlet_id, s.outlet_id),
                    "waiting": s.order_id in waiting,
                }
                for s in report.planned
                if s.order_id != order.order_ref
            ],
            "needed": len(used),
            "fleet": len([v for v in fleet if status.get(v.vehicle_id) is not VehicleStatus.WORKSHOP]),
            "standby": sorted(
                v.vehicle_id
                for v in fleet
                if status.get(v.vehicle_id) is VehicleStatus.STANDBY and v.vehicle_id not in used
            ),
        }
    return out


# ------------------------------------------------------------------------------------------------ checking
def publish_check(db: Session, plan: Plan) -> dict[str, Any]:
    orders = run_orders(db, plan.depot, plan.run_date)
    ctx = context(db, plan, orders)
    reports, _ = evaluate(ctx, stored_trips(db, plan))
    broken = [(r, b) for r in reports for b in r.broken]
    waits = db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)).all()
    unreasoned = [d for d in waits if not d.confirmed_at]
    fresh_stops = [(r, s) for r in reports if r.brand is Brand.FRESH for s in r.expected]
    names = {
        o.outlet_id: o.short_name
        for o in db.scalars(select(Outlet).where(Outlet.outlet_id.in_({o.outlet_id for o in orders})))
    }
    late = []
    for r in reports:
        if r.brand is not Brand.FRESH:
            continue  # the morning windows are the ones at risk; daytime deliveries have hours of slack
        explained = False
        for p, e in zip(r.planned, r.expected, strict=True):
            close = ctx.network.outlets[e.outlet_id].receiving_window[1]
            if e.arrive > close:
                late.append(
                    {
                        "vehicle_id": r.trip.vehicle_id,
                        "trip_no": r.trip.trip_no,
                        "order_ref": e.order_id,
                        "outlet_id": e.outlet_id,
                        "short_name": names.get(e.outlet_id, ""),
                        "closes": ampm(close),
                        "planned": ampm(p.arrive),
                        "expected": ampm(e.arrive),
                        "why": _why_kept(ctx, r, e.order_id, reports, names, same_trip=explained),
                    }
                )
                explained = True
    return {
        "fresh_stops": len(fresh_stops),
        "planned_late": sum(1 for r, b in broken if b.rule == 8),
        "broken": [
            {"vehicle_id": r.trip.vehicle_id, "trip_no": r.trip.trip_no, "message": b.message} for r, b in broken
        ],
        "waiting_without_reason": [order_ref_of(db, d.order_id) for d in unreasoned],
        "expected_late": late,
        "can_publish": not broken and not unreasoned,
    }


def _why_kept(
    ctx: Context,
    report: TripReport,
    order_ref: str,
    reports: Sequence[TripReport],
    names: dict[str, str],
    *,
    same_trip: bool,
) -> str:
    """Why Relay keeps a stop it expects after the window where it is: what holds the trip back, whether another
    stop order would bring the store in, and what every other vehicle that could carry it would cost instead."""
    parts = ["Same trip."] if same_trip else [_holds_back(report, reports)]
    parts.append(_stop_order(ctx, report, order_ref, reports, names))
    parts += _other_vehicles(ctx, report, order_ref, reports, names)
    return " ".join(p for p in parts if p)


def _holds_back(report: TripReport, reports: Sequence[TripReport]) -> str:
    vehicle_id = report.trip.vehicle_id
    if report.trip.trip_no == 2:
        first = next((r for r in reports if r.trip.vehicle_id == vehicle_id and r.trip.trip_no == 1), None)
        if first is not None:
            return (
                f"{vehicle_id} runs {first.district} first and is back at {ampm(first.back)}; its "
                f"{'second ' if first.district == report.district else ''}{report.district} trip leaves "
                f"{round(report.depart - first.back)} min later."
            )
    return f"{vehicle_id} leaves for {report.district} at {ampm(report.depart)}."


def _expected_start(report: TripReport, reports: Sequence[TripReport]) -> float:
    """When the trip leaves on Relay's expected clock: a second trip waits for the first to be back."""
    if report.trip.trip_no == 1:
        return float(report.depart)
    first = next(r for r in reports if r.trip.vehicle_id == report.trip.vehicle_id and r.trip.trip_no == 1)
    return max(float(report.depart), float(first.expected_back + RELOAD_MINUTES))


def _stop_order(
    ctx: Context, report: TripReport, order_ref: str, reports: Sequence[TripReport], names: dict[str, str]
) -> str:
    """Would any other stop order, keeping every window at the published standard, bring this store in?"""
    net = ctx.network
    stops = [(s.order_id, s.outlet_id) for s in report.planned]
    if len(stops) < 2 or len(stops) > 7:
        return ""

    def closes(row: StopTiming) -> float:
        return float(net.outlets[row.outlet_id].receiving_window[1])

    start = _expected_start(report, reports)
    later = next(
        (r for r in reports if r.trip.vehicle_id == report.trip.vehicle_id and r.trip.trip_no > report.trip.trip_no),
        None,
    )
    fixes: list[list[StopTiming]] = []
    for order in itertools.permutations(stops):
        ids, outlets = [o for o, _ in order], [o for _, o in order]
        if ids == [s.order_id for s in report.planned]:
            continue
        planned, back = free_flow(net, outlets, report.depart, report.brand, ids)
        if any(p.arrive > closes(p) for p in planned):
            continue
        if later is not None and back + RELOAD_MINUTES > later.depart:
            continue  # the vehicle's next trip could not leave on time
        rows, _ = expected(net, ctx.conditions, outlets, start, report.brand, ids)
        late = [r for r in rows if r.arrive > closes(r)]
        if all(r.order_id != order_ref for r in late):
            fixes.append(late)
    outlet_id = ctx.orders[order_ref].outlet_id
    name = names.get(outlet_id, outlet_id)
    close = ampm(net.outlets[outlet_id].receiving_window[1])
    if not fixes:
        return f"{name} would miss its {close} close in any stop order that keeps every window."
    fewest = min(fixes, key=len)
    if not fewest:
        return ""
    return f"Serving {name} earlier would make {and_list(names.get(r.outlet_id, r.outlet_id) for r in fewest)} late."


def _other_vehicles(
    ctx: Context, report: TripReport, order_ref: str, reports: Sequence[TripReport], names: dict[str, str]
) -> list[str]:
    """Each other vehicle that could carry the order, tried for real: on its trip to the same district, or on a trip
    of its own. Says what the nearest one that works would cost, and groups the ones that can't."""
    net = ctx.network
    order = ctx.orders[order_ref]
    outlet = net.outlets[order.outlet_id]
    close = outlet.receiving_window[1]
    mine = net.vehicles[report.trip.vehicle_id]
    name = names.get(outlet.outlet_id, outlet.outlet_id)
    own: dict[str, list[EngineTrip]] = {}
    for r in reports:
        own.setdefault(r.trip.vehicle_id, []).append(r.trip)

    def expected_late(rows: Iterable[TripReport]) -> set[str]:
        return {
            s.outlet_id
            for r in rows
            for s in r.expected
            if s.order_id != order_ref and s.arrive > net.outlets[s.outlet_id].receiving_window[1]
        }

    standby: list[str] = []
    idle: list[tuple[str, TripReport, StopTiming]] = []
    busy: list[tuple[str, TripReport, StopTiming, list[str]]] = []
    late: list[str] = []
    no_time: list[str] = []
    full: list[str] = []
    for v in sorted(net.vehicles.values(), key=lambda v: v.vehicle_id):
        if v.depot != mine.depot or v.refrigerated != mine.refrigerated or v.vehicle_id == mine.vehicle_id:
            continue
        if outlet.van_only and v.type is not VehicleType.VAN:
            continue
        if order.weight_kg > v.weight_cap_kg or order.volume_m3 > v.volume_cap_m3:
            continue
        day = ctx.vehicles.get(v.vehicle_id)
        if day is None or day.status is VehicleStatus.WORKSHOP:
            continue
        if day.status is VehicleStatus.STANDBY:
            standby.append(v.vehicle_id)
            continue
        trips = [EngineTrip(t.vehicle_id, t.trip_no, list(t.order_ids), t.depart) for t in own.get(v.vehicle_id, [])]
        before = expected_late(r for r in reports if r.trip.vehicle_id == v.vehicle_id)
        tries: list[list[EngineTrip]] = []
        same = next(
            (
                t
                for t in trips
                if net.outlets[ctx.orders[t.order_ids[0]].outlet_id].district == outlet.district
                and ctx.orders[t.order_ids[0]].brand is order.brand
            ),
            None,
        )
        if same is not None:
            joined = EngineTrip(same.vehicle_id, same.trip_no, [*same.order_ids, order_ref])
            tries.append([joined if t is same else t for t in trips])
        if len(trips) < 2:
            tries.append([*trips, EngineTrip(v.vehicle_id, len(trips) + 1, [order_ref])])
        best: tuple[TripReport, StopTiming, list[str]] | None = None
        rules: set[int] = set()
        for candidate in tries:
            tried, _ = evaluate(ctx, candidate)
            carrying = next(r for r in tried if order_ref in r.trip.order_ids)
            row = next(s for s in carrying.expected if s.order_id == order_ref)
            broken = {b.rule for r in tried for b in r.broken}
            if broken or row.arrive > close:
                rules |= broken or {8}
                continue
            newly = sorted(expected_late(tried) - before)
            if best is None or (len(newly), row.arrive) < (len(best[2]), best[1].arrive):
                best = (carrying, row, newly)
        if best is not None:
            if trips:
                busy.append((v.vehicle_id, *best))
            else:
                idle.append((v.vehicle_id, best[0], best[1]))
        elif rules & {8, 10}:
            late.append(v.vehicle_id)
        elif 7 in rules:
            no_time.append(v.vehicle_id)
        elif rules & {1, 2}:
            full.append(v.vehicle_id)
    lines: list[str] = []
    if busy:
        vehicle_id, carrying, row, newly = min(busy, key=lambda b: (len(b[3]), b[2].arrive))
        offer = f"{vehicle_id} could take it on trip {carrying.trip.trip_no}, expected {ampm(row.arrive)}"
        if newly:
            lines.append(f"{offer}, but {and_list(names.get(o, o) for o in newly)} would then be late.")
        elif not carrying.usual:
            lines.append(f"{offer}, but that takes {vehicle_id} off its usual run (rule 1).")
        else:
            lines.append(f"{offer}, with every other store on it still on time: drag it there to use that.")
    if idle:
        vehicle_id, carrying, row = min(idle, key=lambda b: b[2].arrive)
        kind = "van" if net.vehicles[vehicle_id].is_van else "truck"
        hours = max(1, round((carrying.back - carrying.depart) / 60))
        lines.append(
            f"{vehicle_id} has no trip and could take {name} alone (expected about {ampm(row.arrive)}), but that is a "
            f"second {kind} and driver for about {hours} hour{'s' if hours != 1 else ''} and about "
            f"{carrying.litres:.0f} L of fuel for one store."
        )
    if standby:
        lines.append(f"{and_list(standby)} {'stays' if len(standby) == 1 else 'stay'} free as the standby.")
    if late:
        verb = "is" if len(late) == 1 else "are"
        lines.append(f"{and_list(late)} {verb} back too late to reach it by {ampm(close)}.")
    if no_time:
        verb = "has" if len(no_time) == 1 else "have"
        lines.append(f"{and_list(no_time)} {verb} no Fresh time left for it.")
    if full:
        lines.append(f"{and_list(full)} {'is' if len(full) == 1 else 'are'} full.")
    return lines


# ------------------------------------------------------------------------------------------------ publishing
def publish(db: Session, now: datetime, plan: Plan, user: AppUser | None) -> None:
    check = publish_check(db, plan)
    if not check["can_publish"]:
        if check["broken"]:
            n = len(check["broken"])
            raise PlanError(
                f"{n} {'rule is' if n == 1 else 'rules are'} broken. Fix {'it' if n == 1 else 'them'} to publish."
            )
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
            expected = words.round5(stop.expected_arrival or stop.planned_arrival)
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
    plan.summary = {**plan.summary, "undo": []}  # the board's moves are settled once the plan is out
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


def _clock(moment: datetime) -> str:
    local = moment.astimezone(COLOMBO)
    return ampm(local.hour * 60 + local.minute)


def _window(outlet: Outlet | None) -> str:
    return words.window(outlet.window_open, outlet.window_close) if outlet else ""
