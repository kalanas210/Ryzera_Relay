"""Load the shared network (reference tables and derived tables) and the people. Runs once, on an empty database."""

from __future__ import annotations

import csv
from collections.abc import Iterator
from datetime import date
from pathlib import Path

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from relay_api.models import (
    AppUser,
    CalendarDay,
    CaseType,
    District,
    OrderStream,
    Outlet,
    OutletDwell,
    RoadCondition,
    Role,
    ServiceAllowance,
    ServiceHistory,
    TrafficSpeed,
    UsualRun,
    Vehicle,
)
from relay_api.security import hash_secret


def read(path: Path) -> Iterator[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        yield from csv.DictReader(handle)


def _date(text: str) -> date | None:
    return date.fromisoformat(text) if text else None


def _bulk(db: Session, model: type, rows: list[dict[str, object]]) -> None:
    for start in range(0, len(rows), 2000):
        db.execute(insert(model), rows[start : start + 2000])


def load_reference(db: Session, seed_dir: Path) -> bool:
    """Load the network. Returns False if it is already there."""
    if db.scalar(select(Outlet.outlet_id).limit(1)) is not None:
        return False
    ref, derived, story = seed_dir / "reference", seed_dir / "derived", seed_dir / "story"

    _bulk(
        db,
        District,
        [
            dict(
                name=r["district"],
                depot=r["depot"],
                road_class=r["road_class"],
                free_flow_kmh=float(r["free_flow_kmh"]),
                depot_to_district_km=float(r["depot_to_district_km"]),
                depot_to_district_min=int(r["depot_to_district_freeflow_min"]),
                inter_stop_km=float(r["inter_stop_km"]),
                inter_stop_min=int(r["inter_stop_freeflow_min"]),
            )
            for r in read(ref / "district_travel.csv")
        ],
    )
    names = {r["outlet_id"]: r for r in read(ref / "store_names.csv")}
    _bulk(
        db,
        Outlet,
        [
            dict(
                outlet_id=r["outlet_id"],
                name=names[r["outlet_id"]]["name"],
                short_name=names[r["outlet_id"]]["short_name"],
                brand=r["brand"],
                district=r["district"],
                depot=r["depot"],
                dock_type=r["dock_type"],
                parking_constraint=r["parking_constraint"],
                mall_window=r["mall_window"] or None,
                window_open=r["window_open_time"],
                window_close=r["window_close_time"],
            )
            for r in read(ref / "outlets.csv")
        ],
    )
    _bulk(
        db,
        Vehicle,
        [
            dict(
                vehicle_id=r["vehicle_id"],
                type=r["type"],
                temp=r["temp"],
                weight_cap_kg=float(r["weight_cap_kg"]),
                volume_cap_m3=float(r["volume_cap_m3"]),
                fuel_type=r["fuel_type"],
                km_per_l=float(r["km_per_l"]),
                weekly_fuel_quota_l=float(r["weekly_fuel_quota_l"]),
                depot=r["depot"],
            )
            for r in read(ref / "vehicles.csv")
        ],
    )
    _bulk(
        db,
        CalendarDay,
        [
            dict(
                date=date.fromisoformat(r["date"]),
                dow=int(r["dow"]),
                dow_name=r["dow_name"],
                is_weekend=r["is_weekend"] == "1",
                iso_year=int(r["iso_year"]),
                iso_week=int(r["iso_week"]),
                is_payday=r["is_payday"] == "1",
                festival=r["festival"] or None,
                festival_ramp=float(r["festival_ramp"]),
                is_holiday=r["is_holiday"] == "1",
                monsoon=r["monsoon"] == "1",
                is_operating=r["is_operating"] == "1",
            )
            for r in read(ref / "calendar.csv")
        ],
    )
    _bulk(
        db,
        ServiceAllowance,
        [
            dict(brand=r["brand"], dock_type=r["dock_type"], minutes=int(r["service_allowance_min"]))
            for r in read(ref / "service_allowance.csv")
        ],
    )
    _bulk(
        db,
        TrafficSpeed,
        [
            dict(
                district=r["district"],
                hour=int(r["hour"]),
                monsoon=r["monsoon"] == "1",
                speed_index=float(r["speed_index"]),
            )
            for r in read(ref / "traffic_speed.csv")
        ],
    )
    _bulk(
        db,
        RoadCondition,
        [
            dict(
                district=r["district"],
                date=date.fromisoformat(r["date"]),
                disruption_index=float(r["disruption_index"]),
            )
            for r in read(ref / "road_conditions.csv")
        ],
    )
    _bulk(
        db,
        CaseType,
        [
            dict(
                code=r["code"],
                name=r["name"],
                brand=r["brand"],
                temp=r["temp"],
                kg=float(r["kg"]),
                m3=float(r["m3"]),
                load_rank=int(r["load_rank"]),
            )
            for r in read(ref / "case_types.csv")
        ],
    )
    _bulk(
        db,
        UsualRun,
        [
            dict(
                vehicle_id=r["vehicle_id"],
                dow_name=r["dow_name"],
                trip_no=int(r["trip_no"]),
                brand=r["brand"],
                temp=r["temp"],
                district=r["district"],
                share=float(r["share"]),
            )
            for r in read(derived / "usual_runs.csv")
        ],
    )
    _bulk(
        db,
        OutletDwell,
        [
            dict(
                outlet_id=r["outlet_id"],
                monsoon=r["monsoon"] == "1",
                p10=float(r["p10"]),
                p50=float(r["p50"]),
                p90=float(r["p90"]),
            )
            for r in read(derived / "outlet_dwell.csv")
        ],
    )
    _bulk(db, OrderStream, [dict(r) for r in read(derived / "order_streams.csv")])
    _bulk(
        db,
        ServiceHistory,
        [
            dict(
                outlet_id=r["outlet_id"],
                temp=r["temp"],
                last_delivered=_date(r["last_delivered"]),
                deferred_on=_date(r["deferred_on"]),
            )
            for r in read(story / "history.csv")
        ],
    )
    return True


def load_people(db: Session, seed_dir: Path, password: str) -> int:
    if db.scalar(select(AppUser.id).limit(1)) is not None:
        return 0
    password_hash = hash_secret(password)  # one hash for every seeded account keeps the seed fast
    pins: dict[str, str] = {}
    rows = []
    for r in read(seed_dir / "story" / "people.csv"):
        role = Role(r["role"])
        pin = r["pin"]
        if pin and pin not in pins:
            pins[pin] = hash_secret(pin)
        rows.append(
            dict(
                username=r["username"],
                display_name=r["display_name"],
                role=role,
                password_hash=password_hash,
                pin_hash=pins.get(pin) if pin else None,
                depot=r["depot"] or None,
                outlet_id=r["outlet_id"] or None,
                vehicle_id=r["vehicle_id"] or None,
                locale=r["locale"] or "en",
                judge_account=r["judge"] == "1",
            )
        )
    db.add_all(AppUser(**row) for row in rows)
    return len(rows)
