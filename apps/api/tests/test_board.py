"""The plan board (DSP-02) through the API: the drag's fit for every trip, a stop that moves with every order of its
store as one undo step, the plan's Edited and Ready marks, the fleet changes a dispatcher can make on a draft, the
first read of a new day under concurrent requests, and the words a deferred store reads."""

from __future__ import annotations

import threading
from collections.abc import Callable
from datetime import date, datetime
from typing import Any
from zoneinfo import ZoneInfo

import pytest
from copy_client import Copy

COLOMBO = ZoneInfo("Asia/Colombo")
DILANI_CHILLED = "ORD0098596"  # OUT117 Hemmathagama, the order that doesn't fit
RUN_DATE = "2026-04-08"


def _board(copy: Copy) -> Any:
    return copy.get("/api/dispatch/plan?depot=Kandy", "dispatcher")


def _trip(board: Any, vehicle_id: str, trip_no: int) -> Any:
    return next(
        t for lane in board["lanes"] for t in lane["trips"] if (t["vehicle_id"], t["trip_no"]) == (vehicle_id, trip_no)
    )


def _lane(board: Any, vehicle_id: str) -> Any:
    return next(lane for lane in board["lanes"] if lane["vehicle_id"] == vehicle_id)


def _planning(new_copy: Callable[[], Copy]) -> Copy:
    copy = new_copy()
    copy.jump("plan")  # 4:35 PM: Relay has proposed the Kandy plan
    copy.sign_in("nuwan", "dispatcher")
    return copy


def _status(copy: Copy, vehicle_id: str, body: dict[str, Any], depot: str = "Kandy") -> Any:
    return copy.client.patch(
        f"/api/dispatch/plan/vehicles/{vehicle_id}?depot={depot}", json=body, headers={"X-Relay-Role": "dispatcher"}
    )


def test_the_drag_names_the_stop_the_move_makes(new_copy: Callable[[], Copy]) -> None:
    copy = _planning(new_copy)
    plan = _board(copy)["plan"]["id"]

    fits = copy.get(f"/api/dispatch/plan/{plan}/fit?order_ref={DILANI_CHILLED}", "dispatcher")
    kegalle = next(f for f in fits if (f["vehicle_id"], f["trip_no"]) == ("VEH057", 2))
    # the tooltip's numbers and the trip detail's "Drop to add OUT117 as stop 3"
    assert kegalle == {
        "vehicle_id": "VEH057",
        "trip_no": 2,
        "fits": False,
        "hint": "Over weight and volume",
        "weight_kg": 1460.8,
        "volume_m3": 7.676,
        "weight_cap_kg": 1040.0,
        "volume_cap_m3": 7.0,
        "stop": 3,
        "current": False,
    }
    assert not any(f["current"] for f in fits)  # a Not placed order rides no trip yet

    board = copy.post(
        f"/api/dispatch/plan/{plan}/move",
        {"order_refs": [DILANI_CHILLED], "vehicle_id": "VEH057", "trip_no": 2},
        "dispatcher",
    )
    trip = _trip(board, "VEH057", 2)
    # the second trip leaves after the first is back, so no stop order keeps every window: Relay keeps the
    # dispatcher's, and the store that misses its window is the one just added
    assert [s["outlet_id"] for s in trip["stops"]] == ["OUT116", "OUT119", "OUT117"]
    assert [r["message"] for r in trip["rules"] if not r["passed"]] == [
        "Weight: 1,460.8 of 1,040 kg",
        "Volume: 7.676 of 7.0 m³",
        "Window: OUT117 at 8:01 AM, closes 7:45",
    ]
    assert board["plan"]["edited_at"] is not None
    assert board["plan"]["ready_at"] is None


