"""The deferrals drawer (DSP-03): what no plan could avoid, what Relay chose and by which rule, the pool of
orders that could have waited, what the choice costs, the protected store, the next-run check, and the exact
words the waiting store will read."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import CaseType, Deferral, Order, Outlet, Plan, ServiceHistory
from relay_api.services.planning import (
    DEPOT_LABEL,
    REASONS,
    context,
    next_run_check,
    protected_refs,
    run_orders,
    store_notice,
    stored_trips,
)
from relay_engine.rules import ampm, evaluate


def _kg(value: float) -> str:
    return f"{value:,.1f} kg"


def drawer(db: Session, now: datetime, plan: Plan) -> dict[str, Any]:
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

    def short(ref: str) -> str:
        o = by_ref[ref]
        return f"{o.outlet_id} {outlets[o.outlet_id].short_name}"

    groups = []
    for a in plan.summary.get("analyses", []):
        chilled = [o for o in all_orders if (o.temp == "chilled") == (a["temp_class"] == "chilled")]
        waits = [by_id[d.order_id] for d in deferrals if by_id[d.order_id] in chilled]
        planned = [o for o in chilled if o.order_ref in where]
        pool_by_district: dict[str, list[str]] = {}
        for ref in a.get("pool", []):
            o = by_ref.get(ref)
            if o:
                pool_by_district.setdefault(outlets[o.outlet_id].district, []).append(o.outlet_id)
        keeping = [by_ref[r].outlet_id for r in a.get("pool_keeping_usual_runs", []) if r in by_ref]
        prot = [r for r in a.get("protected", []) if r in by_ref]
        chosen = waits[0] if waits else None
        rule = next((d.explanation.get("rule") for d in deferrals if chosen and d.order_id == chosen.id), None)
        limiting = a.get("limiting", [])
        running = len(
            [
                v
                for v, day in ctx.vehicles.items()
                if ctx.network.vehicles[v].depot == plan.depot
                and ctx.network.vehicles[v].refrigerated == (a["temp_class"] == "chilled")
                and day.status.value == "available"
            ]
        )
        rules = [
            {
                "n": 1,
                "title": "Keep every other vehicle on its usual run.",
                "reason": (
                    f"{' and '.join(limiting)} {'are' if len(limiting) > 1 else 'is'} in the workshop. "
                    if limiting
                    else ""
                )
                + (
                    f"Only {' and '.join(keeping)} could wait without taking another vehicle off its usual run."
                    if keeping
                    else "Every order that could wait moves a vehicle off its usual run."
                ),
            },
            {
                "n": 2,
                "title": "Never make a store wait twice in a row without an override.",
                "reason": (
                    " ".join(
                        f"{short(r)} had its {_waited_on(history, by_ref[r])} "
                        f"{'chilled' if by_ref[r].temp == 'chilled' else 'dry'} order wait, so it rides."
                        for r in prot
                    )
                    if prot
                    else "No store in the pool waited on its last run."
                ),
            },
            {
                "n": 3,
                "title": "Keep the most goods moving.",
                "reason": (
                    f"Of the orders left, letting {short(chosen.order_ref)} wait keeps the most goods moving."
                    if chosen and rule == 3
                    else "The first two rules already decide it."
                ),
            },
        ]
        result = ""
        if chosen:
            sibling = next(
                (
                    o
                    for o in all_orders
                    if o.outlet_id == chosen.outlet_id and o.id != chosen.id and o.order_ref in where
                ),
                None,
            )
            result = f"So {outlets[chosen.outlet_id].short_name}'s order waits"
            if sibling is not None:
                r, _, _ = where[sibling.order_ref]
                result += (
                    f", and its {'dry' if sibling.temp == 'ambient' else 'chilled'} order still comes on "
                    f"{plan.run_date:%A} on {r.trip.vehicle_id}"
                )
            result += "."
        groups.append(
            {
                "temp_class": a["temp_class"],
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
                "pool": {"count": len(a.get("pool", [])), "by_district": pool_by_district, "keeping": keeping},
                "rules": rules,
                "picked_by_rule": rule,
                "result": result,
            }
        )

    waiting = []
    for d in deferrals:
        order = by_id[d.order_id]
        outlet = outlets[order.outlet_id]
        if "next_run" not in d.explanation and d.kind.value == "capacity":
            d.explanation = {**d.explanation, "next_run": next_run_check(db, plan, d)}
            db.flush()
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
                "confirmed_at": d.confirmed_at.astimezone(COLOMBO).isoformat() if d.confirmed_at else None,
                "next_run": d.explanation.get("next_run"),
                "costs": _costs(d, order, outlets, by_ref, where, history, plan, ctx),
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


def _waited_on(history: dict[tuple[str, str], ServiceHistory], order: Order) -> str:
    h = history.get((order.outlet_id, order.temp))
    return f"{h.deferred_on:%A}" if h and h.deferred_on else "last"


def _costs(d, order, outlets, by_ref, where, history, plan, ctx) -> list[str]:  # type: ignore[no-untyped-def]
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


__all__ = ["drawer"]
