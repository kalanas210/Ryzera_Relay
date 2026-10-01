"""Where a run is, and when each store can expect it, from the last thing Relay heard.

One rule, read the same way by the dispatcher, the store and the driver's phone. Start from the last stop event Relay
has for the trip (an arrival, a delivery, or a store's confirmed receipt, which counts as a delivery at the receipt
time). Add that store's usual unloading time if the event was an arrival. Then drive each leg on the expected clock
and add the usual unloading time at each store in between. Show it rounded to 5 minutes.

The estimate moves only when a stop event arrives; time passing alone never pushes it later. While the driver's phone
is out of contact the store and the dispatcher also see a likely range around it, which widens with the silence.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import dataclass
from typing import Literal

from relay_engine.clock import Conditions
from relay_engine.network import Brand, Network

RANGE_BASE_MINUTES = 15.0
"""Half the width of the likely range the moment contact is lost; half of every minute of silence is added to it."""


@dataclass(frozen=True, slots=True)
class LastEvent:
    kind: Literal["departed", "arrived", "delivered"]
    at: float
    """Minutes after midnight of the run date."""
    outlet_id: str | None = None
    """The store of an arrival or delivery; None for the departure from the depot."""


def round5(minutes: float) -> float:
    return round(minutes / 5) * 5


def floor5(minutes: float) -> float:
    return math.floor(minutes / 5 + 1e-9) * 5


def ceil5(minutes: float) -> float:
    return math.ceil(minutes / 5 - 1e-9) * 5


def estimate_after(
    network: Network, conditions: Conditions, brand: Brand, remaining: Sequence[str], last: LastEvent
) -> list[float]:
    """The expected arrival at each store still to come, in stop order, unrounded."""
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


def likely_range(estimate: float, silent_minutes: float, now: float) -> tuple[float, float]:
    """The range shown while the phone is out of contact, around the rounded estimate: 15 minutes either side plus
    half of every minute of silence, rounded outwards to 5 minutes, and never starting before now."""
    rounded = round5(estimate)
    half = RANGE_BASE_MINUTES + max(0.0, silent_minutes) / 2
    low = max(floor5(rounded - half), ceil5(now))
    high = ceil5(rounded + half)
    return low, max(low, high)


Position = tuple[Literal["unloading", "on_the_road", "at_depot", "unknown"], str | None]


def position(
    network: Network, conditions: Conditions, brand: Brand, last: LastEvent, remaining: Sequence[str], now: float
) -> Position:
    """Where the vehicle probably is: still unloading at the last store, or on the road to the next one."""
    if last.kind == "arrived" and last.outlet_id is not None:
        opens, _ = network.outlets[last.outlet_id].receiving_window
        if now < max(last.at, opens) + conditions.unloading(network, brand, last.outlet_id):
            return "unloading", last.outlet_id
    if remaining:
        return "on_the_road", remaining[0]
    return ("at_depot", None) if last.kind == "departed" else ("unknown", None)
