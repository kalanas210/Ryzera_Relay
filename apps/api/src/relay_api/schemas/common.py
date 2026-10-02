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
    pin: str | None = None
    """The seeded PIN, if the account has one: a loader's sign-in, or the driver's own PIN that accepts a load on
    the dock tablet."""


class MomentOut(Schema):
    key: str
    label: str
    at: datetime
    passed: bool


class WorkspaceOut(Schema):
    code: str
    label: str
    is_default: bool
    edition: str
    """New each time the copy is made or reset."""


class DemoState(Schema):
    demo_mode: bool
    workspace: WorkspaceOut
    now: datetime
    rate: float
    moments: list[MomentOut]
    next: MomentOut | None
    played: list[str] = []
    """Story steps the last jump played because nobody had taken them."""
    outages: dict[str, dict[str, datetime]] = {}
    """The story's scripted loss of signal by driver username ({"from", "to"}), once the clock has reached it: the
    demo bar can say why a phone is quiet, and that driver's phone obeys it."""
