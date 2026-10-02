"""The deferrals drawer (DSP-03): what no plan could avoid, what Relay chose and by which rule, the pool of
orders that could have waited, what the choice costs, the protected store, the next-run check, and the exact
words the waiting store will read."""

from __future__ import annotations

import itertools
import uuid
from collections.abc import Callable, Sequence
from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import AppUser, CaseType, Deferral, Order, Outlet, Plan, PlanStatus, ServiceHistory
from relay_api.services.engine_cache import propose_cached
from relay_api.services.planning import (
    DEPOT_LABEL,
    REASONS,
    PlanError,
    and_list,
    check_next_run,
    context,
    protected_refs,
    run_orders,
    store_notice,
    stored_trips,
)
from relay_engine.clock import sequence_stops
from relay_engine.model import EARLIEST_DEPARTURE, RELOAD_MINUTES, StopTiming, TripReport, VehicleStatus
from relay_engine.model import Trip as EngineTrip
from relay_engine.network import Temp
from relay_engine.options import Option
from relay_engine.propose import RunInput
from relay_engine.rules import Context, ampm, evaluate
from relay_engine.solver import Problem
from relay_engine.standard import budget_for, trip_minutes

WORDS = ("no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten")

Where = dict[str, tuple[TripReport, StopTiming, StopTiming]]
"""Each order on the board: its trip, and its stop as planned and as Relay expects it."""
History = dict[tuple[str, str], ServiceHistory]
"""Each store's last delivery and last wait, by outlet and temperature."""


def _kg(value: float) -> str:
    return f"{value:,.1f} kg"


def _count(n: int) -> str:
    return WORDS[n] if 0 <= n < len(WORDS) else str(n)


