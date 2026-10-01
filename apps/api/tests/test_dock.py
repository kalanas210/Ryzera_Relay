"""The night at the Kandy hub dock, through the API: the demo skips ahead to 2:40 AM, Rizwan counts and flags the
rice and dhal for Dilani's store, Nuwan answers from home, the load is handed over and Kasun accepts it."""

from __future__ import annotations

from collections.abc import Callable

from copy_client import Copy

HEMMATHAGAMA_DRY = "ORD0098595"
MAWANELLA_DRY = "ORD0098597"
THURSDAY_DRY = "ORD0098747"


def _story_trip(copy: Copy) -> dict:  # type: ignore[type-arg]
    tonight = copy.get("/api/dock/loads", "loader")
    card = next(c for group in ("loading", "ready", "to_load") for c in tonight[group] if c["vehicle_id"] == "VEH045")
    return copy.get(f"/api/dock/trips/{card['trip_id']}", "loader")


def _line(load: dict, order_ref: str, case_type: str) -> dict:  # type: ignore[type-arg]
    group = next(g for g in load["groups"] if g["order_ref"] == order_ref)
    return next(line for line in group["lines"] if line["case_type"] == case_type)


def test_skipping_to_the_dock_plays_the_evening(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    state = copy.jump("loading")
    assert state["played"] == [
        "Dilani places her chilled and dry orders",
        "Relay proposes the Kandy plan",
        "Nuwan confirms the deferral with Relay's reason",
        "Nuwan publishes Peliyagoda",
        "Nuwan publishes the Kandy plan",
        "Nuwan swaps two stops on Kasun's run",
        "Rizwan loads the last stop first",
    ]
    copy.sign_in("rizwan", "loader")
    tonight = copy.get("/api/dock/loads", "loader")
    assert tonight["loads"] == 15
    assert tonight["daytime"] == 3
    assert {w["vehicle_id"] for w in tonight["workshop"]} == {"VEH039", "VEH058"}
    assert all(w["back_on"] == "2026-04-09" for w in tonight["workshop"])

    [notice] = tonight["notices"]
    assert notice["kind"] == "swap"
    assert notice["vehicle_id"] == "VEH045"
    assert notice["by"] == "Nuwan Perera"
    assert notice["first_place"] == "Hemmathagama"

    load = _story_trip(copy)
    assert [g["seq"] for g in load["groups"]] == [4, 3, 2, 1]  # the last stop goes in first
    assert [g["place"] for g in load["groups"]] == ["Aranayake", "Hemmathagama", "Mawanella", "Kegalle"]
    assert load["groups"][0]["state"] == "done"
    assert load["groups"][1]["moved_from"] == 2
    assert load["groups"][2]["moved_from"] == 3
    assert (load["loaded"], load["cases"]) == (86, 383)
    # heaviest case type first within a stop
    assert [line["case_type"] for line in load["groups"][1]["lines"]] == ["rice_dhal", "packet_foods", "tea_biscuit"]


def test_flag_answer_and_handover(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    copy.sign_in("nuwan", "dispatcher")
    copy.sign_in("dilani", "store_manager")

    load = _story_trip(copy)
    rice = _line(load, HEMMATHAGAMA_DRY, "rice_dhal")
    load = copy.post(f"/api/dock/lines/{rice['id']}", {"loaded": 30}, "loader")
    assert _line(load, HEMMATHAGAMA_DRY, "rice_dhal")["status"] == "in_progress"
    assert load["loaded"] == 116

    load = copy.post(f"/api/dock/lines/{rice['id']}/flag", {"kind": "missing", "qty": 6}, "loader")
    assert load["flags_waiting"] == 1
    # a flagged line cannot be ticked off while the dispatcher decides
    copy.post(f"/api/dock/lines/{rice['id']}", {"loaded": 36}, "loader", expect=409)
    # and the load cannot be completed
    copy.post(f"/api/dock/trips/{load['trip_id']}/complete", None, "loader", expect=409)

    feed = copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")
    [item] = feed["now"]
    assert item["title"] == "6 rice and dhal cases missing on VEH045, stop 3"
    shortfall = item["shortfall"]
    assert (shortfall["next_order_ref"], shortfall["next_day"]) == (THURSDAY_DRY, "2026-04-09")
    assert shortfall["stop_cases"] == 102
    assert shortfall["store_contact"] == "Dilani Jayawardena"

    feed = copy.post(
        f"/api/dispatch/live/shortfalls/{shortfall['id']}/decide", {"decision": "send_short"}, "dispatcher"
    )
    assert not feed["now"]
    assert feed["earlier"][0]["outcome"].startswith("Send short, add to Thursday")

    load = copy.get(f"/api/dock/trips/{load['trip_id']}", "loader")
    rice = _line(load, HEMMATHAGAMA_DRY, "rice_dhal")
    assert rice["status"] == "decided"
    assert rice["shortfall"]["added_to_order_ref"] == THURSDAY_DRY

    for group in load["groups"]:
        for line in group["lines"]:
            if line["status"] in ("to_load", "in_progress"):
                load = copy.post(f"/api/dock/lines/{line['id']}", {"loaded": line["qty"]}, "loader")
    assert (load["loaded"], load["short"], load["lines_done"], load["lines_total"]) == (377, 6, 12, 12)

    load = copy.post(f"/api/dock/trips/{load['trip_id']}/complete", None, "loader")
    handover = load["handover"]
    assert handover["completed_by"] == "Mohamed Rizwan"
    assert (handover["loaded_kg"], handover["planned_kg"]) == (2470.8, 2530.8)
    assert (handover["loaded_m3"], handover["planned_m3"]) == (13.864, 14.104)
    assert [(s["place"], s["loaded"]) for s in handover["stops"]] == [
        ("Kegalle", 57),
        ("Mawanella", 138),
        ("Hemmathagama", 96),
        ("Aranayake", 86),
    ]

    copy.post(f"/api/dock/trips/{load['trip_id']}/accept", {"pin": "0000"}, "loader", expect=401)
    load = copy.post(f"/api/dock/trips/{load['trip_id']}/accept", {"pin": "3690"}, "loader")
    assert load["handover"]["accepted_by"] == "Kasun Bandara"
    assert load["handover"]["accepted_on"] == "tablet"

    notices = copy.get("/api/store/notices", "store_manager")
    short = next(n for n in notices if n["kind"] == "short_delivery")
    assert short["title"] == "6 rice and dhal cases are short in today's dry order"
    moved = next(n for n in notices if n["kind"] == "order_moved")
    assert "now expected later" in moved["body"]


def test_withdrawn_flag_reopens_the_line(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    load = _story_trip(copy)
    rice = _line(load, HEMMATHAGAMA_DRY, "rice_dhal")
    copy.post(f"/api/dock/lines/{rice['id']}/flag", {"kind": "missing", "qty": 6}, "loader")
    load = copy.delete(f"/api/dock/lines/{rice['id']}/flag", "loader")
    rice = _line(load, HEMMATHAGAMA_DRY, "rice_dhal")
    assert rice["shortfall"] is None
    assert (rice["status"], rice["loaded"]) == ("in_progress", 30)
    load = copy.post(f"/api/dock/lines/{rice['id']}", {"loaded": 36}, "loader")
    assert _line(load, HEMMATHAGAMA_DRY, "rice_dhal")["status"] == "checked"


def test_the_world_leaves_a_load_a_person_started(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("suresh", "loader")
    tonight = copy.get("/api/dock/loads", "loader")
    card = next(c for c in tonight["loading"] + tonight["to_load"] if c["vehicle_id"] == "VEH057" and c["trip_no"] == 1)
    load = copy.get(f"/api/dock/trips/{card['trip_id']}", "loader")
    first = load["groups"][0]["lines"][0]
    copy.post(f"/api/dock/lines/{first['id']}", {"loaded": first["qty"]}, "loader")
    before = copy.get(f"/api/dock/trips/{card['trip_id']}", "loader")["loaded"]

    copy.advance(60)  # the world loads every other truck by now
    after = copy.get(f"/api/dock/trips/{card['trip_id']}", "loader")
    assert after["loaded"] == before
    assert after["handover"]["completed_at"] is None


def test_skipping_past_the_handover_finishes_a_load_the_judge_started(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    load = _story_trip(copy)
    tea = _line(load, MAWANELLA_DRY, "tea_biscuit")
    copy.post(f"/api/dock/lines/{tea['id']}", {"loaded": tea["qty"]}, "loader")

    state = copy.jump("handover")
    # the judge started this load, so the story's flag is not played on it; the rest is finished for the truck to go
    assert "Rizwan flags 6 rice and dhal cases missing" not in state["played"]
    assert "Rizwan finishes loading" in state["played"]
    load = copy.get(f"/api/dock/trips/{load['trip_id']}", "loader")
    assert load["lines_done"] == load["lines_total"]
    assert load["short"] == 0


def test_a_copy_cannot_reach_another_copys_loads(new_copy: Callable[[], Copy]) -> None:
    first, second = new_copy(), new_copy()
    first.jump("loading")
    first.sign_in("rizwan", "loader")
    load = _story_trip(first)
    line = load["groups"][1]["lines"][0]

    second.sign_in("rizwan", "loader")
    response = second.client.get(f"/api/dock/trips/{load['trip_id']}", headers={"X-Relay-Role": "loader"})
    assert response.status_code == 404
    response = second.client.post(
        f"/api/dock/lines/{line['id']}", json={"loaded": 1}, headers={"X-Relay-Role": "loader"}
    )
    assert response.status_code == 404
