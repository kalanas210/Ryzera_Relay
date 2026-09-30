"""Which copy of the delivery day a request works in.

The `relay_ws` cookie names the workspace; without it, requests use MAIN, the shared copy the README
walkthrough follows. Resolving the workspace also scopes the database session to it.
"""

from __future__ import annotations

import secrets
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated

from fastapi import Depends, HTTPException, Request, Response, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import sim_now
from relay_api.config import get_settings
from relay_api.db import get_db, scope_to_workspace
from relay_api.models import Workspace

COOKIE = "relay_ws"
MAIN = "MAIN"
_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"


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
    if real_now - workspace.last_active_at > timedelta(minutes=1):
        workspace.last_active_at = real_now
        db.commit()
    scope_to_workspace(db, workspace.id)
    return Scope(db=db, workspace=workspace)


ScopeDep = Annotated[Scope, Depends(get_scope)]


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
