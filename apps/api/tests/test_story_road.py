"""Kasun's morning on the road as the demo bar plays it. A fresh copy jumped straight to each moment, from the first
stop to the end, finds what the specs draw there: the story autopilot plays the judge characters' skipped steps and
the world simulator moves everyone else, through the same services people use. The times the story authors (Kasun's
own, the storm's) are checked as written; counts are read from the data, never the Designathon's."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from copy_client import Copy

COLOMBO = ZoneInfo("Asia/Colombo")
DAY = "2026-04-08"
DRY_ORDER = "ORD0098595"
PEOPLE = (("kasun", "driver"), ("nuwan", "dispatcher"), ("dilani", "store_manager"))


def hm(value: str | None) -> str | None:
    """'2026-04-08T00:22:00Z' is '05:52' in Sri Lanka."""
    return datetime.fromisoformat(value).astimezone(COLOMBO).strftime("%H:%M") if value else None


def spoken(value: str) -> str:
    """How notices print a time: '6:35 AM'."""
    local = datetime.fromisoformat(value).astimezone(COLOMBO)
    return f"{local.hour % 12 or 12}:{local.minute:02d} {'AM' if local.hour < 12 else 'PM'}"


class Day:
    """A fresh copy jumped to one moment, read the way each role's screen reads it."""

    def __init__(self, new_copy: Callable[[], Copy], moment: str) -> None:
        self.copy = new_copy()
        self.state = self.copy.jump(moment)
        for username, role in PEOPLE:
            self.copy.sign_in(username, role)

    @property
    def now(self) -> datetime:
        return datetime.fromisoformat(self.state["now"])

    def run(self) -> dict[str, Any]:
        return self.copy.get("/api/driver/run", "driver")

    def stops(self, run: dict[str, Any] | None = None) -> dict[str, dict[str, Any]]:
        return {s["place"]: s for s in (run or self.run())["trip"]["stops"]}

    def panel(self) -> dict[str, Any]:
        return self.copy.get("/api/dispatch/live/runs?depot=Kandy", "dispatcher")

    def row(self, panel: dict[str, Any], vehicle_id: str, *, backup: bool = False) -> dict[str, Any]:
        return next(r for r in panel["rows"] if r["vehicle_id"] == vehicle_id and r["is_backup"] is backup)

    def feed(self) -> dict[str, Any]:
        return self.copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")

    def tracker(self) -> dict[str, Any]:
        return self.copy.get(f"/api/store/orders/{DRY_ORDER}/tracker", "store_manager")


def markers(row: dict[str, Any]) -> dict[str, dict[str, Any]]:
    return {m["place"]: m for m in row["markers"]}


def backup_row(panel: dict[str, Any]) -> dict[str, Any]:
    [row] = [r for r in panel["rows"] if r["is_backup"]]
    return row


def assert_the_world_keeps_up(panel: dict[str, Any], now: datetime) -> None:
    """Every run nobody plays is where Relay's expected clock puts it: its records never ahead of the clock and in
    stop order, its phone in contact while it runs, and the delivered tile adds up from the runs."""
    moving = 0
    for row in panel["rows"]:
        if row["vehicle_id"] == "VEH045":
            continue
        recorded = [datetime.fromisoformat(m["recorded"]) for m in row["markers"] if m["recorded"]]
        assert all(t <= now for t in recorded), row["vehicle_id"]
        assert recorded == sorted(recorded), row["vehicle_id"]
        if row["departed_at"] and not row["finished_at"]:
            assert not row["out_of_contact"], row["vehicle_id"]
            assert datetime.fromisoformat(row["last_contact_at"]) > now - timedelta(minutes=2)
        moving += bool(recorded)
    assert moving, "the other drivers are on the road"
    assert panel["delivered"] == sum(r["delivered"] for r in panel["rows"] if not r["is_backup"])
    assert panel["running"] == sum(1 for r in panel["rows"] if r["departed_at"] and not r["finished_at"])


