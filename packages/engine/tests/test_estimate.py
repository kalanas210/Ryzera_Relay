"""The estimate while Kasun is out of contact, on the story's own numbers (05-scenario-data, "Estimates while Kasun
is silent"): after the 5:30 AM arrival at Mawanella, Hemmathagama around 6:35 and Aranayake around 7:15, with likely
ranges that widen with the silence, and Dilani's 6:42 receipt bringing Aranayake forward to around 7:05."""

import pytest

from relay_engine.clock import Conditions
from relay_engine.estimate import LastEvent, estimate_after, likely_range, position, round5
from relay_engine.network import Brand, Network


def hm(text: str) -> float:
    h, m = text.split(":")
    return int(h) * 60 + int(m)


def clock(minutes: float) -> str:
    whole = round(minutes)
    return f"{whole // 60}:{whole % 60:02d}"


REMAINING = ["OUT117", "OUT116"]  # Hemmathagama, then Aranayake


@pytest.fixture
def from_mawanella(network: Network, wednesday: Conditions) -> list[float]:
    return estimate_after(network, wednesday, Brand.FRESH, REMAINING, LastEvent("arrived", hm("5:30"), "OUT118"))


def test_estimates_after_the_mawanella_arrival(from_mawanella: list[float]) -> None:
    assert [clock(round5(x)) for x in from_mawanella] == ["6:35", "7:15"]


@pytest.mark.parametrize(
    ("now", "last_contact", "expected"),
    [
        ("6:05", "5:41", [("6:05", "7:05"), ("6:45", "7:45")]),
        ("6:15", "5:41", [("6:15", "7:10"), ("6:40", "7:50")]),
    ],
)
def test_ranges_widen_with_the_silence(
    from_mawanella: list[float], now: str, last_contact: str, expected: list[tuple[str, str]]
) -> None:
    silent = hm(now) - hm(last_contact)
    got = [likely_range(e, silent, hm(now)) for e in from_mawanella]
    assert [(clock(a), clock(b)) for a, b in got] == expected


def test_a_store_receipt_counts_as_the_delivery(network: Network, wednesday: Conditions) -> None:
    receipt = LastEvent("delivered", hm("6:42"), "OUT117")
    [aranayake] = estimate_after(network, wednesday, Brand.FRESH, ["OUT116"], receipt)
    assert clock(round5(aranayake)) == "7:05"
    low, high = likely_range(aranayake, hm("6:42") - hm("5:41"), hm("6:42"))
    assert (clock(low), clock(high)) == ("6:45", "7:55")


def test_where_the_van_probably_is(network: Network, wednesday: Conditions) -> None:
    last = LastEvent("arrived", hm("5:30"), "OUT118")
    assert position(network, wednesday, Brand.FRESH, last, REMAINING, hm("6:05")) == ("unloading", "OUT118")
    assert position(network, wednesday, Brand.FRESH, last, REMAINING, hm("6:15")) == ("on_the_road", "OUT117")
