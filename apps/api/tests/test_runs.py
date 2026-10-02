"""The runs panel on the dispatcher's desk at the end of Kasun's morning: a finished trip is never read as back at the
hub, the driver's "no" reaches the track, the caption names every stop that will be late, the store line names the
person at the store, and a settled two-copy stop waits under Now until the dispatcher has reviewed it."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from typing import Any
from zoneinfo import ZoneInfo

from copy_client import Copy

COLOMBO = ZoneInfo("Asia/Colombo")
DAY = "2026-04-08"


def hm(value: str | None) -> str | None:
    return datetime.fromisoformat(value).astimezone(COLOMBO).strftime("%H:%M") if value else None


def spoken(value: datetime) -> str:
    """How captions print a time: '9:10 AM'."""
    local = value.astimezone(COLOMBO)
    return f"{local.hour % 12 or 12}:{local.minute:02d} {'AM' if local.hour < 12 else 'PM'}"


def jumped(new_copy: Callable[[], Copy], moment: str) -> Copy:
    copy = new_copy()
    copy.jump(moment)
    for username, role in (("kasun", "driver"), ("nuwan", "dispatcher")):
        copy.sign_in(username, role)
    return copy


def kasun_row(copy: Copy) -> dict[str, Any]:
    panel = copy.get("/api/dispatch/live/runs?depot=Kandy", "dispatcher")
    return next(r for r in panel["rows"] if r["vehicle_id"] == "VEH045" and not r["is_backup"])


def marker(row: dict[str, Any], place: str) -> dict[str, Any]:
    return next(m for m in row["markers"] if m["place"] == place)


def feed(copy: Copy) -> dict[str, Any]:
    return copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")


def test_a_finished_trip_is_not_back_at_the_hub(new_copy: Callable[[], Copy]) -> None:
    from relay_api.services import words

    copy = jumped(new_copy, "settled")
    run = copy.get("/api/driver/run", "driver")
    row = kasun_row(copy)
    assert (row["status"], hm(row["finished_at"])) == ("finished", "07:17")
    # the desk reads the time home the phone shows, and only as Relay's estimate
    assert row["expected_back"] == run["trip"]["expected_back"]
    back = datetime.fromisoformat(row["expected_back"])
    assert back > datetime.fromisoformat(row["finished_at"])
    assert row["caption"] == (
        f"Trip finished at 7:17 AM. Expected back at the Kandy hub around {spoken(words.round5(back))}."
    )
    assert "Back at the hub" not in row["caption"]


def test_the_desk_shows_expected_to_the_minute_and_around_while_silent(new_copy: Callable[[], Copy]) -> None:
    copy = jumped(new_copy, "on_the_road")
    stops = kasun_row(copy)["markers"][1:]
    # DSP-04 at 5:20 AM: the desk reads the minute, where Kasun's phone and Dilani's tracker read 5 minutes
    assert [(m["state"], hm(m["estimate"])) for m in stops] == [
        ("next", "05:30"),
        ("pending", "06:35"),
        ("pending", "07:12"),
    ]
    run = copy.get("/api/driver/run", "driver")
    assert [hm(s["expected"]) for s in run["trip"]["stops"][1:]] == ["05:30", "06:35", "07:10"]

    copy.jump("silence")
    row = kasun_row(copy)
    assert row["out_of_contact"]
    # once the phone is silent the desk says "around", with the time the store reads
    assert [hm(m["estimate"]) for m in row["markers"][2:]] == ["06:35", "07:15"]


def _say_no(copy: Copy) -> dict[str, Any]:
    """Kasun answers the one question at 7:14: the delivery at Aranayake was not made."""
    run = copy.get("/api/driver/run", "driver")
    [question] = run["questions"]
    aranayake = next(s for s in run["trip"]["stops"] if s["place"] == "Aranayake")
    answer = {
        "id": str(uuid.uuid4()),
        "kind": "conflict_answer",
        "trip_id": run["trip"]["trip_id"],
        "stop_id": aranayake["stop_id"],
        "base_version": None,
        "occurred_at": f"{DAY}T07:14:00+05:30",
        "payload": {"conflict_id": question["id"], "answer": "no"},
    }
    out = copy.post("/api/driver/records", {"device_id": "test-phone", "records": [answer]}, "driver")
    assert out["results"][0]["outcome"] == "applied"
    return dict(question)


def test_after_the_drivers_no_the_backup_keeps_the_stop(new_copy: Callable[[], Copy]) -> None:
    copy = jumped(new_copy, "signal_back")
    question = _say_no(copy)
    item = next(i for i in feed(copy)["now"] if i["kind"] == "conflict")
    settle = f"/api/dispatch/live/conflicts/{question['id']}/settle"

    panel = copy.post(settle, {"keep": "backup"}, "dispatcher")
    row = next(r for r in panel["rows"] if r["vehicle_id"] == "VEH045" and not r["is_backup"])
    # the stop is VEH060's alone now, and VEH060 carries on to it
    assert {k: marker(row, "Aranayake")[k] for k in ("state", "moved_to", "handed_over")} == {
        "state": "moved",
        "moved_to": "VEH060",
        "handed_over": True,
    }
    assert row["caption"] == "Every stop is done. Stop 4 is with VEH060. Kasun has not finished the trip yet."
    [backup] = [r for r in panel["rows"] if r["is_backup"]]
    assert backup["markers"][0]["state"] != "cancelled"
    settled = next(i for i in [*feed(copy)["now"], *feed(copy)["earlier"]] if i["id"] == item["id"])
    assert settled["handled_at"] is not None
    assert (settled["ref"]["resolution"], settled["outcome"]) == (
        "backup",
        "The driver answered no: not delivered. VEH060's copy stands.",
    )

    # the phone hears it settled, and Relay no longer holds a delivery for the stop from its records
    run = copy.get("/api/driver/run", "driver")
    [asked] = run["questions"]
    assert (asked["status"], asked["resolution"]) == ("resolved", "backup")
    stop = next(s for s in run["trip"]["stops"] if s["place"] == "Aranayake")
    assert (stop["status"], stop["completed_at"], stop["has_photo"]) == ("moved", None, False)
    assert any(n["title"] == "Stop 4 stays with VEH060" for n in run["notices"])

    # the first answer wins: cancelling the backup's copy now changes nothing
    copy.post(settle, {"keep": "driver"}, "dispatcher")
    assert marker(kasun_row(copy), "Aranayake")["handed_over"] is True


def test_the_drivers_no_reaches_the_track(new_copy: Callable[[], Copy]) -> None:
    copy = jumped(new_copy, "signal_back")
    run = copy.get("/api/driver/run", "driver")
    [question] = run["questions"]
    aranayake = next(s for s in run["trip"]["stops"] if s["place"] == "Aranayake")
    assert marker(kasun_row(copy), "Aranayake")["denied"] is False

    answer = {
        "id": str(uuid.uuid4()),
        "kind": "conflict_answer",
        "trip_id": run["trip"]["trip_id"],
        "stop_id": aranayake["stop_id"],
        "base_version": None,
        "occurred_at": f"{DAY}T07:14:00+05:30",
        "payload": {"conflict_id": question["id"], "answer": "no"},
    }
    out = copy.post("/api/driver/records", {"device_id": "test-phone", "records": [answer]}, "driver")
    assert out["results"][0]["outcome"] == "applied"

    row = kasun_row(copy)
    stop4 = marker(row, "Aranayake")
    # still two copies, but the phone's delivery is no longer shown as if it stood
    assert (stop4["state"], stop4["denied"]) == ("conflict", True)
    assert row["caption"] == "Kasun says stop 4, Aranayake, was not delivered. It has two copies until it is settled."


def test_the_store_line_names_the_person_at_the_store(new_copy: Callable[[], Copy]) -> None:
    copy = jumped(new_copy, "silence")
    row = kasun_row(copy)
    assert marker(row, "Hemmathagama")["store_contact"] == "Dilani Jayawardena"


def test_every_late_stop_is_named() -> None:
    from relay_api.services.runs import Marker, late_words

    def at(clock: str) -> datetime:
        return datetime.fromisoformat(f"{DAY}T{clock}:00+05:30").astimezone(UTC)

    def late(place: str, closes: str) -> Marker:
        return Marker("s", 1, "OUT", place, "pending", at("06:00"), at(closes), late_risk=True)

    assert late_words([]) == ""
    assert late_words([late("Aranayake", "07:30")]) == "Aranayake is expected after its 7:30 AM close."
    assert late_words([late("Suduhumpola", "07:45"), late("Ampitiya", "08:00")]) == (
        "Suduhumpola and Ampitiya are expected after their 7:45 AM and 8:00 AM closes."
    )
    assert late_words([late("Aranayake", "08:00"), late("Kegalle", "08:00"), late("Hantana", "08:00")]) == (
        "Aranayake, Kegalle and Hantana are expected after their 8:00 AM close."
    )


def test_a_settled_two_copy_stop_waits_for_review(new_copy: Callable[[], Copy]) -> None:
    copy = jumped(new_copy, "signal_back")
    open_item = next(i for i in feed(copy)["now"] if i["kind"] == "conflict")
    # nothing to review before it is settled
    copy.post(f"/api/dispatch/live/feed/{open_item['id']}/review", role="dispatcher", expect=409)

    state = copy.jump("settled")
    settled = next(i for i in feed(copy)["earlier"] if i["kind"] == "conflict")
    assert (settled["handled_at"] is not None, settled["reviewed_at"]) == (True, None)
    copy.post(f"/api/dispatch/live/feed/{settled['id']}/review", role="dispatcher", expect=204)
    reviewed = next(i for i in feed(copy)["earlier"] if i["kind"] == "conflict")
    assert hm(reviewed["reviewed_at"]) == hm(state["now"])
    assert reviewed["reviewed_by"] == "Nuwan Perera"

    # a second review keeps the first time
    copy.advance(3)
    copy.post(f"/api/dispatch/live/feed/{settled['id']}/review", role="dispatcher", expect=204)
    again = next(i for i in feed(copy)["earlier"] if i["kind"] == "conflict")
    assert again["reviewed_at"] == reviewed["reviewed_at"]
