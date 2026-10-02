"""The deferrals drawer (DSP-03) and the publish check, through the API. The next-run check plans every waiting order
together and reports when each store is served, not a time before it opens; Relay's choice explains each waiting
order and reads as plain lists; an override keeps the counts honest and is costed before it is made; the publish check
names the store and what each other vehicle would cost; and the store's Got it reaches the dispatcher."""

from __future__ import annotations

import re
from collections.abc import Callable
from typing import Any

from copy_client import Copy

from relay_api.services.planning import and_list


def _board(copy: Copy) -> Any:
    return copy.get("/api/dispatch/plan?depot=Kandy", "dispatcher")


def _drawer(copy: Copy, plan_id: str) -> Any:
    return copy.get(f"/api/dispatch/plan/{plan_id}/deferrals", "dispatcher")


def _minutes(ampm: str) -> int:
    clock, half = ampm.split()
    h, m = (int(x) for x in clock.split(":"))
    return (h % 12 + (12 if half == "PM" else 0)) * 60 + m


def _opens(row: dict[str, Any]) -> int:
    h, m = (int(x) for x in row["window_open"].split(":"))
    return h * 60 + m


def test_and_list_reads_as_a_sentence() -> None:
    assert and_list([]) == ""
    assert and_list(["VEH039"]) == "VEH039"
    assert and_list(["VEH039", "VEH058"]) == "VEH039 and VEH058"
    assert and_list(["VEH039", "VEH043", "VEH058"]) == "VEH039, VEH043 and VEH058"


