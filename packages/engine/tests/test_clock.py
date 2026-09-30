"""The two clocks, checked against the Designathon scenario's own figures for Wednesday 8 April 2026."""

from relay_engine.clock import Conditions, choose_departure, expected, format_clock, free_flow, latest_departure
from relay_engine.network import Brand, Network, clock_to_minutes

FRESH = Brand.FRESH
KASUN_BEFORE_SWAP = ["OUT119", "OUT118", "OUT116", "OUT117"]
KASUN_AFTER_SWAP = ["OUT119", "OUT118", "OUT117", "OUT116"]


def times(rows) -> list[str]:
    return [format_clock(r.arrive) for r in rows]


def test_planned_clock_for_kasuns_run(network: Network) -> None:
    rows, back = free_flow(network, KASUN_AFTER_SWAP, clock_to_minutes("03:40"), FRESH)
    assert times(rows) == ["04:33", "05:01", "05:30", "05:58"]
    assert format_clock(back) == "07:06"


def test_planned_clock_for_the_kegalle_chilled_second_trip(network: Network) -> None:
    rows, back = free_flow(network, ["OUT116", "OUT119"], clock_to_minutes("06:12"), FRESH)
    assert times(rows) == ["07:05", "07:33"]
    assert format_clock(back) == "08:41"


def test_expected_clock_for_kasuns_run(network: Network, wednesday: Conditions) -> None:
    rows, _ = expected(network, wednesday, KASUN_AFTER_SWAP, clock_to_minutes("03:40"), FRESH)
    assert times(rows) == ["04:48", "05:31", "06:36", "07:13"]


def test_an_early_vehicle_waits_for_the_store_to_open(network: Network) -> None:
    # Aranayake opens at 5:00; leaving at 2:00 the van would arrive at 2:53 and wait
    rows, _ = free_flow(network, ["OUT116"], clock_to_minutes("02:00"), FRESH)
    assert format_clock(rows[0].arrive) == "02:53"
    assert format_clock(rows[0].start) == "05:00"


def test_latest_departure_keeps_every_window(network: Network) -> None:
    last = latest_departure(network, KASUN_BEFORE_SWAP, FRESH, clock_to_minutes("02:00"))
    assert last is not None
    rows, _ = free_flow(network, KASUN_BEFORE_SWAP, last, FRESH)
    assert all(r.arrive <= network.outlets[r.outlet_id].receiving_window[1] for r in rows)
    late, _ = free_flow(network, KASUN_BEFORE_SWAP, last + 1, FRESH)
    assert any(r.arrive > network.outlets[r.outlet_id].receiving_window[1] for r in late)


def test_relay_leaves_as_late_as_it_can_with_a_thirty_minute_margin(network: Network, wednesday: Conditions) -> None:
    ready = clock_to_minutes("02:00")
    last = latest_departure(network, KASUN_BEFORE_SWAP, FRESH, ready)
    assert last is not None
    depart = choose_departure(network, wednesday, KASUN_BEFORE_SWAP, FRESH, ready, last)
    assert format_clock(depart) == "03:40"
