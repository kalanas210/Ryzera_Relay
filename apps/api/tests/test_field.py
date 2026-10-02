"""Kasun's morning through the API: the load is accepted and the truck drives, the phone goes quiet near Mawanella,
Nuwan sends Aranayake with the standby van, Dilani confirms receipt from the store, and when the phone comes back its
offline records land in order, one clash raises the one question, and Kasun's "yes" settles it."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

from copy_client import Copy

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


def send(copy: Copy, *records: dict) -> dict:
    return copy.post("/api/driver/records", {"device_id": DEVICE, "records": list(records)}, "driver")


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

    copy.jump(at("05:31"))
    run = copy.get("/api/driver/run", "driver")
    kegalle, mawanella = stop_at(run, "Kegalle"), stop_at(run, "Mawanella")
    out = send(
        copy,
        record("arrived", trip, "04:52", kegalle),
        record("delivered", trip, "05:11", kegalle, receiver="P. Silva"),
        record("arrived", trip, "05:30", mawanella),
    )
    assert [r["outcome"] for r in out["results"]] == ["applied", "applied", "applied"]
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
    assert done == [("delivered", "05:11"), ("delivered", "05:52"), ("delivered", "06:35"), ("moved", None)]
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