def test_the_main_story_drawer_explains_the_choice_from_the_weights(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("plan")
    copy.sign_in("nuwan", "dispatcher")
    drawer = _drawer(copy, _board(copy)["plan"]["id"])
    [group] = drawer["groups"]
    rules = {r["n"]: r for r in group["rules"]}
    assert rules[3]["reason"] == (
        "With OUT119 on VEH057, OUT116 Aranayake fits beside it (801.6 kg together). "
        "OUT117 and OUT119 together would be 1,125.6 kg, over the van's 1,040 kg."
    )
    assert group["pool"]["summary"] == (
        "Only OUT117 and OUT119 keep all five vehicles on their usual runs. Rule 2 picks OUT117."
    )
    # by the published minutes alone all 23 fit, VEH042 taking every Kegalle store after Matale; the clock says no
    paper = group["paper"]
    assert paper["orders"] == 23
    assert {"vehicle_id": "VEH042", "takes": "Matale, then all three Kegalle stores", "minutes": "129 + 124 = 253"} in (
        paper["rows"]
    )
    assert any(line.startswith("VEH042 is back from Matale at ") for line in paper["fails"])

    [waiting] = drawer["waiting"]
    check = waiting["next_run"]
    assert check["fits"]
    assert check["vehicle_id"] == "VEH039"
    assert check["back_from_workshop"]
    # VEH039 reaches Hemmathagama before it opens and waits: the plan is when unloading starts, at the opening
    assert _minutes(check["planned"]) == _opens(waiting) == 4 * 60
    assert _minutes(check["arrives"]) < _minutes(check["planned"])
    assert check["inside_windows"]


def test_override_is_costed_first_and_keeps_the_counts(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("plan")
    copy.sign_in("nuwan", "dispatcher")
    plan_id = _board(copy)["plan"]["id"]
    preview = copy.get(f"/api/dispatch/plan/{plan_id}/override/preview?order_ref=ORD0098599", "dispatcher")
    assert preview["consequence"] == (
        "If you defer it, Hemmathagama's order rides VEH057 with Aranayake instead: 994.4 kg on the van."
    )

    copy.post(
        f"/api/dispatch/plan/{plan_id}/override", {"order_ref": "ORD0098599", "note": "Kegalle asked"}, "dispatcher"
    )
    drawer = _drawer(copy, plan_id)
    [group] = drawer["groups"]
    # what no plan could avoid is still counted on the run with every order in it
    assert (group["orders"], group["max_served"], group["unavoidable"]) == (23, 22, 1)
    assert group["waits"] == group["unavoidable"] == group["by_override"] == 1
    rule_two = next(r for r in group["rules"] if r["n"] == 2)["reason"]
    assert rule_two.startswith("OUT119 Kegalle had its Monday chilled order wait.")
    assert "by override at" in rule_two
    [waiting] = drawer["waiting"]
    assert waiting["overridden"]
    assert waiting["confirmed_at"]
    # with Other, the note is the words the store reads
    assert "Kegalle asked" in waiting["store_notice"]


def test_waiting_orders_are_checked_on_the_next_run_together(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("plan")
    copy.sign_in("nuwan", "dispatcher")
    copy.client.patch(
        "/api/dispatch/plan/vehicles/VEH043?depot=Kandy",
        json={"run_date": "2026-04-08", "status": "workshop", "note": ""},
        headers={"X-Relay-Role": "dispatcher"},
    ).raise_for_status()
    board = copy.post("/api/dispatch/plan/propose", {"depot": "Kandy"}, "dispatcher")
    drawer = _drawer(copy, board["plan"]["id"])
    waiting = drawer["waiting"]
    assert len(waiting) > 1
    assert [w["outlet_id"] for w in waiting] == sorted(w["outlet_id"] for w in waiting)

    # one plan of Thursday: two waiting orders on one trip share its departure, and no store is served before it opens
    trips: dict[tuple[str, int], str] = {}
    for w in waiting:
        check = w["next_run"]
        assert check["fits"]
        assert check["checked_with"] == sorted(x["order_ref"] for x in waiting)
        key = (check["vehicle_id"], check["trip_no"])
        assert trips.setdefault(key, check["depart"]) == check["depart"]
        assert _minutes(check["planned"]) >= _opens(w)

    [group] = drawer["groups"]
    assert group["unavoidable"] == group["waits"] == len(waiting)
    rule_three = next(r for r in group["rules"] if r["n"] == 3)
    assert [line.split(",")[0] for line in rule_three["lines"]] == [
        f"{w['outlet_id']} {w['short_name']}" for w in waiting
    ]
    # lists read "A, B and C", never "A and B and C"
    text = " ".join([*(r["reason"] for r in group["rules"]), group["pool"]["summary"], group["result"]])
    assert not re.search(r"(OUT|VEH)\d{3} and (OUT|VEH)\d{3} and ", text)
    assert "VEH039, VEH043 and VEH058 are in the workshop." in text


def test_the_publish_check_names_the_store_and_the_alternatives(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("plan")
    copy.sign_in("nuwan", "dispatcher")
    plan_id = _board(copy)["plan"]["id"]
    check = copy.get(f"/api/dispatch/plan/{plan_id}/check", "dispatcher")
    rows = check["expected_late"]
    assert rows
    assert all(r["short_name"] for r in rows)
    by_store = {r["outlet_id"]: r for r in rows}
    assert by_store["OUT085"]["short_name"] == "Kandy Town"
    assert "would miss its 7:30 AM close in any stop order" in by_store["OUT085"]["why"]
    assert "back too late to reach it by 7:30 AM" in by_store["OUT085"]["why"]
    # the second late store of a trip says so instead of repeating the timetable
    seen: set[tuple[str, int]] = set()
    for r in rows:
        key = (r["vehicle_id"], r["trip_no"])
        assert r["why"].startswith("Same trip.") == (key in seen)
        seen.add(key)


def test_the_dispatcher_sees_when_the_store_saw_its_notice(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("evening")
    copy.sign_in("nuwan", "dispatcher")
    copy.sign_in("dilani", "store_manager")
    plan_id = _board(copy)["plan"]["id"]
    [before] = _drawer(copy, plan_id)["waiting"]
    assert before["notified_at"]
    assert before["acknowledged_at"] is None

    [notice] = [n for n in copy.get("/api/store/notices", "store_manager") if n["kind"] == "order_deferred"]
    copy.post(f"/api/store/notices/{notice['id']}/ack", {}, "store_manager")
    [after] = _drawer(copy, plan_id)["waiting"]
    assert after["acknowledged_at"] is not None
