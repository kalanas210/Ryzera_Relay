"""What reaches people: store notices, and the dispatcher's feed of things that need a decision."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from relay_api.models.base import Base, WorkspaceScoped, new_id, str_enum


class Notification(WorkspaceScoped, Base):
    __tablename__ = "notification"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    outlet_id: Mapped[str | None] = mapped_column(ForeignKey("outlet.outlet_id"), index=True)
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"), index=True)
    kind: Mapped[str] = mapped_column(String(32))
    title: Mapped[str] = mapped_column(String(120))
    body: Mapped[str] = mapped_column(Text)
    data: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_at: Mapped[datetime]
    show_after: Mapped[datetime]
    """When it may ring. A notice to a store between 10:00 PM and 5:00 AM arrives silently at once, readable in
    the app, and rings at 5:00 AM."""
    read_at: Mapped[datetime | None]
    acknowledged_at: Mapped[datetime | None]
    delivered_at: Mapped[datetime | None]
    """When a phone picked it up: a message to a silent driver waits for the next contact."""


class FeedKind(enum.StrEnum):
    SHORTFALL = "shortfall"
    DELAY = "delay"
    FAILED_STOP = "failed_stop"
    PROBLEM = "problem"
    DISPUTE = "dispute"
    SILENCE = "silence"
    CONFLICT = "conflict"
    BACK_IN_CONTACT = "back_in_contact"
    STOP_MOVED = "stop_moved"
    RECEIPT = "receipt"
    """A store confirmed receipt from a silent run while a backup is on the road."""


class FeedItem(WorkspaceScoped, Base):
    __tablename__ = "feed_item"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    kind: Mapped[FeedKind] = mapped_column(str_enum(FeedKind))
    depot: Mapped[str] = mapped_column(String(16))
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text, default="")
    ref: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_at: Mapped[datetime] = mapped_column(index=True)
    handled_at: Mapped[datetime | None]
    handled_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    outcome: Mapped[str] = mapped_column(Text, default="")
