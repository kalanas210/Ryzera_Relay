from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from relay_api.models.base import Base, WorkspaceScoped, new_id, str_enum


class ReceiptStatus(enum.StrEnum):
    CONFIRMED = "confirmed"
    WITH_ISSUES = "with_issues"


class IssueKind(enum.StrEnum):
    MISSING = "missing"
    DAMAGED = "damaged"
    NOT_COLD = "not_cold"


class Receipt(WorkspaceScoped, Base):
    __tablename__ = "receipt"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("delivery_order.id", ondelete="CASCADE"), unique=True)
    status: Mapped[ReceiptStatus] = mapped_column(str_enum(ReceiptStatus))
    confirmed_at: Mapped[datetime]
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    before_driver_proof: Mapped[bool] = mapped_column(default=False)
    """Confirmed at the store before the driver's phone had sent its proof."""
    lines: Mapped[list[Any]] = mapped_column(default=list)
    client_ref: Mapped[str | None] = mapped_column(String(64))


class ReceiptIssue(WorkspaceScoped, Base):
    __tablename__ = "receipt_issue"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    receipt_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("receipt.id", ondelete="CASCADE"), index=True)
    case_type: Mapped[str] = mapped_column(ForeignKey("case_type.code"))
    kind: Mapped[IssueKind] = mapped_column(str_enum(IssueKind))
    qty: Mapped[int]
    note: Mapped[str] = mapped_column(Text, default="")
    photo_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("photo.id"))
