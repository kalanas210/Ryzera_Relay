"""What the plan board shows: every vehicle of the depot as a lane with its trips, meters and rules, the
orders that wait, and the counts in the plan bar. Recomputed from the stored plan on every read."""

from __future__ import annotations

from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import (
    AppUser,
    Deferral,
    Handover,
    Order,
    Outlet,
    Plan,
    PlanStatus,
    Role,
    Trip,
    TripStatus,
    Vehicle,
    VehicleDay,
)
from relay_api.schemas.plan import (
    BoardOut,
    DeferralOut,
    FitOut,
    LaneOut,
    PlanOut,
    RuleOut,
    StopOut,
    TripOut,
    WaitingOut,
)
from relay_api.services import network as adapters
from relay_api.services.ordering import cutoff_for
from relay_api.services.planning import DEPOT_LABEL, context, run_orders, stored_trips
from relay_engine.model import Trip as EngineTrip
from relay_engine.model import TripReport
from relay_engine.rules import ampm, evaluate, fit_hint


def board(db: Session, now: datetime, plan: Plan) -> BoardOut:
    orders = run_orders(db, plan.depot, plan.run_date)
    by_ref = {o.order_ref: o for o in orders}
    outlets = {o.outlet_id: o for o in db.scalars(select(Outlet))}
    ctx = context(db, plan, orders)
    trips = stored_trips(db, plan)
    reports, totals = evaluate(ctx, trips)
    drivers = {u.vehicle_id: u.display_name for u in db.scalars(select(AppUser).where(AppUser.role == Role.DRIVER))}
    days = {d.vehicle_id: d for d in db.scalars(select(VehicleDay).where(VehicleDay.run_date == plan.run_date))}
    vehicles = db.scalars(select(Vehicle).where(Vehicle.depot == plan.depot).order_by(Vehicle.vehicle_id)).all()
    locked = _loads_locked(db, plan)

    lanes = []
    for v in vehicles:
        mine = [r for r in reports if r.trip.vehicle_id == v.vehicle_id]
        day = days.get(v.vehicle_id)
        total = totals.get(v.vehicle_id)
        status = day.status.value if day else "available"
        lanes.append(
            LaneOut(
                vehicle_id=v.vehicle_id,
                type=v.type,
                temp=v.temp,
                weight_cap_kg=v.weight_cap_kg,
                volume_cap_m3=v.volume_cap_m3,
                driver=drivers.get(v.vehicle_id),
                status=status,
                note=_lane_note(status, day.note if day else "", plan, mine),
                fuel_week_l=total.fuel_week_l if total else round(day.fuel_used_l if day else 0.0, 1),
                fuel_quota_l=v.weekly_fuel_quota_l,
                fresh_minutes=total.fresh_minutes if total else 0,
                daytime_minutes=total.daytime_minutes if total else 0,
                trips=[_trip(plan, r, reports, ctx, outlets, by_ref, days, locked) for r in mine],
            )
        )

    placed = {o for t in trips for o in t.order_ids}
    deferrals = {d.order_id: d for d in db.scalars(select(Deferral).where(Deferral.plan_id == plan.id))}
    waiting = []
    for order in orders:
        if order.order_ref in placed:
            continue
        o = outlets[order.outlet_id]
        d = deferrals.get(order.id)
        waiting.append(
            WaitingOut(
                order_ref=order.order_ref,
                outlet_id=order.outlet_id,
                short_name=o.short_name,
                brand=order.brand,
                temp=order.temp,
                units=order.units,
                weight_kg=order.weight_kg,
                volume_m3=order.volume_m3,
                window_open=o.window_open,
                window_close=o.window_close,
                deferral=DeferralOut(
                    kind=d.kind.value,
                    unavoidable=bool(d.explanation.get("unavoidable")),
                    rule=d.explanation.get("rule"),
                    reason=d.reason,
                    reason_code=d.explanation.get("reason_code"),
                    suggested_reason=d.explanation.get("suggested_reason"),
                    to_date=d.to_date,
                    confirmed_at=d.confirmed_at.astimezone(COLOMBO) if d.confirmed_at else None,
                    store_notice=d.store_notice,
                )
                if d
                else None,
            )
        )
    # after publishing, deferred orders have moved to the next run; show them from their deferral
    if plan.status is PlanStatus.PUBLISHED:
        for d in deferrals.values():
            order = db.get(Order, d.order_id)
            if order is None or order.order_ref in by_ref:
                continue
            o = outlets[order.outlet_id]
            waiting.append(
                WaitingOut(
                    order_ref=order.order_ref,
                    outlet_id=order.outlet_id,
                    short_name=o.short_name,
                    brand=order.brand,
                    temp=order.temp,
                    units=order.units,
                    weight_kg=order.weight_kg,
                    volume_m3=order.volume_m3,
                    window_open=o.window_open,
                    window_close=o.window_close,
                    deferral=DeferralOut(
                        kind=d.kind.value,
                        unavoidable=bool(d.explanation.get("unavoidable")),
                        rule=d.explanation.get("rule"),
                        reason=d.reason,
                        reason_code=d.explanation.get("reason_code"),
                        suggested_reason=d.explanation.get("suggested_reason"),
                        to_date=d.to_date,
                        confirmed_at=d.confirmed_at.astimezone(COLOMBO) if d.confirmed_at else None,
                        store_notice=d.store_notice,
                    ),
                )
            )

    placed_by_type: dict[str, int] = {}
    for ref in placed:
        order = by_ref.get(ref)
        if order is None:
            continue
        key = "Fresh chilled" if order.temp == "chilled" else "Fresh dry" if order.brand == "Fresh" else order.brand
        placed_by_type[key] = placed_by_type.get(key, 0) + 1

    peers = [
        {
            "depot": p.depot,
            "status": p.status.value,
            "published_at": p.published_at.isoformat() if p.published_at else None,
        }
        for p in db.scalars(select(Plan).where(Plan.run_date == plan.run_date, Plan.id != plan.id))
    ]
    edited = plan.summary.get("edited_at")
    total_orders = len(orders) + (
        sum(1 for w in waiting if w.order_ref not in by_ref) if plan.status is PlanStatus.PUBLISHED else 0
    )
    return BoardOut(
        plan=PlanOut(
            id=plan.id,
            depot=plan.depot,
            run_date=plan.run_date,
            status=plan.status.value,
            version=plan.version,
            proposed_at=plan.proposed_at.astimezone(COLOMBO) if plan.proposed_at else None,
            published_at=plan.published_at.astimezone(COLOMBO) if plan.published_at else None,
            edited_at=datetime.fromisoformat(edited).astimezone(COLOMBO) if edited else None,
        ),
        orders=total_orders,
        served=len(placed),
        trips=len(trips),
        lanes=lanes,
        waiting=waiting,
        placed_by_type=placed_by_type,
        analyses=plan.summary.get("analyses", []),
        can_undo=plan.status is not PlanStatus.PUBLISHED and bool(plan.summary.get("undo")),
        broken=sum(len(r.broken) for r in reports),
        locked=now >= cutoff_for(plan.run_date),
        published_peers=peers,
    )


