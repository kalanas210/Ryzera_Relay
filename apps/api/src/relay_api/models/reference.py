"""The shared network, loaded from the organizers' reference tables. The same in every workspace."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

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


class UsualStop(Base):
    """The stores a vehicle's usual trip visits on a weekday, per run it makes (brand, temperature, district),
    learned from the route history. The proposal keeps vehicles on these runs first (Relay's rule 1)."""

    __tablename__ = "usual_stop"

    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicle.vehicle_id"), primary_key=True)
    dow_name: Mapped[str] = mapped_column(String(3), primary_key=True)
    trip_no: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    brand: Mapped[str] = mapped_column(String(8), primary_key=True)
    temp: Mapped[str] = mapped_column(String(8), primary_key=True)
    district: Mapped[str] = mapped_column(ForeignKey("district.name"), primary_key=True)
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlet.outlet_id"), primary_key=True)
    share: Mapped[float] = mapped_column(Numeric(4, 3, asdecimal=False))
    run_share: Mapped[float] = mapped_column(Numeric(4, 3, asdecimal=False))
    """How often the vehicle makes this run on that weekday."""


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


class HubStock(Base):
    """What a hub's store holds of a case type for a run beyond the night's picks, and when the supplier's next
    drop arrives. The dispatcher reads it when the dock flags cases missing: a spare, or a delivery before the
    truck leaves, is worth holding the truck for."""

    __tablename__ = "hub_stock"

    depot: Mapped[str] = mapped_column(String(16), primary_key=True)
    case_type: Mapped[str] = mapped_column(ForeignKey("case_type.code"), primary_key=True)
    run_date: Mapped[date] = mapped_column(Date, primary_key=True)
    spare: Mapped[int]
    next_delivery_at: Mapped[datetime | None]


class OutlookForecast(Base):
    """A depot's demand forecast for the capacity outlook (DSP-05): when it was made, what an ordinary week is, and
    how well the method did. The forecast (the Datathon's method) and the fewest-vehicles search need the order
    history, which the app never holds, so the seed carries their answers. A depot without a row has no outlook."""

    __tablename__ = "outlook_forecast"

    depot: Mapped[str] = mapped_column(String(16), primary_key=True)
    forecast_updated: Mapped[date] = mapped_column(Date)
    baseline_year: Mapped[int] = mapped_column(SmallInteger)
    baseline_first_week: Mapped[int] = mapped_column(SmallInteger)
    baseline_last_week: Mapped[int] = mapped_column(SmallInteger)
    """The ISO weeks an ordinary week is averaged over."""
    backtest_year: Mapped[int] = mapped_column(SmallInteger)
    backtest_first_week: Mapped[int] = mapped_column(SmallInteger)
    backtest_last_week: Mapped[int] = mapped_column(SmallInteger)
    backtest_pct: Mapped[float] = mapped_column(Numeric(4, 1, asdecimal=False))
    """The method's mean weekly miss on the depot's Fresh volume over the backtest weeks, in %."""
    last_year_pct: Mapped[float] = mapped_column(Numeric(4, 1, asdecimal=False))
    """The same for "same week last year times growth"."""
    ordinary_week_m3: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))
    """Chilled m³ in an ordinary week of the baseline."""
    record_week_m3: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))
    record_year: Mapped[int] = mapped_column(SmallInteger)
    record_week: Mapped[int] = mapped_column(SmallInteger)
    """The depot's highest chilled week on record."""
    tech_order_max_m3: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
    """The largest single Tech order in the depot's history."""


class OutlookWeek(Base):
    """Forecast demand at a depot for one ISO week, in m³ per group, counted over the week's open days."""

    __tablename__ = "outlook_week"

    depot: Mapped[str] = mapped_column(ForeignKey("outlook_forecast.depot"), primary_key=True)
    iso_year: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    iso_week: Mapped[int] = mapped_column(SmallInteger, primary_key=True)
    chilled_m3: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))
    dry_m3: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))
    style_m3: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))
    tech_m3: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))


class OutlookDay(Base):
    """One open day at a depot: its forecast chilled orders, the fewest refrigerated vehicles that carry them all on
    Relay's clock (exact search under the plan's rules), and the refrigerated vehicles out of service that day."""

    __tablename__ = "outlook_day"

    depot: Mapped[str] = mapped_column(ForeignKey("outlook_forecast.depot"), primary_key=True)
    date: Mapped[date] = mapped_column(Date, primary_key=True)
    chilled_orders: Mapped[int] = mapped_column(SmallInteger)
    chilled_kg: Mapped[float] = mapped_column(Numeric(8, 1, asdecimal=False))
    chilled_m3: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
    needed: Mapped[int] = mapped_column(SmallInteger)
    in_workshop: Mapped[list[Any]] = mapped_column(default=list)
    """Vehicle IDs."""
    served_one_fewer: Mapped[int | None] = mapped_column(SmallInteger)
    """Chilled orders that one refrigerated vehicle fewer than needed can serve, on the days the search counted it."""


class OutletDwell(Base):
    """Each store's usual unloading time in minutes, from the route history (Relay's Expected clock)."""

    __tablename__ = "outlet_dwell"

    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlet.outlet_id"), primary_key=True)
    monsoon: Mapped[bool] = mapped_column(primary_key=True)
    p10: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
    p50: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
    p90: Mapped[float] = mapped_column(Numeric(6, 1, asdecimal=False))
