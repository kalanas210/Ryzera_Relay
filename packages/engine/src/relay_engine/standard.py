"""The organizers' published trip-time standard (booklet pages 20 and 21)."""

from __future__ import annotations

from collections.abc import Sequence

from relay_engine.network import Brand, DockType, Network

# Fresh trips of one vehicle, 3:30 AM to 8 AM
FRESH_BUDGET_MIN = 270

# Style and Tech trips of one vehicle, across the trading day
DAYTIME_BUDGET_MIN = 480

MAX_TRIPS_PER_DAY = 2


def trip_minutes(network: Network, district: str, brand: Brand, docks: Sequence[DockType]) -> int:
    # The return journey is not added, the daily budgets already allow for it.
    if not docks:
        return 0
    d = network.districts[district]
    handling = sum(network.allowance[(brand, dock)] for dock in docks)
    return d.depot_to_district_min + (len(docks) - 1) * d.inter_stop_min + handling


def budget_for(brand: Brand) -> int:
    return FRESH_BUDGET_MIN if brand is Brand.FRESH else DAYTIME_BUDGET_MIN
