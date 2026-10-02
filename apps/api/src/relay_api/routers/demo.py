"""The demo bar: the scenario clock, private copies of the day, and reset. Only in demo mode."""

from __future__ import annotations

from datetime import datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from relay_api.clock import set_clock, sim_now
from relay_api.config import get_settings
from relay_api.db import get_db, scope_to_workspace
from relay_api.models import Workspace
from relay_api.schemas.common import DemoState, MomentOut, WorkspaceOut
from relay_api.seed.story import create_workspace, reset_workspace
from relay_api.services import story
from relay_api.services.simulator import catch_up
from relay_api.workspaces import ScopeDep, find_workspace, new_code, remember_workspace

router = APIRouter(prefix="/api/demo", tags=["demo"])

Db = Annotated[Session, Depends(get_db)]


def _demo_only() -> None:
    if not get_settings().demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo mode is off")


def state_of(db: Session, workspace: Workspace, played: list[str] | None = None) -> DemoState:
    now = sim_now(workspace)
    moments = story.moments(db)
    nxt = next((m for m in moments if m.at > now + timedelta(seconds=30)), None)
    return DemoState(
        demo_mode=get_settings().demo_mode,
        workspace=WorkspaceOut.model_validate(workspace),
        now=now,
        rate=workspace.clock_rate,
        moments=[MomentOut(key=m.key, label=m.label, at=m.at, passed=m.at <= now) for m in moments],
        next=MomentOut(key=nxt.key, label=nxt.label, at=nxt.at, passed=False) if nxt else None,
        played=played or [],
        outages={
            name: {k: datetime.fromisoformat(v) for k, v in window.items()}
            for name, window in (workspace.state.get("outages") or {}).items()
        },
    )


@router.get("/state", response_model=DemoState)
def get_state(scope: ScopeDep) -> DemoState:
    catch_up(scope.db, scope.workspace)
    return state_of(scope.db, scope.workspace)


class ClockCommand(BaseModel):
    action: Literal["jump", "advance", "pause", "resume"]
    to: str | None = Field(default=None, description="A moment key, or an ISO time")
    minutes: int | None = Field(default=None, ge=1, le=24 * 60)


@router.post("/clock", response_model=DemoState, dependencies=[Depends(_demo_only)])
def move_clock(body: ClockCommand, scope: ScopeDep) -> DemoState:
    ws = scope.workspace
    now = sim_now(ws)
    moment = story.moment_time(body.to or "") if body.action == "jump" else None
    if body.action == "jump":
        target = moment(scope.db) if moment else datetime.fromisoformat(body.to or "")
        if target < now - timedelta(minutes=1):
            raise HTTPException(status.HTTP_409_CONFLICT, "The clock only moves forward. Reset the day to start again.")
        if moment is None:
            set_clock(ws, target)  # a moment can move while the jump plays the steps on the way; catch_up sets it
    elif body.action == "advance":
        set_clock(ws, now + timedelta(minutes=body.minutes or 15))
    elif body.action == "pause":
        set_clock(ws, now, rate=0.0)
    else:
        set_clock(ws, now, rate=1.0)
    scope.db.commit()
    played = catch_up(scope.db, ws, moment, jumped_from=now) if body.action in ("jump", "advance") else []
    return state_of(scope.db, ws, played)


@router.post("/reset", response_model=DemoState, dependencies=[Depends(_demo_only)])
def reset(scope: ScopeDep) -> DemoState:
    reset_workspace(scope.db, get_settings().seed_dir, scope.workspace)
    scope.db.commit()
    return state_of(scope.db, scope.workspace)


@router.post("/workspaces", response_model=DemoState, dependencies=[Depends(_demo_only)])
def new_private_copy(response: Response, db: Db) -> DemoState:
    code = new_code()
    while find_workspace(db, code) is not None:
        code = new_code()
    ws = create_workspace(db, get_settings().seed_dir, code, "Private walkthrough")
    db.commit()
    remember_workspace(response, ws)
    return state_of(db, ws)


class JoinRequest(BaseModel):
    code: str = Field(min_length=4, max_length=8)


@router.post("/join", response_model=DemoState, dependencies=[Depends(_demo_only)])
def join(body: JoinRequest, response: Response, db: Db) -> DemoState:
    ws = find_workspace(db, body.code)
    if ws is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No walkthrough with that code.")
    remember_workspace(response, ws)
    scope_to_workspace(db, ws.id)
    return state_of(db, ws)
