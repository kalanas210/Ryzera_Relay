"""The shared network, loaded from the organizers' reference tables. The same in every workspace."""

from __future__ import annotations

from datetime import date

from sqlalchemy import Date, ForeignKey, Numeric, SmallInteger, String
from sqlalchemy.orm import Mapped, mapped_column

from relay_api.models.base import Base


class District(Base):
    __tablename__ = "district"

    name: Mapped[str] = mapped_column(String(32), primary_key=True)
    depot: Mapped[str] = mapped_column(String(16))
    road_class: Mapped[str] = mapped_column(String(16))
    free_flow_kmh: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
    depot_to_district_km: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))
    depot_to_district_min: Mapped[int]
    inter_stop_km: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
    inter_stop_min: Mapped[int]


class Outlet(Base):
    __tablename__ = "outlet"

    outlet_id: Mapped[str] = mapped_column(String(8), primary_key=True)
    name: Mapped[str] = mapped_column(String(80))
    short_name: Mapped[str] = mapped_column(String(40))
    brand: Mapped[str] = mapped_column(String(8), index=True)
    district: Mapped[str] = mapped_column(ForeignKey("district.name"), index=True)
    depot: Mapped[str] = mapped_column(String(16), index=True)
    dock_type: Mapped[str] = mapped_column(String(12))
    parking_constraint: Mapped[str] = mapped_column(String(12))
    mall_window: Mapped[str | None] = mapped_column(String(11))
    window_open: Mapped[str] = mapped_column(String(5))
    window_close: Mapped[str] = mapped_column(String(5))


class Vehicle(Base):
    __tablename__ = "vehicle"

    vehicle_id: Mapped[str] = mapped_column(String(8), primary_key=True)
    type: Mapped[str] = mapped_column(String(8))
    temp: Mapped[str] = mapped_column(String(8))
    weight_cap_kg: Mapped[float] = mapped_column(Numeric(8, 1, asdecimal=False))
    volume_cap_m3: Mapped[float] = mapped_column(Numeric(6, 2, asdecimal=False))
    fuel_type: Mapped[str] = mapped_column(String(12))
    km_per_l: Mapped[float] = mapped_column(Numeric(5, 2, asdecimal=False))
    weekly_fuel_quota_l: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))
    depot: Mapped[str] = mapped_column(String(16), index=True)


class CalendarDay(Base):
    __tablename__ = "calendar_day"

    date: Mapped[date] = mapped_column(Date, primary_key=True)
    dow: Mapped[int] = mapped_column(SmallInteger)
    dow_name: Mapped[str] = mapped_column(String(3))
    is_weekend: Mapped[bool]
    iso_year: Mapped[int] = mapped_column(SmallInteger)
    iso_week: Mapped[int] = mapped_column(SmallInteger)
    is_payday: Mapped[bool]
    festival: Mapped[str | None] = mapped_column(String(24))
    festival_ramp: Mapped[float] = mapped_column(Numeric(3, 1, asdecimal=False))
    is_holiday: Mapped[bool]
    monsoon: Mapped[bool]
    is_operating: Mapped[bool]


class ServiceAllowance(Base):
    __tablename__ = "service_allowance"

    brand: Mapped[str] = mapped_column(String(8), primary_key=True)
    dock_type: Mapped[str] = mapped_column(String(12), primary_key=True)
    minutes: Mapped[int]


class TrafficSpeed(Base):
    """Typical congestion by district and hour; 100 is free flow."""

    __tablename__ = "traffic_speed"

    district: Mapped[str] = mapped_column(ForeignKey("district.name"), primary_key=True)
    hour: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    monsoon: Mapped[bool] = mapped_column(primary_key=True)
    speed_index: Mapped[float] = mapped_column(Numeric(5, 1, asdecimal=False))


class RoadCondition(Base):
    """Date-specific disruption by district; 100 is a clear road."""

    __tablename__ = "road_condition"

    district: Mapped[str] = mapped_column(ForeignKey("district.name"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    disruption_index: Mapped[float] = mapped_column(Numeric(5, 1, asdecimal=False))


class CaseType(Base):
    """Standard case types a store orders in, so the planner gets real weight and volume."""

    __tablename__ = "case_type"

    code: Mapped[str] = mapped_column(String(24), primary_key=True)
    name: Mapped[str] = mapped_column(String(40))
    brand: Mapped[str] = mapped_column(String(8))
    temp: Mapped[str] = mapped_column(String(8))
    kg: Mapped[float] = mapped_column(Numeric(7, 2, asdecimal=False))
    m3: Mapped[float] = mapped_column(Numeric(7, 4, asdecimal=False))
    load_rank: Mapped[int] = mapped_column(SmallInteger, default=0)
    """Heaviest first within a stop: lower loads first."""


class UsualRun(Base):
    """What a vehicle usually does on a weekday, learned from the route history."""

    __tablename__ = "usual_run"

    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicle.vehicle_id"), primary_key=True)
    dow_name: Mapped[str] = mapped_column(String(3), primary_key=True)
    trip_no: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    brand: Mapped[str] = mapped_column(String(8))
    temp: Mapped[str] = mapped_column(String(8))
    district: Mapped[str] = mapped_column(ForeignKey("district.name"))
    share: Mapped[float] = mapped_column(Numeric(4, 3, asdecimal=False))
    """How often this vehicle ran this trip on that weekday in the history."""


class OrderStream(Base):
    """A store that orders on this weekday, with this temperature, in nearly every week of the history.
    The order queue uses it to list the stores that have not ordered yet."""

    __tablename__ = "order_stream"

    dow_name: Mapped[str] = mapped_column(String(3), primary_key=True)
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlet.outlet_id"), primary_key=True)
    temp: Mapped[str] = mapped_column(String(8), primary_key=True)


class ServiceHistory(Base):
    """Each store's last delivery before the story day, and whether its last order waited.
    Relay's second rule protects a store whose last order waited."""

    __tablename__ = "service_history"

    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlet.outlet_id"), primary_key=True)
    temp: Mapped[str] = mapped_column(String(8), primary_key=True)
    last_delivered: Mapped[date | None] = mapped_column(Date)
    deferred_on: Mapped[date | None] = mapped_column(Date)


class OutletDwell(Base):
    """Each store's usual unloading time in minutes, from the route history (Relay's Expected clock)."""

    __tablename__ = "outlet_dwell"

    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlet.outlet_id"), primary_key=True)
    monsoon: Mapped[bool] = mapped_column(primary_key=True)
    p10: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
    p50: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
    p90: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
