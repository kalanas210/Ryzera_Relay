"""Dilani's orders through the API: the 4:00 PM cutoff decides the run by Relay's receive time, a resend never makes
a second order, an order can be changed until its cutoff, and a notice the store opens is marked read. The last tests
check that every screen's API answers only its own role, and that a wrong password or PIN signs nobody in."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime
from zoneinfo import ZoneInfo

import pytest
from copy_client import PASSWORD, Copy

COLOMBO = ZoneInfo("Asia/Colombo")
WEDNESDAY, THURSDAY = "2026-04-08", "2026-04-09"
CHILLED = [
    {"case_type": "dairy", "qty": 40},
    {"case_type": "produce", "qty": 32},
    {"case_type": "meat_fish", "qty": 20},
]
DRY = [
    {"case_type": "rice_dhal", "qty": 36},
    {"case_type": "packet_foods", "qty": 44},
    {"case_type": "tea_biscuit", "qty": 22},
]


def hm(value: str | None) -> str | None:
    return datetime.fromisoformat(value).astimezone(COLOMBO).strftime("%H:%M") if value else None


def order(copy: Copy, temp: str, lines: list[dict], *, for_date: str | None = None, ref: str | None = None) -> dict:
    body = {"temp": temp, "lines": lines, "client_ref": ref or f"test-{uuid.uuid4()}", "for_date": for_date}
    return copy.post("/api/store/orders", body, "store_manager", expect=201)


def notices(copy: Copy) -> list[dict]:
    return copy.get("/api/store/notices", "store_manager")


def test_an_order_before_the_cutoff_joins_tomorrows_run_once(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()  # Tuesday 2:05 PM
    copy.sign_in("dilani", "store_manager")
    home = copy.get("/api/store/home", "store_manager")
    assert (home["ordering_for"], hm(home["cutoff"]), home["closed_for"]) == (WEDNESDAY, "16:00", None)

    sent = order(copy, "chilled", CHILLED, for_date=WEDNESDAY, ref="chilled-order-1")
    assert sent["order_ref"] == "ORD0098596"  # the number the order book keeps for this store's chilled order
    assert (sent["requested_date"], sent["run_date"], sent["deferral"]) == (WEDNESDAY, WEDNESDAY, None)
    assert (sent["units"], sent["weight_kg"], sent["volume_m3"]) == (92, 659.2, 3.464)
    assert (sent["locked"], hm(sent["locks_at"])) == (False, "16:00")

    # Try again with the same client_ref finds the first order, never a second one
    again = order(copy, "chilled", CHILLED, for_date=WEDNESDAY, ref="chilled-order-1")
    assert again["id"] == sent["id"]
    home = copy.get("/api/store/home", "store_manager")
    assert [o["order_ref"] for o in home["orders"] if o["requested_date"] == WEDNESDAY] == ["ORD0098596"]

    # the store read "Received by Waypoint" on its own screen, so it is not an unread notice
    received = [n for n in notices(copy) if n["kind"] == "order_received"]
    assert len(received) == 1
    assert received[0]["read_at"] is not None
    assert home["unread_notices"] == 0


def test_a_line_that_does_not_belong_is_refused(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.sign_in("dilani", "store_manager")
    body = {"temp": "chilled", "lines": [{"case_type": "rice_dhal", "qty": 3}], "client_ref": "wrong-temp-1"}
    copy.post("/api/store/orders", body, "store_manager", expect=422)  # a dry case in a chilled order
    body = {"temp": "ambient", "lines": [{"case_type": "no_such_case", "qty": 3}], "client_ref": "wrong-case-1"}
    copy.post("/api/store/orders", body, "store_manager", expect=422)
    twice = [{"case_type": "rice_dhal", "qty": 3}, {"case_type": "rice_dhal", "qty": 4}]
    copy.post("/api/store/orders", {"temp": "ambient", "lines": twice, "client_ref": "twice-1"}, "store_manager", 422)
    later = {"temp": "ambient", "lines": DRY, "client_ref": "too-early-1", "for_date": THURSDAY}
    copy.post("/api/store/orders", later, "store_manager", expect=422)  # Thursday's orders are not open yet
    assert notices(copy) == []


def test_a_send_that_reaches_relay_after_four_goes_on_the_next_run(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.sign_in("dilani", "store_manager")
    copy.sign_in("nuwan", "dispatcher")
    copy.jump("2026-04-07T16:05:00+05:30")

    home = copy.get("/api/store/home", "store_manager")
    assert (home["closed_for"], hm(home["closed_at"])) == (WEDNESDAY, "16:00")
    assert (home["ordering_for"], hm(home["cutoff"])) == (THURSDAY, "16:00")

    # the form showed Wednesday (the store's phone was offline at 3:58); Relay received it at 4:05
    late = order(copy, "ambient", [{"case_type": "tea_biscuit", "qty": 5}], for_date=WEDNESDAY)
    assert (late["requested_date"], late["run_date"]) == (WEDNESDAY, THURSDAY)
    assert late["deferral"]["kind"] == "cutoff"
    assert late["locked"] is True
    told = next(n for n in notices(copy) if n["kind"] == "order_after_cutoff")
    assert f"Your dry order {late['order_ref']} came in after 4:00 PM, so it goes on Thursday's run." in told["body"]
    queue = copy.get(f"/api/dispatch/queue?run_date={WEDNESDAY}", "dispatcher")
    assert late["order_ref"] in [o["order_ref"] for o in queue["late"]]

    # a form opened after the cutoff already showed Thursday: that order is on time for Thursday
    thursday = order(copy, "ambient", [{"case_type": "tea_biscuit", "qty": 5}], for_date=THURSDAY)
    assert (thursday["requested_date"], thursday["run_date"], thursday["deferral"]) == (THURSDAY, THURSDAY, None)
    assert thursday["locked"] is False


def test_an_order_can_be_changed_until_its_cutoff(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.sign_in("dilani", "store_manager")
    sent = order(copy, "ambient", DRY, for_date=WEDNESDAY)
    assert sent["order_ref"] == "ORD0098595"

    fewer = [{"case_type": "rice_dhal", "qty": 30}, {"case_type": "packet_foods", "qty": 44}]
    changed = copy.client.patch(
        f"/api/store/orders/{sent['order_ref']}", json={"lines": fewer}, headers={"X-Relay-Role": "store_manager"}
    )
    assert changed.status_code == 200, changed.text
    changed = changed.json()
    assert changed["id"] == sent["id"]
    assert [(line["case_type"], line["qty"]) for line in changed["lines"]] == [("rice_dhal", 30), ("packet_foods", 44)]
    assert (changed["units"], changed["weight_kg"], changed["volume_m3"]) == (74, 528.8, 2.784)

    chilled = copy.client.patch(
        f"/api/store/orders/{sent['order_ref']}",
        json={"lines": [{"case_type": "dairy", "qty": 4}]},
        headers={"X-Relay-Role": "store_manager"},
    )
    assert chilled.status_code == 422  # a dry order stays dry

    copy.jump("cutoff")
    closed = copy.client.patch(
        f"/api/store/orders/{sent['order_ref']}", json={"lines": DRY}, headers={"X-Relay-Role": "store_manager"}
    )
    assert closed.status_code == 409
    assert "closed at 4:00 PM" in closed.json()["detail"]
    home = copy.get("/api/store/home", "store_manager")
    kept = next(o for o in home["orders"] if o["order_ref"] == sent["order_ref"])
    assert (kept["units"], kept["locked"]) == (74, True)


def test_opening_a_notice_marks_it_read(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.sign_in("dilani", "store_manager")
    copy.jump("evening")  # the plan is published: the deferral notice is waiting
    before = copy.get("/api/store/home", "store_manager")["unread_notices"]
    deferral = next(n for n in notices(copy) if n["kind"] == "order_deferred")
    assert (deferral["read_at"], deferral["acknowledged_at"]) == (None, None)

    opened = copy.post(f"/api/store/notices/{deferral['id']}/read", None, "store_manager")
    assert hm(opened["read_at"]) == "18:41"
    assert opened["acknowledged_at"] is None  # only Got it tells the dispatcher the store has seen it
    assert copy.get("/api/store/home", "store_manager")["unread_notices"] == before - 1

    seen = copy.post(f"/api/store/notices/{deferral['id']}/ack", None, "store_manager")
    assert datetime.fromisoformat(seen["read_at"]) == datetime.fromisoformat(opened["read_at"])
    assert seen["acknowledged_at"] is not None
    copy.post(f"/api/store/notices/{uuid.uuid4()}/read", None, "store_manager", expect=404)


# ------------------------------------------------------------------------------------------------ who may see what
ROUTES = [
    ("/api/store/home", "store_manager"),
    ("/api/dispatch/queue", "dispatcher"),
    ("/api/dispatch/plan?depot=Kandy", "dispatcher"),
    ("/api/dispatch/live/feed?depot=Kandy", "dispatcher"),
    ("/api/dispatch/live/runs?depot=Kandy", "dispatcher"),
    ("/api/dock/loads", "loader"),
    ("/api/driver/run", "driver"),
]
PEOPLE = {"store_manager": "dilani", "dispatcher": "nuwan", "loader": "rizwan", "driver": "kasun"}


@pytest.fixture(scope="module")
def everyone(database: None) -> Copy:
    from fastapi.testclient import TestClient

    from relay_api.main import app

    copy = Copy(TestClient(app, headers={"X-Relay-Client": "web"}))
    for role, username in PEOPLE.items():
        copy.sign_in(username, role)
    return copy


@pytest.mark.parametrize(("path", "owner"), ROUTES)
def test_each_screen_answers_only_its_own_role(everyone: Copy, path: str, owner: str) -> None:
    from fastapi.testclient import TestClient

    from relay_api.main import app

    assert everyone.client.get(path, headers={"X-Relay-Role": owner}).status_code == 200
    for role in PEOPLE:
        if role != owner:
            # signed in as that role, and acting as it: the right person, the wrong screen
            assert everyone.client.get(path, headers={"X-Relay-Role": role}).status_code == 403, role
    anonymous = TestClient(app, headers={"X-Relay-Client": "web"})
    assert anonymous.get(path, headers={"X-Relay-Role": owner}).status_code == 401


def test_a_wrong_password_or_pin_signs_nobody_in(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    client = copy.client
    assert client.post("/api/auth/login", json={"username": "nuwan", "password": "not-the-password"}).status_code == 401
    assert client.post("/api/auth/login", json={"username": "nobody", "password": PASSWORD}).status_code == 401
    assert client.post("/api/auth/pin", json={"username": "rizwan", "pin": "0000"}).status_code == 401
    # a store manager's account has no PIN: the dock tablet is for loaders and drivers
    assert client.post("/api/auth/pin", json={"username": "dilani", "pin": "2580"}).status_code == 401
    assert client.get("/api/dispatch/queue", headers={"X-Relay-Role": "dispatcher"}).status_code == 401
    assert client.get("/api/dock/loads", headers={"X-Relay-Role": "loader"}).status_code == 401
