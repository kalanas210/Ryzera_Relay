from __future__ import annotations

import enum
import uuid
from datetime import datetime

from sqlalchemy import ForeignKey, SmallInteger, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from relay_api.models.base import Base, WorkspaceScoped, new_id, str_enum


class LoadLineStatus(enum.StrEnum):
    TO_LOAD = "to_load"
    IN_PROGRESS = "in_progress"
    CHECKED = "checked"
    FLAG_WAITING = "flag_waiting"
    """Flagged short or damaged; loading goes on while the dispatcher decides."""
    DECIDED = "decided"


class LoadLine(WorkspaceScoped, Base):
    """One case type for one stop on one trip, in loading order."""

    __tablename__ = "load_line"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"), index=True)
    stop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stop.id", ondelete="CASCADE"), index=True)
    case_type: Mapped[str] = mapped_column(ForeignKey("case_type.code"))
    load_order: Mapped[int] = mapped_column(SmallInteger)
    planned_qty: Mapped[int]
    loaded_qty: Mapped[int] = mapped_column(default=0)
    status: Mapped[LoadLineStatus] = mapped_column(str_enum(LoadLineStatus), default=LoadLineStatus.TO_LOAD)
    changed_by_plan: Mapped[bool] = mapped_column(default=False)
    updated_at: Mapped[datetime | None]
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))


class ShortfallKind(enum.StrEnum):
    MISSING = "missing"
    DAMAGED = "damaged"


class ShortfallDecision(enum.StrEnum):
    SEND_SHORT = "send_short"
    """Leave without the cases and add them to the store's next order."""
    NO_REPLACEMENT = "no_replacement"
    """Leave without the cases; the store is told and nothing is added."""


class Shortfall(WorkspaceScoped, Base):
    __tablename__ = "shortfall"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    load_line_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("load_line.id", ondelete="CASCADE"), index=True)
    kind: Mapped[ShortfallKind] = mapped_column(str_enum(ShortfallKind))
    qty: Mapped[int]
    note: Mapped[str] = mapped_column(Text, default="")
    photo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("photo.id"))
    flagged_at: Mapped[datetime]
    flagged_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    decision: Mapped[ShortfallDecision | None] = mapped_column(str_enum(ShortfallDecision))
    decided_at: Mapped[datetime | None]
    decided_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    added_to_order_ref: Mapped[str | None] = mapped_column(String(12))


class Handover(WorkspaceScoped, Base):
    """Planned against loaded, confirmed by the loader and accepted by the driver."""

    __tablename__ = "handover"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"), unique=True)
    planned_cases: Mapped[int]
    loaded_cases: Mapped[int]
    completed_at: Mapped[datetime]
    completed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    accepted_at: Mapped[datetime | None]
    accepted_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    accepted_on: Mapped[str | None] = mapped_column(String(8))
    """'phone' or 'tablet' (the driver's own PIN on the dock tablet)."""
    difference: Mapped[str] = mapped_column(Text, default="")
    """What the driver said does not match, when the driver reported a difference instead of accepting."""
