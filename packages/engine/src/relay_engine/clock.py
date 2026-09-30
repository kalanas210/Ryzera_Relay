"""Two clocks for every trip.

*Planned* is the published standard at free flow: the outbound drive, a fixed drive between stops in
the district, and each stop's handling allowance. A vehicle that arrives before a store opens waits.
This is the clock the plan is checked on.

*Expected* is Relay's model of the day: each drive at free flow times 100/speed index for that hour,
times 100/road index for that date, plus each store's usual unloading time from the route history.
It is what Relay tells the store and the driver, and what the publish check warns about.
"""

from __future__ import annotations

import itertools
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field

from relay_engine.model import EARLIEST_DEPARTURE, StopTiming
from relay_engine.network import Brand, Network

LATEST_FRESH_DEPARTURE = 8 * 60
MARGIN_MINUTES = 30
"""Relay leaves as late as it can while every store is expected at least this long before it closes."""


@dataclass(frozen=True, slots=True)
class Conditions:
    """The day's conditions for Relay's expected clock."""

    speed: Mapping[tuple[str, int], float] = field(default_factory=dict)
    """(district, hour) to the speed index for the day's season; 100 is free flow."""
    road: Mapping[str, float] = field(default_factory=dict)
    """District to that date's road index; 100 is a clear road."""
    dwell: Mapping[str, float] = field(default_factory=dict)
    """Outlet to its usual unloading minutes (Fresh), from the route history."""

    def factor(self, district: str, minute: float) -> float:
        hour = int(minute // 60) % 24
        speed = self.speed.get((district, hour), 100.0) or 100.0
        road = self.road.get(district, 100.0) or 100.0
        return (100.0 / speed) * (100.0 / road)

    def unloading(self, network: Network, brand: Brand, outlet_id: str) -> float:
        if brand is Brand.FRESH and outlet_id in self.dwell:
            return self.dwell[outlet_id]
        return float(network.handling_minutes(brand, outlet_id))


FREE_FLOW = Conditions()


def free_flow(
    network: Network, outlets: Sequence[str], depart: float, brand: Brand, order_ids: Sequence[str] | None = None
) -> tuple[list[StopTiming], float]:
    """Planned arrivals at free flow, as the route history plans them, and the time back at the depot."""
    return _simulate(network, outlets, depart, brand, order_ids, None)


def expected(
    network: Network,
    conditions: Conditions,
    outlets: Sequence[str],
    depart: float,
    brand: Brand,
    order_ids: Sequence[str] | None = None,
) -> tuple[list[StopTiming], float]:
    """Relay's expected arrivals for the day's conditions, and the expected time back at the depot."""
    return _simulate(network, outlets, depart, brand, order_ids, conditions)


def _simulate(
    network: Network,
    outlets: Sequence[str],
    depart: float,
    brand: Brand,
    order_ids: Sequence[str] | None,
    conditions: Conditions | None,
) -> tuple[list[StopTiming], float]:
    if not outlets:
        return [], depart
    district = network.districts[network.outlets[outlets[0]].district]
    ids = order_ids or outlets
    t = float(depart)
    rows: list[StopTiming] = []
    for i, (outlet_id, order_id) in enumerate(zip(outlets, ids, strict=True)):
        drive = district.depot_to_district_min if i == 0 else district.inter_stop_min
        t += drive * (conditions.factor(district.name, t) if conditions else 1.0)
        arrive = t
        opens, _ = network.outlets[outlet_id].receiving_window
        start = max(arrive, float(opens))
        unload = (
            conditions.unloading(network, brand, outlet_id)
            if conditions
            else float(network.handling_minutes(brand, outlet_id))
        )
        t = start + unload
        rows.append(StopTiming(order_id=order_id, outlet_id=outlet_id, arrive=arrive, start=start, leave=t))
    back = t + district.depot_to_district_min * (conditions.factor(district.name, t) if conditions else 1.0)
    return rows, back


def fits_windows(network: Network, rows: Sequence[StopTiming]) -> bool:
    return all(r.arrive <= network.outlets[r.outlet_id].receiving_window[1] for r in rows)


def latest_departure(
    network: Network, outlets: Sequence[str], brand: Brand, ready: float, latest: float = LATEST_FRESH_DEPARTURE
) -> int | None:
    """The latest whole minute the vehicle can leave and still reach every store inside its window at free flow.
    None when even leaving at `ready` misses a window. Later departures only make arrivals later."""
    lo, hi = int(ready), int(latest)
    if not fits_windows(network, free_flow(network, outlets, lo, brand)[0]):
        return None
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if fits_windows(network, free_flow(network, outlets, mid, brand)[0]):
            lo = mid
        else:
            hi = mid - 1
    return lo


def late_count(network: Network, rows: Sequence[StopTiming]) -> int:
    return sum(1 for r in rows if r.arrive > network.outlets[r.outlet_id].receiving_window[1])


def min_margin(network: Network, rows: Sequence[StopTiming]) -> float:
    return min(network.outlets[r.outlet_id].receiving_window[1] - r.arrive for r in rows)


def choose_departure(
    network: Network,
    conditions: Conditions,
    outlets: Sequence[str],
    brand: Brand,
    ready: float,
    latest: int,
    expected_ready: float | None = None,
) -> int:
    """When a trip leaves.

    Fresh trips leave as late as they can while every store is expected at least MARGIN_MINUTES before it closes;
    when no departure gives that margin they leave as early as they can. Style and Tech trips leave so the first
    store is reached as it opens, or as soon as the vehicle is ready.
    """
    start = int(ready + 0.999)
    if latest < start:
        return start
    if brand is not Brand.FRESH:
        d = network.districts[network.outlets[outlets[0]].district]
        opens = network.outlets[outlets[0]].receiving_window[0]
        return max(start, min(latest, opens - d.depot_to_district_min))

    def margin(depart: int) -> float:
        start = max(float(depart), expected_ready or 0.0)
        return min_margin(network, expected(network, conditions, outlets, start, brand)[0])

    if margin(start) < MARGIN_MINUTES:
        return start
    lo, hi = start, latest
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if margin(mid) >= MARGIN_MINUTES:
            lo = mid
        else:
            hi = mid - 1
    return lo


@dataclass(frozen=True, slots=True)
class Sequenced:
    outlets: tuple[str, ...]
    depart: int
    expected_late: int
    margin: float
    """At the tightest store, by the expected clock."""
    back: float
    margin_total: float
    """Across all stores."""


def sequence_candidates(network: Network, outlets: Sequence[str], exhaustive_up_to: int = 7) -> list[tuple[str, ...]]:
    stops = list(dict.fromkeys(outlets))
    if len(stops) <= exhaustive_up_to:
        return list(itertools.permutations(stops))
    return _heuristic_orders(network, stops)


def timed(
    network: Network,
    conditions: Conditions,
    seq: Sequence[str],
    brand: Brand,
    ready: float,
    *,
    latest: float = LATEST_FRESH_DEPARTURE,
    back_by: float | None = None,
    expected_ready: float | None = None,
    depart: int | None = None,
) -> Sequenced | None:
    """One stop order, timed: its departure (Relay's choice unless given), and how the day is expected to go.
    None when the order can't keep every window, or can't be back by `back_by`."""
    last = latest_departure(network, seq, brand, ready, latest)
    if last is None:
        return None
    if back_by is not None:
        cap = _latest_for_back(network, seq, brand, ready, last, back_by)
        if cap is None:
            return None
        last = cap
    if depart is None:
        depart = choose_departure(network, conditions, seq, brand, ready, last, expected_ready)
    rows, _ = expected(network, conditions, seq, max(float(depart), expected_ready or 0.0), brand)
    _, back = free_flow(network, seq, depart, brand)
    margins = [network.outlets[r.outlet_id].receiving_window[1] - r.arrive for r in rows]
    return Sequenced(tuple(seq), depart, late_count(network, rows), min(margins), back, sum(margins))


def sequence_stops(
    network: Network,
    conditions: Conditions,
    outlets: Sequence[str],
    brand: Brand,
    ready: float,
    *,
    latest: float = LATEST_FRESH_DEPARTURE,
    back_by: float | None = None,
    expected_ready: float | None = None,
    lead: Sequence[str] = (),
    exhaustive_up_to: int = 7,
) -> Sequenced | None:
    """The stop order and departure for a set of stores in one district.

    Every order that keeps each planned arrival inside its window is tried (exhaustively up to 7 stops). A store
    in `lead`, whose last order waited, goes first when that still fits. Then Relay takes the fewest stores
    expected late, the most margin at the tightest store (up to 30 minutes), the most margin across all stores,
    and the latest start. `back_by` caps the free-flow return so a second trip can still leave in time.
    None when no order fits."""
    candidates = sequence_candidates(network, outlets, exhaustive_up_to)
    first = {o for o in outlets if o in set(lead)}
    pools = [[c for c in candidates if set(c[: len(first)]) == first]] if first else []
    pools.append(candidates)
    for pool in pools:
        best: Sequenced | None = None
        for seq in pool:
            found = timed(
                network, conditions, seq, brand, ready, latest=latest, back_by=back_by, expected_ready=expected_ready
            )
            if found is not None and (best is None or rank(found) < rank(best)):
                best = found
        if best is not None:
            return best
    return None


def _latest_for_back(
    network: Network, seq: Sequence[str], brand: Brand, ready: float, last: int, back_by: float
) -> int | None:
    """The latest departure up to `last` that is back by `back_by` at free flow."""
    lo = int(ready + 0.999)
    if free_flow(network, seq, lo, brand)[1] > back_by + 1e-6:
        return None
    hi = last
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if free_flow(network, seq, mid, brand)[1] <= back_by + 1e-6:
            lo = mid
        else:
            hi = mid - 1
    return lo


def latest_start_for(
    network: Network, outlets: Sequence[str], brand: Brand, latest: float = LATEST_FRESH_DEPARTURE
) -> tuple[tuple[str, ...], int] | None:
    """The stop order that can leave latest while keeping every window, and that departure. A second trip's
    first trip must be back before it."""
    best: tuple[tuple[str, ...], int] | None = None
    for seq in sequence_candidates(network, outlets):
        last = latest_departure(network, seq, brand, 0, latest)
        if last is not None and (best is None or last > best[1]):
            best = (tuple(seq), last)
    return best


def rank(s: Sequenced) -> tuple[int, float, float, int, tuple[str, ...]]:
    """Fewest stores expected late, margin up to 30 minutes at the tightest store, margin across all stores,
    then the latest start."""
    return s.expected_late, -round(min(s.margin, MARGIN_MINUTES), 6), -round(s.margin_total, 3), -s.depart, s.outlets


def _heuristic_orders(network: Network, stops: Sequence[str]) -> list[tuple[str, ...]]:
    """For long trips: earliest close first, earliest open first, and one swap of each neighbouring pair."""
    by_close = sorted(
        stops, key=lambda o: (network.outlets[o].receiving_window[1], network.outlets[o].receiving_window[0], o)
    )
    by_open = sorted(
        stops, key=lambda o: (network.outlets[o].receiving_window[0], network.outlets[o].receiving_window[1], o)
    )
    orders = {tuple(by_close), tuple(by_open)}
    for base in (by_close, by_open):
        for i in range(len(base) - 1):
            swapped = list(base)
            swapped[i], swapped[i + 1] = swapped[i + 1], swapped[i]
            orders.add(tuple(swapped))
    return sorted(orders)


def quick_fit(network: Network, outlets: Sequence[str], brand: Brand, ready: float) -> tuple[bool, float]:
    """A fast free-flow check for option screening: does some simple stop order keep every window, and how early
    can the vehicle be back. Tries earliest-close-first and earliest-open-first."""
    best_back = float("inf")
    ok = False
    for order in _simple_orders(network, outlets):
        rows, back = free_flow(network, order, ready, brand)
        if fits_windows(network, rows):
            ok = True
            best_back = min(best_back, back)
    return ok, best_back


def _simple_orders(network: Network, outlets: Sequence[str]) -> list[list[str]]:
    key_close: Callable[[str], tuple[int, int, str]] = lambda o: (  # noqa: E731
        network.outlets[o].receiving_window[1],
        network.outlets[o].receiving_window[0],
        o,
    )
    key_open: Callable[[str], tuple[int, int, str]] = lambda o: (  # noqa: E731
        network.outlets[o].receiving_window[0],
        network.outlets[o].receiving_window[1],
        o,
    )
    a = sorted(outlets, key=key_close)
    b = sorted(outlets, key=key_open)
    return [a] if a == b else [a, b]


def format_clock(minutes: float) -> str:
    whole = round(minutes)
    return f"{(whole // 60) % 24:02d}:{whole % 60:02d}"


__all__ = [
    "EARLIEST_DEPARTURE",
    "FREE_FLOW",
    "Conditions",
    "Sequenced",
    "choose_departure",
    "expected",
    "fits_windows",
    "format_clock",
    "free_flow",
    "late_count",
    "latest_departure",
    "latest_start_for",
    "min_margin",
    "quick_fit",
    "rank",
    "sequence_candidates",
    "sequence_stops",
    "timed",
]
