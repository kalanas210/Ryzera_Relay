"""The story day's inputs, read straight from the seed files: the orders, the vehicles, the usual runs and the
expected clock's conditions. Shared by the engine tests; the fixtures that wrap them live in conftest.py."""

import csv
from pathlib import Path

from relay_engine.clock import Conditions
from relay_engine.model import Order, UsualTrip, VehicleDay, VehicleStatus
from relay_engine.network import Brand, Temp

SEED = Path(__file__).resolve().parents[3] / "seed" / "data"
REFERENCE = SEED / "reference"
STORY = SEED / "story"
DERIVED = SEED / "derived"
WEDNESDAY = "2026-04-08"
LATE = {"ORD0098496", "ORD0098497"}  # OUT032's two orders arrive after the 4:00 PM cutoff


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def conditions_for(day: str) -> Conditions:
    """The expected clock's inputs for one date, from the seed's reference and derived tables."""
    monsoon = next(r for r in _rows(REFERENCE / "calendar.csv") if r["date"] == day)["monsoon"]
    speed = {
        (r["district"], int(r["hour"])): float(r["speed_index"])
        for r in _rows(REFERENCE / "traffic_speed.csv")
        if r["monsoon"] == monsoon
    }
    road = {
        r["district"]: float(r["disruption_index"])
        for r in _rows(REFERENCE / "road_conditions.csv")
        if r["date"] == day
    }
    dwell = {r["outlet_id"]: float(r["p50"]) for r in _rows(DERIVED / "outlet_dwell.csv") if r["monsoon"] == monsoon}
    return Conditions(speed=speed, road=road, dwell=dwell)


def story_orders(day: str = WEDNESDAY) -> list[Order]:
    return [
        Order(
            r["order_ref"],
            r["outlet_id"],
            Brand(r["brand"]),
            Temp(r["temp"]),
            int(r["units"]),
            float(r["kg"]),
            float(r["m3"]),
        )
        for r in _rows(STORY / "orders.csv")
        if r["requested_date"] == day and r["order_ref"] not in LATE
    ]


def story_vehicles(day: str = WEDNESDAY) -> list[VehicleDay]:
    return [
        VehicleDay(r["vehicle_id"], VehicleStatus(r["status"]), float(r["fuel_used_l"] or 0))
        for r in _rows(STORY / "vehicle_days.csv")
        if r["run_date"] == day
    ]


def usual_runs(dow: str = "Wed") -> dict[str, list[UsualTrip]]:
    groups: dict[tuple[str, int, str, str, str, float], set[str]] = {}
    for r in _rows(DERIVED / "usual_stops.csv"):
        if r["dow_name"] == dow:
            key = (r["vehicle_id"], int(r["trip_no"]), r["brand"], r["temp"], r["district"], float(r["run_share"]))
            groups.setdefault(key, set()).add(r["outlet_id"])
    usual: dict[str, list[UsualTrip]] = {}
    for (v, tn, brand, temp, district, share), outlets in groups.items():
        usual.setdefault(v, []).append(UsualTrip(v, tn, Brand(brand), Temp(temp), district, share, frozenset(outlets)))
    return usual


def protected_orders(orders: list[Order]) -> set[str]:
    waited = {(r["outlet_id"], r["temp"]) for r in _rows(STORY / "history.csv") if r["deferred_on"]}
    return {o.order_id for o in orders if (o.outlet_id, o.temp.value) in waited}
