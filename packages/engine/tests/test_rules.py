"""The eleven rules, on the moves the Designathon's plan board shows."""

import pytest
from story_data import story_orders, story_vehicles, usual_runs

from relay_engine.clock import Conditions
from relay_engine.model import Trip
from relay_engine.network import Network
from relay_engine.rules import Context, evaluate, fit_hint


@pytest.fixture(scope="module")
def ctx(network: Network, wednesday: Conditions) -> Context:
    orders = {o.order_id: o for o in story_orders()}
    return Context(network, orders, {v.vehicle_id: v for v in story_vehicles()}, wednesday, usual_runs())


def test_dilanis_chilled_order_breaks_three_rules_on_the_van(ctx: Context) -> None:
    # DSP-02 / broken rule: VEH057 trip 2 with Kegalle's two chilled orders and Dilani's
    trips = [
        Trip("VEH057", 1, ["ORD0098545", "ORD0098552", "ORD0098554", "ORD0098556", "ORD0098550"], 220),
        Trip("VEH057", 2, ["ORD0098594", "ORD0098599", "ORD0098596"], 372),
    ]
    reports, _ = evaluate(ctx, trips)
    second = next(r for r in reports if r.trip.trip_no == 2)
    broken = {r.rule: r.message for r in second.broken}
    assert set(broken) == {1, 2, 8}
    assert broken[1] == "Weight: 1,460.8 of 1,040 kg"
    assert broken[2] == "Volume: 7.676 of 7.0 m³"
    assert broken[8] == "Window: OUT117 at 8:01 AM, closes 7:45"


def test_the_fit_hint_says_why_in_a_few_words(ctx: Context) -> None:
    van_trip = Trip("VEH057", 2, ["ORD0098594", "ORD0098599"], 372)
    fits, hint = fit_hint(ctx, ctx.orders["ORD0098596"], van_trip, [van_trip])
    assert not fits
    assert hint == "Over weight and volume"
    badulla = Trip("VEH040", 1, ["ORD0098585", "ORD0098587"], 120)
    fits, hint = fit_hint(ctx, ctx.orders["ORD0098596"], badulla, [badulla])
    assert (fits, hint) == (False, "Serves Badulla only")


def test_chilled_goods_on_a_dry_truck_are_refused_in_plain_words(ctx: Context) -> None:
    reports, _ = evaluate(ctx, [Trip("VEH045", 1, ["ORD0098596"], 220)])
    temperature = next(r for r in reports[0].rules if r.rule == 3)
    assert not temperature.passed
    assert temperature.message == "Chilled goods need a refrigerated vehicle; VEH045 is a dry-box truck"


def test_van_only_stores_need_a_van(ctx: Context) -> None:
    reports, _ = evaluate(ctx, [Trip("VEH042", 1, ["ORD0098552"], 220)])
    access = next(r for r in reports[0].rules if r.rule == 4)
    assert not access.passed
    assert access.message == "OUT081 takes vans only; VEH042 is a truck"