def drawer(db: Session, now: datetime, plan: Plan) -> dict[str, Any]:
    check_next_run(db, plan)
    orders = run_orders(db, plan.depot, plan.run_date)
    deferrals = list(db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)))
    by_id = {o.id: o for o in orders}
    for d in deferrals:
        if d.order_id not in by_id:
            moved = db.get(Order, d.order_id)
            if moved is not None:
                by_id[moved.id] = moved
    all_orders = list(by_id.values())
    by_ref = {o.order_ref: o for o in all_orders}
    outlets = {o.outlet_id: o for o in db.scalars(select(Outlet))}
    names = {c.code: c.name for c in db.scalars(select(CaseType))}
    ctx = context(db, plan, orders)
    reports, _ = evaluate(ctx, stored_trips(db, plan))
    where = {s.order_id: (r, s, e) for r in reports for s, e in zip(r.planned, r.expected, strict=True)}
    history = {(h.outlet_id, h.temp): h for h in db.scalars(select(ServiceHistory))}
    protected = protected_refs(db, plan.run_date, orders)
    overridden = set(plan.summary.get("overridden", []))
    deferral_of = {by_id[d.order_id].order_ref: d for d in deferrals}
    people = {u.id: u.display_name for u in db.scalars(select(AppUser))}

    def short(ref: str) -> str:
        o = by_ref[ref]
        return f"{o.outlet_id} {outlets[o.outlet_id].short_name}"

    # What no plan could avoid is counted on the run with every order in it: after an override the engine plans
    # without the overridden order, so its own count would leave that order out.
    found = {a["temp_class"]: a for a in plan.summary.get("analyses", [])}
    before = {a["temp_class"]: a for a in plan.summary.get("analyses_before_override") or []}
    groups = []
    for temp_class in sorted(found.keys() | before.keys()):
        a = before.get(temp_class) or found[temp_class]
        chilled = [o for o in all_orders if (o.temp == "chilled") == (temp_class == "chilled")]
        waits = [by_id[d.order_id] for d in deferrals if by_id[d.order_id] in chilled]
        forced = sorted((o for o in waits if o.order_ref in overridden), key=lambda o: o.outlet_id)
        chosen = sorted((o for o in waits if o.order_ref not in overridden), key=lambda o: o.outlet_id)
        planned = [o for o in chilled if o.order_ref in where]
        pool_by_district: dict[str, list[str]] = {}
        for ref in a.get("pool", []):
            o = by_ref.get(ref)
            if o:
                pool_by_district.setdefault(outlets[o.outlet_id].district, []).append(o.outlet_id)
        keeping = [by_ref[r].outlet_id for r in a.get("pool_keeping_usual_runs", []) if r in by_ref]
        prot = [r for r in a.get("protected", []) if r in by_ref]
        limiting = a.get("limiting", [])
        running = len(
            [
                v
                for v, day in ctx.vehicles.items()
                if ctx.network.vehicles[v].depot == plan.depot
                and ctx.network.vehicles[v].refrigerated == (temp_class == "chilled")
                and day.status is VehicleStatus.AVAILABLE
            ]
        )
        # an order taken off the board by hand waits because of that move, not by any of the three rules
        rules_by_order = {
            o.order_ref: "hand"
            if deferral_of[o.order_ref].explanation.get("manual")
            else deferral_of[o.order_ref].explanation.get("rule")
            for o in chosen
        }
        rule = next((r for r in rules_by_order.values() if isinstance(r, int)), None)
        weighed = [
            f"{short(o.order_ref)}, {_kg(o.weight_kg)}: {_weighed(ctx, reports, o.order_ref, prot, by_ref, outlets)}"
            if len(chosen) > 1
            else _weighed(ctx, reports, o.order_ref, prot, by_ref, outlets)
            for o in chosen
        ]
        rules = [
            {
                "n": 1,
                "title": "Keep every other vehicle on its usual run.",
                "reason": (
                    f"{and_list(limiting)} {'are' if len(limiting) > 1 else 'is'} in the workshop. " if limiting else ""
                )
                + (
                    f"Only {and_list(keeping)} could wait without taking another vehicle off its usual run."
                    if keeping
                    else "Every order that could wait moves a vehicle off its usual run."
                ),
                "lines": [],
            },
            {
                "n": 2,
                "title": "Never make a store wait twice in a row without an override.",
                "reason": " ".join(_rule_two(r, by_ref, history, deferral_of, overridden, short, people) for r in prot)
                if prot
                else "No store in the pool waited on its last run.",
                "lines": [],
            },
            {
                "n": 3,
                "title": "Keep the most goods moving.",
                "reason": (
                    "For each order that waits, the trip that would carry it and what it weighs:"
                    if len(weighed) > 1
                    else weighed[0]
                    if weighed
                    else "The first two rules already decide it."
                ),
                "lines": weighed if len(weighed) > 1 else [],
            },
        ]
        groups.append(
            {
                "temp_class": temp_class,
                "orders": len(chilled),
                "max_served": a["max_served"],
                "unavoidable": a["unavoidable"],
                "running": running,
                "limiting": limiting,
                "total_kg": round(sum(o.weight_kg for o in chilled), 1),
                "total_m3": round(sum(o.volume_m3 for o in chilled), 3),
                "planned": len(planned),
                "planned_kg": round(sum(o.weight_kg for o in planned), 1),
                "planned_m3": round(sum(o.volume_m3 for o in planned), 3),
                "waits": len(waits),
                "waits_kg": round(sum(o.weight_kg for o in waits), 1),
                "waits_m3": round(sum(o.volume_m3 for o in waits), 3),
                "by_override": len(forced),
                "pool": {
                    "count": len(a.get("pool", [])),
                    "by_district": pool_by_district,
                    "keeping": keeping,
                    "summary": _pool_summary(keeping, running, chosen, rules_by_order, a),
                },
                "rules": rules,
                "paper": _paper(db, plan, ctx, reports, temp_class) if a["unavoidable"] else None,
                "picked_by_rule": rule,
                "result": _result(chosen, forced, all_orders, where, outlets, plan),
            }
        )

    waiting = []
    for d in sorted(deferrals, key=lambda d: (by_id[d.order_id].outlet_id, by_id[d.order_id].order_ref)):
        order = by_id[d.order_id]
        outlet = outlets[order.outlet_id]
        h = history.get((order.outlet_id, order.temp))
        sibling = next(
            (o for o in all_orders if o.outlet_id == order.outlet_id and o.id != order.id and o.order_ref in where),
            None,
        )
        suggested = d.explanation.get("suggested_reason") or "other"
        preview = d.store_notice or store_notice(db, plan, order, d, d.explanation.get("reason_code") or suggested)
        waiting.append(
            {
                "order_ref": order.order_ref,
                "outlet_id": order.outlet_id,
                "short_name": outlet.short_name,
                "name": outlet.name,
                "temp": order.temp,
                "brand": order.brand,
                "units": order.units,
                "weight_kg": order.weight_kg,
                "volume_m3": order.volume_m3,
                "window_open": outlet.window_open,
                "window_close": outlet.window_close,
                "kind": d.kind.value,
                "rule": d.explanation.get("rule"),
                "unavoidable": bool(d.explanation.get("unavoidable")),
                "overridden": order.order_ref in overridden,
                "last_delivered": h.last_delivered.isoformat() if h and h.last_delivered else None,
                "sibling": {
                    "order_ref": sibling.order_ref,
                    "temp": sibling.temp,
                    "vehicle_id": where[sibling.order_ref][0].trip.vehicle_id,
                    "expected": ampm(where[sibling.order_ref][2].arrive),
                }
                if sibling
                else None,
                "moves_to": d.to_date.isoformat(),
                "reasons": [{"code": k, "label": v, "suggested": k == suggested} for k, v in REASONS.items()],
                "reason_code": d.explanation.get("reason_code"),
                "reason": d.reason,
                "note": d.explanation.get("note", ""),
                "confirmed_at": _local(d.confirmed_at),
                "notified_at": _local(d.notified_at),
                "acknowledged_at": _local(d.acknowledged_at),
                "next_run": d.explanation.get("next_run"),
                "costs": _costs(d, order, outlets, by_ref, where, history, ctx, overridden),
                "store_notice": preview,
                "lines": [{"name": names.get(line.case_type, line.case_type), "qty": line.qty} for line in order.lines],
                "placed_at": order.placed_at.astimezone(COLOMBO).isoformat(),
            }
        )

    protected_cards = []
    for ref in sorted(protected):
        o = by_ref.get(ref)
        if o is None or ref not in where:
            continue
        r, s, e = where[ref]
        close = ctx.network.outlets[o.outlet_id].receiving_window[1]
        protected_cards.append(
            {
                "order_ref": ref,
                "outlet_id": o.outlet_id,
                "short_name": outlets[o.outlet_id].short_name,
                "temp": o.temp,
                "units": o.units,
                "weight_kg": o.weight_kg,
                "volume_m3": o.volume_m3,
                "waited_on": _waited_on(history, o),
                "vehicle_id": r.trip.vehicle_id,
                "trip_no": r.trip.trip_no,
                "planned": ampm(s.arrive),
                "expected": ampm(e.arrive),
                "late_by": max(0, round(e.arrive - close)),
                "closes": ampm(close),
            }
        )

    return {
        "depot": plan.depot,
        "depot_label": DEPOT_LABEL[plan.depot],
        "run_date": plan.run_date.isoformat(),
        "proposed_at": plan.proposed_at.astimezone(COLOMBO).isoformat() if plan.proposed_at else None,
        "status": plan.status.value,
        "groups": groups,
        "waiting": waiting,
        "protected": protected_cards,
    }