def test_first_stop(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "first_stop")
    assert hm(day.state["now"]) == "04:52"
    assert "Kasun arrives at Kegalle" in day.state["played"]
    assert "Kasun delivers to Kegalle" not in day.state["played"]

    run = day.run()
    kegalle, *later = run["trip"]["stops"]
    assert (kegalle["place"], kegalle["status"], hm(kegalle["arrived_at"])) == ("Kegalle", "arrived", "04:52")
    assert {s["status"] for s in later} == {"pending"}
    # the storm is scripted for Kasun's phone from the start, so the phone obeys it the minute it begins
    assert {k: hm(v) for k, v in run["outage"].items()} == {"from": "05:41", "to": "07:14"}
    assert day.state["outages"] == {}

    panel = day.panel()
    kasun = day.row(panel, "VEH045")
    assert not kasun["out_of_contact"]
    assert hm(kasun["last_contact_at"]) == "04:52"
    assert panel["out_of_contact"] == 0
    assert_the_world_keeps_up(panel, day.now)

    # Sampath tells the office about the Matale road at 4:28, and Nuwan marks it handled at 4:35
    delay = next(i for i in day.feed()["earlier"] if i["kind"] == "delay")
    assert delay["title"] == "Sampath Lakmal reports: Delayed, 45 min"
    assert delay["body"] == "Slow on the Matale road, one lane open."
    assert (hm(delay["created_at"]), hm(delay["handled_at"]), delay["handled_by"]) == ("04:28", "04:35", "Nuwan Perera")


def test_on_the_road(new_copy: Callable[[], Copy]) -> None:
    from relay_api.services import words

    day = Day(new_copy, "on_the_road")
    assert hm(day.state["now"]) == "05:20"
    stops = day.stops()
    kegalle = stops["Kegalle"]
    assert (kegalle["status"], hm(kegalle["completed_at"]), kegalle["receiver"]) == ("delivered", "05:11", "P. Silva")
    assert kegalle["has_photo"]  # a rear dock: the photo went with the delivery
    assert stops["Mawanella"]["status"] == "pending"

    panel = day.panel()
    kasun = day.row(panel, "VEH045")
    assert not kasun["out_of_contact"]
    assert hm(kasun["last_contact_at"]) == "05:20"
    assert_the_world_keeps_up(panel, day.now)

    # Dilani reads the same estimate Nuwan does, to 5 minutes where the dispatch desk shows the minute, and was told
    # when it moved
    tracker = day.tracker()
    assert (tracker["status"], tracker["out_of_contact"]) == ("on_the_way", False)
    desk = datetime.fromisoformat(markers(kasun)["Hemmathagama"]["estimate"])
    assert hm(tracker["expected"]) == hm(words.round5(desk).isoformat()) == "06:35"
    notices = day.copy.get("/api/store/notices", "store_manager")
    assert any(n["kind"] == "new_time" and spoken(tracker["expected"]) in n["body"] for n in notices)


def test_signal_lost(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "signal_lost")
    assert hm(day.state["now"]) == "05:41"
    run = day.run()
    stops = day.stops(run)
    assert (stops["Mawanella"]["status"], hm(stops["Mawanella"]["arrived_at"])) == ("arrived", "05:30")
    # what the phone holds when the signal goes: Relay's estimates from the Mawanella arrival
    assert (hm(stops["Hemmathagama"]["expected"]), hm(stops["Aranayake"]["expected"])) == ("06:35", "07:15")
    # the storm is scripted for Kasun's phone, which obeys it whoever holds it
    window = {k: hm(v) for k, v in run["outage"].items()}
    assert window == {"from": "05:41", "to": "07:14"}
    assert {k: hm(v) for k, v in day.state["outages"]["kasun"].items()} == window

    panel = day.panel()
    kasun = day.row(panel, "VEH045")
    assert hm(kasun["last_contact_at"]) == "05:41"
    assert not kasun["out_of_contact"]
    assert_the_world_keeps_up(panel, day.now)


