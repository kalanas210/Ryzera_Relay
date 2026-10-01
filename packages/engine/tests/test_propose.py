"""Relay's proposal for the Kandy hub on Wednesday 8 April 2026, the Designathon story day: two refrigerated
vehicles are in the workshop, so one chilled order has to wait, and Relay's rules choose which."""

import pytest
from story_data import protected_orders, story_orders, story_vehicles, usual_runs

from relay_engine.clock import Conditions, format_clock
from relay_engine.model import TripReport
from relay_engine.network import Network
from relay_engine.propose import Proposal, RunInput, propose

DILANI_CHILLED = "ORD0098596"
KEGALLE_CHILLED = "ORD0098599"  # OUT119, whose Monday chilled order waited a day


@pytest.fixture(scope="module")
def kandy(network: Network, wednesday: Conditions) -> Proposal:
    orders = story_orders()
    run = RunInput(network, "Kandy", orders, story_vehicles(), usual_runs(), wednesday, protected_orders(orders))
    return propose(run)


def trip(p: Proposal, vehicle: str, number: int) -> TripReport:
    return next(r for r in p.reports if r.trip.vehicle_id == vehicle and r.trip.trip_no == number)


def test_one_chilled_order_waits_and_the_rest_travel(kandy: Proposal) -> None:
    served = sum(len(r.trip.order_ids) for r in kandy.reports)
    assert (len(kandy.reports), served) == (18, 56)
    assert [d.order_id for d in kandy.deferred] == [DILANI_CHILLED]


def test_only_one_waiting_is_unavoidable_and_rule_two_picks_it(kandy: Proposal) -> None:
    analysis = kandy.analyses[0]
    assert (analysis.max_served, analysis.orders, analysis.unavoidable) == (22, 23, 1)
    assert len(analysis.pool) == 15  # any of 15 chilled orders could have been the one to wait
    assert set(analysis.pool_keeping_usual_runs) == {DILANI_CHILLED, KEGALLE_CHILLED}
    assert analysis.protected == [KEGALLE_CHILLED]
    assert analysis.limiting == ["VEH039", "VEH058"]
    deferred = kandy.deferred[0]
    assert (deferred.unavoidable, deferred.rule) == (False, 2)


def test_every_proposed_trip_keeps_all_eleven_rules(kandy: Proposal) -> None:
    for report in kandy.reports:
        assert report.broken == [], (report.trip.key, [r.message for r in report.broken])
        assert len(report.rules) == 11


def test_the_van_covers_the_kegalle_chilled_run_after_its_own(kandy: Proposal) -> None:
    second = trip(kandy, "VEH057", 2)
    assert [s.outlet_id for s in second.planned] == ["OUT116", "OUT119"]
    assert format_clock(second.depart) == "06:12"
    assert [format_clock(s.arrive) for s in second.planned] == ["07:05", "07:33"]
    assert format_clock(second.back) == "08:41"


def test_veh042_runs_matale_first_then_its_own_kandy_run(kandy: Proposal) -> None:
    first, second = trip(kandy, "VEH042", 1), trip(kandy, "VEH042", 2)
    assert first.district == "Matale"
    assert [s.outlet_id for s in second.planned] == ["OUT084", "OUT085", "OUT087"]
    assert [format_clock(s.arrive) for s in second.planned] == ["06:42", "07:03", "07:24"]


def test_kasuns_truck_runs_kegalle_with_the_protected_store_first(kandy: Proposal) -> None:
    run = trip(kandy, "VEH045", 1)
    assert run.district == "Kegalle"
    assert {s.outlet_id for s in run.planned} == {"OUT116", "OUT117", "OUT118", "OUT119"}
    assert run.planned[0].outlet_id == "OUT119"


def test_no_workshop_or_standby_vehicle_is_used(kandy: Proposal) -> None:
    used = {r.trip.vehicle_id for r in kandy.reports}
    assert not used & {"VEH039", "VEH058", "VEH060"}