def _local(moment: datetime | None) -> str | None:
    return moment.astimezone(COLOMBO).isoformat() if moment else None


def _waited_on(history: History, order: Order) -> str:
    h = history.get((order.outlet_id, order.temp))
    return f"{h.deferred_on:%A}" if h and h.deferred_on else "last"


def _rule_two(
    ref: str,
    by_ref: dict[str, Order],
    history: History,
    deferral_of: dict[str, Deferral],
    overridden: set[str],
    short: Callable[[str], str],
    people: dict[uuid.UUID, str],
) -> str:
    o = by_ref[ref]
    temp = "chilled" if o.temp == "chilled" else "dry"
    waited = _waited_on(history, o)
    if ref not in overridden:
        return f"{short(ref)} had its {waited} {temp} order wait, so it rides."
    d = deferral_of.get(ref)
    by = d.confirmed_by if d is not None else None
    who = people.get(by, "The dispatcher") if by is not None else "The dispatcher"
    when = f" at {ampm(_minutes(d.confirmed_at))}" if d is not None and d.confirmed_at else ""
    return f"{short(ref)} had its {waited} {temp} order wait. {who} deferred this one too, by override{when}."


def _minutes(moment: datetime) -> float:
    local = moment.astimezone(COLOMBO)
    return local.hour * 60 + local.minute


