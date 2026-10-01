"""The dispatcher's live view (DSP-04): the exceptions feed, and on the phone the one decision it asks for."""

from __future__ import annotations

import uuid
from datetime import date, datetime

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
    departs: datetime
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
    shortfall: ShortfallDetailOut | None


class FeedOut(Schema):
    depot: str
    depot_label: str
    run_date: date
    now: list[FeedItemOut]
    earlier: list[FeedItemOut]
