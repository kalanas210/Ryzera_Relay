"""Kasun's morning through the API: the load is accepted and the truck drives, the phone goes quiet near Mawanella,
Nuwan sends Aranayake with the standby van, Dilani confirms receipt from the store, and when the phone comes back its
offline records land in order, one clash raises the one question, and Kasun's "yes" settles it."""

from __future__ import annotations

import uuid
from collections.abc import Callable, Iterator
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from copy_client import Copy
from sqlalchemy import select

DAY = "2026-04-08"
COLOMBO = ZoneInfo("Asia/Colombo")
DEVICE = "test-phone"


def at(clock: str) -> str:
    return f"{DAY}T{clock}:00+05:30"


def local(value: str) -> str:
    """'2026-04-08T01:05:00Z' is '06:35' in Sri Lanka."""
    return datetime.fromisoformat(value).astimezone(COLOMBO).strftime("%H:%M")


def record(kind: str, trip: dict[str, Any], clock: str, stop: dict[str, Any] | None = None, **payload: Any) -> dict:
    return {
        "id": str(uuid.uuid4()),
        "kind": kind,
        "trip_id": trip["trip_id"],
        "stop_id": stop["stop_id"] if stop else None,
        "base_version": stop["version"] if stop else None,
        "occurred_at": at(clock),
        "payload": payload,
    }


def send(copy: Copy, *records: dict, device: str = DEVICE) -> dict:
    return copy.post("/api/driver/records", {"device_id": device, "records": list(records)}, "driver")


def save_offline(copy: Copy, clock: str, record: dict, kept: list[dict]) -> None:
    """The phone saves a record with no signal: nothing reaches Relay, and the demo's stand-in for the phone's memory
    keeps it, as the web app hands it over, so a demo jump leaves that stop to this phone."""
    copy.jump(at(clock))
    body = {"device_id": DEVICE, "records": [record]}
    copy.post("/api/driver/records", body, "driver", expect=503)
    copy.post("/api/driver/held", body, "driver", expect=204)
    kept.append(record)


def stop_at(run: dict, place: str) -> dict:
    return next(s for s in run["trip"]["stops"] if s["place"] == place)


def loaded_and_handed_over(new_copy: Callable[[], Copy]) -> tuple[Copy, dict]:
    copy = new_copy()
    copy.jump("loading")
    people = (("rizwan", "loader"), ("kasun", "driver"), ("nuwan", "dispatcher"), ("dilani", "store_manager"))
    for username, role in people:
        copy.sign_in(username, role)
    tonight = copy.get("/api/dock/loads", "loader")
    card = next(c for g in ("loading", "ready", "to_load") for c in tonight[g] if c["vehicle_id"] == "VEH045")
    load = copy.get(f"/api/dock/trips/{card['trip_id']}", "loader")
    for group in load["groups"]:
        for line in group["lines"]:
            if line["status"] in ("to_load", "in_progress"):
                copy.post(f"/api/dock/lines/{line['id']}", {"loaded": line["qty"]}, "loader")
    copy.post(f"/api/dock/trips/{card['trip_id']}/complete", None, "loader")
    return copy, copy.get("/api/driver/run", "driver")


def test_the_phone_accepts_the_load_and_resends_are_harmless(new_copy: Callable[[], Copy]) -> None:
    copy, run = loaded_and_handed_over(new_copy)
    trip = run["trip"]
    assert trip["vehicle_id"] == "VEH045"
    assert trip["load"] == "to_accept"
    assert [s["place"] for s in trip["stops"]] == ["Kegalle", "Mawanella", "Hemmathagama", "Aranayake"]

    accepted = record("load_accepted", trip, "02:45")
    first = send(copy, accepted)
    assert first["results"][0]["outcome"] == "applied"
    assert first["run"]["trip"]["load"] == "accepted"
    again = send(copy, accepted)
    assert again["results"][0]["outcome"] == "duplicate"

    late = record("arrived", trip, "23:59", stop_at(run, "Kegalle"))
    assert send(copy, late)["results"][0]["outcome"] == "rejected"