def test_silence(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "silence")
    assert hm(day.state["now"]) == "06:05"
    # the 5:59 delivery at Mawanella waits on the phone: Relay still has the arrival only
    assert day.stops()["Mawanella"]["status"] == "arrived"

    panel = day.panel()
    kasun = day.row(panel, "VEH045")
    assert (kasun["out_of_contact"], kasun["silent_minutes"]) == (True, 24)
    assert kasun["position"] == "Probably still unloading at Mawanella."
    ranges = {place: [hm(t) for t in m["range"]] for place, m in markers(kasun).items() if m["range"]}
    assert ranges == {"Hemmathagama": ["06:05", "07:05"], "Aranayake": ["06:45", "07:45"]}
    assert panel["out_of_contact"] == 1  # every phone the world carries is in contact
    assert_the_world_keeps_up(panel, day.now)

    [silence] = [i for i in day.feed()["now"] if i["kind"] == "silence"]
    assert silence["title"] == "No contact from Kasun since 5:41 AM"

    tracker = day.tracker()
    assert (tracker["out_of_contact"], hm(tracker["last_heard"]), hm(tracker["expected"])) == (True, "05:41", "06:35")
    assert [hm(t) for t in tracker["range"]] == ["06:05", "07:05"]


def test_backup_is_left_to_the_judge(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "backup")
    assert hm(day.state["now"]) == "06:15"
    assert not any(step.startswith("Nuwan sends") for step in day.state["played"])
    aranayake = day.stops()["Aranayake"]
    assert (aranayake["status"], aranayake["moved_to"]) == ("pending", None)

    panel = day.panel()
    kasun = day.row(panel, "VEH045")
    assert kasun["silent_minutes"] == 34
    ranges = {place: [hm(t) for t in m["range"]] for place, m in markers(kasun).items() if m["range"]}
    assert ranges == {"Hemmathagama": ["06:15", "07:10"], "Aranayake": ["06:40", "07:50"]}
    options = day.copy.get(f"/api/dispatch/live/stops/{aranayake['stop_id']}/move-options", "dispatcher")
    assert options[0]["fits"]
    assert options[0]["status"] == "standby"


def test_receipt(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "receipt")
    assert hm(day.state["now"]) == "06:40"
    panel = day.panel()
    van = backup_row(panel)
    assert f"Nuwan sends Aranayake with {van['vehicle_id']}" in day.state["played"]
    assert "Dilani confirms everything arrived" not in day.state["played"]  # 6:42 is still to come

    # the backup was picked at the dock and left on time, while Kasun's phone holds stops 2 and 3
    assert van["departed_at"] == van["planned_depart"]
    assert van["status"] == "on_the_road"
    assert not van["out_of_contact"]
    assert panel["standby_free"] == 0
    stops = day.stops()
    # the phone has had no signal since 5:41, so it knows nothing of the move: Relay and the office do
    assert (stops["Aranayake"]["status"], stops["Aranayake"]["moved_to"]) == ("pending", None)
    aranayake = markers(day.row(panel, "VEH045"))["Aranayake"]
    assert (aranayake["state"], aranayake["moved_to"]) == ("moved", van["vehicle_id"])
    assert stops["Hemmathagama"]["status"] == "pending"
    assert_the_world_keeps_up(panel, day.now)

    moved = next(i for i in day.feed()["earlier"] if i["kind"] == "stop_moved")
    assert "No contact from Kasun for 34 minutes. Backup in case Kasun is stuck." in moved["body"]

    # Dilani's estimate has passed with no word, so the store may confirm receipt itself
    tracker = day.tracker()
    assert (tracker["status"], tracker["passed"], tracker["can_confirm"]) == ("on_the_way", True, True)
    assert tracker["receipt"] is None


