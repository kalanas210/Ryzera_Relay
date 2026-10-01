from __future__ import annotations

import enum
import uuid
from datetime import date, datetime

from sqlalchemy import Date, ForeignKey, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from relay_api.models.base import Base, WorkspaceScoped, new_id, str_enum


class OrderStatus(enum.StrEnum):
    RECEIVED = "received"
    """Confirmed to the store; waiting for the plan."""
    ALLOCATED = "allocated"
    DEFERRED = "deferred"
    LOADED = "loaded"
    ON_THE_WAY = "on_the_way"
    DELIVERED = "delivered"
    FAILED = "failed"
    CONFIRMED = "confirmed"
    """The store confirmed receipt."""
    DISPUTED = "disputed"
    """The store reported an issue on receipt."""


class OrderSource(enum.StrEnum):
    STORE = "store"
    SEED = "seed"
    SIMULATOR = "simulator"
    CARRIED = "carried"
    """Opened by Relay to carry cases that went short on an earlier delivery."""


class Order(WorkspaceScoped, Base):
    __tablename__ = "delivery_order"
    __table_args__ = (UniqueConstraint("workspace_id", "order_ref"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    order_ref: Mapped[str] = mapped_column(String(12))
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlet.outlet_id"), index=True)
    brand: Mapped[str] = mapped_column(String(8))
    temp: Mapped[str] = mapped_column(String(8))
    requested_date: Mapped[date] = mapped_column(Date)
    """The delivery day the store ordered for."""
    run_date: Mapped[date] = mapped_column(Date, index=True)
    """The run it will go on: the requested day, or a later one after a cutoff or a deferral."""
    units: Mapped[int]
    weight_kg: Mapped[float] = mapped_column(Numeric(9, 1, asdecimal=False))
    volume_m3: Mapped[float] = mapped_column(Numeric(9, 3, asdecimal=False))
    status: Mapped[OrderStatus] = mapped_column(str_enum(OrderStatus), default=OrderStatus.RECEIVED)
    source: Mapped[OrderSource] = mapped_column(str_enum(OrderSource), default=OrderSource.SEED)
    placed_at: Mapped[datetime]
    placed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    client_ref: Mapped[str | None] = mapped_column(String(64))
    """The store device's id for the order, so a resend never creates a second order."""
    note: Mapped[str] = mapped_column(Text, default="")

    lines: Mapped[list[OrderLine]] = relationship(
        back_populates="order", cascade="all, delete-orphan", order_by="OrderLine.position"
    )


class OrderLine(WorkspaceScoped, Base):
    __tablename__ = "order_line"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("delivery_order.id", ondelete="CASCADE"), index=True)
    position: Mapped[int] = mapped_column(default=0)
    case_type: Mapped[str] = mapped_column(ForeignKey("case_type.code"))
    qty: Mapped[int]
    carried_qty: Mapped[int] = mapped_column(default=0)
    """Cases added from an earlier order that went short, included in qty."""
    carried_from: Mapped[str | None] = mapped_column(String(12))

    order: Mapped[Order] = relationship(back_populates="lines")