def test_signal_lost_backup_sent_and_the_clash_settled(new_copy: Callable[[], Copy]) -> None:
    copy, run = loaded_and_handed_over(new_copy)
    trip = run["trip"]
    send(copy, record("load_accepted", trip, "02:50"))

    # the phone records Kegalle itself, each record as it happens, so no jump plays that stop for Kasun
    copy.jump(at("04:48"))
    run = copy.get("/api/driver/run", "driver")
    kegalle, mawanella = stop_at(run, "Kegalle"), stop_at(run, "Mawanella")
    assert send(copy, record("arrived", trip, "04:48", kegalle))["results"][0]["outcome"] == "applied"
    copy.jump(at("05:06"))
    out = send(copy, record("delivered", trip, "05:06", kegalle, receiver="P. Silva"))
    assert out["results"][0]["outcome"] == "applied"
    copy.jump(at("05:31"))
    out = send(copy, record("arrived", trip, "05:30", mawanella))
    assert out["results"][0]["outcome"] == "applied"
    seen = out["run"]  # what the phone holds when the signal goes
    # after the Mawanella arrival Relay expects Hemmathagama around 6:35 and Aranayake around 7:15
    assert local(stop_at(seen, "Hemmathagama")["expected"]) == "06:35"
    assert local(stop_at(seen, "Aranayake")["expected"]) == "07:15"
    notices = copy.get("/api/store/notices", "store_manager")
    assert any(n["kind"] == "new_time" and "6:35 AM" in n["body"] for n in notices)

    copy.jump(at("05:40"))
    copy.post("/api/driver/checkin", {"device_id": DEVICE}, "driver")  # the last contact before the storm
    kept: list[dict] = []
    save_offline(copy, "05:52", record("delivered", trip, "05:52", mawanella, receiver="N. Wijesinghe"), kept)

    copy.jump(at("06:15"))
    panel = copy.get("/api/dispatch/live/runs?depot=Kandy", "dispatcher")
    row = next(r for r in panel["rows"] if r["vehicle_id"] == "VEH045")
    assert row["out_of_contact"] is True
    assert row["silent_minutes"] == 34
    ranges = {m["place"]: m["range"] for m in row["markers"]}
    assert [local(t) for t in ranges["Hemmathagama"]] == ["06:15", "07:10"]
    assert [local(t) for t in ranges["Aranayake"]] == ["06:40", "07:50"]

    aranayake = stop_at(seen, "Aranayake")
    options = copy.get(f"/api/dispatch/live/stops/{aranayake['stop_id']}/move-options", "dispatcher")
    assert options[0]["vehicle_id"] == "VEH060"
    assert options[0]["fits"]
    copy.post(
        f"/api/dispatch/live/stops/{aranayake['stop_id']}/move",
        {"vehicle_id": "VEH060", "reason": "No contact from Kasun since 5:41 AM on the hill road."},
        "dispatcher",
    )

    hemmathagama = stop_at(seen, "Hemmathagama")
    save_offline(copy, "06:20", record("arrived", trip, "06:20", hemmathagama), kept)
    save_offline(copy, "06:35", record("delivered", trip, "06:35", hemmathagama, receiver="W. Rathnayake"), kept)

    copy.jump(at("06:42"))
    tracker = copy.post("/api/store/orders/ORD0098595/receipt", {"client_ref": "test-receipt"}, "store_manager")
    assert tracker["status"] == "confirmed"
    feed = copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")
    question = next(i for i in feed["now"] if i["kind"] == "receipt")
    keep = {"action": "keep", "note": "Kasun is still out of contact on the hill road."}
    copy.post(f"/api/dispatch/live/feed/{question['id']}/backup", keep, "dispatcher")

    save_offline(copy, "06:55", record("arrived", trip, "06:55", aranayake), kept)
    save_offline(copy, "07:08", record("delivered", trip, "07:08", aranayake, receiver="K. Herath"), kept)

    state = copy.jump(at("07:14"))  # the signal is back: what the phone saved lands in order, each with its own time
    assert not [step for step in state["played"] if step.startswith("Kasun")]  # every stop was the phone's
    run = copy.get("/api/driver/run", "driver")
    done = [(s["status"], local(s["completed_at"]) if s["completed_at"] else None) for s in run["trip"]["stops"]]
    assert done == [("delivered", "05:06"), ("delivered", "05:52"), ("delivered", "06:35"), ("moved", None)]
    [ask] = run["questions"]  # stop 4 clashed with the move and waits for the one question
    assert ask["place"] == "Aranayake"
    assert "VEH060" in ask["question"]
    assert (local(ask["arrived_at"]), local(ask["delivered_at"]), ask["receiver"]) == ("06:55", "07:08", "K. Herath")
    feed = copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")
    back = next(i for i in feed["earlier"] if i["kind"] == "back_in_contact")
    assert "5 records received" in back["body"]
    # the phone's own send, now it has signal, finds every record already there
    out = send(copy, *kept)
    assert {r["outcome"] for r in out["results"]} == {"duplicate"}

    copy.jump(at("07:15"))
    answer = record("conflict_answer", trip, "07:15", conflict_id=ask["id"], answer="yes")
    out = send(copy, answer)
    assert out["results"][0]["outcome"] == "applied"
    [settled] = out["run"]["questions"]
    assert (settled["status"], settled["resolution"]) == ("resolved", "driver")
    assert stop_at(out["run"], "Aranayake")["status"] == "delivered"

    panel = copy.get("/api/dispatch/live/runs?depot=Kandy", "dispatcher")
    veh060 = [r for r in panel["rows"] if r["vehicle_id"] == "VEH060"]
    assert all(r["status"] in ("cancelled", "returning") for r in veh060)
    tracker = copy.get("/api/store/orders/ORD0098595/tracker", "store_manager")
    assert tracker["proof"]["receiver"] == "W. Rathnayake"
    assert local(tracker["proof"]["sent_at"]) == "07:14"


