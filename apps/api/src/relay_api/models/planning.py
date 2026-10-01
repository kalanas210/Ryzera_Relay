from __future__ import annotations

import enum
import uuid
from datetime import date, datetime
from typing import Any

from sqlalchemy import Date, ForeignKey, Numeric, SmallInteger, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from relay_api.models.base import Base, WorkspaceScoped, new_id, str_enum


class PlanStatus(enum.StrEnum):
    DRAFT = "draft"
    PUBLISHED = "published"


class VehicleDayStatus(enum.StrEnum):
    AVAILABLE = "available"
    WORKSHOP = "workshop"
    STANDBY = "standby"


class TripStatus(enum.StrEnum):
    PLANNED = "planned"
    LOADING = "loading"
    LOADED = "loaded"
    """Handed over and accepted by the driver."""
    DEPARTED = "departed"
    RETURNING = "returning"
    """A backup turned back on the road: its stop was delivered after all."""
    FINISHED = "finished"
    CANCELLED = "cancelled"


class StopStatus(enum.StrEnum):
    PENDING = "pending"
    ARRIVED = "arrived"
    DELIVERED = "delivered"
    FAILED = "failed"
    MOVED = "moved"
    """Given to a backup vehicle while the driver was out of contact; settled when his records arrive."""
    CANCELLED = "cancelled"


class DeferralKind(enum.StrEnum):
    CAPACITY = "capacity"
    """The fleet cannot carry it on this run."""
    CUTOFF = "cutoff"
    """Placed after 4:00 PM, so it goes on the next run."""
    MANUAL = "manual"


class Plan(WorkspaceScoped, Base):
    __tablename__ = "plan"
    __table_args__ = (UniqueConstraint("workspace_id", "depot", "run_date"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    depot: Mapped[str] = mapped_column(String(16))
    run_date: Mapped[date] = mapped_column(Date)
    status: Mapped[PlanStatus] = mapped_column(str_enum(PlanStatus), default=PlanStatus.DRAFT)
    version: Mapped[int] = mapped_column(default=0)
    proposed_at: Mapped[datetime | None]
    published_at: Mapped[datetime | None]
    published_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    summary: Mapped[dict[str, Any]] = mapped_column(default=dict)

    trips: Mapped[list[Trip]] = relationship(back_populates="plan", cascade="all, delete-orphan")


class VehicleDay(WorkspaceScoped, Base):
    __tablename__ = "vehicle_day"
    __table_args__ = (UniqueConstraint("workspace_id", "vehicle_id", "run_date"),)

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicle.vehicle_id"))
    run_date: Mapped[date] = mapped_column(Date)
    status: Mapped[VehicleDayStatus] = mapped_column(str_enum(VehicleDayStatus))
    driver_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    fuel_used_l: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False), default=0.0)
    """Litres already used earlier in the same ISO week."""
    note: Mapped[str] = mapped_column(Text, default="")


class Trip(WorkspaceScoped, Base):
    __tablename__ = "trip"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plan.id", ondelete="CASCADE"), index=True)
    vehicle_id: Mapped[str] = mapped_column(ForeignKey("vehicle.vehicle_id"), index=True)
    trip_no: Mapped[int] = mapped_column(SmallInteger)
    brand: Mapped[str] = mapped_column(String(8))
    temp: Mapped[str] = mapped_column(String(8))
    district: Mapped[str] = mapped_column(ForeignKey("district.name"))
    planned_depart: Mapped[datetime]
    planned_back: Mapped[datetime]
    std_minutes: Mapped[int]
    fuel_l: Mapped[float] = mapped_column(Numeric(7, 1, asdecimal=False))
    status: Mapped[TripStatus] = mapped_column(str_enum(TripStatus), default=TripStatus.PLANNED)
    is_backup: Mapped[bool] = mapped_column(default=False)
    departed_at: Mapped[datetime | None]
    finished_at: Mapped[datetime | None]
    expected_back: Mapped[datetime | None]
    note: Mapped[str] = mapped_column(Text, default="")
    loader_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    """Who is loading it now, or loaded it."""
    loading_started_at: Mapped[datetime | None]
    claimed_at: Mapped[datetime | None]
    """When a person first worked on this load. From then on the world simulator leaves it alone."""
    turned_back_at: Mapped[datetime | None]

    plan: Mapped[Plan] = relationship(back_populates="trips")
    stops: Mapped[list[Stop]] = relationship(back_populates="trip", cascade="all, delete-orphan", order_by="Stop.seq")


class Stop(WorkspaceScoped, Base):
    """One order delivered at one outlet. The data delivers every order as its own stop."""

    __tablename__ = "stop"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    trip_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"), index=True)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("delivery_order.id"), index=True)
    outlet_id: Mapped[str] = mapped_column(ForeignKey("outlet.outlet_id"))
    seq: Mapped[int] = mapped_column(SmallInteger)
    planned_arrival: Mapped[datetime]
    expected_arrival: Mapped[datetime | None]
    status: Mapped[StopStatus] = mapped_column(str_enum(StopStatus), default=StopStatus.PENDING)
    arrived_at: Mapped[datetime | None]
    completed_at: Mapped[datetime | None]
    version: Mapped[int] = mapped_column(default=1)
    """Bumped on every change the office makes, so a record made offline can be checked against it."""
    backup_of: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("stop.id"))
    reason: Mapped[str] = mapped_column(Text, default="")

    trip: Mapped[Trip] = relationship(back_populates="stops")


class Deferral(WorkspaceScoped, Base):
    __tablename__ = "deferral"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    order_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("delivery_order.id"), index=True)
    plan_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("plan.id", ondelete="CASCADE"))
    kind: Mapped[DeferralKind] = mapped_column(str_enum(DeferralKind))
    from_date: Mapped[date] = mapped_column(Date)
    to_date: Mapped[date] = mapped_column(Date)
    reason: Mapped[str] = mapped_column(Text, default="")
    """The dispatcher's recorded reason."""
    store_notice: Mapped[str] = mapped_column(Text, default="")
    """The exact words the store reads."""
    explanation: Mapped[dict[str, Any]] = mapped_column(default=dict)
    """What the engine found: unavoidable or its choice, the rule, the pool, the cost, the next-run check."""
    created_at: Mapped[datetime]
    confirmed_at: Mapped[datetime | None]
    confirmed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))
    notified_at: Mapped[datetime | None]
    acknowledged_at: Mapped[datetime | None]


class PlanChange(WorkspaceScoped, Base):
    """A change after publishing, such as swapping two stops, with the cost Relay showed first."""

    __tablename__ = "plan_change"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    plan_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("plan.id", ondelete="CASCADE"), index=True)
    trip_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("trip.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(24))
    summary: Mapped[str] = mapped_column(Text)
    detail: Mapped[dict[str, Any]] = mapped_column(default=dict)
    created_at: Mapped[datetime]
    created_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("app_user.id"))


class EngineCache(Base):
    """The engine's answer for one exact set of inputs (see relay_api.services.engine_cache). Shared by every copy
    of the day, since the answer depends only on what the engine reads."""

    __tablename__ = "engine_cache"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    depot: Mapped[str] = mapped_column(String(16))
    created_at: Mapped[datetime]
    result: Mapped[dict[str, Any]]
