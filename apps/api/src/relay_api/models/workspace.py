from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from relay_api.models.base import Base, WorkspaceScoped, new_id


class Workspace(Base):
    """One copy of the delivery day with its own scenario clock. MAIN is the shared copy; judges can start
    private ones and reset them."""

    __tablename__ = "workspace"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    code: Mapped[str] = mapped_column(String(8), unique=True)
    label: Mapped[str] = mapped_column(String(64), default="")
    is_default: Mapped[bool] = mapped_column(default=False)
    created_at: Mapped[datetime]
    last_active_at: Mapped[datetime]
    clock_anchor_real: Mapped[datetime]
    clock_anchor_sim: Mapped[datetime]
    clock_rate: Mapped[float] = mapped_column(default=1.0)
    """Scenario seconds per real second: 1 runs in real time, 0 holds the clock still."""
    state: Mapped[dict[str, Any]] = mapped_column(default=dict)


class ScheduledEvent(WorkspaceScoped, Base):
    """Something the world simulator does when the scenario clock reaches `due_at`: a store places an
    order, a driver reports a delay. Applied once, in order."""

    __tablename__ = "scheduled_event"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    due_at: Mapped[datetime] = mapped_column(index=True)
    kind: Mapped[str] = mapped_column(String(32))
    payload: Mapped[dict[str, Any]] = mapped_column(default=dict)
    done_at: Mapped[datetime | None]


class AuditLog(WorkspaceScoped, Base):
    """Every change a person or the simulator makes, in scenario time."""

    __tablename__ = "audit_log"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    at: Mapped[datetime] = mapped_column(index=True)
    actor_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    actor_label: Mapped[str] = mapped_column(String(64))
    action: Mapped[str] = mapped_column(String(48))
    entity: Mapped[str] = mapped_column(String(32))
    entity_id: Mapped[str] = mapped_column(String(64))
    summary: Mapped[str] = mapped_column(Text, default="")
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
