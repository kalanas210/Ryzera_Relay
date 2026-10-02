"""Accounts across copies of the day: a language choice stays in the copy it was made in, and the demo shows the
PIN a judge needs to accept a load on the dock tablet."""

from __future__ import annotations

from collections.abc import Callable

from copy_client import Copy


def _locale(copy: Copy, role: str) -> str:
    return copy.get("/api/auth/me", role)["locale"]


def test_a_language_choice_stays_in_its_copy(new_copy: Callable[[], Copy]) -> None:
    mine, theirs = new_copy(), new_copy()
    mine.sign_in("rizwan", "loader")
    theirs.sign_in("rizwan", "loader")

    response = mine.client.patch("/api/auth/me", json={"locale": "ta"}, headers={"X-Relay-Role": "loader"})
    assert response.status_code == 200, response.text
    assert response.json()["locale"] == "ta"
    assert _locale(mine, "loader") == "ta"
    # another judge playing Rizwan in another copy keeps the seeded language
    assert _locale(theirs, "loader") == "en"

    # signing in again in the same copy brings the choice back
    response = mine.client.post("/api/auth/pin", json={"username": "rizwan", "pin": "2580"})
    assert response.json()["locale"] == "ta"

    # and a reset brings back the seeded language
    mine.post("/api/demo/reset")
    assert _locale(mine, "loader") == "en"


def test_a_seeded_language_is_the_default(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.sign_in("suresh", "loader")
    assert _locale(copy, "loader") == "ta"


def test_the_demo_shows_the_driver_pin_for_the_dock_tablet(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    accounts = {a["username"]: a for a in copy.get("/api/auth/accounts")}
    kasun = accounts["kasun"]
    # Kasun signs in on the phone with a password, and accepts a load on the dock tablet with a PIN
    assert not kasun["uses_pin"]
    assert kasun["hint"] == "Password relay2026 · PIN 3690"
    assert kasun["pin"] == "3690"
    assert accounts["rizwan"]["hint"] == "PIN 2580"
    assert accounts["nuwan"]["hint"] == "Password relay2026"
    assert accounts["nuwan"]["pin"] is None