def test_signal_back(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "signal_back")
    assert hm(day.state["now"]) == "07:14"
    played = day.state["played"]
    assert "Dilani confirms everything arrived" in played
    assert "Nuwan keeps the backup on its way" in played
    assert "Kasun answers yes: delivered" not in played

    # the phone's records landed in the order it saved them, each with its own time; stop 4 clashed with the move
    run = day.run()
    stops = day.stops(run)
    assert (stops["Mawanella"]["status"], hm(stops["Mawanella"]["completed_at"])) == ("delivered", "05:59")
    hemmathagama = stops["Hemmathagama"]
    assert (hemmathagama["status"], hm(hemmathagama["arrived_at"]), hm(hemmathagama["completed_at"])) == (
        "delivered",
        "06:21",
        "06:36",
    )
    assert stops["Aranayake"]["status"] == "moved"
    assert {hm(s["sent_at"]) for s in run["trip"]["stops"] if s["place"] != "Kegalle"} == {"07:14"}
    [question] = run["questions"]
    assert (question["place"], question["status"], hm(question["opened_at"])) == (
        "Aranayake",
        "waiting_for_driver",
        "07:14",
    )
    # the card reads from Relay when the phone holds none of it: "Arrived 6:56 AM · Delivered 7:09 AM"
    assert (hm(question["arrived_at"]), hm(question["delivered_at"])) == ("06:56", "07:09")
    assert (question["receiver"], question["has_photo"], question["cases"]) == ("K. Herath", True, 86)
    assert (question["backup_driver"], question["moved_by"], hm(question["moved_at"])) == (
        "Nimal Fernando",
        "Nuwan Perera",
        "06:15",
    )

    feed = day.feed()
    back = next(i for i in feed["earlier"] if i["kind"] == "back_in_contact")
    assert back["title"] == "Kasun Bandara back in contact"
    assert "offline 93 min" in back["body"]
    assert "7 records received" in back["body"]  # 5 stop records and 2 photos
    assert all(i["handled_at"] for i in feed["now"] + feed["earlier"] if i["kind"] == "silence")
    assert [i["title"] for i in feed["now"] if i["kind"] == "conflict"] == ["Stop 4 has two copies"]
    kept = next(i for i in feed["earlier"] if i["kind"] == "receipt")
    assert kept["outcome"].startswith("You kept the backup at 6:44 AM.")

    panel = day.panel()
    kasun = day.row(panel, "VEH045")
    assert not kasun["out_of_contact"]
    assert markers(kasun)["Aranayake"]["state"] == "conflict"
    assert kasun["delivered"] == 3  # stop 4 is held until the question is settled
    assert backup_row(panel)["status"] == "on_the_road"
    assert_the_world_keeps_up(panel, day.now)

    # Dilani confirmed at 6:42, before any proof; Kasun's proof joined the receipt at 7:14, photo and all
    tracker = day.tracker()
    assert tracker["status"] == "confirmed"
    assert (hm(tracker["receipt"]["confirmed_at"]), tracker["receipt"]["before_driver_proof"]) == ("06:42", True)
    proof = tracker["proof"]
    assert (proof["receiver"], hm(proof["delivered_at"]), hm(proof["sent_at"])) == ("W. Rathnayake", "06:36", "07:14")
    photo = day.copy.client.get(f"/api/photos/{proof['photo_id']}", headers={"X-Relay-Role": "store_manager"})
    assert photo.status_code == 200
    assert photo.headers["content-type"] == "image/png"


