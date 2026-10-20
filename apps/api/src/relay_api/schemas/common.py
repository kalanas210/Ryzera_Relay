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
    # The sign-in page shows it because the README publishes the demo credentials anyway.
    hint: str
    pin: str | None = None


class MomentOut(Schema):
    key: str
    label: str
    at: datetime
    passed: bool


class WorkspaceOut(Schema):
    code: str
    label: str
    is_default: bool
    # New each time the copy is made or reset.
    edition: str


class DemoState(Schema):
    demo_mode: bool
    workspace: WorkspaceOut
    now: datetime
    rate: float
    moments: list[MomentOut]
    next: MomentOut | None
    played: list[str] = []
    # The story's scripted loss of signal by driver username, once the clock has reached it.
    outages: dict[str, dict[str, datetime]] = {}
