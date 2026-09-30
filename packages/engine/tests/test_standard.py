"""The published trip-time standard, checked against the booklet's own worked examples."""

from relay_engine.network import Brand, DockType, Network
from relay_engine.standard import FRESH_BUDGET_MIN, budget_for, trip_minutes

REAR, STREET = DockType.REAR_DOCK, DockType.STREET


def test_gampaha_example_on_page_21(network: Network) -> None:
    # 37 outbound, 9 x (3 - 1) between stops, 15 + 15 + 16 handling
    assert trip_minutes(network, "Gampaha", Brand.FRESH, [REAR, REAR, STREET]) == 101


def test_colombo_second_trip_example(network: Network) -> None:
    # 24 + (3 x 8) + (4 x 16)
    assert trip_minutes(network, "Colombo", Brand.FRESH, [STREET] * 4) == 112


def test_both_trips_fit_the_fresh_budget(network: Network) -> None:
    used = trip_minutes(network, "Gampaha", Brand.FRESH, [REAR, REAR, STREET]) + trip_minutes(
        network, "Colombo", Brand.FRESH, [STREET] * 4
    )
    assert used == 213
    assert used <= FRESH_BUDGET_MIN


def test_a_trip_with_no_stops_takes_no_time(network: Network) -> None:
    assert trip_minutes(network, "Kandy", Brand.TECH, []) == 0


def test_style_and_tech_share_the_daytime_budget() -> None:
    assert budget_for(Brand.FRESH) == 270
    assert budget_for(Brand.STYLE) == budget_for(Brand.TECH) == 480