def _weighed(
    ctx: Context,
    reports: Sequence[TripReport],
    ref: str,
    protected: Sequence[str],
    by_ref: dict[str, Order],
    outlets: dict[str, Outlet],
) -> str:
    """Rule 3 for one waiting order, from the weights Relay compared: the trip that reaches its district, what
    already rides it, and what the order would make of it."""
    net = ctx.network
    order = ctx.orders.get(ref)
    if order is None:
        return "It is not on this run any more."
    district = net.outlets[order.outlet_id].district
    same = [
        r
        for r in reports
        if r.district == district and r.temp is order.temp and r.brand is order.brand and r.trip.order_ids
    ]
    if not same:
        usual = sorted(
            v
            for v, trips in ctx.usual.items()
            if any(u.district == district and u.temp is order.temp for u in trips)
            and ctx.vehicles.get(v) is not None
            and ctx.vehicles[v].status is VehicleStatus.WORKSHOP
        )
        kind = "refrigerated" if order.temp is Temp.CHILLED else "ambient"
        return f"No {kind} trip in this plan goes to {district}" + (
            f": its usual run is {and_list(usual)}'s, in the workshop." if usual else "."
        )

    def names(refs: Sequence[str]) -> str:
        return and_list(f"{by_ref[r].outlet_id} {outlets[by_ref[r].outlet_id].short_name}" for r in refs)

    def ids(refs: Sequence[str]) -> str:
        return and_list(by_ref[r].outlet_id for r in refs)

    # the trip that carries a protected store first: that is where the rules met
    trip = next((r for r in same if set(r.trip.order_ids) & set(protected)), max(same, key=lambda r: r.weight_kg))
    riders = list(trip.trip.order_ids)
    vehicle = net.vehicles[trip.trip.vehicle_id]
    kind = "van" if vehicle.is_van else "truck"
    cap = f"{vehicle.weight_cap_kg:,.0f} kg"
    keep = [r for r in riders if r in protected]
    rest = [r for r in riders if r not in keep]
    alt = [ref, *keep]
    alt_kg = sum(ctx.orders[r].weight_kg for r in alt)
    if keep and rest:
        lead = (
            f"With {ids(keep)} on {trip.trip.vehicle_id}, {names(rest)} "
            f"{'fits' if len(rest) == 1 else 'fit'} beside {'it' if len(keep) == 1 else 'them'} "
            f"({_kg(trip.weight_kg)} together)."
        )
    else:
        lead = f"{trip.trip.vehicle_id} trip {trip.trip.trip_no} carries {names(riders)} ({_kg(trip.weight_kg)})."
    if not keep:
        alt = [ref, *riders]
        alt_kg = trip.weight_kg + order.weight_kg
    together = f"{ids(alt)} together would be {_kg(alt_kg)}"
    if alt_kg > vehicle.weight_cap_kg + 1e-6:
        return f"{lead} {together}, over the {kind}'s {cap}."
    # light enough: try it on the clock, with the vehicle's other trip as it is
    others = [r.trip for r in reports if r.trip.vehicle_id == trip.trip.vehicle_id and r is not trip]
    tried, _ = evaluate(ctx, [*others, EngineTrip(trip.trip.vehicle_id, trip.trip.trip_no, alt)])
    broken = [b for r in tried for b in r.broken]
    if broken:
        return f"{lead} {together}, within the {kind}'s {cap}, but it breaks a rule: {broken[0].message}."
    moved = alt_kg - trip.weight_kg
    if moved < 0:
        return f"{lead} {together}: {_kg(-moved)} less on the road."
    return f"{lead} {together}."


