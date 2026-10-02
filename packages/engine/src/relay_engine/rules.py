"""The eleven rules every trip is checked against, in plain words.

1 Weight within the vehicle's limit. 2 Volume within the vehicle's limit. 3 Chilled on a refrigerated
vehicle, Fresh dry on an ambient one. 4 Van-only stores go by van. 5 Every store belongs to the vehicle's
home depot. 6 One brand and one district a trip. 7 Fresh trips within 270 minutes a day (Style and Tech
within 480). 8 Every planned arrival inside the store's window. 9 At most two trips a day. 10 First trips
leave at 2:00 AM or later; a second trip leaves at least 10 minutes after the first is back. 11 Fuel stays
within the weekly quota.

Rules 1 to 7 and 9 are the organizers' published standard; 8 and 10 are Relay's clock; 11 is Waypoint's quota.
"""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from relay_engine.clock import Conditions, expected, free_flow
from relay_engine.model import (
    RELOAD_MINUTES,
    Order,
    RuleResult,
    StopTiming,
    Trip,
    TripReport,
    UsualTrip,
    VehicleDay,
    VehicleReport,
    VehicleStatus,
)
from relay_engine.network import Brand, Network, Temp, VehicleType
from relay_engine.standard import DAYTIME_BUDGET_MIN, FRESH_BUDGET_MIN, MAX_TRIPS_PER_DAY, trip_minutes

RULE_NAMES = {
    1: "Weight",
    2: "Volume",
    3: "Temperature",
    4: "Van only",
    5: "Home depot",
    6: "One brand and district",
    7: "Trip time",
    8: "Windows",
    9: "Two trips",
    10: "Departure",
    11: "Fuel",
}


def ampm(minutes: float) -> str:
    """465 becomes '7:45 AM'."""
    whole = round(minutes) % (24 * 60)
    h, m = divmod(whole, 60)
    suffix = "AM" if h < 12 else "PM"
    return f"{h % 12 or 12}:{m:02d} {suffix}"


def kg(value: float) -> str:
    return f"{value:,.1f}"


def trip_litres(network: Network, vehicle_id: str, district: str, stops: int) -> float:
    """Fuel for one trip at the district table's distances, counting the drive back to the depot."""
    if stops == 0:
        return 0.0
    d = network.districts[district]
    km = 2 * d.depot_to_district_km + (stops - 1) * d.inter_stop_km
    return km / network.vehicles[vehicle_id].km_per_l


@dataclass(frozen=True, slots=True)
class Context:
    """Everything a check needs besides the trips themselves."""

    network: Network
    orders: Mapping[str, Order]
    vehicles: Mapping[str, VehicleDay]
    conditions: Conditions
    usual: Mapping[str, Sequence[UsualTrip]]
    """Vehicle to its usual trips for the weekday."""


def evaluate(ctx: Context, trips: Sequence[Trip]) -> tuple[list[TripReport], dict[str, VehicleReport]]:
    """Time, measure and check every trip. A trip without a departure gets the clock's choice."""
    from relay_engine.clock import choose_departure, latest_departure

    network = ctx.network
    by_vehicle: dict[str, list[Trip]] = {}
    for trip in trips:
        by_vehicle.setdefault(trip.vehicle_id, []).append(trip)

    reports: list[TripReport] = []
    vehicles: dict[str, VehicleReport] = {}
    for vehicle_id, own in by_vehicle.items():
        own.sort(key=lambda t: t.trip_no)
        vehicle = network.vehicles[vehicle_id]
        day = ctx.vehicles.get(vehicle_id, VehicleDay(vehicle_id))
        timed: list[tuple[Trip, int, list[StopTiming], float, list[StopTiming], float, float]] = []
        ready = float(day.ready_at)
        expected_ready = ready
        for trip in own:
            orders = [ctx.orders[o] for o in trip.order_ids]
            outlets = [o.outlet_id for o in orders]
            brand = orders[0].brand if orders else Brand.FRESH
            depart = trip.depart
            if depart is None:
                last = latest_departure(network, outlets, brand, ready) if outlets else None
                if last is None:
                    depart = round(ready)
                else:
                    depart = choose_departure(network, ctx.conditions, outlets, brand, ready, last)
            planned, back = free_flow(network, outlets, depart, brand, trip.order_ids)
            exp_depart = max(float(depart), expected_ready)
            exp_rows, exp_back = expected(network, ctx.conditions, outlets, exp_depart, brand, trip.order_ids)
            litres = (
                trip_litres(network, vehicle_id, network.outlets[outlets[0]].district, len(outlets)) if outlets else 0.0
            )
            timed.append((trip, depart, planned, back, exp_rows, exp_back, litres))
            ready = back + RELOAD_MINUTES
            expected_ready = exp_back + RELOAD_MINUTES

        fresh = daytime = 0
        for trip, *_ in timed:
            orders = [ctx.orders[o] for o in trip.order_ids]
            if not orders:
                continue
            minutes = trip_minutes(
                network,
                network.outlets[orders[0].outlet_id].district,
                orders[0].brand,
                [network.outlets[o.outlet_id].dock_type for o in orders],
            )
            if orders[0].brand is Brand.FRESH:
                fresh += minutes
            else:
                daytime += minutes
        fuel_week = day.fuel_used_l + sum(t[6] for t in timed)
        vehicles[vehicle_id] = VehicleReport(
            vehicle_id=vehicle_id,
            fresh_minutes=fresh,
            daytime_minutes=daytime,
            fuel_week_l=round(fuel_week, 1),
            fuel_quota_l=vehicle.weekly_fuel_quota_l,
            trips=len([t for t in own if t.order_ids]),
        )

        previous_back: float | None = None
        for trip, depart, planned, back, exp_rows, exp_back, litres in timed:
            orders = [ctx.orders[o] for o in trip.order_ids]
            report = _report(
                ctx,
                trip,
                orders,
                depart,
                planned,
                back,
                exp_rows,
                exp_back,
                litres,
                vehicles[vehicle_id],
                day,
                previous_back,
            )
            reports.append(report)
            previous_back = back
    reports.sort(key=lambda r: (r.trip.vehicle_id, r.trip.trip_no))
    return reports, vehicles


