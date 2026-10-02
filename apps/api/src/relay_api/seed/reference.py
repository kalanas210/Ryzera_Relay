"""Load the shared network (the organizers' reference tables and the tables derived from the history) and
the people. Each table is loaded only while it is empty, so a table added by a later migration is filled on
the next start without touching the rest."""

from __future__ import annotations

import csv
from collections.abc import Callable, Iterator
from datetime import date, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import insert, select
from sqlalchemy.orm import Session

from relay_api.models import (
    AppUser,
    Base,
    CalendarDay,
    CaseType,
    District,
    HubStock,
    OrderStream,
    Outlet,
    OutletDwell,
    OutlookDay,
    OutlookForecast,
    OutlookWeek,
    RoadCondition,
    Role,
    ServiceAllowance,
    ServiceHistory,
    TrafficSpeed,
    UsualRun,
    UsualStop,
    Vehicle,
)
from relay_api.security import hash_secret


def read(path: Path) -> Iterator[dict[str, str]]:
    with path.open(newline="", encoding="utf-8") as handle:
        yield from csv.DictReader(handle)


def _date(text: str) -> date | None:
    return date.fromisoformat(text) if text else None


def _flag(text: str) -> bool:
    return text == "1"


Rows = Callable[[Path], list[dict[str, Any]]]


def _districts(seed: Path) -> list[dict[str, Any]]:
    return [
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
        for r in read(seed / "reference" / "district_travel.csv")
    ]


def _outlets(seed: Path) -> list[dict[str, Any]]:
    names = {r["outlet_id"]: r for r in read(seed / "reference" / "store_names.csv")}
    return [
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
        for r in read(seed / "reference" / "outlets.csv")
    ]


def _vehicles(seed: Path) -> list[dict[str, Any]]:
    return [
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
        for r in read(seed / "reference" / "vehicles.csv")
    ]


def _calendar(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            date=date.fromisoformat(r["date"]),
            dow=int(r["dow"]),
            dow_name=r["dow_name"],
            is_weekend=_flag(r["is_weekend"]),
            iso_year=int(r["iso_year"]),
            iso_week=int(r["iso_week"]),
            is_payday=_flag(r["is_payday"]),
            festival=r["festival"] or None,
            festival_ramp=float(r["festival_ramp"]),
            is_holiday=_flag(r["is_holiday"]),
            monsoon=_flag(r["monsoon"]),
            is_operating=_flag(r["is_operating"]),
        )
        for r in read(seed / "reference" / "calendar.csv")
    ]


def _allowances(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(brand=r["brand"], dock_type=r["dock_type"], minutes=int(r["service_allowance_min"]))
        for r in read(seed / "reference" / "service_allowance.csv")
    ]


def _traffic(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            district=r["district"],
            hour=int(r["hour"]),
            monsoon=_flag(r["monsoon"]),
            speed_index=float(r["speed_index"]),
        )
        for r in read(seed / "reference" / "traffic_speed.csv")
    ]


def _roads(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(district=r["district"], date=date.fromisoformat(r["date"]), disruption_index=float(r["disruption_index"]))
        for r in read(seed / "reference" / "road_conditions.csv")
    ]


def _case_types(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            code=r["code"],
            name=r["name"],
            brand=r["brand"],
            temp=r["temp"],
            kg=float(r["kg"]),
            m3=float(r["m3"]),
            load_rank=int(r["load_rank"]),
        )
        for r in read(seed / "reference" / "case_types.csv")
    ]


def _usual_runs(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            vehicle_id=r["vehicle_id"],
            dow_name=r["dow_name"],
            trip_no=int(r["trip_no"]),
            brand=r["brand"],
            temp=r["temp"],
            district=r["district"],
            share=float(r["share"]),
        )
        for r in read(seed / "derived" / "usual_runs.csv")
    ]


def _usual_stops(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            vehicle_id=r["vehicle_id"],
            dow_name=r["dow_name"],
            trip_no=int(r["trip_no"]),
            brand=r["brand"],
            temp=r["temp"],
            district=r["district"],
            outlet_id=r["outlet_id"],
            share=float(r["share"]),
            run_share=float(r["run_share"]),
        )
        for r in read(seed / "derived" / "usual_stops.csv")
    ]


def _dwell(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            outlet_id=r["outlet_id"],
            monsoon=_flag(r["monsoon"]),
            p10=float(r["p10"]),
            p50=float(r["p50"]),
            p90=float(r["p90"]),
        )
        for r in read(seed / "derived" / "outlet_dwell.csv")
    ]


def _streams(seed: Path) -> list[dict[str, Any]]:
    return [dict(r) for r in read(seed / "derived" / "order_streams.csv")]


def _history(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            outlet_id=r["outlet_id"],
            temp=r["temp"],
            last_delivered=_date(r["last_delivered"]),
            deferred_on=_date(r["deferred_on"]),
        )
        for r in read(seed / "story" / "history.csv")
    ]


