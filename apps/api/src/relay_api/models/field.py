"""What drivers record on the road. Every record carries the id the phone gave it, so a resend is harmless."""

from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, LargeBinary, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from relay_api.models.base import Base, WorkspaceScoped, new_id, str_enum


class FieldEventKind(enum.StrEnum):
    LOAD_ACCEPTED = "load_accepted"
    DEPARTED = "departed"
    ARRIVED = "arrived"
    DELIVERED = "delivered"
    FAILED = "failed"
    PROBLEM = "problem"
    TRIP_FINISHED = "trip_finished"
    CHECKIN = "checkin"
    LOAD_DIFFERENCE = "load_difference"
    """The driver says the load does not match the handover."""
    CONFLICT_ANSWER = "conflict_answer"
    """The driver's answer to the one question about a stop with two copies."""


class FieldEventOutcome(enum.StrEnum):
    APPLIED = "applied"
    DUPLICATE = "duplicate"
    CONFLICT = "conflict"
    """Recorded, but it clashes with a change the office made while the phone was silent."""
    REJECTED = "rejected"


class FieldEvent(WorkspaceScoped, Base):
    __tablename__ = "field_event"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    """Generated on the phone when the record is made."""
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), index=True)
    device_id: Mapped[str] = mapped_column(String(64))
    kind: Mapped[FieldEventKind] = mapped_column(str_enum(FieldEventKind))
    trip_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"), index=True)
    stop_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stop.id", ondelete="CASCADE"), index=True)
    occurred_at: Mapped[datetime]
    """When it happened, by the phone's scenario clock. Kept as recorded, even if it arrives an hour later."""
    received_at: Mapped[datetime]
    base_version: Mapped[int | None]
    """The stop version the phone last saw."""
    lat: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False))
    lng: Mapped[float | None] = mapped_column(Numeric(9, 6, asdecimal=False))
    accuracy_m: Mapped[float | None] = mapped_column(Numeric(7, 1, asdecimal=False))
    payload: Mapped[dict[str, Any]] = mapped_column(default=dict)
    outcome: Mapped[FieldEventOutcome] = mapped_column(str_enum(FieldEventOutcome))
    applied_at: Mapped[datetime | None]
    """When it took effect: on arrival, or when the question it raised was settled."""
    reject_reason: Mapped[str] = mapped_column(Text, default="")


class Photo(WorkspaceScoped, Base):
    __tablename__ = "photo"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True)
    content_type: Mapped[str] = mapped_column(String(32))
    data: Mapped[bytes] = mapped_column(LargeBinary)
    width: Mapped[int | None]
    height: Mapped[int | None]
    taken_at: Mapped[datetime]
    uploaded_at: Mapped[datetime]
    uploaded_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    stop_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stop.id", ondelete="CASCADE"), index=True)
    event_id: Mapped[uuid.UUID | None]
    """The delivery record it belongs to; the photo is sent after it."""


class Proof(WorkspaceScoped, Base):
    """Proof of delivery for one stop: what was dropped, who received it, a photo or a signature."""

    __tablename__ = "proof"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    stop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stop.id", ondelete="CASCADE"), unique=True)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("field_event.id", ondelete="CASCADE"))
    receiver_name: Mapped[str] = mapped_column(String(64))
    lines: Mapped[list[Any]] = mapped_column(default=list)
    """Delivered count per case type, with a reason where it differs from the load."""
    all_delivered: Mapped[bool] = mapped_column(default=True)
    photo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("photo.id"))
    signature_svg: Mapped[str | None] = mapped_column(Text)
    recorded_at: Mapped[datetime]


class ProblemReason(enum.StrEnum):
    DELAYED = "delayed"
    OUTLET_CLOSED = "outlet_closed"
    ACCESS_BLOCKED = "access_blocked"
    GOODS_REFUSED = "goods_refused"
    DAMAGED_IN_TRANSIT = "damaged_in_transit"
    VEHICLE_PROBLEM = "vehicle_problem"


class ProblemReport(WorkspaceScoped, Base):
    __tablename__ = "problem_report"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    event_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("field_event.id", ondelete="CASCADE"))
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"), index=True)
    stop_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stop.id", ondelete="CASCADE"))
    reason: Mapped[ProblemReason] = mapped_column(str_enum(ProblemReason))
    delay_min: Mapped[int | None]
    note: Mapped[str] = mapped_column(Text, default="")
    reported_at: Mapped[datetime]
    lines: Mapped[list[Any]] = mapped_column(default=list)
    """Case type and count, for goods refused or damaged in transit."""
    urgent: Mapped[bool] = mapped_column(default=False)
    """The vehicle cannot move."""


class ConflictStatus(enum.StrEnum):
    WAITING_FOR_DRIVER = "waiting_for_driver"
    ESCALATED = "escalated"
    """The driver said no, or nobody answered in 10 minutes: the dispatcher decides."""
    RESOLVED = "resolved"


class Conflict(WorkspaceScoped, Base):
    """A driver's offline record that clashes with an office change, and the one question that settles it."""

    __tablename__ = "conflict"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    stop_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stop.id", ondelete="CASCADE"), index=True)
    backup_stop_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stop.id", ondelete="CASCADE"))
    driver_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"))
    status: Mapped[ConflictStatus] = mapped_column(str_enum(ConflictStatus))
    question: Mapped[str] = mapped_column(Text)
    answer: Mapped[str | None] = mapped_column(String(8))
    opened_at: Mapped[datetime]
    answered_at: Mapped[datetime | None]
    resolution: Mapped[str] = mapped_column(Text, default="")
    """Who settled it: the driver, or the dispatcher cancelling the backup's copy."""
    event_id: Mapped[uuid.UUID | None]
    """The record that clashed."""
    resolved_at: Mapped[datetime | None]
    resolved_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    escalated_at: Mapped[datetime | None]


class DeviceContact(WorkspaceScoped, Base):
    """The last time each driver's phone reached Relay, and what it said was still waiting to send."""

    __tablename__ = "device_contact"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("app_user.id"), index=True)
    last_contact_at: Mapped[datetime]
    last_record_at: Mapped[datetime | None]
    pending_records: Mapped[int] = mapped_column(default=0)
    device_id: Mapped[str | None] = mapped_column(String(64))
    gap_from: Mapped[datetime | None]
    """The last silence on a running trip, for "Offline 5:41 to 7:14"."""
    gap_to: Mapped[datetime | None]
