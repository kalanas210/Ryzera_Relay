"""The fixed network the engine plans on: districts, outlets, vehicles and handling allowances.

Everything here mirrors the organizers' reference tables (outlets.csv, vehicles.csv,
district_travel.csv, service_allowance.csv). Clock times are whole minutes after midnight
of the delivery day, so 4:00 AM is 240 and 7:45 AM is 465.
"""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass
from enum import StrEnum


class Brand(StrEnum):
    FRESH = "Fresh"
    STYLE = "Style"
    TECH = "Tech"


class Temp(StrEnum):
    AMBIENT = "ambient"
    CHILLED = "chilled"


class DockType(StrEnum):
    REAR_DOCK = "rear_dock"
    STREET = "street"
    MALL_BAY = "mall_bay"


class Parking(StrEnum):
    NORMAL = "normal"
    VAN_ONLY = "van_only"
    MALL_DOCK = "mall_dock"


class VehicleType(StrEnum):
    TRUCK = "truck"
    VAN = "van"


class VehicleTemp(StrEnum):
    REEFER = "reefer"
    AMBIENT = "ambient"


def clock_to_minutes(text: str) -> int:
    """'07:45' becomes 465."""
    hours, minutes = text.split(":")
    return int(hours) * 60 + int(minutes)


def minutes_to_clock(value: float) -> str:
    """465 becomes '07:45'. Minutes past midnight of the next day wrap around."""
    whole = round(value)
    return f"{(whole // 60) % 24:02d}:{whole % 60:02d}"


@dataclass(frozen=True, slots=True)
class District:
    name: str
    depot: str
    road_class: str
    free_flow_kmh: float
    depot_to_district_km: float
    depot_to_district_min: int
    inter_stop_km: float
    inter_stop_min: int


@dataclass(frozen=True, slots=True)
class Outlet:
    outlet_id: str
    brand: Brand
    district: str
    depot: str
    dock_type: DockType
    parking: Parking
    window_open: int
    window_close: int
    mall_window: tuple[int, int] | None = None
    name: str = ""

    @property
    def van_only(self) -> bool:
        return self.parking is Parking.VAN_ONLY

    @property
    def receiving_window(self) -> tuple[int, int]:
        """The time goods can be received: the requested window, narrowed to the mall's access window."""
        if self.parking is Parking.MALL_DOCK and self.mall_window is not None:
            return max(self.window_open, self.mall_window[0]), min(self.window_close, self.mall_window[1])
        return self.window_open, self.window_close


@dataclass(frozen=True, slots=True)
class Vehicle:
    vehicle_id: str
    type: VehicleType
    temp: VehicleTemp
    weight_cap_kg: float
    volume_cap_m3: float
    km_per_l: float
    weekly_fuel_quota_l: float
    depot: str

    @property
    def is_van(self) -> bool:
        return self.type is VehicleType.VAN

    @property
    def refrigerated(self) -> bool:
        return self.temp is VehicleTemp.REEFER


@dataclass(frozen=True, slots=True)
class Network:
    districts: Mapping[str, District]
    outlets: Mapping[str, Outlet]
    vehicles: Mapping[str, Vehicle]
    allowance: Mapping[tuple[Brand, DockType], int]

    def handling_minutes(self, brand: Brand, outlet_id: str) -> int:
        """The dispatcher's standard handling allowance for one stop (service_allowance.csv)."""
        return self.allowance[(brand, self.outlets[outlet_id].dock_type)]
