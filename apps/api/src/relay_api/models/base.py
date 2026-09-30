from __future__ import annotations

import enum
import uuid
from datetime import datetime
from typing import Any

from sqlalchemy import DateTime, Enum, ForeignKey, MetaData
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

NAMING = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING)
    type_annotation_map = {  # noqa: RUF012
        datetime: DateTime(timezone=True),
        dict[str, Any]: JSONB,
        list[Any]: JSONB,
    }


def str_enum(kind: type[enum.StrEnum], length: int = 24) -> Enum:
    """Store a StrEnum as plain text, so adding a value never needs a database enum migration."""
    return Enum(kind, native_enum=False, length=length, values_callable=lambda e: [m.value for m in e])


def new_id() -> uuid.UUID:
    return uuid.uuid4()


class WorkspaceScoped:
    """Rows that belong to one copy of the delivery day. See relay_api.db for how queries are scoped."""

    workspace_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("workspace.id", ondelete="CASCADE"), index=True)
