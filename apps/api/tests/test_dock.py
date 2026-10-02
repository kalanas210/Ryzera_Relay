"""The night at the Kandy hub dock, through the API: the demo skips ahead to 2:40 AM, Rizwan counts and flags the
rice and dhal for Dilani's store, Nuwan answers from home, the load is handed over and Kasun accepts it."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime
from typing import Any

from copy_client import Copy

from relay_api.clock import COLOMBO

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
        "Dilani places the chilled and dry orders",
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
    assert (shortfall["run_date"], shortfall["trip_stops"]) == ("2026-04-08", 4)
    # the hub has no spare, and the supplier's rice and dhal comes at 5:00 AM, after the truck leaves
    assert shortfall["hub_spare"] == 0
    assert datetime.fromisoformat(shortfall["next_delivery_at"]) == datetime(2026, 4, 8, 5, 0, tzinfo=COLOMBO)
    assert shortfall["photo_id"] is None
    # the tablet cannot place calls, so it shows the number that reaches the dispatcher on call
    assert load["dispatcher_phone"] == "081 000 2145"
    assert load["plan_changed_by"] == "Nuwan Perera"

    feed = copy.post(
        f"/api/dispatch/live/shortfalls/{shortfall['id']}/decide", {"decision": "send_short"}, "dispatcher"
    )
    assert not feed["now"]
    # once decided, the item reads as a shortfall on the truck, no longer as cases missing
    assert feed["earlier"][0]["title"] == "Shortfall on VEH045, stop 3"
    assert feed["earlier"][0]["outcome"] == (
        "Send short, add to Thursday. The 6 missing cases joined ORD0098747, marked from Wednesday."
    )

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

    # the dispatcher's record of the shortfall follows it to the end: the store read it, the truck was handed over
    copy.post(f"/api/store/notices/{short['id']}/ack", None, "store_manager")
    record = copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")["earlier"][0]["shortfall"]
    assert record["store_seen_at"] is not None
    assert (record["loaded_cases"], record["planned_cases"], record["accepted_by"]) == (377, 383, "Kasun Bandara")


def test_one_case_reads_as_one(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    copy.sign_in("nuwan", "dispatcher")
    copy.sign_in("dilani", "store_manager")
    packet = _line(_story_trip(copy), HEMMATHAGAMA_DRY, "packet_foods")
    copy.post(f"/api/dock/lines/{packet['id']}/flag", {"kind": "damaged", "qty": 1}, "loader")
    [item] = copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")["now"]
    assert item["title"] == "1 packet foods case damaged on VEH045, stop 3"
    feed = copy.post(
        f"/api/dispatch/live/shortfalls/{item['shortfall']['id']}/decide", {"decision": "send_short"}, "dispatcher"
    )
    assert feed["earlier"][0]["outcome"] == (
        "Send short, add to Thursday. The damaged case joined ORD0098747, marked from Wednesday."
    )
    short = next(n for n in copy.get("/api/store/notices", "store_manager") if n["kind"] == "short_delivery")
    assert short["title"] == "1 packet foods case is short in today's dry order"
    assert "1 of your 44 packet foods cases was found damaged" in short["body"]


def test_loading_now_moves_past_a_waiting_flag(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    load = _story_trip(copy)
    assert [g["state"] for g in load["groups"]] == ["done", "loading", "to_load", "to_load"]

    # stop 3's rice and dhal waits for the dispatcher, and the rest of stop 3 goes on
    rice = _line(load, HEMMATHAGAMA_DRY, "rice_dhal")
    copy.post(f"/api/dock/lines/{rice['id']}/flag", {"kind": "missing", "qty": 6}, "loader")
    for case_type in ("packet_foods", "tea_biscuit"):
        line = _line(load, HEMMATHAGAMA_DRY, case_type)
        load = copy.post(f"/api/dock/lines/{line['id']}", {"loaded": line["qty"]}, "loader")
    # so the one stop being loaded now is stop 2, even before a case of it is on
    assert [g["state"] for g in load["groups"]] == ["done", "to_load", "loading", "to_load"]

    tea = _line(load, MAWANELLA_DRY, "tea_biscuit")
    load = copy.post(f"/api/dock/lines/{tea['id']}", {"loaded": 1}, "loader")
    assert [g["state"] for g in load["groups"]] == ["done", "to_load", "loading", "to_load"]


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


def _world_trips(copy: Copy, vehicle_id: str) -> list[dict]:  # type: ignore[type-arg]
    tonight = copy.get("/api/dock/loads", "loader")
    cards = [c for group in ("loading", "ready", "to_load") for c in tonight[group] if c["vehicle_id"] == vehicle_id]
    return [copy.get(f"/api/dock/trips/{c['trip_id']}", "loader") for c in sorted(cards, key=lambda c: c["trip_no"])]


def test_a_load_a_person_finished_still_leaves(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("suresh", "loader")
    first, second = _world_trips(copy, "VEH057")
    for group in first["groups"]:
        for line in group["lines"]:
            if line["status"] != "checked":
                copy.post(f"/api/dock/lines/{line['id']}", {"loaded": line["qty"]}, "loader")
    copy.post(f"/api/dock/trips/{first['trip_id']}/complete", None, "loader")

    copy.jump("settled")
    first = copy.get(f"/api/dock/trips/{first['trip_id']}", "loader")
    # nobody plays this driver, so the world still does: the load is accepted on the phone and the truck leaves
    assert first["state"] == "left"
    assert first["handover"]["accepted_on"] == "phone"
    assert first["handover"]["completed_by"] == "Suresh Kumar"
    second = copy.get(f"/api/dock/trips/{second['trip_id']}", "loader")
    assert second["state"] == "left"
    assert second["handover"]["accepted_at"] > first["departed_at"]


def test_a_second_trip_waits_for_the_vehicle(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("suresh", "loader")
    first, second = _world_trips(copy, "VEH057")
    line = next(line for g in first["groups"] for line in g["lines"] if line["status"] == "to_load")
    copy.post(f"/api/dock/lines/{line['id']}", {"loaded": line["qty"]}, "loader")

    copy.jump("settled")
    assert copy.get(f"/api/dock/trips/{first['trip_id']}", "loader")["state"] == "loading"
    # trip 2 is picked and waits at the bay, but VEH057 is not back from a trip it never left on
    second = copy.get(f"/api/dock/trips/{second['trip_id']}", "loader")
    assert second["departed_at"] is None
    assert second["handover"]["accepted_at"] is None


def test_the_world_passes_over_a_load_a_person_holds(new_copy: Callable[[], Copy]) -> None:
    from relay_api.db import SessionLocal
    from relay_api.services.dock import lock_trip

    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("suresh", "loader")
    first, _ = _world_trips(copy, "VEH057")
    with SessionLocal() as other:
        # a person's action is in flight on this load: the tick neither waits for it nor writes over it
        lock_trip(other, first["trip_id"])
        copy.advance(5)
        assert copy.get(f"/api/dock/trips/{first['trip_id']}", "loader")["loaded"] == first["loaded"]
        other.rollback()
    copy.advance(5)
    assert copy.get(f"/api/dock/trips/{first['trip_id']}", "loader")["loaded"] > first["loaded"]


def test_a_moved_stop_marks_the_lines_already_on(new_copy: Callable[[], Copy]) -> None:
    from sqlalchemy import update

    from relay_api.db import SessionLocal
    from relay_api.models import LoadLine

    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    load = _story_trip(copy)
    assert load["lines_to_check"] == 0
    loaded = [line for line in load["groups"][0]["lines"] if line["loaded"]]
    # what a stop reorder after loading began leaves behind (services.changes marks these lines)
    with SessionLocal() as db:
        db.execute(
            update(LoadLine).where(LoadLine.id.in_([line["id"] for line in loaded])).values(changed_by_plan=True)
        )
        db.commit()
    load = copy.get(f"/api/dock/trips/{load['trip_id']}", "loader")
    assert load["lines_to_check"] == len(loaded)
    assert all(line["changed_by_plan"] for line in load["groups"][0]["lines"] if line["loaded"])

    # the loader looks at a line again, and its mark goes
    line = loaded[0]
    load = copy.post(f"/api/dock/lines/{line['id']}", {"loaded": line["qty"]}, "loader")
    assert load["lines_to_check"] == len(loaded) - 1
    assert not next(x for x in load["groups"][0]["lines"] if x["id"] == line["id"])["changed_by_plan"]


def test_a_stop_moved_twice_names_the_place_it_last_held(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    copy.sign_in("nuwan", "dispatcher")
    before = _story_trip(copy)
    mawanella = next(g for g in before["groups"] if g["order_ref"] == MAWANELLA_DRY)

    # 9:12 PM moved Hemmathagama from stop 2 to stop 3; now Nuwan swaps stops 3 and 4 as well
    board = copy.get("/api/dispatch/plan?depot=Kandy", "dispatcher")
    trip = next(t for lane in board["lanes"] for t in lane["trips"] if (t["vehicle_id"], t["trip_no"]) == ("VEH045", 1))
    refs = [s["order_ref"] for s in trip["stops"]]
    refs[2], refs[3] = refs[3], refs[2]
    copy.post(f"/api/dispatch/plan/{board['plan']['id']}/trips/VEH045/1/reorder", {"order_refs": refs}, "dispatcher")

    load = _story_trip(copy)
    hemmathagama = next(g for g in load["groups"] if g["order_ref"] == HEMMATHAGAMA_DRY)
    # it was stop 3 until this change, not stop 2: that place it left at 9:12 PM
    assert (hemmathagama["seq"], hemmathagama["moved_from"]) == (4, 3)
    assert hemmathagama["moved_at"] == load["plan_changed_at"]
    # a stop the second change left alone keeps its own move and time
    still = next(g for g in load["groups"] if g["order_ref"] == MAWANELLA_DRY)
    assert (still["moved_from"], still["moved_at"]) == (mawanella["moved_from"], mawanella["moved_at"])


def test_a_flagged_line_waits_on_the_dispatcher_not_a_check(new_copy: Callable[[], Copy]) -> None:
    from sqlalchemy import update

    from relay_api.db import SessionLocal
    from relay_api.models import LoadLine

    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    load = _story_trip(copy)
    rice = _line(load, HEMMATHAGAMA_DRY, "rice_dhal")
    copy.post(f"/api/dock/lines/{rice['id']}", {"loaded": 30}, "loader")
    copy.post(f"/api/dock/lines/{rice['id']}/flag", {"kind": "missing", "qty": 6}, "loader")
    # a stop reorder while the flag waits marks the 30 already on
    with SessionLocal() as db:
        db.execute(update(LoadLine).where(LoadLine.id == rice["id"]).values(changed_by_plan=True))
        db.commit()
    load = copy.get(f"/api/dock/trips/{load['trip_id']}", "loader")
    assert load["lines_to_check"] == 0  # the loader cannot confirm a flagged line, so it is not one to check

    # once the cases turn up and the flag is withdrawn, the line is the loader's again, mark and all
    load = copy.delete(f"/api/dock/lines/{rice['id']}/flag", "loader")
    assert load["lines_to_check"] == 1
    load = copy.post(f"/api/dock/lines/{rice['id']}", {"loaded": 36}, "loader")
    assert load["lines_to_check"] == 0


JPEG = bytes([0xFF, 0xD8, 0xFF, 0xE0, *([0] * 64), 0xFF, 0xD9])
"""Enough of a JPEG for the dock: Relay checks the type and size, the tablet does the resizing."""


def _put_photo(copy: Copy, line_id: str, data: bytes = JPEG, kind: str = "image/jpeg") -> Any:
    return copy.client.put(
        f"/api/dock/lines/{line_id}/flag/photo",
        files={"file": ("damage.jpg", data, kind)},
        headers={"X-Relay-Role": "loader"},
    )


def test_damaged_cases_carry_a_photo(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    copy.sign_in("nuwan", "dispatcher")
    packet = _line(_story_trip(copy), HEMMATHAGAMA_DRY, "packet_foods")
    assert _put_photo(copy, packet["id"]).status_code == 409  # the flag comes first

    copy.post(f"/api/dock/lines/{packet['id']}/flag", {"kind": "damaged", "qty": 2}, "loader")
    assert _put_photo(copy, packet["id"], b"not a photo", "text/plain").status_code == 409
    response = _put_photo(copy, packet["id"])
    assert response.status_code == 200, response.text
    first = _line(response.json(), HEMMATHAGAMA_DRY, "packet_foods")["shortfall"]["photo_id"]
    assert first is not None

    # the dispatcher sees what the dock saw, and so does whoever is signed in on the tablet
    [item] = copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")["now"]
    assert item["shortfall"]["photo_id"] == first
    assert copy.client.get(f"/api/photos/{first}?as=dispatcher").content == JPEG
    copy.sign_in("suresh", "loader")
    assert copy.client.get(f"/api/photos/{first}?as=loader").status_code == 200

    # a second photo replaces the first, and withdrawing the flag takes the photo with it
    second = _line(_put_photo(copy, packet["id"]).json(), HEMMATHAGAMA_DRY, "packet_foods")["shortfall"]["photo_id"]
    assert second != first
    assert copy.client.get(f"/api/photos/{first}?as=dispatcher").status_code == 404
    copy.delete(f"/api/dock/lines/{packet['id']}/flag", "loader")
    assert copy.client.get(f"/api/photos/{second}?as=dispatcher").status_code == 404


def test_departures_read_one_row_per_time(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    tonight = copy.get("/api/dock/loads", "loader")
    rows = tonight["left"]
    assert rows, "by 2:40 AM the Badulla runs have left"
    times = [datetime.fromisoformat(row["at"]) for row in rows]
    assert all(at.second == 0 and at.microsecond == 0 for at in times)
    assert times == sorted(times)
    assert len({(row["at"], row["district"]) for row in rows}) == len(rows)
    assert all("until" not in row for row in rows)
    assert sum(len(row["vehicles"]) for row in rows) == tonight["left_count"]


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


def test_a_loader_reaches_only_their_own_hubs_loads(new_copy: Callable[[], Copy]) -> None:
    from sqlalchemy import select

    from relay_api.db import SessionLocal, scope_to_workspace
    from relay_api.models import LoadLine, Plan, Trip
    from relay_api.workspaces import find_workspace

    copy = new_copy()
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")  # a Kandy loader
    with SessionLocal() as db:
        workspace = find_workspace(db, copy.code)
        assert workspace is not None
        scope_to_workspace(db, workspace.id)
        trip = db.scalars(select(Trip).join(Plan, Plan.id == Trip.plan_id).where(Plan.depot == "Peliyagoda")).first()
        assert trip is not None
        line = db.scalars(select(LoadLine).where(LoadLine.trip_id == trip.id)).first()
        assert line is not None
        trip_id, line_id, loaded = trip.id, line.id, line.loaded_qty

    headers = {"X-Relay-Role": "loader"}
    # another hub's load reads as not there, and nothing on it changes
    assert copy.client.get(f"/api/dock/trips/{trip_id}", headers=headers).status_code == 404
    assert copy.client.post(f"/api/dock/lines/{line_id}", json={"loaded": 1}, headers=headers).status_code == 404
    flag = copy.client.post(f"/api/dock/lines/{line_id}/flag", json={"kind": "missing", "qty": 1}, headers=headers)
    assert flag.status_code == 404
    assert copy.client.post(f"/api/dock/trips/{trip_id}/complete", json={}, headers=headers).status_code == 404
    accept = copy.client.post(f"/api/dock/trips/{trip_id}/accept", json={"pin": "3690"}, headers=headers)
    assert accept.status_code == 404
    with SessionLocal() as db:
        assert db.get(LoadLine, line_id).loaded_qty == loaded  # type: ignore[union-attr]

    # the loader's own hub is still theirs
    assert _story_trip(copy)["vehicle_id"] == "VEH045"
