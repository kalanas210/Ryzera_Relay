"""What the engine plans with and what it returns. Plain data, no behaviour."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum

from relay_engine.network import Brand, Temp

EARLIEST_DEPARTURE = 120
"""2:00 AM: the earliest planned depot departure in the route history."""

RELOAD_MINUTES = 10
"""At the dock between a vehicle's two trips."""


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
    STANDBY = "standby"
    """Kept free for the unexpected; the proposal leaves it alone."""


@dataclass(frozen=True, slots=True)
class VehicleDay:
    vehicle_id: str
    status: VehicleStatus = VehicleStatus.AVAILABLE
    fuel_used_l: float = 0.0
    """Litres already used earlier in the same ISO week."""
    ready_at: int = EARLIEST_DEPARTURE


@dataclass(frozen=True, slots=True)
class UsualTrip:
    """What a vehicle usually does on this weekday, learned from the route history."""

    vehicle_id: str
    trip_no: int
    brand: Brand
    temp: Temp
    district: str
    share: float
    outlets: frozenset[str] = frozenset()
    """The stores this trip visits on at least half of those weeks."""


@dataclass(slots=True)
class Trip:
    """One vehicle trip: one brand, one district, the orders in delivery order, and when it leaves."""

    vehicle_id: str
    trip_no: int
    order_ids: list[str]
    depart: int | None = None
    """Minutes after midnight. None lets the clock choose."""
    locked: bool = False
    """Placed by hand; the proposal keeps it as it is."""

    @property
    def key(self) -> tuple[str, int]:
        return self.vehicle_id, self.trip_no


class Severity(StrEnum):
    BROKEN = "broken"
    """The plan cannot be published while this holds."""
    NOTE = "note"


@dataclass(frozen=True, slots=True)
class RuleResult:
    rule: int
    """1 to 11, as numbered on the plan board."""
    name: str
    passed: bool
    message: str
    """Plain words for the dispatcher: 'Weight: 1,460.8 of 1,040 kg'."""


@dataclass(frozen=True, slots=True)
class StopTiming:
    order_id: str
    outlet_id: str
    arrive: float
    start: float
    """Unloading starts at the arrival, or when the store opens if the vehicle is early."""
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
    """The vehicle's usual run for this weekday and trip."""

    @property
    def broken(self) -> list[RuleResult]:
        return [r for r in self.rules if not r.passed]


@dataclass(slots=True)
class VehicleReport:
    vehicle_id: str
    fresh_minutes: int
    daytime_minutes: int
    fuel_week_l: float
    """Used earlier this week plus this day's trips."""
    fuel_quota_l: float
    trips: int


@dataclass(slots=True)
class Deferred:
    order_id: str
    unavoidable: bool
    """True when no allocation could serve it; False when Relay chose it among orders that could wait."""
    rule: int | None
    """Which of the three deferral rules decided the choice."""
    reason: str


@dataclass(slots=True)
class GroupAnalysis:
    """Why a group of orders (a depot's chilled or ambient orders) could not all travel."""

    depot: str
    temp_class: str
    orders: int
    max_served: int
    """The most orders any allocation that keeps every rule could serve."""
    unavoidable: int
    pool: list[str] = field(default_factory=list)
    """Orders that could have been the one to wait (each alone, keeping max_served)."""
    pool_keeping_usual_runs: list[str] = field(default_factory=list)
    protected: list[str] = field(default_factory=list)
    limiting: list[str] = field(default_factory=list)
    """Vehicles out of service that would have carried these orders."""


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
