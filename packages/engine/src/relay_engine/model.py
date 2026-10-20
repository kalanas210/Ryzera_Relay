"""What the engine plans with and what it returns. Plain data, no behaviour."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from relay_engine.network import Brand, Temp

# 2:00 AM, the earliest planned depot departure in the route history
EARLIEST_DEPARTURE = 120

RELOAD_MINUTES = 10


@dataclass(frozen=True, slots=True)
class Order:
    order_id: str
    outlet_id: str
    brand: Brand
    temp: Temp
    units: int
    weight_kg: float
    volume_m3: float


class VehicleStatus(StrEnum):
    AVAILABLE = "available"
    WORKSHOP = "workshop"
    # kept free for the unexpected, the proposal leaves it alone
    STANDBY = "standby"


@dataclass(frozen=True, slots=True)
class VehicleDay:
    vehicle_id: str
    status: VehicleStatus = VehicleStatus.AVAILABLE
    fuel_used_l: float = 0.0
    ready_at: int = EARLIEST_DEPARTURE


@dataclass(frozen=True, slots=True)
class UsualTrip:
    vehicle_id: str
    trip_no: int
    brand: Brand
    temp: Temp
    district: str
    share: float
    # stores this trip visits on at least half of those weeks
    outlets: frozenset[str] = frozenset()


@dataclass(slots=True)
class Trip:
    vehicle_id: str
    trip_no: int
    order_ids: list[str]
    # minutes after midnight, None lets the clock choose
    depart: int | None = None
    locked: bool = False

    @property
    def key(self) -> tuple[str, int]:
        return self.vehicle_id, self.trip_no


class Severity(StrEnum):
    BROKEN = "broken"
    NOTE = "note"


@dataclass(frozen=True, slots=True)
class RuleResult:
    # 1 to 11, as numbered on the plan board
    rule: int
    name: str
    passed: bool
    message: str


@dataclass(frozen=True, slots=True)
class StopTiming:
    order_id: str
    outlet_id: str
    arrive: float
    # unloading starts at the arrival, or when the store opens if the vehicle is early
    start: float
    leave: float


@dataclass(slots=True)
class TripReport:
    trip: Trip
    brand: Brand
    temp: Temp
    district: str
    depart: int
    planned: list[StopTiming]
    back: float
    expected: list[StopTiming]
    expected_back: float
    weight_kg: float
    volume_m3: float
    units: int
    standard_minutes: int
    litres: float
    rules: list[RuleResult]
    usual: bool

    @property
    def broken(self) -> list[RuleResult]:
        return [r for r in self.rules if not r.passed]


@dataclass(slots=True)
class VehicleReport:
    vehicle_id: str
    fresh_minutes: int
    daytime_minutes: int
    fuel_week_l: float
    fuel_quota_l: float
    trips: int


@dataclass(slots=True)
class Deferred:
    order_id: str
    # True when no allocation could serve it, False when Relay chose it among orders that could wait
    unavoidable: bool
    rule: int | None
    reason: str


@dataclass(slots=True)
class GroupAnalysis:
    depot: str
    temp_class: str
    orders: int
    max_served: int
    unavoidable: int
    pool: list[str] = field(default_factory=list)
    pool_keeping_usual_runs: list[str] = field(default_factory=list)
    protected: list[str] = field(default_factory=list)
    limiting: list[str] = field(default_factory=list)


@dataclass(slots=True)
class PlanResult:
    trips: list[TripReport]
    vehicles: dict[str, VehicleReport]
    deferred: list[Deferred]
    unplaced: list[str]
    analyses: list[GroupAnalysis]

    @property
    def broken(self) -> list[tuple[TripReport, RuleResult]]:
        return [(t, r) for t in self.trips for r in t.broken]