def test_a_stop_moves_with_every_order_given_as_one_undo_step(new_copy: Callable[[], Copy]) -> None:
    copy = _planning(new_copy)
    board = _board(copy)
    plan = board["plan"]["id"]
    kegalle = _trip(board, "VEH057", 2)
    refs = [s["order_ref"] for s in kegalle["stops"]]

    fits = copy.get(f"/api/dispatch/plan/{plan}/fit?" + "&".join(f"order_ref={r}" for r in refs), "dispatcher")
    assert next(f for f in fits if (f["vehicle_id"], f["trip_no"]) == ("VEH057", 2))["current"]

    moved = copy.post(f"/api/dispatch/plan/{plan}/move", {"order_refs": refs}, "dispatcher")
    waiting = {w["order_ref"]: w for w in moved["waiting"]}
    assert set(refs) <= waiting.keys()
    assert all(waiting[r]["deferral"]["kind"] == "manual" for r in refs)
    assert moved["plan"]["edited_at"] is not None

    back = copy.post(f"/api/dispatch/plan/{plan}/undo", None, "dispatcher")
    assert [s["order_ref"] for s in _trip(back, "VEH057", 2)["stops"]] == refs
    # back to exactly what Relay proposed, so the plan bar no longer says Edited
    assert back["plan"]["edited_at"] is None
    assert not back["can_undo"]


def test_a_move_names_orders_that_are_not_on_the_run(new_copy: Callable[[], Copy]) -> None:
    copy = _planning(new_copy)
    plan = _board(copy)["plan"]["id"]
    refused = copy.post(
        f"/api/dispatch/plan/{plan}/move", {"order_refs": ["ORD0000001", "ORD0000002"]}, "dispatcher", expect=409
    )
    assert refused["detail"] == "ORD0000001 and ORD0000002 are not on this run"
    copy.post(f"/api/dispatch/plan/{plan}/move", {}, "dispatcher", expect=409)


def test_the_plan_is_ready_when_the_deferral_has_a_reason(new_copy: Callable[[], Copy]) -> None:
    copy = _planning(new_copy)
    plan = _board(copy)["plan"]["id"]
    assert _board(copy)["plan"]["ready_at"] is None  # the deferral still needs a reason

    copy.post(f"/api/dispatch/plan/{plan}/deferrals/{DILANI_CHILLED}/confirm", {"reason": "reefer_short"}, "dispatcher")
    board = _board(copy)
    waiting = next(w for w in board["waiting"] if w["order_ref"] == DILANI_CHILLED)
    assert board["plan"]["ready_at"] == waiting["deferral"]["confirmed_at"]
    assert waiting["deferral"]["store_notice"].startswith("Two of our refrigerated vehicles are in the workshop")


def test_the_fleet_changes_on_a_draft_and_the_board_asks_for_a_new_proposal(new_copy: Callable[[], Copy]) -> None:
    copy = _planning(new_copy)
    before = _board(copy)
    assert before["plan"]["fleet_changed_at"] is None
    trips = len(_lane(before, "VEH043")["trips"])
    assert trips

    sent = _status(copy, "VEH043", {"run_date": RUN_DATE, "status": "workshop", "note": "Brakes, back Fri"})
    assert sent.status_code == 200, sent.text
    board = sent.json()
    lane = _lane(board, "VEH043")
    assert (lane["status"], lane["note"]) == ("workshop", "Brakes, back Fri")
    assert board["plan"]["fleet_changed_at"] is not None
    # its trips stay until Relay proposes again, and break rule 9 so the plan can't go out like this
    assert len(lane["trips"]) == trips
    assert board["broken"] >= trips
    assert all("VEH043 is in the workshop today" in [r["message"] for r in t["rules"]] for t in lane["trips"])

    back = _status(copy, "VEH043", {"run_date": RUN_DATE, "status": "available", "note": "ignored"}).json()
    assert (_lane(back, "VEH043")["status"], _lane(back, "VEH043")["note"]) == ("available", "")
    assert back["broken"] == 0


def test_the_fleet_is_set_once_the_plan_is_out(new_copy: Callable[[], Copy]) -> None:
    copy = _planning(new_copy)
    assert _status(copy, "VEH999", {"run_date": RUN_DATE, "status": "workshop"}).status_code == 404
    other = _status(copy, "VEH001", {"run_date": RUN_DATE, "status": "workshop"})
    assert other.status_code == 409
    assert other.json()["detail"] == "VEH001 is a Peliyagoda vehicle"
    long_ago = _status(copy, "VEH040", {"run_date": "1999-01-01", "status": "workshop"})
    assert long_ago.status_code == 409
    assert long_ago.json()["detail"].startswith("The fleet can be changed for runs from Wednesday 8 April")

    copy.jump("publish")
    plan = _board(copy)["plan"]["id"]
    copy.post(f"/api/dispatch/plan/{plan}/deferrals/{DILANI_CHILLED}/confirm", {"reason": "reefer_short"}, "dispatcher")
    copy.post(f"/api/dispatch/plan/{plan}/publish", None, "dispatcher")
    refused = _status(copy, "VEH045", {"run_date": RUN_DATE, "status": "workshop"})
    assert refused.status_code == 409
    assert "is published, so its fleet is set" in refused.json()["detail"]
    assert _lane(_board(copy), "VEH045")["status"] == "available"


