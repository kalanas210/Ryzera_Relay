"""The dispatcher's live view (DSP-04): the exceptions feed, and on the phone the one decision it asks for."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from pydantic import Field

from relay_api.schemas.common import Schema


class ShortfallDetailOut(Schema):
    id: uuid.UUID
    kind: str
    qty: int
    planned: int
    case_type: str
    case_name: str
    temp_label: str
    vehicle_id: str
    trip_no: int
    stop_seq: int
    order_ref: str
    outlet_id: str
    place: str
    flagged_at: datetime
    flagged_by: str | None
    run_date: date
    """The run the load is for: the day a carried-over order is marked from."""
    departs: datetime
    trip_stops: int
    driver: str | None
    stop_cases: int
    next_order_ref: str | None
    next_day: date | None
    window: str
    store_contact: str | None
    decision: str | None
    decided_at: datetime | None
    decided_by: str | None
    added_to_order_ref: str | None
    store_seen_at: datetime | None
    """When the store opened its short-delivery notice."""
    completed_at: datetime | None
    loaded_cases: int
    planned_cases: int
    """The whole load's cases, for the record once the load is complete."""
    accepted_at: datetime | None
    accepted_by: str | None
    hub_spare: int | None
    """Spare cases of this type at the hub for the run, when Relay knows the hub's stock of it."""
    next_delivery_at: datetime | None
    """When the supplier's next drop of this case type reaches the hub."""
    photo_id: uuid.UUID | None
    """A photo of damaged cases from the dock."""


class FeedItemOut(Schema):
    id: uuid.UUID
    kind: str
    depot: str
    title: str
    body: str
    created_at: datetime
    handled_at: datetime | None
    handled_by: str | None
    outcome: str
    reviewed_at: datetime | None = None
    """A settled two-copy stop stays under Now until the dispatcher marks it reviewed."""
    reviewed_by: str | None = None
    shortfall: ShortfallDetailOut | None
    ref: dict[str, Any] = Field(default_factory=dict)
    """What the item is about (its trip, stop, conflict or backup), so the desk ties it to the right run."""


class FeedOut(Schema):
    depot: str
    depot_label: str
    run_date: date
    now: list[FeedItemOut]
    earlier: list[FeedItemOut]