def _pool_summary(
    keeping: list[str],
    running: int,
    chosen: list[Order],
    rules_by_order: dict[str, int | str | None],
    analysis: dict[str, Any],
) -> str:
    parts = []
    if keeping:
        verb = "keeps" if len(keeping) == 1 else "keep"
        parts.append(f"Only {and_list(keeping)} {verb} all {_count(running)} vehicles on their usual runs.")
    by_rule: dict[int | str | None, list[str]] = {}
    for o in chosen:
        by_rule.setdefault(rules_by_order.get(o.order_ref), []).append(o.outlet_id)
    for rule, ids in sorted(by_rule.items(), key=lambda kv: str(kv[0])):
        if rule == "hand":
            moved = "waits because it was" if len(ids) == 1 else "wait because they were"
            parts.append(f"{and_list(ids)} {moved} moved off the board by hand.")
        elif rule:
            parts.append(f"Rule {rule} picks {and_list(ids)}.")
        else:
            parts.append(f"Every plan that carries {analysis['max_served']} leaves {and_list(ids)} waiting.")
    return " ".join(parts)


def _result(
    chosen: list[Order],
    forced: list[Order],
    all_orders: list[Order],
    where: Where,
    outlets: dict[str, Outlet],
    plan: Plan,
) -> str:
    waits = [*chosen, *forced]
    if not waits:
        return ""
    stores = and_list(f"{outlets[o.outlet_id].short_name}'s" for o in waits)
    line = f"So {stores} {'order waits' if len(waits) == 1 else 'orders wait'}"
    if forced and not chosen:
        line += ", by override"
    elif forced:
        line += f", {and_list(o.outlet_id for o in forced)} by override"
    siblings = {
        o.order_ref: s
        for o in waits
        for s in all_orders
        if s.outlet_id == o.outlet_id and s.id != o.id and s.order_ref in where
    }
    if len(waits) == 1:
        sibling = siblings.get(waits[0].order_ref)
        if sibling is None:
            return f"{line}."
        r, _, _ = where[sibling.order_ref]
        kind = "dry" if sibling.temp == "ambient" else "chilled"
        return f"{line}, and its {kind} order still comes on {plan.run_date:%A} on {r.trip.vehicle_id}."
    if not siblings:
        return f"{line}."
    kinds = {"dry" if s.temp == "ambient" else "chilled" for s in siblings.values()}
    kind = kinds.pop() if len(kinds) == 1 else "other"
    if len(siblings) == len(waits):
        return f"{line}. Each store's {kind} order still comes on {plan.run_date:%A}."
    stores = and_list(outlets[o.outlet_id].short_name for o in waits if o.order_ref in siblings)
    return f"{line}. The {kind} orders from {stores} still come on {plan.run_date:%A}."


def _costs(
    d: Deferral,
    order: Order,
    outlets: dict[str, Outlet],
    by_ref: dict[str, Order],
    where: Where,
    history: History,
    ctx: Context,
    overridden: set[str],
) -> list[str]:
    lines = []
    kind = "chilled" if order.temp == "chilled" else "dry"
    h = history.get((order.outlet_id, order.temp))
    shelf = (
        f" {outlets[order.outlet_id].short_name}'s {kind} shelf goes from its {h.last_delivered:%A} "
        f"{h.last_delivered.day} {h.last_delivered:%B} delivery to {d.to_date:%A} {d.to_date.day} {d.to_date:%B}."
        if h and h.last_delivered
        else ""
    )
    lines.append(f"{_kg(order.weight_kg)} of {kind} goods waits a day.{shelf}")
    if order.order_ref in overridden:
        lines.append(
            f"{order.outlet_id} waited on {_waited_on(history, order)} too, so this makes two in a row. "
            "Your note is kept with the order."
        )
        return lines
    a = d.explanation.get("analysis") or {}
    pool = [by_ref[r] for r in a.get("pool", []) if r in by_ref]
    keeping = set(a.get("pool_keeping_usual_runs", []))
    lighter = [o for o in pool if o.weight_kg < order.weight_kg and o.order_ref not in keeping]
    if lighter:
        lightest = min(lighter, key=lambda o: o.weight_kg)
        lines.append(
            f"Making the lightest order in the pool wait, {lightest.outlet_id} "
            f"{outlets[lightest.outlet_id].short_name} ({_kg(lightest.weight_kg)}), would keep "
            f"{_kg(order.weight_kg - lightest.weight_kg)} more moving, but every such plan moves at least one other "
            "vehicle off its usual run. Rule 1 comes before rule 3, so Relay doesn't do that."
        )
    if d.explanation.get("rule") == 2:
        for ref in a.get("protected", []):
            other = by_ref.get(ref)
            if other is None:
                continue
            diff = order.weight_kg - other.weight_kg
            lines.append(
                f"Without rule 2, {other.outlet_id}'s {_kg(other.weight_kg)} would wait instead"
                + (f": {_kg(abs(diff))} {'less' if diff > 0 else 'more'}" if abs(diff) >= 0.05 else "")
                + ", but its second order in a row."
            )
            if ref in where:
                _r, _s, e = where[ref]
                close = ctx.network.outlets[other.outlet_id].receiving_window[1]
                if e.arrive > close:
                    lines.append(
                        f"The protected order still arrives late: Relay expects {other.outlet_id} at {ampm(e.arrive)}, "
                        f"{round(e.arrive - close)} min after its {ampm(close)} close, but the same morning."
                    )
    return lines


