"""Build a Network straight from the organizers' reference CSV files.

The API builds its Network from the database instead; this loader serves tests, scripts and
the Datathon, and uses only the standard library.
"""

from __future__ import annotations

import csv
from collections.abc import Mapping
from pathlib import Path

from relay_engine.network import (
    Brand,
    District,
    DockType,
    Network,
    Outlet,
    Parking,
    Vehicle,
    VehicleTemp,
    VehicleType,
    clock_to_minutes,
)


def _rows(path: Path) -> list[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        return list(csv.DictReader(handle))


def parse_mall_window(text: str) -> tuple[int, int] | None:
    """'09:00-11:00' becomes (540, 660); a blank cell means the outlet is not in a mall."""
    if not text:
        return None
    start, end = text.split("-")
    return clock_to_minutes(start), clock_to_minutes(end)


def load_network(directory: Path, store_names: Mapping[str, str] | None = None) -> Network:
    names = store_names or {}
    districts = {
        r["district"]: District(
            name=r["district"],
            depot=r["depot"],
            road_class=r["road_class"],
            free_flow_kmh=float(r["free_flow_kmh"]),
            depot_to_district_km=float(r["depot_to_district_km"]),
            depot_to_district_min=int(r["depot_to_district_freeflow_min"]),
            inter_stop_km=float(r["inter_stop_km"]),
            inter_stop_min=int(r["inter_stop_freeflow_min"]),
        )
        for r in _rows(directory / "district_travel.csv")
    }
    outlets = {
        r["outlet_id"]: Outlet(
            outlet_id=r["outlet_id"],
            brand=Brand(r["brand"]),
            district=r["district"],
            depot=r["depot"],
            dock_type=DockType(r["dock_type"]),
            parking=Parking(r["parking_constraint"]),
            window_open=clock_to_minutes(r["window_open_time"]),
            window_close=clock_to_minutes(r["window_close_time"]),
            mall_window=parse_mall_window(r["mall_window"]),
            name=names.get(r["outlet_id"], ""),
        )
        for r in _rows(directory / "outlets.csv")
    }
    vehicles = {
        r["vehicle_id"]: Vehicle(
            vehicle_id=r["vehicle_id"],
            type=VehicleType(r["type"]),
            temp=VehicleTemp(r["temp"]),
            weight_cap_kg=float(r["weight_cap_kg"]),
            volume_cap_m3=float(r["volume_cap_m3"]),
            km_per_l=float(r["km_per_l"]),
            weekly_fuel_quota_l=float(r["weekly_fuel_quota_l"]),
            depot=r["depot"],
        )
        for r in _rows(directory / "vehicles.csv")
    }
    allowance = {
        (Brand(r["brand"]), DockType(r["dock_type"])): int(r["service_allowance_min"])
        for r in _rows(directory / "service_allowance.csv")
    }
    return Network(districts=districts, outlets=outlets, vehicles=vehicles, allowance=allowance)
