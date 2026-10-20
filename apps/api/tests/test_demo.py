from __future__ import annotations

from collections.abc import Callable, Iterator
from datetime import UTC, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from copy_client import Copy
from sqlalchemy.orm import object_session

COLOMBO = ZoneInfo("Asia/Colombo")
HEMMATHAGAMA_DRY = "ORD0098595"


def hm(value: str | None) -> str | None:
    return datetime.fromisoformat(value).astimezone(COLOMBO).strftime("%H:%M") if value else None


def story_load(copy: Copy) -> dict[str, Any]:
    tonight = copy.get("/api/dock/loads", "loader")
    card = next(c for g in ("loading", "ready", "to_load") for c in tonight[g] if c["vehicle_id"] == "VEH045")
    return copy.get(f"/api/dock/trips/{card['trip_id']}", "loader")


def run_on(copy: Copy, minutes: int) -> dict[str, Any]:
    from relay_api.clock import set_clock, sim_now
    from relay_api.db import SessionLocal
    from relay_api.workspaces import find_workspace

    with SessionLocal() as db:
        workspace = find_workspace(db, copy.code)
        assert workspace is not None
        set_clock(workspace, sim_now(workspace) + timedelta(minutes=minutes))
        db.commit()
    return copy.get("/api/demo/state")


@pytest.mark.parametrize(
    "body",
    [
        {"action": "jump"},
        {"action": "jump", "to": ""},
        {"action": "jump", "to": "not-a-date"},
        {"action": "jump", "to": "2026-04-08T05:20:00"},
        {"action": "advance", "minutes": 0},
        {"action": "rewind"},
    ],
)
def test_a_clock_command_the_bar_never_sends_is_refused(new_copy: Callable[[], Copy], body: dict[str, Any]) -> None:
    copy = new_copy()
    response = copy.client.post("/api/demo/clock", json=body)
    assert response.status_code == 422, response.text
    assert hm(copy.get("/api/demo/state")["now"]) == "14:05"