def test_a_bad_record_is_refused_alone_and_leaves_nothing_behind(new_copy: Callable[[], Copy]) -> None:
    copy, run = loaded_and_handed_over(new_copy)
    trip, kegalle = run["trip"], stop_at(run, "Kegalle")
    copy.jump(at("02:58"))
    checkin = {"id": str(uuid.uuid4()), "kind": "checkin", "occurred_at": at("02:58")}
    out = send(copy, record("load_accepted", trip, "02:58"), checkin)
    assert [r["outcome"] for r in out["results"]] == ["applied", "applied"]
    assert send(copy, checkin)["results"][0]["outcome"] == "duplicate"

    report = record("problem", trip, "02:58", reason="delayed", delay_min=10)
    no_photo = record("delivered", trip, "02:58", kegalle, receiver="P. Silva", photo_id="not-a-uuid")
    no_cases = record("delivered", trip, "02:58", kegalle, receiver="P. Silva", lines=[{"case_type": "rice_dhal"}])
    out = send(copy, report, no_photo, no_cases)
    assert [(r["outcome"], r["reason"]) for r in out["results"]] == [
        ("applied", ""),
        ("rejected", "No such photo."),
        ("rejected", "The delivered cases could not be read."),
    ]
    # the refused deliveries changed nothing: the stop still waits and the truck has not left on their word
    stop = stop_at(out["run"], "Kegalle")
    assert (stop["status"], stop["completed_at"], stop["receiver"]) == ("pending", None, None)
    assert out["run"]["trip"]["departed_at"] is None
    # and the report sent with them stands
    assert send(copy, report)["results"][0]["outcome"] == "duplicate"


def test_a_stop_completes_once_whichever_phone_records_it(new_copy: Callable[[], Copy]) -> None:
    """Two phones record the same stop, a judge's and the demo's own: the truck was there from the earlier arrival,
    and the first delivery stands with its time and its proof. A later delivery is kept and changes nothing."""
    copy, run = loaded_and_handed_over(new_copy)
    trip = run["trip"]
    send(copy, record("load_accepted", trip, "02:41"))
    copy.jump(at("04:46"))
    kegalle = stop_at(copy.get("/api/driver/run", "driver"), "Kegalle")

    assert send(copy, record("arrived", trip, "04:45", kegalle), device="other")["results"][0]["outcome"] == "applied"
    # this phone got there first, but its arrival reaches Relay second
    assert send(copy, record("arrived", trip, "04:41", kegalle))["results"][0]["outcome"] == "applied"
    first = send(copy, record("delivered", trip, "04:46", kegalle, receiver="P. Silva"), device="other")
    assert first["results"][0]["outcome"] == "applied"

    second = record("delivered", trip, "04:44", kegalle, receiver="A. Judge", signature_svg="<svg></svg>")
    out = send(copy, second, record("failed", trip, "04:46", kegalle, reason="Closed"))
    assert [r["outcome"] for r in out["results"]] == ["duplicate", "duplicate"]
    assert out["results"][0]["reason"] == "Stop 1 was already recorded delivered at 4:46 AM."
    stop = stop_at(out["run"], "Kegalle")
    assert (stop["status"], local(stop["arrived_at"]), local(stop["completed_at"])) == ("delivered", "04:41", "04:46")
    assert stop["receiver"] == "P. Silva"
    # a resend of the refused copy is a plain duplicate
    assert send(copy, second)["results"][0] == {"id": second["id"], "outcome": "duplicate", "reason": ""}


def test_the_demo_switch_cuts_the_phone_off_until_it_is_back(new_copy: Callable[[], Copy]) -> None:
    """The demo bar's "no signal" switch tells Relay, on the demo's own channel, that the phone is cut off, so the
    story's autopilot can leave that driver to the judge holding the phone; anything the phone sends ends it."""
    from relay_api.db import SessionLocal
    from relay_api.models import Workspace

    def cut_off() -> dict[str, str]:
        with SessionLocal() as db:
            workspace = db.scalar(select(Workspace).where(Workspace.code == copy.code))
            assert workspace is not None
            return workspace.state.get("switched_off") or {}

    def switch(on: bool) -> None:
        response = copy.client.put("/api/driver/signal", json={"on": on}, headers={"X-Relay-Role": "driver"})
        assert response.status_code == 204, response.text

    copy, _run = loaded_and_handed_over(new_copy)
    copy.jump(at("03:00"))
    switch(True)
    assert local(cut_off()["kasun"]) == "03:00"
    copy.jump(at("03:10"))
    switch(True)  # the phone says so again after a reload: the switch went on at 3:00
    assert local(cut_off()["kasun"]) == "03:00"
    switch(False)
    assert cut_off() == {}

    switch(True)
    copy.post("/api/driver/checkin", {"device_id": DEVICE}, "driver")  # a check-in means the phone has signal
    assert cut_off() == {}