# ------------------------------------------------------------------------------------------------ override
def override_preview(db: Session, plan: Plan, order_ref: str) -> dict[str, Any]:
    """What deferring a protected order anyway would change, before the dispatcher writes the note: the same
    question the override asks the engine, so the answer is kept and the override itself is quick."""
    if plan.status is PlanStatus.PUBLISHED:
        raise PlanError("This plan is published. Change it trip by trip instead.")
    orders = run_orders(db, plan.depot, plan.run_date)
    by_ref = {o.order_ref: o for o in orders}
    if order_ref not in by_ref:
        raise PlanError(f"{order_ref} is not on this run")
    forced = {*plan.summary.get("overridden", []), order_ref}
    ctx = context(db, plan, orders)
    run = RunInput(  # exactly what propose_plan asks for the override
        network=ctx.network,
        depot=plan.depot,
        orders=[ctx.orders[o.order_ref] for o in orders if o.order_ref not in forced],
        vehicles=list(ctx.vehicles.values()),
        usual=ctx.usual,
        conditions=ctx.conditions,
        protected=protected_refs(db, plan.run_date, orders) - forced,
    )
    answer = propose_cached(db, run)
    reports, _ = evaluate(ctx, answer.trips)
    where = {ref: r for r in reports for ref in r.trip.order_ids}
    outlets = {o.outlet_id: o for o in db.scalars(select(Outlet))}
    ids = {o.id: o.order_ref for o in orders}
    waiting_now = {
        ids[d.order_id] for d in db.scalars(select(Deferral).where(Deferral.plan_id == plan.id)) if d.order_id in ids
    }

    def place(ref: str) -> str:
        return outlets[by_ref[ref].outlet_id].short_name

    lines = []
    for ref in sorted(waiting_now - forced):
        r = where.get(ref)
        if r is None:
            lines.append(f"{place(ref)}'s order still waits.")
            continue
        vehicle = ctx.network.vehicles[r.trip.vehicle_id]
        others = [o for o in r.trip.order_ids if o != ref]
        lines.append(
            f"{place(ref)}'s order rides {r.trip.vehicle_id}"
            + (f" with {and_list(place(o) for o in others)}" if others else "")
            + f" instead: {_kg(r.weight_kg)} on the {'van' if vehicle.is_van else 'truck'}."
        )
    newly = sorted(d.order_id for d in answer.deferred if d.order_id not in waiting_now and d.order_id in by_ref)
    for ref in newly:
        lines.append(f"{by_ref[ref].outlet_id} {place(ref)}'s order waits instead.")
    consequence = " ".join(lines) if lines else "nothing else on the plan changes."
    return {"order_ref": order_ref, "consequence": f"If you defer it, {consequence}", "lines": lines}


# ------------------------------------------------------------------------------------------------ on paper
PAPER_LATEST = 4999
"""A departure no window limits: on paper, a trip can leave whenever the vehicle is free."""


