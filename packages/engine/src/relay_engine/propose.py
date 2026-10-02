"""Relay's proposal for one depot's run, and why each order that waits, waits.

Chilled orders compete for the few refrigerated vehicles, so they are planned exactly, all districts at once:
first the most orders any allocation can carry (what is unavoidable), then, keeping that many, the allocation
that best follows Relay's three rules (what is Relay's choice):

1. Keep every other vehicle on its usual run.
2. Never make a store wait twice in a row without an override.
3. Keep the most goods moving.

Ambient orders (Fresh dry, Style and Tech) rarely run short of vehicles, so each vehicle first takes its usual
run, and whatever is left is placed on free trip slots in a second, smaller search.
"""

from __future__ import annotations

from collections.abc import Iterable, Mapping, Sequence
from collections.abc import Set as AbstractSet
from dataclasses import dataclass, field

from relay_engine.clock import (
    MARGIN_MINUTES,
    Conditions,
    Sequenced,
    expected,
    free_flow,
    latest_start_for,
    rank,
    sequence_candidates,
    sequence_stops,
    timed,
)
from relay_engine.model import (
    RELOAD_MINUTES,
    Deferred,
    GroupAnalysis,
    Order,
    Trip,
    TripReport,
    UsualTrip,
    VehicleDay,
    VehicleReport,
    VehicleStatus,
)
from relay_engine.network import Network, Temp
from relay_engine.options import Option, enumerate_options
from relay_engine.rules import Context, evaluate
from relay_engine.solver import Problem, Slot, Solution


@dataclass(slots=True)
class RunInput:
    network: Network
    depot: str
    orders: Sequence[Order]
    vehicles: Sequence[VehicleDay]
    usual: Mapping[str, Sequence[UsualTrip]]
    conditions: Conditions
    protected: set[str] = field(default_factory=set)
    """Orders whose store's last order of the same temperature waited (rule 2)."""


@dataclass(slots=True)
class Proposal:
    trips: list[Trip]
    reports: list[TripReport]
    vehicles: dict[str, VehicleReport]
    deferred: list[Deferred]
    analyses: list[GroupAnalysis]


def propose(run: RunInput, *, explain: bool = True) -> Proposal:
    network = run.network
    orders = [o for o in run.orders if network.outlets[o.outlet_id].depot == run.depot]
    vehicles = [v for v in run.vehicles if network.vehicles[v.vehicle_id].depot == run.depot]
    reefers = [v for v in vehicles if network.vehicles[v.vehicle_id].refrigerated]
    ambient = [v for v in vehicles if not network.vehicles[v.vehicle_id].refrigerated]

    chilled_orders = [o for o in orders if o.temp is Temp.CHILLED]
    ambient_orders = [o for o in orders if o.temp is Temp.AMBIENT]

    slots: list[Slot] = []
    deferred: list[Deferred] = []
    analyses: list[GroupAnalysis] = []

    if chilled_orders:
        chosen, analysis, waits = _plan_chilled(run, chilled_orders, reefers, explain)
        slots += chosen
        deferred += waits
        if analysis:
            analyses.append(analysis)
    if ambient_orders:
        chosen, waits = _plan_ambient(run, ambient_orders, ambient)
        slots += chosen
        deferred += waits

    by_id = {o.order_id: o for o in orders}
    trips = _timed_trips(run, slots, by_id)
    ctx = Context(network, by_id, {v.vehicle_id: v for v in vehicles}, run.conditions, run.usual)
    reports, totals = evaluate(ctx, trips)
    return Proposal(trips, reports, totals, deferred, analyses)


# ---------------------------------------------------------------------------------------------- chilled
def _options(run: RunInput, orders: Sequence[Order], fleet: Sequence[VehicleDay]) -> list[Option]:
    caps = [run.network.vehicles[v.vehicle_id] for v in fleet if v.status is VehicleStatus.AVAILABLE]
    if not caps:
        return []
    return enumerate_options(
        run.network,
        orders,
        max_weight=max(c.weight_cap_kg for c in caps),
        max_volume=max(c.volume_cap_m3 for c in caps),
        conditions=run.conditions,
    )