def _outlook_forecasts(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            depot=r["depot"],
            forecast_updated=date.fromisoformat(r["forecast_updated"]),
            baseline_year=int(r["baseline_year"]),
            baseline_first_week=int(r["baseline_first_week"]),
            baseline_last_week=int(r["baseline_last_week"]),
            backtest_year=int(r["backtest_year"]),
            backtest_first_week=int(r["backtest_first_week"]),
            backtest_last_week=int(r["backtest_last_week"]),
            backtest_pct=float(r["backtest_pct"]),
            last_year_pct=float(r["last_year_pct"]),
            ordinary_week_m3=float(r["ordinary_week_m3"]),
            record_week_m3=float(r["record_week_m3"]),
            record_year=int(r["record_year"]),
            record_week=int(r["record_week"]),
            tech_order_max_m3=float(r["tech_order_max_m3"]),
        )
        for r in read(seed / "derived" / "outlook_meta.csv")
    ]


def _outlook_weeks(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            depot=r["depot"],
            iso_year=int(r["iso_year"]),
            iso_week=int(r["iso_week"]),
            chilled_m3=float(r["chilled_m3"]),
            dry_m3=float(r["dry_m3"]),
            style_m3=float(r["style_m3"]),
            tech_m3=float(r["tech_m3"]),
        )
        for r in read(seed / "derived" / "outlook_weeks.csv")
    ]


def _outlook_days(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            depot=r["depot"],
            date=date.fromisoformat(r["date"]),
            chilled_orders=int(r["chilled_orders"]),
            chilled_kg=float(r["chilled_kg"]),
            chilled_m3=float(r["chilled_m3"]),
            needed=int(r["needed"]),
            in_workshop=r["in_workshop"].split(),
            served_one_fewer=int(r["served_one_fewer"]) if r["served_one_fewer"] else None,
        )
        for r in read(seed / "derived" / "outlook_days.csv")
    ]


def _hub_stock(seed: Path) -> list[dict[str, Any]]:
    return [
        dict(
            depot=r["depot"],
            case_type=r["case_type"],
            run_date=date.fromisoformat(r["run_date"]),
            spare=int(r["spare"]),
            next_delivery_at=datetime.fromisoformat(r["next_delivery_at"]) if r["next_delivery_at"] else None,
        )
        for r in read(seed / "story" / "hub_stock.csv")
    ]


# In dependency order: a table is loaded after the tables it refers to.
TABLES: list[tuple[type[Base], Rows]] = [
    (District, _districts),
    (Outlet, _outlets),
    (Vehicle, _vehicles),
    (CalendarDay, _calendar),
    (ServiceAllowance, _allowances),
    (TrafficSpeed, _traffic),
    (RoadCondition, _roads),
    (CaseType, _case_types),
    (UsualRun, _usual_runs),
    (UsualStop, _usual_stops),
    (OutletDwell, _dwell),
    (OrderStream, _streams),
    (ServiceHistory, _history),
    (HubStock, _hub_stock),
    (OutlookForecast, _outlook_forecasts),
    (OutlookWeek, _outlook_weeks),
    (OutlookDay, _outlook_days),
]


def load_reference(db: Session, seed_dir: Path) -> list[str]:
    """Fill every empty network table. Returns the tables it filled."""
    filled = []
    for model, rows in TABLES:
        if db.execute(select(model.__table__).limit(1)).first() is not None:
            continue
        data = rows(seed_dir)
        for start in range(0, len(data), 2000):
            db.execute(insert(model), data[start : start + 2000])
        filled.append(model.__tablename__)
    return filled


def load_people(db: Session, seed_dir: Path, password: str) -> int:
    existing = {u.username: u for u in db.scalars(select(AppUser))}
    if existing:
        # people are seeded once; a phone number added to the file later is filled in where none is set yet
        for r in read(seed_dir / "story" / "people.csv"):
            user = existing.get(r["username"])
            if user is not None and user.phone is None and r.get("phone"):
                user.phone = r["phone"]
        return 0
    password_hash = hash_secret(password)  # one hash for every seeded account keeps the seed fast
    pins: dict[str, str] = {}
    rows = []
    for r in read(seed_dir / "story" / "people.csv"):
        pin = r["pin"]
        if pin and pin not in pins:
            pins[pin] = hash_secret(pin)
        rows.append(
            dict(
                username=r["username"],
                display_name=r["display_name"],
                role=Role(r["role"]),
                password_hash=password_hash,
                pin_hash=pins.get(pin) if pin else None,
                depot=r["depot"] or None,
                outlet_id=r["outlet_id"] or None,
                vehicle_id=r["vehicle_id"] or None,
                locale=r["locale"] or "en",
                phone=r.get("phone") or None,
                judge_account=r["judge"] == "1",
            )
        )
    db.add_all(AppUser(**row) for row in rows)
    return len(rows)