def _paper(
    db: Session, plan: Plan, ctx: Context, reports: Sequence[TripReport], temp_class: str
) -> dict[str, Any] | None:
    """The plan the published standard alone would pass: weight, volume, temperature, access, one district a trip,
    two trips and 270 Fresh minutes a vehicle, and nothing about the clock. When it carries every order of the
    group, it shows which trips it changes and where the clock breaks them. Kept with the plan until it changes."""
    kept = plan.summary.get("paper") or {}
    if kept.get("version") == plan.version and temp_class in kept.get("groups", {}):
        cached: dict[str, Any] | None = kept["groups"][temp_class]
        return cached
    found = _paper_plan(
        ctx, plan.depot, reports, temp_class, {o.outlet_id: o.short_name for o in db.scalars(select(Outlet))}
    )
    groups = {**(kept.get("groups", {}) if kept.get("version") == plan.version else {}), temp_class: found}
    plan.summary = {**plan.summary, "paper": {"version": plan.version, "groups": groups}}
    return found


def _paper_plan(
    ctx: Context, depot: str, reports: Sequence[TripReport], temp_class: str, names: dict[str, str]
) -> dict[str, Any] | None:
    net = ctx.network
    chilled = temp_class == "chilled"
    orders = [
        o
        for o in ctx.orders.values()
        if (o.temp is Temp.CHILLED) == chilled and net.outlets[o.outlet_id].depot == depot
    ]
    fleet = [
        day
        for v, day in ctx.vehicles.items()
        if net.vehicles[v].depot == depot
        and net.vehicles[v].refrigerated == chilled
        and day.status is VehicleStatus.AVAILABLE
    ]
    if not orders or not fleet:
        return None
    biggest_kg = max(net.vehicles[d.vehicle_id].weight_cap_kg for d in fleet)
    biggest_m3 = max(net.vehicles[d.vehicle_id].volume_cap_m3 for d in fleet)
    groups: dict[tuple[Any, str], list[Any]] = {}
    for o in orders:
        groups.setdefault((o.brand, net.outlets[o.outlet_id].district), []).append(o)
    options = []
    for (brand, district), members in groups.items():
        if len(members) > 12:
            return None  # too many stores to walk every trip; the engine samples these, and so would this
        for size in range(1, len(members) + 1):
            for combo in itertools.combinations(members, size):
                outlets = [o.outlet_id for o in combo]
                weight = sum(o.weight_kg for o in combo)
                volume = sum(o.volume_m3 for o in combo)
                if len(set(outlets)) != len(outlets) or weight > biggest_kg + 1e-6 or volume > biggest_m3 + 1e-9:
                    continue
                minutes = trip_minutes(net, district, brand, [net.outlets[o].dock_type for o in outlets])
                if minutes > budget_for(brand):
                    continue
                options.append(
                    Option(
                        orders=tuple(sorted(o.order_id for o in combo)),
                        outlets=tuple(outlets),
                        brand=brand,
                        temp=combo[0].temp,
                        district=district,
                        weight_kg=round(weight, 3),
                        volume_m3=round(volume, 4),
                        van_only=any(net.outlets[o].van_only for o in outlets),
                        minutes=minutes,
                        earliest_back=0.0,
                        preferred_depart=EARLIEST_DEPARTURE,
                        preferred_back=0.0,
                        latest_depart=PAPER_LATEST,
                        km=0.0,
                    )
                )
    problem = Problem(net, options, fleet, ctx.usual, scope="open")
    most = problem.solve(maximize="served", time_limit=10)
    if most is None or most.count < len(orders):
        return None
    best = problem.solve(maximize="choice", min_served=most.count, time_limit=10) or most

    planned: dict[str, list[tuple[int, frozenset[str]]]] = {}
    for r in reports:
        if (r.temp is Temp.CHILLED) == chilled and r.trip.order_ids:
            planned.setdefault(r.trip.vehicle_id, []).append((r.trip.trip_no, frozenset(r.trip.order_ids)))
    paper: dict[str, list[Option]] = {}
    for slot in sorted(best.slots, key=lambda s: (s.vehicle_id, s.trip_no)):
        paper.setdefault(slot.vehicle_id, []).append(slot.option)
    changed = sorted(
        v
        for v in paper.keys() | planned.keys()
        if sorted(frozenset(o.orders) for o in paper.get(v, [])) != sorted(s for _, s in planned.get(v, []))
    )
    by_district = {key[1]: len(members) for key, members in groups.items()}
    rows = []
    lines = []
    for v in changed:
        trips = paper.get(v, [])
        if not trips:
            continue
        own = [s for _, s in sorted(planned.get(v, []))]
        takes = []
        for i, option in enumerate(trips):
            if frozenset(option.orders) in own:
                # Relay's own trip, kept; named as a run when it moves to the vehicle's other trip
                moved = own.index(frozenset(option.orders)) != i
                takes.append(f"its {option.district} run" if moved else option.district)
            elif len(option.orders) == by_district[option.district] and len(option.orders) > 1:
                takes.append(f"all {_count(len(option.orders))} {option.district} stores")
            else:
                stores = [names.get(ctx.orders[o].outlet_id, o) for o in option.orders]
                takes.append(and_list(stores) if len(stores) <= 3 else f"{len(stores)} {option.district} stores")
            if i == 0 and len(trips) > 1:
                takes[-1] += ", then"
        spans = [o.minutes for o in trips]
        rows.append(
            {
                "vehicle_id": v,
                "takes": " ".join(takes),
                "minutes": " + ".join(str(m) for m in spans) + (f" = {sum(spans)}" if len(spans) > 1 else ""),
            }
        )

        clocked = _on_the_clock(ctx, v, trips, [r.trip for r in reports if r.trip.vehicle_id == v])
        for report in clocked:
            late = next((s for s in report.planned if s.arrive > net.outlets[s.outlet_id].receiving_window[1]), None)
            if late is None:
                continue
            close = net.outlets[late.outlet_id].receiving_window[1]
            first = next((r for r in clocked if r.trip.trip_no == 1), None)
            lead = (
                f"{v} is back from {first.district} at {ampm(first.back)} and"
                if report.trip.trip_no == 2 and first is not None
                else v
            )
            lines.append(
                f"{lead} would reach {names.get(late.outlet_id, late.outlet_id)} at {ampm(late.arrive)}, "
                f"after its {ampm(close)} close."
            )
            break
    if not rows or not lines:
        return None  # the paper plan works on the clock too, or changes nothing: no story to tell
    return {"orders": len(orders), "rows": rows, "fails": lines}