def _loads_locked(db: Session, plan: Plan) -> set[tuple[str, int]]:
    """Trips whose truck is packed or gone: the stop order is set by how the cases went on."""
    if plan.status is not PlanStatus.PUBLISHED:
        return set()
    trips = db.scalars(select(Trip).where(Trip.plan_id == plan.id)).all()
    complete = set(
        db.scalars(
            select(Handover.trip_id).where(
                Handover.trip_id.in_([t.id for t in trips]), Handover.completed_at.is_not(None)
            )
        )
    )
    return {
        (t.vehicle_id, t.trip_no)
        for t in trips
        if t.departed_at is not None or t.status is TripStatus.LOADED or t.id in complete
    }


def _trip(plan, report: TripReport, reports, ctx, outlets, by_ref, days, locked) -> TripOut:  # type: ignore[no-untyped-def]
    day = plan.run_date
    stops = []
    for p, e in zip(report.planned, report.expected, strict=True):
        o = outlets[p.outlet_id]
        order = by_ref[p.order_id]
        stops.append(
            StopOut(
                order_ref=p.order_id,
                outlet_id=p.outlet_id,
                short_name=o.short_name,
                name=o.name,
                dock_type=o.dock_type,
                window_open=o.window_open,
                window_close=o.window_close,
                planned=adapters.at_minutes(day, p.arrive),
                expected=adapters.at_minutes(day, e.arrive),
                units=order.units,
                weight_kg=order.weight_kg,
                volume_m3=order.volume_m3,
            )
        )
    return TripOut(
        vehicle_id=report.trip.vehicle_id,
        trip_no=report.trip.trip_no,
        brand=report.brand.value,
        temp=report.temp.value,
        district=report.district,
        depart=adapters.at_minutes(day, report.depart),
        back=adapters.at_minutes(day, report.back),
        expected_back=adapters.at_minutes(day, report.expected_back),
        weight_kg=report.weight_kg,
        volume_m3=report.volume_m3,
        units=report.units,
        std_minutes=report.standard_minutes,
        litres=report.litres,
        usual=report.usual,
        rules=[RuleOut(rule=r.rule, name=r.name, passed=r.passed, message=r.message) for r in report.rules],
        broken=len(report.broken),
        stops=stops,
        note=_trip_note(report, reports, ctx, days),
        load_locked=report.trip.key in locked,
    )


