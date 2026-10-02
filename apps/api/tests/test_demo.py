"""The demo bar's jumps, through the API: a moment at the dock follows the story truck the jump publishes on the way,
and the autopilot never plays a step that comes after the moment the judge asked for."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timedelta

import pytest
from copy_client import Copy


@pytest.mark.parametrize("start", [None, "publish"])
def test_a_jump_to_the_handover_leaves_the_handover_to_the_judge(
    new_copy: Callable[[], Copy], start: str | None
) -> None:
    copy = new_copy()
    if start is not None:
        copy.jump(start)  # the Kandy plan is still a draft here, as on a fresh copy
    state = copy.jump("handover")
    assert "Rizwan finishes loading" in state["played"]
    assert "Load complete, and Kasun accepts it" not in state["played"]
    moment = datetime.fromisoformat(next(m["at"] for m in state["moments"] if m["key"] == "handover"))
    assert timedelta(0) <= datetime.fromisoformat(state["now"]) - moment < timedelta(minutes=1)

    copy.sign_in("rizwan", "loader")
    tonight = copy.get("/api/dock/loads", "loader")
    card = next(c for c in tonight["loading"] + tonight["to_load"] if c["vehicle_id"] == "VEH045")
    load = copy.get(f"/api/dock/trips/{card['trip_id']}", "loader")
    assert load["handover"]["completed_at"] is None
    assert load["handover"]["accepted_at"] is None
    assert load["lines_done"] == load["lines_total"]  # every line on, Load complete is the judge's tap
    assert moment == datetime.fromisoformat(load["planned_depart"]) - timedelta(minutes=13)