def test_a_new_days_first_reads_share_one_plan(new_copy: Callable[[], Copy]) -> None:
    """The board's poll and a depot switch can both be the first read of a day: one plan, and no error."""
    from relay_api.db import SessionLocal, scope_to_workspace
    from relay_api.services import planning
    from relay_api.workspaces import find_workspace

    copy = new_copy()
    with SessionLocal() as db:
        workspace = find_workspace(db, copy.code)
        assert workspace is not None
        workspace_id = workspace.id

    start = threading.Barrier(6)
    found: list[Any] = []
    failed: list[BaseException] = []

    def first_read() -> None:
        try:
            with SessionLocal() as db:
                scope_to_workspace(db, workspace_id)
                start.wait()
                plan = planning.get_plan(db, "Kandy", date(2026, 4, 20))
                db.commit()
                found.append(plan.id)
        except BaseException as exc:
            failed.append(exc)

    readers = [threading.Thread(target=first_read) for _ in range(6)]
    for reader in readers:
        reader.start()
    for reader in readers:
        reader.join()
    assert not failed
    assert len(found) == 6
    assert len(set(found)) == 1


@pytest.mark.parametrize(
    ("reason", "rule", "limiting", "first", "rule_two_told"),
    [
        ("reefer_short", 2, ["VEH039", "VEH043", "VEH058"], "Three of our refrigerated vehicles are", True),
        ("workshop", None, ["VEH039"], "One of our refrigerated vehicles is", False),
        ("store_asked", 2, ["VEH039", "VEH058"], "You asked us to move it.", False),
    ],
)
def test_the_store_reads_one_reason_in_plain_words(
    database: None, reason: str, rule: int | None, limiting: list[str], first: str, rule_two_told: bool
) -> None:
    from relay_api.models import Deferral, DeferralKind, Order, Plan
    from relay_api.services.planning import store_notice

    plan = Plan(depot="Kandy", run_date=date(2026, 4, 8))
    order = Order(order_ref=DILANI_CHILLED, temp="chilled")
    deferral = Deferral(
        kind=DeferralKind.CAPACITY,
        to_date=date(2026, 4, 9),
        explanation={"rule": rule, "analysis": {"limiting": limiting}},
        created_at=datetime(2026, 4, 7, 16, 52, tzinfo=COLOMBO),
    )
    notice = store_notice(None, plan, order, deferral, reason)  # type: ignore[arg-type]
    assert notice.startswith(first)
    assert ("Another store in your area had its chilled order wait" in notice) is rule_two_told


def test_the_api_warms_the_story_days_first_proposals(new_copy: Callable[[], Copy]) -> None:
    """`relay-api serve` warms the engine cache, so a judge's jump to the plan on a fresh install answers from it."""
    from sqlalchemy import delete, func, select

    from relay_api.cli import warm
    from relay_api.db import SessionLocal
    from relay_api.models import EngineCache, Workspace

    def count(model: type) -> int:
        with SessionLocal() as db:
            return db.scalar(select(func.count()).select_from(model)) or 0

    with SessionLocal() as db:
        db.execute(delete(EngineCache))
        db.commit()
    copies = count(Workspace)

    warm()
    with SessionLocal() as db:
        assert set(db.scalars(select(EngineCache.depot))) == {"Kandy", "Peliyagoda"}
    assert count(Workspace) == copies  # the scratch copy is gone
    answers = count(EngineCache)

    copy = new_copy()
    played = copy.jump("plan")["played"]
    assert "Relay proposes the Kandy plan" in played
    assert count(EngineCache) == answers  # the judge's proposal was already there