def _trip_note(report: TripReport, reports, ctx, days) -> str:  # type: ignore[no-untyped-def]
    parts = []
    if not report.usual:
        mine = set(report.trip.order_ids)
        for vehicle_id, trips in ctx.usual.items():
            day = days.get(vehicle_id)
            if day is None or day.status.value != "workshop":
                continue
            for u in trips:
                if u.brand is report.brand and u.temp is report.temp and u.district == report.district:
                    today = {
                        o.order_id
                        for o in ctx.orders.values()
                        if o.outlet_id in u.outlets and o.brand is u.brand and o.temp is u.temp
                    }
                    if today:
                        share = f"{len(mine & today)} of its {len(today)} orders"
                        run = f"{vehicle_id}'s usual {report.district} run"
                        parts.append(f"{run}, {share}, while {vehicle_id} is in the workshop.")
                    break
            if parts:
                break
    if report.trip.trip_no == 2:
        first = next((r for r in reports if r.trip.vehicle_id == report.trip.vehicle_id and r.trip.trip_no == 1), None)
        if first is not None:
            parts.append(
                f"It leaves {round(report.depart - first.back)} min after trip 1 is back at {ampm(first.back)}."
            )
    return " ".join(parts)


def _lane_note(status: str, note: str, plan: Plan, trips: list[TripReport]) -> str:
    if status == "workshop":
        return note or "In the workshop"
    if status == "standby":
        return note or f"Standby, free until 8:00 AM on {plan.run_date:%A}"
    if not trips:
        return "Not needed"
    return ""


def fits(db: Session, plan: Plan, order_ref: str) -> list[FitOut]:
    """While an order is dragged: for every trip and every empty slot of the depot's running vehicles, would it
    fit, and if not, why in a few words."""
    orders = run_orders(db, plan.depot, plan.run_date)
    ctx = context(db, plan, orders)
    order = ctx.orders.get(order_ref)
    if order is None:
        return []
    trips = list(stored_trips(db, plan))
    for t in trips:
        if order_ref in t.order_ids:
            t.order_ids.remove(order_ref)
    trips = [t for t in trips if t.order_ids]
    out = []
    for vehicle_id, v in ctx.network.vehicles.items():
        if v.depot != plan.depot:
            continue
        day = ctx.vehicles.get(vehicle_id)
        if day is not None and day.status.value == "workshop":
            continue
        own = sorted((t for t in trips if t.vehicle_id == vehicle_id), key=lambda t: t.trip_no)
        for number in (1, 2):
            trip = next((t for t in own if t.trip_no == number), None)
            if trip is None and number > len(own) + 1:
                continue
            target = trip or EngineTrip(vehicle_id, number, [])
            ok, hint = fit_hint(ctx, order, target, trips)
            out.append(FitOut(vehicle_id=vehicle_id, trip_no=number, fits=ok, hint=hint))
    return out


__all__ = ["DEPOT_LABEL", "board", "fits"]
