from __future__ import annotations

import enum
import uuid

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from relay_api.models.base import Base, new_id, str_enum


class Role(enum.StrEnum):
    DISPATCHER = "dispatcher"
    LOADER = "loader"
    DRIVER = "driver"
    STORE_MANAGER = "store_manager"


class AppUser(Base):
    __tablename__ = "app_user"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=new_id)
    username: Mapped[str] = mapped_column(String(32), unique=True)
    display_name: Mapped[str] = mapped_column(String(64))
    role: Mapped[Role] = mapped_column(str_enum(Role), index=True)
    password_hash: Mapped[str | None] = mapped_column(String(128))
    pin_hash: Mapped[str | None] = mapped_column(String(128))
    depot: Mapped[str | None] = mapped_column(String(16))
    outlet_id: Mapped[str | None] = mapped_column(ForeignKey("outlet.outlet_id"))
    vehicle_id: Mapped[str | None] = mapped_column(ForeignKey("vehicle.vehicle_id"))
    locale: Mapped[str] = mapped_column(String(2), default="en")
    phone: Mapped[str | None] = mapped_column(String(20))
    judge_account: Mapped[bool] = mapped_column(default=False)
    """One of the four accounts in the README; shown as a quick sign-in card in demo mode."""