def test_settled(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "settled")
    assert hm(day.state["now"]) == "07:22"
    assert {"Kasun answers yes: delivered", "Kasun finishes the trip"} <= set(day.state["played"])

    run = day.run()
    [question] = run["questions"]
    assert (question["status"], question["resolution"], hm(question["resolved_at"])) == ("resolved", "driver", "07:15")
    assert hm(run["trip"]["finished_at"]) == "07:17"
    aranayake = day.stops(run)["Aranayake"]
    assert (aranayake["status"], hm(aranayake["completed_at"]), aranayake["receiver"]) == (
        "delivered",
        "07:09",
        "K. Herath",
    )

    panel = day.panel()
    kasun = day.row(panel, "VEH045")
    assert (kasun["status"], kasun["delivered"]) == ("finished", len(run["trip"]["stops"]))
    van = backup_row(panel)
    assert van["status"] == "returning"
    assert_the_world_keeps_up(panel, day.now)
    settled = next(i for i in day.feed()["earlier"] if i["kind"] == "conflict")
    assert settled["title"] == "Stop 4 conflict resolved"
    assert hm(settled["handled_at"]) == "07:15"

    # Nimal's phone, carried by the world, heard the change the minute it was made
    day.copy.sign_in(f"driver.{van['vehicle_id'].lower()}", "driver")  # seeded drivers are driver.veh0nn
    notices = {n["kind"]: n for n in day.copy.get("/api/driver/run", "driver")["notices"]}
    assert hm(notices["backup_cancelled"]["read_at"]) == "07:15"
    assert notices["backup_cancelled"]["body"].startswith("Aranayake is cancelled. Go back to the Kandy hub")


def tick(copy: Copy, minutes: int) -> dict[str, Any]:
    """Let the clock run on by itself, as the background tick does: the world moves, and the characters nobody is
    playing take their story steps as their times come."""
    from relay_api.clock import set_clock, sim_now
    from relay_api.db import SessionLocal
    from relay_api.workspaces import find_workspace

    with SessionLocal() as db:
        workspace = find_workspace(db, copy.code)
        assert workspace is not None
        set_clock(workspace, sim_now(workspace) + timedelta(minutes=minutes))
        db.commit()
    return copy.get("/api/demo/state")


def test_the_running_clock_sees_the_silence_and_the_unanswered_question(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "signal_lost")
    assert not [i for i in day.feed()["now"] if i["kind"] == "silence"]
    tick(day.copy, 6)
    assert [i["title"] for i in day.feed()["now"] if i["kind"] == "silence"] == ["No contact from Kasun since 5:41 AM"]
    assert day.panel()["out_of_contact"] == 1

    day = Day(new_copy, "signal_back")
    [question] = day.run()["questions"]  # the judge holds Kasun's phone, so the answer is theirs to give
    assert question["status"] == "waiting_for_driver"
    tick(day.copy, 11)
    [question] = day.run()["questions"]
    assert question["status"] == "escalated"


def test_the_running_clock_drives_kasun_when_nobody_holds_the_phone(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "first_stop")  # signed in, but nobody has opened Kasun's phone
    tick(day.copy, 10)
    tick(day.copy, 10)
    kegalle = day.stops()["Kegalle"]
    # Kasun delivered at the story's 5:11, not when the clock happened to be read
    assert (kegalle["status"], hm(kegalle["completed_at"]), kegalle["receiver"]) == ("delivered", "05:11", "P. Silva")
    tick(day.copy, 20)  # 5:32: the judge has the phone now, so the 5:30 arrival at Mawanella waits for them
    assert day.stops()["Mawanella"]["status"] == "pending"