def _report(
    ctx: Context,
    trip: Trip,
    orders: list[Order],
    depart: int,
    planned: list[StopTiming],
    back: float,
    exp_rows: list[StopTiming],
    exp_back: float,
    litres: float,
    totals: VehicleReport,
    day: VehicleDay,
    previous_back: float | None,
) -> TripReport:
    network = ctx.network
    vehicle = network.vehicles[trip.vehicle_id]
    weight = round(sum(o.weight_kg for o in orders), 1)
    volume = round(sum(o.volume_m3 for o in orders), 3)
    units = sum(o.units for o in orders)
    brands = sorted({o.brand for o in orders})
    districts = sorted({network.outlets[o.outlet_id].district for o in orders})
    temps = {o.temp for o in orders}
    brand = brands[0] if brands else Brand.FRESH
    temp = Temp.CHILLED if Temp.CHILLED in temps else Temp.AMBIENT
    district = districts[0] if districts else ""
    minutes = (
        trip_minutes(network, district, brand, [network.outlets[o.outlet_id].dock_type for o in orders])
        if len(districts) == 1 and len(brands) == 1
        else 0
    )
    kind = "van" if vehicle.type is VehicleType.VAN else "truck"
    fridge = "refrigerated" if vehicle.refrigerated else "dry-box"

    rules: list[RuleResult] = []

    def add(rule: int, passed: bool, message: str) -> None:
        rules.append(RuleResult(rule, RULE_NAMES[rule], passed, message))

    add(1, weight <= vehicle.weight_cap_kg + 1e-6, f"Weight: {kg(weight)} of {vehicle.weight_cap_kg:,.0f} kg")
    add(2, volume <= vehicle.volume_cap_m3 + 1e-9, f"Volume: {volume:.3f} of {vehicle.volume_cap_m3:.1f} m³")

    chilled_on_dry = [o for o in orders if o.temp is Temp.CHILLED and not vehicle.refrigerated]
    dry_on_reefer = [o for o in orders if o.brand is Brand.FRESH and o.temp is Temp.AMBIENT and vehicle.refrigerated]
    if chilled_on_dry:
        add(3, False, f"Chilled goods need a refrigerated vehicle; {trip.vehicle_id} is a {fridge} {kind}")
    elif dry_on_reefer:
        add(3, False, f"Fresh dry goods go on an ambient vehicle, and {trip.vehicle_id} is refrigerated")
    else:
        add(3, True, f"{'Chilled' if temp is Temp.CHILLED else 'Ambient'} goods on a {fridge} {kind}")

    van_only = [o for o in orders if network.outlets[o.outlet_id].van_only]
    if van_only and vehicle.type is not VehicleType.VAN:
        names = ", ".join(sorted({network.outlets[o.outlet_id].outlet_id for o in van_only}))
        add(
            4,
            False,
            f"{names} {'takes' if len({o.outlet_id for o in van_only}) == 1 else 'take'} vans only; "
            f"{trip.vehicle_id} is a truck",
        )
    else:
        add(4, True, "Van-only stores go by van" if van_only else "No van-only store on this trip")

    away = sorted({o.outlet_id for o in orders if network.outlets[o.outlet_id].depot != vehicle.depot})
    add(
        5,
        not away,
        f"{', '.join(away)} belong{'s' if len(away) == 1 else ''} to another depot"
        if away
        else f"Every store belongs to the {vehicle.depot} depot",
    )

    if len(brands) > 1 or len(districts) > 1:
        parts = []
        if len(brands) > 1:
            parts.append(f"{len(brands)} brands: {' and '.join(b.value for b in brands)}")
        if len(districts) > 1:
            parts.append(f"{len(districts)} districts: {' and '.join(districts)}")
        add(6, False, "; ".join(parts))
    else:
        add(6, True, f"One brand and one district: {brand.value}, {district}")

    if brand is Brand.FRESH:
        add(
            7, totals.fresh_minutes <= FRESH_BUDGET_MIN, f"Fresh time: {totals.fresh_minutes} of {FRESH_BUDGET_MIN} min"
        )
    else:
        add(
            7,
            totals.daytime_minutes <= DAYTIME_BUDGET_MIN,
            f"Daytime: {totals.daytime_minutes} of {DAYTIME_BUDGET_MIN} min",
        )

    late = [r for r in planned if r.arrive > network.outlets[r.outlet_id].receiving_window[1]]
    if late:
        first = late[0]
        add(
            8,
            False,
            f"Window: {first.outlet_id} at {ampm(first.arrive)}, closes "
            f"{ampm(network.outlets[first.outlet_id].receiving_window[1]).replace(' AM', '').replace(' PM', '')}",
        )
    else:
        add(8, True, "Every planned arrival is inside its window")

    status_ok = day.status is not VehicleStatus.WORKSHOP
    add(
        9,
        totals.trips <= MAX_TRIPS_PER_DAY and trip.trip_no <= MAX_TRIPS_PER_DAY and status_ok,
        f"{trip.vehicle_id} is in the workshop today"
        if not status_ok
        else f"{totals.trips} trips; a vehicle runs at most {MAX_TRIPS_PER_DAY}"
        if totals.trips > MAX_TRIPS_PER_DAY
        else f"Trip {trip.trip_no} of {totals.trips}",
    )

    if trip.trip_no == 1 or previous_back is None:
        ok = depart >= day.ready_at
        add(10, ok, f"Leaves {ampm(depart)}" + ("" if ok else f", before {ampm(day.ready_at)}"))
    else:
        ok = depart >= previous_back + RELOAD_MINUTES - 1e-6
        add(
            10,
            ok,
            f"Leaves {ampm(depart)}, {round(depart - previous_back)} min after trip {trip.trip_no - 1} is back "
            f"at {ampm(previous_back)}"
            if ok
            else f"Leaves {ampm(depart)}, before trip {trip.trip_no - 1} is back at {ampm(previous_back)} plus 10 min",
        )

    add(
        11,
        totals.fuel_week_l <= totals.fuel_quota_l + 1e-6,
        f"Fuel: {totals.fuel_week_l:,.1f} of {totals.fuel_quota_l:,.0f} L this week",
    )

    usual = any(
        u.brand is brand and u.temp is temp and u.district == district for u in ctx.usual.get(trip.vehicle_id, ())
    )
    return TripReport(
        trip=trip,
        brand=brand,
        temp=temp,
        district=district,
        depart=depart,
        planned=planned,
        back=back,
        expected=exp_rows,
        expected_back=exp_back,
        weight_kg=weight,
        volume_m3=volume,
        units=units,
        standard_minutes=minutes,
        litres=round(litres, 1),
        rules=rules,
        usual=usual,
    )


