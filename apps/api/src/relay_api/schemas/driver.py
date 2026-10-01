"""What the driver's phone reads (DRV-01 to DRV-05) and sends (the outbox's records)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any, Literal

from pydantic import BaseModel, Field

from relay_api.schemas.common import Schema
from relay_api.schemas.dock import HandoverOut


class DriverLineOut(Schema):
    case_type: str
    name: str
    ordered: int
    loaded: int
    short: int
    """Cases the dispatcher decided to send short; they come on the store's next order."""
    short_until: date | None


class DriverStopOut(Schema):
    stop_id: uuid.UUID
    seq: int
    version: int
    status: Literal["pending", "arrived", "delivered", "failed", "moved", "cancelled"]
    order_ref: str
    outlet_id: str
    place: str
    store_name: str
    dock_type: str
    van_only: bool
    window_open: str
    window_close: str
    planned: datetime
    expected: datetime | None
    """The time Relay last sent: rounded to 5 minutes on the phone, never pushed later while offline."""
    arrived_at: datetime | None
    completed_at: datetime | None
    moved_to: str | None
    cases: int
    lines: list[DriverLineOut]
    receiver: str | None
    has_photo: bool


class QuestionOut(Schema):
    id: uuid.UUID
    stop_id: uuid.UUID
    seq: int
    place: str
    question: str
    status: Literal["waiting_for_driver", "escalated", "resolved"]
    answer: str | None
    opened_at: datetime
    delivered_at: datetime | None
    cases: int


class NoticeOut(Schema):
    id: uuid.UUID
    kind: str
    title: str
    body: str
    created_at: datetime
    read_at: datetime | None


class DriverTripOut(Schema):
    trip_id: uuid.UUID
    vehicle_id: str
    vehicle_kind: str
    trip_no: int
    trips_today: int
    is_backup: bool
    brand: str
    temp: str
    district: str
    depot: str
    depot_label: str
    status: str
    planned_depart: datetime
    departed_at: datetime | None
    planned_back: datetime
    expected_back: datetime | None
    finished_at: datetime | None
    load: Literal["loading", "to_accept", "accepted"]
    loader: str | None
    handover: HandoverOut
    shortfalls: list[dict[str, Any]]
    stops: list[DriverStopOut]


class DriverRunOut(Schema):
    run_date: date
    now: datetime
    driver: str
    vehicle_id: str | None
    published: bool
    dispatcher: str | None
    trip: DriverTripOut | None
    later: list[DriverTripOut]
    questions: list[QuestionOut]
    notices: list[NoticeOut]
    outage: dict[str, datetime] | None
    """The story's scripted loss of signal for this driver, which the phone obeys in demo mode."""


class RecordIn(BaseModel):
    id: uuid.UUID
    kind: Literal[
        "load_accepted",
        "load_difference",
        "departed",
        "arrived",
        "delivered",
        "failed",
        "problem",
        "trip_finished",
        "conflict_answer",
        "checkin",
    ]
    trip_id: uuid.UUID | None = None
    stop_id: uuid.UUID | None = None
    occurred_at: datetime
    base_version: int | None = None
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    accuracy_m: float | None = Field(default=None, ge=0, le=100_000)
    payload: dict[str, Any] = Field(default_factory=dict)


class RecordsIn(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    sent_at: datetime | None = None
    records: list[RecordIn] = Field(max_length=200)


class RecordResult(Schema):
    id: uuid.UUID
    outcome: Literal["applied", "duplicate", "conflict", "rejected"]
    reason: str = ""


class RecordsOut(Schema):
    results: list[RecordResult]
    run: DriverRunOut


class CheckinIn(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
    waiting_records: int = Field(default=0, ge=0, le=10_000)


class CheckinOut(Schema):
    now: datetime
    outage: dict[str, datetime] | None
