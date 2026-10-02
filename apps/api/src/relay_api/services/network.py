"""Adapters from database rows to the engine's plain types."""

from __future__ import annotations

import threading
from datetime import date, datetime, time, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import (
    CalendarDay,
    District,
    Outlet,
    OutletDwell,
    RoadCondition,
    ServiceAllowance,
    TrafficSpeed,
    UsualStop,
    Vehicle,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.models import Order as OrderRow
from relay_engine.clock import Conditions
from relay_engine.model import Order, UsualTrip, VehicleStatus
from relay_engine.model import VehicleDay as EngineVehicleDay
from relay_engine.network import (
    Brand,
    DockType,
    Network,
    Parking,
    Temp,
    VehicleTemp,
    VehicleType,
    clock_to_minutes,
)
from relay_engine.network import District as EngineDistrict
from relay_engine.network import Outlet as EngineOutlet
from relay_engine.network import Vehicle as EngineVehicle
from relay_engine.reference import parse_mall_window

_lock = threading.Lock()
_network: Network | None = None


def network(db: Session) -> Network:
    """The shared network, loaded once per process: it never changes while Relay runs."""
    global _network
    if _network is None:
        with _lock:
            if _network is None:
                _network = _load_network(db)
    return _network


def _load_network(db: Session) -> Network:
    districts = {
        d.name: EngineDistrict(
            name=d.name,
            depot=d.depot,
            road_class=d.road_class,
            free_flow_kmh=d.free_flow_kmh,
            depot_to_district_km=d.depot_to_district_km,
            depot_to_district_min=d.depot_to_district_min,
            inter_stop_km=d.inter_stop_km,
            inter_stop_min=d.inter_stop_min,
        )
        for d in db.scalars(select(District))
    }
    outlets = {
        o.outlet_id: EngineOutlet(
            outlet_id=o.outlet_id,
            brand=Brand(o.brand),
            district=o.district,
            depot=o.depot,
            dock_type=DockType(o.dock_type),
            parking=Parking(o.parking_constraint),
            window_open=clock_to_minutes(o.window_open),
            window_close=clock_to_minutes(o.window_close),
            mall_window=parse_mall_window(o.mall_window or ""),
            name=o.name,
        )
        for o in db.scalars(select(Outlet))
    }
    vehicles = {
        v.vehicle_id: EngineVehicle(
            vehicle_id=v.vehicle_id,
            type=VehicleType(v.type),
            temp=VehicleTemp(v.temp),
            weight_cap_kg=v.weight_cap_kg,
            volume_cap_m3=v.volume_cap_m3,
            km_per_l=v.km_per_l,
            weekly_fuel_quota_l=v.weekly_fuel_quota_l,
            depot=v.depot,
        )
        for v in db.scalars(select(Vehicle))
    }
    allowance = {(Brand(a.brand), DockType(a.dock_type)): a.minutes for a in db.scalars(select(ServiceAllowance))}
    return Network(districts=districts, outlets=outlets, vehicles=vehicles, allowance=allowance)


_conditions: dict[date, Conditions] = {}


def conditions(db: Session, day: date) -> Conditions:
    """A day's traffic, road and unloading tables, read once per process: they are reference data and never change
    while Relay runs, and every estimate and every simulated record reads them."""
    known = _conditions.get(day)
    if known is None:
        with _lock:
            known = _conditions.get(day)
            if known is None:
                known = _conditions[day] = _load_conditions(db, day)
    return known


def _load_conditions(db: Session, day: date) -> Conditions:
    cal = db.get(CalendarDay, day)
    monsoon = bool(cal.monsoon) if cal else False
    speed = {
        (t.district, t.hour): t.speed_index
        for t in db.scalars(select(TrafficSpeed).where(TrafficSpeed.monsoon.is_(monsoon)))
    }
    road = {r.district: r.disruption_index for r in db.scalars(select(RoadCondition).where(RoadCondition.date == day))}
    dwell = {d.outlet_id: d.p50 for d in db.scalars(select(OutletDwell).where(OutletDwell.monsoon.is_(monsoon)))}
    return Conditions(speed=speed, road=road, dwell=dwell)


def usual(db: Session, day: date) -> dict[str, list[UsualTrip]]:
    dow = day.strftime("%a")
    groups: dict[tuple[str, int, str, str, str, float], set[str]] = {}
    for u in db.scalars(select(UsualStop).where(UsualStop.dow_name == dow)):
        groups.setdefault((u.vehicle_id, u.trip_no, u.brand, u.temp, u.district, u.run_share), set()).add(u.outlet_id)
    out: dict[str, list[UsualTrip]] = {}
    for (v, tn, brand, temp, district, share), outlets in groups.items():
        out.setdefault(v, []).append(UsualTrip(v, tn, Brand(brand), Temp(temp), district, share, frozenset(outlets)))
    return out


def vehicle_days(db: Session, day: date) -> list[EngineVehicleDay]:
    rows = db.scalars(select(VehicleDay).where(VehicleDay.run_date == day)).all()
    status = {
        VehicleDayStatus.AVAILABLE: VehicleStatus.AVAILABLE,
        VehicleDayStatus.WORKSHOP: VehicleStatus.WORKSHOP,
        VehicleDayStatus.STANDBY: VehicleStatus.STANDBY,
    }
    return [EngineVehicleDay(r.vehicle_id, status[r.status], r.fuel_used_l) for r in rows]


def engine_order(row: OrderRow) -> Order:
    return Order(
        order_id=row.order_ref,
        outlet_id=row.outlet_id,
        brand=Brand(row.brand),
        temp=Temp(row.temp),
        units=row.units,
        weight_kg=row.weight_kg,
        volume_m3=row.volume_m3,
    )


def at_minutes(day: date, minutes: float) -> datetime:
    """Minutes after midnight of the delivery day, as a Sri Lanka time."""
    return datetime.combine(day, time(0, 0), tzinfo=COLOMBO) + timedelta(minutes=round(minutes))


def minutes_of(day: date, moment: datetime) -> float:
    start = datetime.combine(day, time(0, 0), tzinfo=COLOMBO)
    return (moment.astimezone(COLOMBO) - start).total_seconds() / 60.0