def _plan_chilled(
    run: RunInput, orders: Sequence[Order], fleet: Sequence[VehicleDay], explain: bool
) -> tuple[list[Slot], GroupAnalysis | None, list[Deferred]]:
    problem = Problem(run.network, _options(run, orders, fleet), fleet, run.usual, scope="joint")
    ids = {o.order_id for o in orders}
    most = problem.solve(maximize="served")
    if most is None:
        most = Solution([], set())
    protected = run.protected & ids
    best = problem.solve(maximize="choice", min_served=most.count, force=protected) or problem.solve(
        maximize="choice", min_served=most.count
    )
    best = best or most
    waiting = sorted(ids - best.served)
    if not waiting:
        return best.slots, None, []

    analysis = GroupAnalysis(
        depot=run.depot,
        temp_class="chilled",
        orders=len(orders),
        max_served=most.count,
        unavoidable=len(orders) - most.count,
        protected=sorted(protected),
        limiting=sorted(
            v.vehicle_id
            for v in fleet
            if v.status is VehicleStatus.WORKSHOP and run.network.vehicles[v.vehicle_id].depot == run.depot
        ),
    )
    if explain and analysis.unavoidable:
        pool: list[str] = []
        kept: dict[str, float] = {}
        for order_id in sorted(ids):
            alone = problem.solve(maximize="served", forbid={order_id}, time_limit=10)
            if alone is None or alone.count < most.count:
                continue
            pool.append(order_id)
            choice = problem.solve(maximize="choice", min_served=most.count, forbid={order_id}, time_limit=10)
            kept[order_id] = choice.usual_kept if choice else -1
        analysis.pool = pool
        top = max(kept.values(), default=0)
        analysis.pool_keeping_usual_runs = [o for o in pool if kept[o] >= top - 1e-6]

    return best.slots, analysis, [_why(analysis, o) for o in waiting]


def _why(analysis: GroupAnalysis, order_id: str) -> Deferred:
    pool = set(analysis.pool)
    keeping = set(analysis.pool_keeping_usual_runs)
    open_pool = keeping - set(analysis.protected)
    if not pool or pool == {order_id} or len(pool) <= analysis.unavoidable:
        return Deferred(
            order_id, unavoidable=True, rule=None, reason="No allocation that keeps every rule can carry it"
        )
    if keeping == {order_id}:
        return Deferred(order_id, unavoidable=False, rule=1, reason="Every other vehicle stays on its usual run")
    if open_pool == {order_id}:
        return Deferred(order_id, unavoidable=False, rule=2, reason="The other candidate's store waited last run")
    return Deferred(order_id, unavoidable=False, rule=3, reason="Letting it wait keeps the most goods moving")


# ---------------------------------------------------------------------------------------------- ambient
def _plan_ambient(
    run: RunInput, orders: Sequence[Order], fleet: Sequence[VehicleDay]
) -> tuple[list[Slot], list[Deferred]]:
    options = _options(run, orders, fleet)
    usual = Problem(run.network, options, fleet, run.usual, scope="usual", first_back="preferred")
    first = usual.solve(maximize="served") or Solution([], set())
    first = usual.solve(maximize="choice", min_served=first.count) or first
    chosen = list(first.slots)
    left = [o for o in orders if o.order_id not in first.served]
    if left:
        trips_by_vehicle: dict[str, list[Slot]] = {}
        for s in chosen:
            trips_by_vehicle.setdefault(s.vehicle_id, []).append(s)
        free = [v for v in fleet if len(trips_by_vehicle.get(v.vehicle_id, [])) < 2]
        booked = {v: slots[0].option.earliest_back for v, slots in trips_by_vehicle.items() if len(slots) == 1}
        preferred = {v: slots[0].option.preferred_back for v, slots in trips_by_vehicle.items() if len(slots) == 1}
        usage = {
            v: (
                slots[0].option.minutes if slots[0].option.brand.value == "Fresh" else 0,
                0 if slots[0].option.brand.value == "Fresh" else slots[0].option.minutes,
                slots[0].option.km / run.network.vehicles[v].km_per_l,
            )
            for v, slots in trips_by_vehicle.items()
            if len(slots) == 1
        }
        repair = Problem(
            run.network,
            _options(run, left, free),
            free,
            run.usual,
            scope="open",
            booked=booked,
            booked_usage=usage,
            booked_preferred=preferred,
            first_back="earliest",
        )
        extra = repair.solve(maximize="served") or Solution([], set())
        extra = repair.solve(maximize="choice", min_served=extra.count) or extra
        chosen += extra.slots
        served = first.served | extra.served
    else:
        served = first.served
    waits = [
        Deferred(o.order_id, unavoidable=True, rule=None, reason="No free ambient vehicle can carry it in time")
        for o in orders
        if o.order_id not in served
    ]
    return chosen, waits