def test_a_jump_leaves_a_phone_the_switch_cut_off_to_the_judge(new_copy: Callable[[], Copy]) -> None:
    """With the switch on, the judge holds Kasun's phone and what it saved: a jump plays none of Kasun's steps (the
    stops it passes stay the judge's), and the desk sees the phone go quiet until it is back."""
    copy = new_copy()
    copy.jump("on_the_road")  # 5:20 AM, Kegalle delivered, Mawanella next
    for username, role in (("kasun", "driver"), ("nuwan", "dispatcher")):
        copy.sign_in(username, role)
    response = copy.client.put("/api/driver/signal", json={"on": True}, headers={"X-Relay-Role": "driver"})
    assert response.status_code == 204, response.text

    state = copy.jump(at("05:35"))
    assert not [step for step in state["played"] if step.startswith("Kasun")]
    run = copy.get("/api/driver/run", "driver")
    mawanella = next(s for s in run["trip"]["stops"] if s["place"] == "Mawanella")
    assert (mawanella["status"], mawanella["arrived_at"]) == ("pending", None)
    panel = copy.get("/api/dispatch/live/runs?depot=Kandy", "dispatcher")
    kasun = next(r for r in panel["rows"] if r["vehicle_id"] == "VEH045" and not r["is_backup"])
    assert (kasun["out_of_contact"], local(kasun["last_contact_at"])) == (True, "05:20")

    response = copy.client.put("/api/driver/signal", json={"on": False}, headers={"X-Relay-Role": "driver"})
    assert response.status_code == 204, response.text
    copy.post("/api/driver/checkin", {"device_id": DEVICE}, "driver")
    panel = copy.get("/api/dispatch/live/runs?depot=Kandy", "dispatcher")
    kasun = next(r for r in panel["rows"] if r["vehicle_id"] == "VEH045" and not r["is_backup"])
    assert (kasun["out_of_contact"], local(kasun["last_contact_at"])) == (False, "05:35")


def test_the_run_says_why_there_is_nothing_to_drive_yet(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("publish")
    copy.sign_in("nuwan", "dispatcher")
    copy.sign_in("kasun", "driver")
    # Peliyagoda is out, but Kasun's run waits on the Kandy plan
    assert copy.get("/api/dispatch/plan?depot=Peliyagoda", "dispatcher")["plan"]["status"] == "published"
    assert copy.get("/api/dispatch/plan?depot=Kandy", "dispatcher")["plan"]["status"] != "published"
    run = copy.get("/api/driver/run", "driver")
    assert (run["vehicle_id"], run["published"], run["trip"]) == ("VEH045", False, None)
    assert (run["dispatcher"], run["dispatcher_phone"]) == ("Nuwan Perera", "081 000 2145")

    copy.jump("evening")
    run = copy.get("/api/driver/run", "driver")
    assert run["published"] is True
    assert run["trip"]["load"] == "not_started"  # nobody has started loading VEH045 yet


def test_a_body_larger_than_relay_takes_is_refused_before_it_is_read(new_copy: Callable[[], Copy]) -> None:
    """Caddy holds a 2 MB limit in front of the deployed API; the API holds the same one without it, whether the
    phone says how large the body is or streams it."""
    copy, run = loaded_and_handed_over(new_copy)
    photo = f"/api/driver/photos/{uuid.uuid4()}"
    form = {"taken_at": at("04:46")}
    big = ("proof.jpg", b"\xff" * 2_100_000, "image/jpeg")
    response = copy.client.put(photo, files={"file": big}, data=form, headers={"X-Relay-Role": "driver"})
    assert (response.status_code, response.json()["detail"]) == (413, "This is too large for Relay to take.")

    def chunks() -> Iterator[bytes]:
        for _ in range(3):
            yield b"x" * 1_000_000

    streamed = copy.client.post(
        "/api/driver/records", content=chunks(), headers={"X-Relay-Role": "driver", "Content-Type": "application/json"}
    )
    assert streamed.status_code == 413
    # a photo within the limit still goes through to the route, which reads it
    small = ("proof.jpg", b"\xff\xd8" + b"\x00" * 1000, "image/jpeg")
    response = copy.client.put(photo, files={"file": small}, data=form, headers={"X-Relay-Role": "driver"})
    assert response.status_code != 413
    assert run["trip"] is not None
