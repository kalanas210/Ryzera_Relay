"""The exact search: choose trips for vehicles from the enumerated options, as a small integer program.

Variables are (vehicle, trip 1 or 2, option). Each order rides at most once. A vehicle runs a second trip
only after a first, within its Fresh and daytime budgets, and the second trip must be able to leave at
least 10 minutes after the first is back (Relay's clock). Fuel stays within what is left of the week's
quota. Capacity, van-only access and temperature decide which options a vehicle may take at all.

It answers two questions in turn: how many orders can travel at most (what is unavoidable), and, keeping
that many, which allocation best follows Relay's rules (what is Relay's choice).
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass, field

import numpy as np
from scipy.optimize import Bounds, LinearConstraint, milp
from scipy.sparse import lil_matrix

from relay_engine.model import RELOAD_MINUTES, UsualTrip, VehicleDay, VehicleStatus
from relay_engine.network import Brand, Network, Temp, Vehicle, VehicleType
from relay_engine.options import Option
from relay_engine.standard import DAYTIME_BUDGET_MIN, FRESH_BUDGET_MIN

BIG = 5000.0


@dataclass(frozen=True, slots=True)
class Slot:
    vehicle_id: str
    trip_no: int
    option: Option


@dataclass(slots=True)
class Solution:
    slots: list[Slot]
    served: set[str]
    usual_kept: float = 0.0
    weight_kg: float = 0.0

    @property
    def count(self) -> int:
        return len(self.served)


@dataclass
class Problem:
    """One depot's vehicles and the options they could run, ready to solve many ways."""

    network: Network
    options: Sequence[Option]
    vehicles: Sequence[VehicleDay]
    usual: Mapping[str, Sequence[UsualTrip]] = field(default_factory=dict)
    scope: str = "joint"
    """joint: usual runs, runs whose usual vehicles are out, and spares anywhere. usual: each vehicle's usual runs
    exactly (the stores it usually serves that ordered today). open: any vehicle anywhere (for leftovers)."""
    booked: Mapping[str, float] = field(default_factory=dict)
    """Vehicles that already run a first trip: the time they are back, so only a second trip can be added."""
    booked_usage: Mapping[str, tuple[int, int, float]] = field(default_factory=dict)
    booked_preferred: Mapping[str, float] = field(default_factory=dict)
    """For booked vehicles: when their first trip is back if it keeps Relay's usual departure."""
    first_back: str = "earliest"
    """How a second trip is timed against the first. earliest: the first trip may leave as soon as the vehicle is
    ready, which squeezes the most out of scarce refrigerated vehicles. preferred: the first trip keeps Relay's
    usual departure, so a second trip is only planned when it fits after that."""
    """For booked vehicles: Fresh minutes, daytime minutes and litres their first trip already uses."""
    slots: list[Slot] = field(default_factory=list)

    def __post_init__(self) -> None:
        present: dict[tuple[Brand, Temp, str], set[str]] = {}
        for option in self.options:
            present.setdefault((option.brand, option.temp, option.district), set()).update(option.outlets)
        self._present = present
        available = {d.vehicle_id for d in self.vehicles if d.status is VehicleStatus.AVAILABLE}
        carriers: dict[tuple[Brand, Temp, str], set[str]] = {}
        for vehicle_id, trips in self.usual.items():
            for u in trips:
                carriers.setdefault((u.brand, u.temp, u.district), set()).add(vehicle_id)
        self._covered = {group for group, vs in carriers.items() if vs & available}
        self.slots = [s for v in self.vehicles if v.status is VehicleStatus.AVAILABLE for s in self._slots_for(v)]
        if self.scope == "usual":
            self.slots = [s for s in self.slots if self.usual_bonus(s) > 0]

    def _districts_for(self, vehicle_id: str) -> set[tuple[Brand, Temp, str]] | None:
        """Where the proposal may send a vehicle. None means anywhere."""
        if self.scope == "open":
            return None
        mine = {(u.brand, u.temp, u.district) for u in self.usual.get(vehicle_id, ())}
        if self.scope == "usual":
            return mine
        if not mine:
            return None  # a spare on this weekday
        return mine | {g for g in self._present if g not in self._covered}

    def _slots_for(self, day: VehicleDay) -> Iterable[Slot]:
        vehicle = self.network.vehicles[day.vehicle_id]
        fuel_left = vehicle.weekly_fuel_quota_l - day.fuel_used_l
        allowed = self._districts_for(day.vehicle_id)
        for option in self.options:
            if allowed is not None and (option.brand, option.temp, option.district) not in allowed:
                continue
            if not eligible(vehicle, option):
                continue
            if option.km / vehicle.km_per_l > fuel_left + 1e-6:
                continue
            if option.latest_depart is None:
                continue
            if day.vehicle_id in self.booked:
                if option.latest_depart >= self.booked[day.vehicle_id] + RELOAD_MINUTES:
                    yield Slot(day.vehicle_id, 2, option)
                continue
            if option.latest_depart < day.ready_at:
                continue
            yield Slot(day.vehicle_id, 1, option)
            yield Slot(day.vehicle_id, 2, option)

    def usual_bonus(self, slot: Slot) -> float:
        """How strongly this trip keeps the vehicle on its usual run: the share of weekdays it makes that run, when
        the trip carries the stores it usually serves on it, as many of them as ordered today, and no others."""
        opt = slot.option
        today = self._present.get((opt.brand, opt.temp, opt.district), set())
        best = 0.0
        for u in self.usual.get(slot.vehicle_id, ()):
            if u.brand is not opt.brand or u.temp is not opt.temp or u.district != opt.district:
                continue
            expected_stores = u.outlets & today if u.outlets else today
            if expected_stores and set(opt.outlets) == expected_stores:
                best = max(best, u.share)
        return best

    def pulled(self, slot: Slot) -> bool:
        """A second trip on a vehicle that already runs a first one, which only fits if that first trip leaves
        earlier than Relay would send it."""
        if slot.vehicle_id not in self.booked_preferred:
            return False
        return (slot.option.latest_depart or 0) < self.booked_preferred[slot.vehicle_id] + RELOAD_MINUTES

    def solve(
        self,
        *,
        maximize: str = "served",
        min_served: int | None = None,
        forbid: Iterable[str] = (),
        force: Iterable[str] = (),
        time_limit: float = 30.0,
    ) -> Solution | None:
        forbid, force = set(forbid), set(force)
        slots = [s for s in self.slots if not (set(s.option.orders) & forbid)]
        if not slots:
            return Solution([], set()) if not force else None
        orders = sorted({o for s in slots for o in s.option.orders} | force)
        index = {o: i for i, o in enumerate(orders)}
        vehicles = sorted({s.vehicle_id for s in slots})
        n = len(slots)
        rows = len(orders) + 6 * len(vehicles) + 1
        a = lil_matrix((rows, n))
        lo: list[float] = []
        hi: list[float] = []

        for k, slot in enumerate(slots):
            for o in slot.option.orders:
                a[index[o], k] = 1
        for o in orders:
            lo.append(1 if o in force else 0)
            hi.append(1)
        r = len(orders)
        by_vehicle: dict[str, list[int]] = {}
        for k, slot in enumerate(slots):
            by_vehicle.setdefault(slot.vehicle_id, []).append(k)
        for vehicle_id in vehicles:
            vehicle = self.network.vehicles[vehicle_id]
            day = next(d for d in self.vehicles if d.vehicle_id == vehicle_id)
            for k in by_vehicle[vehicle_id]:
                slot = slots[k]
                opt = slot.option
                first = slot.trip_no == 1
                a[r, k] = 1 if first else 0  # at most one first trip
                a[r + 1, k] = -1 if first else 1  # a second trip needs a first
                if opt.brand is Brand.FRESH:
                    a[r + 2, k] = opt.minutes
                else:
                    a[r + 3, k] = opt.minutes
                if first:
                    back = opt.preferred_back if self.first_back == "preferred" else opt.earliest_back
                    a[r + 4, k] = back + max(0.0, day.ready_at - 120.0) + RELOAD_MINUTES
                else:
                    a[r + 4, k] = BIG - float(opt.latest_depart or 0)
                a[r + 5, k] = opt.km / vehicle.km_per_l
            booked = vehicle_id in self.booked
            used = self.booked_usage.get(vehicle_id, (0, 0, 0.0))
            lo += [0, -np.inf, 0, 0, -np.inf, 0]
            hi += [
                1,
                1 if booked else 0,
                FRESH_BUDGET_MIN - used[0],
                DAYTIME_BUDGET_MIN - used[1],
                BIG,
                vehicle.weekly_fuel_quota_l - day.fuel_used_l - used[2],
            ]
            r += 6
        sizes = np.array([s.option.size for s in slots], dtype=float)
        if min_served is not None:
            for k in range(n):
                a[r, k] = sizes[k]
            lo.append(min_served)
            hi.append(np.inf)
            r += 1
        a = a[:r].tocsr()

        if maximize == "served":
            c = -sizes
        else:
            usual = np.array([self.usual_bonus(s) for s in slots], dtype=float)
            weight = np.array([s.option.weight_kg for s in slots], dtype=float)
            pulled = np.array([1.0 if self.pulled(s) else 0.0 for s in slots])
            # Relay's rules in order: don't pull a driver out early for a second trip another vehicle can run, keep
            # vehicles on their usual runs, move the most goods, then use fewer trips.
            c = pulled * 2e7 - (usual * 1e7 + weight * 10.0) + 1.0
        result = milp(
            c,
            constraints=[LinearConstraint(a, np.array(lo[:r]), np.array(hi[:r]))],
            integrality=np.ones(n),
            bounds=Bounds(0, 1),
            options={"time_limit": time_limit, "disp": False},
        )
        if result.x is None:
            return None
        chosen = [slots[k] for k in range(n) if result.x[k] > 0.5]
        served = {o for s in chosen for o in s.option.orders}
        kept = round(sum(self.usual_bonus(s) for s in chosen), 6)
        return Solution(chosen, served, kept, round(sum(s.option.weight_kg for s in chosen), 1))


def eligible(vehicle: Vehicle, option: Option) -> bool:
    """Capacity, access and temperature: may this vehicle run this trip at all."""
    if option.weight_kg > vehicle.weight_cap_kg + 1e-6 or option.volume_m3 > vehicle.volume_cap_m3 + 1e-9:
        return False
    if option.van_only and vehicle.type is not VehicleType.VAN:
        return False
    if option.temp is Temp.CHILLED:
        return vehicle.refrigerated
    # Refrigerated vehicles stay free for chilled goods: Fresh dry, Style and Tech go on ambient vehicles.
    return not vehicle.refrigerated
