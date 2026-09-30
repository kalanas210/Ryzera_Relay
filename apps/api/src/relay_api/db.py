"""Database engine and sessions.

Every request works inside one workspace (one copy of the delivery day). The session keeps the
workspace id in `session.info`, and a single ORM hook adds `workspace_id = :id` to every query
on a workspace-scoped table, so no endpoint can read another judge's copy by forgetting a filter.
"""

from __future__ import annotations

import uuid
from collections.abc import Iterator
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.orm import ORMExecuteState, Session, sessionmaker, with_loader_criteria

from relay_api.config import get_settings
from relay_api.models.base import WorkspaceScoped

engine = create_engine(get_settings().database_url, pool_pre_ping=True, pool_size=10, max_overflow=10)
SessionLocal = sessionmaker(engine, expire_on_commit=False)

WORKSPACE_KEY = "workspace_id"


def scope_to_workspace(session: Session, workspace_id: uuid.UUID) -> None:
    session.info[WORKSPACE_KEY] = workspace_id


@event.listens_for(Session, "do_orm_execute")
def _add_workspace_criteria(state: ORMExecuteState) -> None:
    workspace_id = state.session.info.get(WORKSPACE_KEY)
    if workspace_id is None or state.execution_options.get("all_workspaces", False):
        return
    if state.is_select or state.is_update or state.is_delete:
        state.statement = state.statement.options(
            with_loader_criteria(
                WorkspaceScoped,
                lambda cls: cls.workspace_id == workspace_id,
                include_aliases=True,
            )
        )


@event.listens_for(Session, "before_flush")
def _stamp_workspace(session: Session, _context: Any, _instances: Any) -> None:
    workspace_id = session.info.get(WORKSPACE_KEY)
    if workspace_id is None:
        return
    for obj in session.new:
        if isinstance(obj, WorkspaceScoped) and getattr(obj, "workspace_id", None) is None:
            obj.workspace_id = workspace_id


def get_db() -> Iterator[Session]:
    with SessionLocal() as session:
        yield session