def _on_the_clock(
    ctx: Context, vehicle_id: str, trips: Sequence[Option], relay: Sequence[EngineTrip]
) -> list[TripReport]:
    """Paper trips timed the way Relay times its own: a trip Relay also runs keeps Relay's stop order and departure;
    any other gets Relay's best stop order from the moment the vehicle is free, or the closing order when no order
    keeps every window."""
    net = ctx.network
    timed: list[EngineTrip] = []
    ready = float(ctx.vehicles[vehicle_id].ready_at)
    for i, option in enumerate(trips):
        same = next((t for t in relay if t.trip_no == i + 1 and set(t.order_ids) == set(option.orders)), None)
        if same is not None:
            trip = EngineTrip(vehicle_id, i + 1, list(same.order_ids), same.depart)
        else:
            by_outlet = {ctx.orders[o].outlet_id: o for o in option.orders}
            found = sequence_stops(net, ctx.conditions, list(by_outlet), option.brand, ready)
            if found is not None:
                trip = EngineTrip(vehicle_id, i + 1, [by_outlet[o] for o in found.outlets], found.depart)
            else:
                order = sorted(by_outlet, key=lambda o: net.outlets[o].receiving_window[::-1])
                trip = EngineTrip(vehicle_id, i + 1, [by_outlet[o] for o in order], round(ready))
        timed.append(trip)
        so_far, _ = evaluate(ctx, timed)
        ready = so_far[-1].back + RELOAD_MINUTES
    reports: list[TripReport] = evaluate(ctx, timed)[0]
    return reports


__all__ = ["drawer", "override_preview"]
