"""Every trip one vehicle could run: a set of orders of one brand and temperature, in one district, that fits
some vehicle, the time budget and every store window at free flow.

For a district with up to EXHAUSTIVE orders the search walks every subset, and stops extending a set as soon
as it breaks a limit, because adding a stop never makes a trip lighter, shorter or earlier. Larger districts
get every set of up to SMALL_SET orders plus every run of consecutive orders in two natural stop orders,
which is where good trips come from.
"""

from __future__ import annotations

import itertools
from collections.abc import Sequence
from dataclasses import dataclass

from relay_engine.clock import (
    FREE_FLOW,
    LATEST_FRESH_DEPARTURE,
    Conditions,
    choose_departure,
    free_flow,
    latest_departure,
    quick_fit,
)
from relay_engine.model import EARLIEST_DEPARTURE, Order
from relay_engine.network import Brand, Network, Temp
from relay_engine.standard import budget_for, trip_minutes

DAYTIME_LATEST_DEPARTURE = 17 * 60
EXHAUSTIVE = 12
SMALL_SET = 4


@dataclass(frozen=True, slots=True)
class Option:
    orders: tuple[str, ...]
    outlets: tuple[str, ...]
    """In earliest-close order."""
    brand: Brand
    temp: Temp
    district: str
    weight_kg: float
    volume_m3: float
    van_only: bool
    minutes: int
    """The published standard for this trip."""
    earliest_back: float
    """Back at the depot at free flow when leaving as soon as the vehicle is ready, by the better simple stop order."""
    preferred_depart: int
    """When Relay would send it as a first trip (see clock.choose_departure)."""
    preferred_back: float
    """Back at the depot at free flow after leaving at preferred_depart."""
    latest_depart: int | None
    """The latest departure that still keeps every window, for use as a second trip."""
    km: float

    @property
    def size(self) -> int:
        return len(self.orders)


def group_key(network: Network, order: Order) -> tuple[Brand, Temp, str]:
    return order.brand, order.temp, network.outlets[order.outlet_id].district


def enumerate_options(
    network: Network,
    orders: Sequence[Order],
    *,
    max_weight: float,
    max_volume: float,
    conditions: Conditions = FREE_FLOW,
    ready: int = EARLIEST_DEPARTURE,
) -> list[Option]:
    groups: dict[tuple[Brand, Temp, str], list[Order]] = {}
    for order in orders:
        groups.setdefault(group_key(network, order), []).append(order)
    options: list[Option] = []
    for (brand, temp, district), members in sorted(groups.items()):
        members.sort(key=lambda o: (*network.outlets[o.outlet_id].receiving_window[::-1], o.order_id))
        builder = _Builder(network, conditions, brand, temp, district, max_weight, max_volume, ready)
        if len(members) <= EXHAUSTIVE:
            builder.walk(members)
        else:
            builder.sample(members)
        options.extend(builder.found.values())
    return options


class _Builder:
    def __init__(
        self,
        network: Network,
        conditions: Conditions,
        brand: Brand,
        temp: Temp,
        district: str,
        max_weight: float,
        max_volume: float,
        ready: int,
    ) -> None:
        self.network = network
        self.conditions = conditions
        self.brand = brand
        self.temp = temp
        self.district = district
        self.max_weight = max_weight
        self.max_volume = max_volume
        self.ready = ready
        self.budget = budget_for(brand)
        self.latest = LATEST_FRESH_DEPARTURE if brand is Brand.FRESH else DAYTIME_LATEST_DEPARTURE
        self.found: dict[tuple[str, ...], Option] = {}

    def make(self, members: Sequence[Order]) -> Option | None:
        """The option for exactly these orders, or None when they break a limit."""
        network = self.network
        weight = sum(o.weight_kg for o in members)
        volume = sum(o.volume_m3 for o in members)
        if weight > self.max_weight + 1e-6 or volume > self.max_volume + 1e-9:
            return None
        outlets = [o.outlet_id for o in members]
        if len(set(outlets)) != len(outlets):
            return None  # one order per store and temperature on a trip
        minutes = trip_minutes(network, self.district, self.brand, [network.outlets[o].dock_type for o in outlets])
        if minutes > self.budget:
            return None
        ok, earliest_back = quick_fit(network, outlets, self.brand, self.ready)
        if not ok:
            return None
        edd = _edd(network, outlets)
        last = latest_departure(network, edd, self.brand, self.ready, self.latest)
        if last is None:
            return None
        depart = choose_departure(network, self.conditions, edd, self.brand, self.ready, last)
        _, back = free_flow(network, edd, depart, self.brand)
        d = network.districts[self.district]
        key = tuple(sorted(o.order_id for o in members))
        return Option(
            orders=key,
            outlets=tuple(edd),
            brand=self.brand,
            temp=self.temp,
            district=self.district,
            weight_kg=round(weight, 3),
            volume_m3=round(volume, 4),
            van_only=any(network.outlets[o].van_only for o in outlets),
            minutes=minutes,
            earliest_back=earliest_back,
            preferred_depart=depart,
            preferred_back=back,
            latest_depart=last,
            km=2 * d.depot_to_district_km + (len(outlets) - 1) * d.inter_stop_km,
        )

    def add(self, members: Sequence[Order]) -> bool:
        key = tuple(sorted(o.order_id for o in members))
        if key in self.found:
            return True
        option = self.make(members)
        if option is None:
            return False
        self.found[key] = option
        return True

    def walk(self, members: Sequence[Order]) -> None:
        def visit(start: int, chosen: list[Order]) -> None:
            for i in range(start, len(members)):
                current = [*chosen, members[i]]
                if self.add(current):
                    visit(i + 1, current)

        visit(0, [])

    def sample(self, members: Sequence[Order]) -> None:
        for size in range(1, SMALL_SET + 1):
            for combo in itertools.combinations(members, size):
                self.add(combo)
        by_open = sorted(members, key=lambda o: (*self.network.outlets[o.outlet_id].receiving_window, o.order_id))
        for ordering in (list(members), by_open):
            for i in range(len(ordering)):
                for j in range(i + SMALL_SET + 1, len(ordering) + 1):
                    if not self.add(ordering[i:j]):
                        break


def _edd(network: Network, outlets: Sequence[str]) -> list[str]:
    return sorted(outlets, key=lambda o: (*network.outlets[o].receiving_window[::-1], o))
