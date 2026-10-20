from __future__ import annotations

from collections.abc import Callable
from typing import Any

from copy_client import Copy


def _board(copy: Copy) -> Any:
    return copy.get("/api/dispatch/plan?depot=Kandy", "dispatcher")


def _trip(board: Any, vehicle_id: str, trip_no: int) -> Any:
    return next(
        t for lane in board["lanes"] for t in lane["trips"] if (t["vehicle_id"], t["trip_no"]) == (vehicle_id, trip_no)
    )


def _earlier(trip: Any, stop: int) -> dict[str, list[str]]:
    refs = [s["order_ref"] for s in trip["stops"]]
    refs[stop - 2], refs[stop - 1] = refs[stop - 1], refs[stop - 2]
    return {"order_refs": refs}


def test_a_new_order_that_breaks_the_next_trip_is_refused(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("evening")
    copy.sign_in("nuwan", "dispatcher")
    board = _board(copy)
    first = _trip(board, "VEH057", 1)
    path = f"/api/dispatch/plan/{board['plan']['id']}/trips/VEH057/1/reorder"
    body = _earlier(first, 5)  # Watapuluwa before Katugastota brings the truck back 22 min later

    preview = copy.post(f"{path}/preview", body, "dispatcher")
    assert preview["broken"] == ["Trip 2: Leaves 6:12 AM, before trip 1 is back at 6:24 AM plus 10 min"]
    copy.post(path, body, "dispatcher", expect=409)

    board = _board(copy)
    assert board["broken"] == 0
    assert _trip(board, "VEH057", 1)["stops"] == first["stops"]


def test_the_later_trips_stores_hear_their_new_time(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("evening")
    copy.sign_in("nuwan", "dispatcher")
    board = _board(copy)
    path = f"/api/dispatch/plan/{board['plan']['id']}/trips/VEH044/1/reorder"
    body = _earlier(_trip(board, "VEH044", 1), 4)

    preview = copy.post(f"{path}/preview", body, "dispatcher")
    assert preview["broken"] == []
    assert "Tennekumbura on trip 2: expected 12:18 PM, was 12:15 PM." in preview["costs"]
    assert "OUT095 Tennekumbura is told the new time, around 12:20 PM." in preview["told"]

    copy.post(path, body, "dispatcher")
    again = copy.post(f"{path}/preview", body, "dispatcher")
    assert not [line for line in again["costs"] if "on trip 2" in line]
    assert not [line for line in again["told"] if "Tennekumbura" in line]


def test_a_loaded_truck_keeps_its_stop_order(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("2026-04-08T03:05:00+05:30")
    copy.sign_in("nuwan", "dispatcher")
    board = _board(copy)
    path = f"/api/dispatch/plan/{board['plan']['id']}/trips/VEH045/1/reorder"
    body = _earlier(_trip(board, "VEH045", 1), 2)
    copy.post(f"{path}/preview", body, "dispatcher")

    copy.jump("handover")  # Rizwan marks the load complete a minute before Kasun reaches the dock
    copy.sign_in("rizwan", "loader")
    tonight = copy.get("/api/dock/loads", "loader")
    assert any(c["vehicle_id"] == "VEH045" for c in tonight["ready"])
    board = _board(copy)
    assert _trip(board, "VEH045", 1)["load_locked"]
    assert not _trip(board, "VEH042", 2)["load_locked"]

    refused = copy.post(f"{path}/preview", body, "dispatcher", expect=409)
    assert refused["detail"].startswith("VEH045 is already loaded for this stop order.")
    copy.post(path, body, "dispatcher", expect=409)


def test_undo_ends_when_the_plan_is_published(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("plan")
    copy.sign_in("nuwan", "dispatcher")
    plan = _board(copy)["plan"]["id"]
    board = copy.post(
        f"/api/dispatch/plan/{plan}/move",
        {"order_ref": "ORD0098598", "vehicle_id": "VEH045", "trip_no": 1},
        "dispatcher",
    )
    assert board["can_undo"]

    copy.jump("publish")
    board = copy.post(f"/api/dispatch/plan/{plan}/publish", None, "dispatcher")
    assert board["plan"]["status"] == "published"
    assert not board["can_undo"]

    copy.jump("loading")
    copy.post(f"/api/dispatch/plan/{plan}/undo", None, "dispatcher", expect=409)
    copy.sign_in("rizwan", "loader")
    tonight = copy.get("/api/dock/loads", "loader")
    assert tonight["loads"] == 15
    card = next(c for group in ("loading", "ready", "to_load") for c in tonight[group] if c["vehicle_id"] == "VEH045")
    assert card["loaded"] > 0
