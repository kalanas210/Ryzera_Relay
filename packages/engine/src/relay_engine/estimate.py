"""Where a run is, and when each store can expect it, from the last thing Relay heard.
The estimate moves only when a stop event arrives. Time passing alone never pushes it later."""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from relay_engine.clock import Conditions
from relay_engine.network import Brand, Network

RANGE_BASE_MINUTES = 15.0


# A store's confirmed receipt counts as a delivery at the receipt time.
@dataclass(frozen=True, slots=True)
class LastEvent:
    kind: Literal["departed", "arrived", "delivered"]
    # minutes after midnight of the run date
    at: float
    outlet_id: str | None = None


def round5(minutes: float) -> float:
    return round(minutes / 5) * 5


def floor5(minutes: float) -> float:
    return math.floor(minutes / 5 + 1e-9) * 5


def ceil5(minutes: float) -> float:
    return math.ceil(minutes / 5 - 1e-9) * 5


# Start from the last stop event Relay has. If it was an arrival, add the store's usual unloading time.
# Then drive each leg on the expected clock and add the usual unloading time at each store between.
def estimate_after(
    network: Network, conditions: Conditions, brand: Brand, remaining: Sequence[str], last: LastEvent
) -> list[float]:
    if not remaining:
        return []
    district = network.districts[network.outlets[remaining[0]].district]
    t = float(last.at)
    if last.kind == "arrived" and last.outlet_id is not None:
        opens, _ = network.outlets[last.outlet_id].receiving_window
        t = max(t, opens) + conditions.unloading(network, brand, last.outlet_id)
    out = []
    for i, outlet_id in enumerate(remaining):
        drive = district.depot_to_district_min if (i == 0 and last.kind == "departed") else district.inter_stop_min
        t += drive * conditions.factor(district.name, t)
        out.append(t)
        opens, _ = network.outlets[outlet_id].receiving_window
        t = max(t, opens) + conditions.unloading(network, brand, outlet_id)
    return out


# Out of contact: 15 min either side plus half the silence, rounded out to 5 min, never before now.
def likely_range(estimate: float, silent_minutes: float, now: float) -> tuple[float, float]:
    rounded = round5(estimate)
    half = RANGE_BASE_MINUTES + max(0.0, silent_minutes) / 2
    low = max(floor5(rounded - half), ceil5(now))
    high = ceil5(rounded + half)
    return low, max(low, high)


Position = tuple[Literal["unloading", "on_the_road", "at_depot", "unknown"], str | None]


def position(
    network: Network, conditions: Conditions, brand: Brand, last: LastEvent, remaining: Sequence[str], now: float
) -> Position:
    if last.kind == "arrived" and last.outlet_id is not None:
        opens, _ = network.outlets[last.outlet_id].receiving_window
        if now < max(last.at, opens) + conditions.unloading(network, brand, last.outlet_id):
            return "unloading", last.outlet_id
    if remaining:
        return "on_the_road", remaining[0]
    return ("at_depot", None) if last.kind == "departed" else ("unknown", None)
