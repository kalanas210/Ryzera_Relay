from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, ConfigDict

from relay_api.models import Role


class Schema(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class Me(Schema):
    id: uuid.UUID
    username: str
    display_name: str
    role: Role
    depot: str | None
    outlet_id: str | None
    vehicle_id: str | None
    locale: str


class Account(Schema):
    """A seeded account, shown as a quick sign-in card when demo mode is on."""

    username: str
    display_name: str
    role: Role
    detail: str
    uses_pin: bool
    hint: str
    """The demo credential, shown on the sign-in page because the README publishes it anyway."""


class MomentOut(Schema):
    key: str
    label: str
    at: datetime
    passed: bool


class WorkspaceOut(Schema):
    code: str
    label: str
    is_default: bool


class DemoState(Schema):
    demo_mode: bool
    workspace: WorkspaceOut
    now: datetime
    rate: float
    moments: list[MomentOut]
    next: MomentOut | None