# ---------------------------------------------------------------------------------------------- timing
def _timed_trips(run: RunInput, slots: Iterable[Slot], orders: Mapping[str, Order]) -> list[Trip]:
    """Stop order and departure for each chosen trip.

    A store whose last order waited goes first on its trip. A vehicle with two trips gets its first trip's stop
    order and departure chosen together with the second trip, so that across both the fewest stores are expected
    late and the tightest margin is as wide as it can be (up to 30 minutes)."""
    network = run.network
    days = {v.vehicle_id: v for v in run.vehicles}
    lead = {orders[o].outlet_id for o in run.protected if o in orders}
    by_vehicle: dict[str, list[Slot]] = {}
    for slot in slots:
        by_vehicle.setdefault(slot.vehicle_id, []).append(slot)
    trips: list[Trip] = []
    for vehicle_id, own in sorted(by_vehicle.items()):
        own.sort(key=lambda s: (s.trip_no, s.option.earliest_back))
        ready = float(days[vehicle_id].ready_at)
        if len(own) == 1:
            trips.append(_single(run, vehicle_id, 1, own[0].option, ready, orders, lead))
            continue
        first, second = own[0].option, own[1].option
        pair = _pair(run, first, second, ready, lead)
        if pair is None:
            t1 = _single(run, vehicle_id, 1, first, ready, orders, lead)
            _, back1 = free_flow(network, [orders[o].outlet_id for o in t1.order_ids], t1.depart or ready, first.brand)
            trips += [t1, _single(run, vehicle_id, 2, second, back1 + RELOAD_MINUTES, orders, lead)]
            continue
        s1, s2 = pair
        trips += [
            Trip(vehicle_id, 1, _ids(first, list(s1.outlets), orders), s1.depart),
            Trip(vehicle_id, 2, _ids(second, list(s2.outlets), orders), s2.depart),
        ]
    return trips


def _pair(
    run: RunInput, first: Option, second: Option, ready: float, lead: set[str]
) -> tuple[Sequenced, Sequenced] | None:
    network, conditions = run.network, run.conditions
    latest = latest_start_for(network, second.outlets, second.brand, _latest(second))
    if latest is None:
        return None
    cap = latest[1] - RELOAD_MINUTES
    # the most promising first-trip stop orders on their own, then every departure for each
    ranked = []
    for seq in sequence_candidates(network, first.outlets):
        found = timed(network, conditions, seq, first.brand, ready, latest=_latest(first), back_by=cap)
        if found is not None:
            leads = bool(lead & set(seq)) and set(seq[: len(lead & set(seq))]) == lead & set(seq)
            ranked.append((0 if leads or not (lead & set(seq)) else 1, rank(found), found))
    ranked.sort(key=lambda r: (r[0], r[1]))
    best: tuple[tuple[int, float, int], Sequenced, Sequenced] | None = None
    for _, _, top in ranked[:6]:
        seq1 = list(top.outlets)
        for d1 in range(int(ready + 0.999), top.depart + 1, 5):
            one = timed(network, conditions, seq1, first.brand, ready, latest=_latest(first), depart=d1)
            if one is None:
                continue
            _, exp_back1 = expected(network, conditions, seq1, d1, first.brand)
            two = sequence_stops(
                network,
                conditions,
                second.outlets,
                second.brand,
                one.back + RELOAD_MINUTES,
                latest=_latest(second),
                expected_ready=exp_back1 + RELOAD_MINUTES,
                lead=tuple(lead),
            )
            if two is None:
                continue
            # fewest stores expected late, then the tightest margin up to 30 minutes, then the latest start: the
            # first trip leaves no earlier than the second trip needs
            key = (
                one.expected_late + two.expected_late,
                -round(min(one.margin, two.margin, MARGIN_MINUTES), 3),
                -d1,
            )
            if best is None or key < best[0]:
                best = (key, one, two)
    return (best[1], best[2]) if best else None


def _single(
    run: RunInput,
    vehicle_id: str,
    trip_no: int,
    option: Option,
    ready: float,
    orders: Mapping[str, Order],
    lead: AbstractSet[str] = frozenset(),
) -> Trip:
    seq = sequence_stops(
        run.network, run.conditions, option.outlets, option.brand, ready, latest=_latest(option), lead=tuple(lead)
    )
    if seq is None:
        return Trip(vehicle_id, trip_no, _ids(option, list(option.outlets), orders), int(ready))
    return Trip(vehicle_id, trip_no, _ids(option, list(seq.outlets), orders), seq.depart)


def _ids(option: Option, outlets: Sequence[str], orders: Mapping[str, Order]) -> list[str]:
    by_outlet = {orders[o].outlet_id: o for o in option.orders}
    return [by_outlet[o] for o in outlets]


def _latest(option: Option) -> int:
    from relay_engine.clock import LATEST_FRESH_DEPARTURE
    from relay_engine.options import DAYTIME_LATEST_DEPARTURE

    return LATEST_FRESH_DEPARTURE if option.brand.value == "Fresh" else DAYTIME_LATEST_DEPARTURE