def test_nothing_from_the_phone_reaches_relay_in_the_storm(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "silence")
    run = day.run()
    hemmathagama = day.stops(run)["Hemmathagama"]
    # the phone keeps trying, whoever holds it: Relay notes no contact and takes no record
    out = day.copy.post("/api/driver/checkin", {"device_id": "judge-phone"}, "driver")
    assert {k: hm(v) for k, v in out["outage"].items()} == {"from": "05:41", "to": "07:14"}
    tapped = record("arrived", run, hemmathagama, "06:05")
    day.copy.post("/api/driver/records", {"device_id": "judge-phone", "records": [tapped]}, "driver", expect=503)

    kasun = day.row(day.panel(), "VEH045")
    assert (kasun["out_of_contact"], hm(kasun["last_contact_at"])) == (True, "05:41")
    assert [i["title"] for i in day.feed()["now"] if i["kind"] == "silence"] == ["No contact from Kasun since 5:41 AM"]
    assert not [i for i in day.feed()["earlier"] if i["kind"] == "back_in_contact"]
    # what the phone reads meanwhile is its own memory: the 5:59 delivery the jump played waits there, unsent
    held = day.run()["held"]
    assert [(r["kind"], hm(r["occurred_at"])) for r in held["records"]] == [("delivered", "05:59")]
    assert day.stops()["Mawanella"]["status"] == "arrived"


def record(kind: str, run: dict[str, Any], stop: dict[str, Any] | None, clock: str, **payload: Any) -> dict[str, Any]:
    return {
        "id": str(uuid.uuid4()),
        "kind": kind,
        "trip_id": run["trip"]["trip_id"],
        "stop_id": stop["stop_id"] if stop else None,
        "base_version": stop["version"] if stop else None,
        "occurred_at": f"{DAY}T{clock}:00+05:30",
        "payload": payload,
    }


def test_a_judge_holding_the_phone_in_the_storm_keeps_those_stops(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "signal_lost")
    run = day.run()
    mawanella = day.stops(run)["Mawanella"]
    saved = record("delivered", run, mawanella, "05:41", receiver="S. Fernando")
    held = {"device_id": "judge-phone", "records": [saved], "photos": []}
    day.copy.post("/api/driver/held", held, "driver", expect=204)

    state = day.copy.jump("signal_back")
    # the jump plays only what nobody did: the judge's phone delivered Mawanella, the autopilot the stops after it
    assert "Kasun delivers to Mawanella" not in state["played"]
    assert {"Kasun delivers to Hemmathagama", "Kasun delivers to Aranayake"} <= set(state["played"])
    run = day.run()
    mawanella = day.stops(run)["Mawanella"]
    assert (mawanella["status"], hm(mawanella["completed_at"]), mawanella["receiver"]) == (
        "delivered",
        "05:41",
        "S. Fernando",
    )
    [question] = run["questions"]
    assert question["place"] == "Aranayake"
    # the phone sends its own copy once it has signal: Relay already has it from the phone's outbox
    again = day.copy.post("/api/driver/records", {"device_id": "judge-phone", "records": [saved]}, "driver")
    assert again["results"][0]["outcome"] == "duplicate"
    back = next(i for i in day.feed()["earlier"] if i["kind"] == "back_in_contact")
    assert "7 records received" in back["body"]


@pytest.mark.parametrize("reason", ["outlet_closed", "access_blocked", "goods_refused", "damaged_in_transit"])
def test_a_stop_the_judge_reported_a_problem_at_is_theirs(new_copy: Callable[[], Copy], reason: str) -> None:
    day = Day(new_copy, "on_the_road")
    run = day.run()
    report = record("problem", run, day.stops(run)["Mawanella"], "05:20", reason=reason)
    out = day.copy.post("/api/driver/records", {"device_id": "judge-phone", "records": [report]}, "driver")
    assert out["results"][0]["outcome"] == "applied"

    played = day.copy.jump("signal_lost")["played"] + day.copy.jump("silence")["played"]
    # the judge is dealing with Mawanella: the jumps play neither an arrival nor a delivery there
    assert "Kasun arrives at Mawanella" not in played
    assert "Kasun delivers to Mawanella" not in played
    mawanella = day.stops()["Mawanella"]
    assert (mawanella["status"], mawanella["arrived_at"], mawanella["completed_at"]) == ("pending", None, None)


