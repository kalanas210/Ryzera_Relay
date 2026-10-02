"""Dilani's side of the morning through the API: the store sees a delivery time only once the plan is published,
reads the planned and actual times of its own stop, and can still report a problem after confirming receipt."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from zoneinfo import ZoneInfo

from copy_client import Copy

COLOMBO = ZoneInfo("Asia/Colombo")
DRY_ORDER = "ORD0098595"


def hm(value: str | None) -> str | None:
    return datetime.fromisoformat(value).astimezone(COLOMBO).strftime("%H:%M") if value else None


def tracker(copy: Copy) -> dict:
    return copy.get(f"/api/store/orders/{DRY_ORDER}/tracker", "store_manager")


def test_a_draft_plan_is_not_the_stores_to_see(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("plan")  # Relay has proposed the Kandy plan; nobody has published it
    copy.sign_in("dilani", "store_manager")
    seen = tracker(copy)
    assert (seen["status"], seen["stop_seq"], seen["expected"]) == ("scheduled", None, None)

    copy.jump("evening")  # published at 6:40 PM: now the store has its time
    seen = tracker(copy)
    assert seen["stop_seq"] is not None
    assert seen["expected"] is not None
    assert seen["planned"] is not None


def test_a_problem_found_after_confirming_still_reaches_the_dispatcher(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    state = copy.jump("receipt")
    assert hm(state["now"]) == "06:40"
    copy.sign_in("dilani", "store_manager")
    copy.sign_in("nuwan", "dispatcher")
    seen = tracker(copy)
    assert hm(seen["departed_at"]) is not None
    assert hm(seen["issues_until"]) == "16:00"

    copy.post(f"/api/store/orders/{DRY_ORDER}/receipt", {"client_ref": "receipt-first"}, "store_manager")
    later = {
        "client_ref": "issue-after-receipt",
        "issues": [{"case_type": "packet_foods", "kind": "damaged", "qty": 1, "note": "Crushed at the back"}],
    }
    seen = copy.post(f"/api/store/orders/{DRY_ORDER}/issues", later, "store_manager")
    assert seen["status"] == "disputed"
    assert seen["receipt"]["status"] == "with_issues"
    assert [(i["case_type"], i["qty"], i["note"]) for i in seen["receipt"]["issues"]] == [
        ("packet_foods", 1, "Crushed at the back")
    ]
    assert hm(seen["receipt"]["reported_at"]) == "06:40"

    # Try again with the same client_ref reports nothing twice
    again = copy.post(f"/api/store/orders/{DRY_ORDER}/issues", later, "store_manager")
    assert len(again["receipt"]["issues"]) == 1
    feed = copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")
    disputes = [i for i in feed["now"] if i["kind"] == "dispute"]
    assert len(disputes) == 1
    assert disputes[0]["ref"]["order_ref"] == DRY_ORDER

    # nothing to report without a receipt to add it to
    copy.post("/api/store/orders/ORD0098596/issues", later | {"client_ref": "no-receipt-yet"}, "store_manager", 409)
