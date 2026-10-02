"""Which copy of the delivery day a request works in.

The `relay_ws` cookie names the workspace; without it, requests use MAIN, the shared copy every browser opens until it
starts or joins a private one. MAIN stays at the start of the story: its clock is held at Tuesday 2:05 PM, and once
nobody has used it for an hour, whatever people changed in it is undone. Resolving the workspace also scopes the
database session to it, and notes who is signed in there: the story autopilot leaves a character to the judge who is
playing them.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated, Any

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import func, literal, select, update
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session

from relay_api.clock import sim_now
from relay_api.config import get_settings
from relay_api.db import get_db, scope_to_workspace
from relay_api.models import AppUser, Workspace
from relay_api.security import ROLE_HEADER, current_user
from relay_api.seed.story import MAIN, held_at_start, reset_workspace

COOKIE = "relay_ws"
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

MAIN_IDLE = timedelta(hours=1)
"""How long MAIN keeps what people changed in it after the last of them left."""
PRESENT = "present"
"""Key in Workspace.state: when each person was last signed in and using this copy (real time), by username."""
TOUCHED = "touched"
"""Key in Workspace.state: someone signed in has changed something in MAIN since it last started."""
AWAY = timedelta(minutes=5)
"""A person not seen for this long is not being played: the story autopilot takes their steps as their times come."""
NOTE_EVERY = timedelta(minutes=1)
READING = frozenset({"GET", "HEAD", "OPTIONS"})


def new_code() -> str:
    return "".join(secrets.choice(_ALPHABET) for _ in range(6))


@dataclass
class Scope:
    """A request's workspace, its database session and the scenario time it acts at."""

    db: Session
    workspace: Workspace

    @property
    def now(self) -> datetime:
        return sim_now(self.workspace)


def find_workspace(db: Session, code: str) -> Workspace | None:
    return db.scalar(select(Workspace).where(Workspace.code == code.upper()))


def get_scope(request: Request, db: Annotated[Session, Depends(get_db)]) -> Scope:
    code = request.cookies.get(COOKIE) or MAIN
    workspace = find_workspace(db, code) or find_workspace(db, MAIN)
    if workspace is None:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "The database has not been seeded yet")
    real_now = datetime.now(UTC)
    if workspace.is_default and not _at_rest(workspace, real_now):
        workspace = _restart(db, workspace, real_now)
    _note_visit(db, workspace, real_now, _signed_in(request, db), changes=request.method not in READING)
    scope_to_workspace(db, workspace.id)
    return Scope(db=db, workspace=workspace)


ScopeDep = Annotated[Scope, Depends(get_scope)]


def playing(workspace: Workspace, real_now: datetime) -> set[str]:
    """Who is being played in this copy: everyone signed in here and seen in the last few minutes."""
    seen = workspace.state.get(PRESENT) or {}
    return {name for name, at in seen.items() if real_now - datetime.fromisoformat(at) < AWAY}


def _at_rest(workspace: Workspace, real_now: datetime) -> bool:
    left = bool(workspace.state.get(TOUCHED)) and real_now - workspace.last_active_at > MAIN_IDLE
    return held_at_start(workspace) and not left


def _restart(db: Session, workspace: Workspace, real_now: datetime) -> Workspace:
    """MAIN back to the start of the story: left changed for an hour, or a copy from before its clock was held. The
    first request to find it so does it; any other waits on the row and finds it done."""
    locked = db.scalar(
        select(Workspace)
        .where(Workspace.id == workspace.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )
    assert locked is not None
    if not _at_rest(locked, real_now):
        reset_workspace(db, get_settings().seed_dir, locked)
        locked.last_active_at = real_now
    db.commit()
    return locked


def _signed_in(request: Request, db: Session) -> AppUser | None:
    """The person a request acts as, when it names a role and that role's session is signed in. A request that names
    no role (the demo state on the sign-in page, say) is nobody's."""
    if not (request.headers.get(ROLE_HEADER) or request.query_params.get("as")):
        return None
    try:
        return current_user(request, db)
    except HTTPException:
        return None


def _note_visit(db: Session, workspace: Workspace, real_now: datetime, user: AppUser | None, changes: bool) -> None:
    """When the copy was last used, who is signed in and using it, and whether MAIN has been changed: each written at
    most once a minute, merged into the row in one statement so it never writes over the simulator's state. Skipped
    while a jump holds the row: the next request writes it."""
    values: dict[str, Any] = {}
    if real_now - workspace.last_active_at > NOTE_EVERY:
        values["last_active_at"] = real_now
    patch: list[Any] = []
    if user is not None:
        seen = (workspace.state.get(PRESENT) or {}).get(user.username)
        if seen is None or real_now - datetime.fromisoformat(seen) > NOTE_EVERY:
            mine = func.jsonb_build_object(user.username, real_now.isoformat())
            patch += [PRESENT, func.coalesce(Workspace.state[PRESENT], literal({}, JSONB)).op("||")(mine)]
        if workspace.is_default and changes and not workspace.state.get(TOUCHED):
            patch += [TOUCHED, True]
    if patch:
        values["state"] = Workspace.state.op("||")(func.jsonb_build_object(*patch))
    if not values:
        return
    free = db.scalar(select(Workspace.id).where(Workspace.id == workspace.id).with_for_update(skip_locked=True))
    if free is not None:
        db.execute(
            update(Workspace)
            .where(Workspace.id == workspace.id)
            .values(**values)
            .execution_options(synchronize_session=False)
        )
    db.commit()


def remember_workspace(response: Response, workspace: Workspace) -> None:
    response.set_cookie(
        COOKIE,
        workspace.code,
        max_age=30 * 24 * 3600,
        httponly=True,
        secure=get_settings().cookie_secure,
        samesite="lax",
        path="/",
    )