def test_a_delay_the_judge_reported_lets_the_story_go_on(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "on_the_road")
    run = day.run()
    report = record("problem", run, day.stops(run)["Mawanella"], "05:20", reason="delayed", delay_min=10)
    day.copy.post("/api/driver/records", {"device_id": "judge-phone", "records": [report]}, "driver")
    assert "Kasun arrives at Mawanella" in day.copy.jump("signal_lost")["played"]


def test_a_stop_reported_in_the_storm_is_left_to_the_phone_that_holds_it(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "signal_lost")
    run = day.run()
    report = record("problem", run, day.stops(run)["Hemmathagama"], "05:50", reason="outlet_closed")
    held = {"device_id": "judge-phone", "records": [report], "photos": []}
    day.copy.post("/api/driver/held", held, "driver", expect=204)
    played = day.copy.jump("receipt")["played"]
    assert "Kasun delivers to Mawanella" in played
    assert not [step for step in played if step.endswith("Hemmathagama")]


def test_runs_still_out_when_the_day_turns_over_drive_home(new_copy: Callable[[], Copy]) -> None:
    """At midday the stores' day turns to Thursday; Wednesday's runs still on the road finish as they would, and
    nobody's phone is read as silent for it."""
    from sqlalchemy import select

    from relay_api.db import SessionLocal, scope_to_workspace
    from relay_api.models import AppUser, DeviceContact, Trip
    from relay_api.services.field import back_at_hub
    from relay_api.workspaces import find_workspace

    day = Day(new_copy, "settled")
    state = day.copy.jump(f"{DAY}T13:30:00+05:30")  # the long Colombo runs come home after 1 PM
    now = datetime.fromisoformat(state["now"])
    with SessionLocal() as db:
        workspace = find_workspace(db, day.copy.code)
        assert workspace is not None
        scope_to_workspace(db, workspace.id)
        trips = db.scalars(select(Trip).where(Trip.departed_at.is_not(None))).all()
        # the world kept driving after the turn: runs came home after midday
        home = [back_at_hub(t) for t in trips]
        assert [back for back in home if back is not None and hm(back.isoformat()) >= "12:00"]
        drivers = {u.vehicle_id: u.id for u in db.scalars(select(AppUser).where(AppUser.vehicle_id.is_not(None)))}
        contacts = {c.user_id: c.last_contact_at for c in db.scalars(select(DeviceContact))}
        for trip in trips:
            if trip.finished_at is None and drivers.get(trip.vehicle_id) in contacts:
                assert contacts[drivers[trip.vehicle_id]] > now - timedelta(minutes=2), trip.vehicle_id
    feed = day.feed()
    assert not [i for i in feed["now"] if i["kind"] == "silence"]


def test_a_backup_the_judge_called_off_stays_off(new_copy: Callable[[], Copy]) -> None:
    day = Day(new_copy, "receipt")
    # Dilani confirms before the story would, and Nuwan calls the backup off instead of keeping it
    day.copy.post(f"/api/store/orders/{DRY_ORDER}/receipt", {"client_ref": "judge-receipt"}, "store_manager")
    question = next(i for i in day.feed()["now"] if i["kind"] == "receipt")
    day.copy.post(f"/api/dispatch/live/feed/{question['id']}/backup", {"action": "cancel"}, "dispatcher")

    state = day.copy.jump("settled")
    played = state["played"]
    assert "Dilani confirms everything arrived" not in played
    assert "Nuwan keeps the backup on its way" not in played
    assert not [step for step in played if step.startswith("Nuwan sends")]
    # Aranayake is Kasun's again, so the records the phone kept apply as they are: no question, the trip finishes
    run = day.run()
    assert run["questions"] == []
    aranayake = day.stops(run)["Aranayake"]
    assert (aranayake["status"], hm(aranayake["completed_at"])) == ("delivered", "07:09")
    assert hm(run["trip"]["finished_at"]) == "07:17"
    # the van turned back, or never left, and is home
    assert all(r["status"] == "finished" for r in day.panel()["rows"] if r["is_backup"])