def test_a_jump_takes_a_moment_or_a_time_with_its_offset(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    assert hm(copy.jump("queue")["now"]) == "15:12"
    assert hm(copy.jump("2026-04-07T15:30:00+05:30")["now"]) == "15:30"


@pytest.mark.parametrize("start", [None, "publish"])
def test_a_jump_to_the_handover_puts_the_handover_on_the_phone(new_copy: Callable[[], Copy], start: str | None) -> None:
    copy = new_copy()
    if start is not None:
        copy.jump(start)
    state = copy.jump("handover")
    assert "Rizwan finishes loading" in state["played"]
    assert "Kasun accepts the load" not in state["played"]
    moment = datetime.fromisoformat(next(m["at"] for m in state["moments"] if m["key"] == "handover"))
    assert timedelta(0) <= datetime.fromisoformat(state["now"]) - moment < timedelta(minutes=1)

    copy.sign_in("rizwan", "loader")
    load = story_load(copy)
    assert hm(load["handover"]["completed_at"]) == (moment - timedelta(minutes=1)).astimezone(COLOMBO).strftime("%H:%M")
    assert load["handover"]["accepted_at"] is None
    assert load["lines_done"] == load["lines_total"]
    assert moment == datetime.fromisoformat(load["planned_depart"]) - timedelta(minutes=13)

    copy.sign_in("kasun", "driver")
    assert copy.get("/api/driver/run", "driver")["trip"]["load"] == "to_accept"

    state = copy.jump("first_stop")
    assert state["played"][:2] == ["Kasun accepts the load", "Kasun leaves the hub"]
    load = copy.get(f"/api/dock/trips/{load['trip_id']}", "loader")
    assert (load["handover"]["accepted_on"], load["handover"]["accepted_by"]) == ("phone", "Kasun Bandara")
    assert datetime.fromisoformat(load["handover"]["accepted_at"]) == moment + timedelta(minutes=1)


def test_a_load_the_judge_accepted_is_left_alone(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("handover")
    copy.sign_in("rizwan", "loader")
    trip_id = story_load(copy)["trip_id"]
    copy.post(f"/api/dock/trips/{trip_id}/accept", {"pin": "3690"}, "loader")
    state = copy.jump("first_stop")
    assert "Kasun accepts the load" not in state["played"]
    assert copy.get(f"/api/dock/trips/{trip_id}", "loader")["handover"]["accepted_on"] == "tablet"


def flag_rice(copy: Copy) -> dict[str, Any]:
    # Rizwan, played by the judge, counts 30 of 36 rice and dhal cases for Dilani's store and flags 6.
    copy.jump("loading")
    copy.sign_in("rizwan", "loader")
    load = story_load(copy)
    group = next(g for g in load["groups"] if g["order_ref"] == HEMMATHAGAMA_DRY)
    rice = next(line for line in group["lines"] if line["case_type"] == "rice_dhal")
    copy.post(f"/api/dock/lines/{rice['id']}", {"loaded": 30}, "loader")
    copy.post(f"/api/dock/lines/{rice['id']}/flag", {"kind": "missing", "qty": 6}, "loader")
    return rice


def rice_flag(copy: Copy) -> dict[str, Any]:
    group = next(g for g in story_load(copy)["groups"] if g["order_ref"] == HEMMATHAGAMA_DRY)
    rice = next(line for line in group["lines"] if line["case_type"] == "rice_dhal")
    flag: dict[str, Any] = rice["shortfall"]
    return flag


def test_nuwan_answers_a_flag_when_nobody_is_playing_nuwan(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    flag_rice(copy)
    run_on(copy, 11)  # 2:51. Nuwan answers five minutes after a flag, so the story has him at 2:52
    assert rice_flag(copy)["decision"] is None
    state = run_on(copy, 2)
    assert state["played"] == []
    flag = rice_flag(copy)
    assert (flag["decision"], flag["decided_by"], hm(flag["decided_at"])) == ("send_short", "Nuwan Perera", "02:52")


def test_a_flag_raised_late_is_answered_five_minutes_after(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("loading")
    copy.jump("2026-04-08T03:00:00+05:30")  # Rizwan's own story flag at 2:47 was answered on the way
    copy.sign_in("rizwan", "loader")
    load = story_load(copy)
    line = next(x for g in load["groups"] for x in g["lines"] if x["status"] == "to_load")
    copy.post(f"/api/dock/lines/{line['id']}/flag", {"kind": "missing", "qty": 1}, "loader")
    run_on(copy, 4)
    assert copy.get(f"/api/dock/trips/{load['trip_id']}", "loader")["flags_waiting"] == 1
    run_on(copy, 2)
    assert copy.get(f"/api/dock/trips/{load['trip_id']}", "loader")["flags_waiting"] == 0


def test_a_judge_playing_nuwan_answers_the_flag_themselves(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    flag_rice(copy)
    copy.sign_in("nuwan", "dispatcher")
    copy.get("/api/dispatch/live/feed?depot=Kandy", "dispatcher")
    run_on(copy, 20)
    assert rice_flag(copy)["decision"] is None


def test_kasun_accepts_a_load_nobody_accepts(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("handover")
    copy.sign_in("rizwan", "loader")
    run_on(copy, 5)
    assert story_load(copy)["handover"]["accepted_at"] is None
    run_on(copy, 2)
    handover = story_load(copy)["handover"]
    assert (handover["accepted_by"], handover["accepted_on"]) == ("Kasun Bandara", "phone")


def test_kasun_waits_for_the_judge_holding_the_phone(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("handover")
    copy.sign_in("kasun", "driver")
    copy.sign_in("rizwan", "loader")
    copy.get("/api/demo/state", "driver")
    run_on(copy, 30)
    assert story_load(copy)["handover"]["accepted_at"] is None


@pytest.fixture
def shared(database: None) -> Iterator[Any]:
    # A browser with no copy of its own works in MAIN. MAIN is reset before and after.
    from fastapi.testclient import TestClient

    from relay_api.config import get_settings
    from relay_api.main import app
    from relay_api.seed.story import reset_workspace

    def restart(main: Any) -> None:
        reset_workspace(object_session(main), get_settings().seed_dir, main)

    _main(restart)
    yield TestClient(app, headers={"X-Relay-Client": "web"})
    _main(restart)


def _main(change: Callable[[Any], None]) -> str:
    from relay_api.db import SessionLocal
    from relay_api.seed.story import MAIN
    from relay_api.workspaces import find_workspace

    with SessionLocal() as db:
        main = find_workspace(db, MAIN)
        assert main is not None
        change(main)
        db.commit()
        return str(main.state.get("edition"))


def test_the_shared_walkthrough_is_held_at_the_start(shared: Any) -> None:
    state = shared.get("/api/demo/state").json()
    assert state["workspace"]["is_default"]
    assert (hm(state["now"]), state["rate"]) == ("14:05", 0)
    moved = shared.post("/api/demo/clock", json={"action": "jump", "to": "loading"})
    assert moved.status_code == 409
    assert "Start your own copy" in moved.json()["detail"]
    assert shared.post("/api/demo/clock", json={"action": "advance", "minutes": 15}).status_code == 409
    assert shared.post("/api/demo/reset").status_code == 409
    assert hm(shared.get("/api/demo/state").json()["now"]) == "14:05"

    mine = shared.post("/api/demo/workspaces").json()
    assert not mine["workspace"]["is_default"]
    assert mine["rate"] == 1
    assert hm(shared.post("/api/demo/clock", json={"action": "jump", "to": "loading"}).json()["now"]) == "02:40"


def test_a_shared_walkthrough_left_running_goes_back_to_the_start(shared: Any) -> None:
    from relay_api.clock import at, set_clock

    before = _main(lambda ws: set_clock(ws, at("2026-04-09", "10:31"), rate=1.0))
    state = shared.get("/api/demo/state").json()
    assert (hm(state["now"]), state["rate"]) == ("14:05", 0)
    assert state["workspace"]["edition"] != before


def test_a_changed_shared_walkthrough_starts_again_an_hour_after_the_last_visit(shared: Any) -> None:
    edition = shared.get("/api/demo/state").json()["workspace"]["edition"]
    _main(lambda ws: setattr(ws, "last_active_at", datetime.now(UTC) - timedelta(hours=2)))
    assert shared.get("/api/demo/state").json()["workspace"]["edition"] == edition

    shared.post("/api/auth/login", json={"username": "dilani", "password": "relay2026"})
    response = shared.patch("/api/auth/me", json={"locale": "si"}, headers={"X-Relay-Role": "store_manager"})
    assert response.status_code == 200, response.text
    assert shared.get("/api/demo/state").json()["workspace"]["edition"] == edition

    _main(lambda ws: setattr(ws, "last_active_at", datetime.now(UTC) - timedelta(minutes=50)))
    assert shared.get("/api/demo/state").json()["workspace"]["edition"] == edition
    _main(lambda ws: setattr(ws, "last_active_at", datetime.now(UTC) - timedelta(hours=2)))
    assert shared.get("/api/demo/state").json()["workspace"]["edition"] != edition
    me = shared.get("/api/auth/me", headers={"X-Relay-Role": "store_manager"}).json()
    assert me["locale"] == "en"