def fit_hint(ctx: Context, order: Order, trip: Trip, trips: Sequence[Trip]) -> tuple[bool, str]:
    """While an order is dragged: would it fit on this trip, and if not, the reason in a few words. A trip that
    serves another district says so before anything else: no change of load would make it fit."""
    candidate = Trip(trip.vehicle_id, trip.trip_no, [*trip.order_ids, order.order_id], trip.depart)
    others = [t for t in trips if t.key != trip.key]
    reports, _ = evaluate(ctx, [*others, candidate])
    mine = next(r for r in reports if r.trip.key == trip.key)
    broken = mine.broken
    if not broken:
        return True, "Fits"
    first = broken[0]
    network = ctx.network
    if trip.order_ids and any(r.rule == 6 for r in broken):
        existing = ctx.orders[trip.order_ids[0]]
        return False, f"Serves {network.outlets[existing.outlet_id].district} only"
    if {r.rule for r in broken} >= {1, 2}:
        return False, "Over weight and volume"
    short = {
        1: "Over weight",
        2: "Over volume",
        3: "Needs a refrigerated vehicle" if order.temp is Temp.CHILLED else "Refrigerated vehicle",
        4: "Trucks can't reach this store",
        5: "Another depot",
    }
    if first.rule in short:
        return False, short[first.rule]
    return False, first.message
