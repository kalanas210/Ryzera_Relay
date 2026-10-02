from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Any

from relay_api.schemas.common import Schema


class RuleOut(Schema):
    rule: int
    name: str
    passed: bool
    message: str


class StopOut(Schema):
    order_ref: str
    outlet_id: str
    short_name: str
    name: str
    dock_type: str
    window_open: str
    window_close: str
    planned: datetime
    expected: datetime
    units: int
    weight_kg: float
    volume_m3: float


class TripOut(Schema):
    vehicle_id: str
    trip_no: int
    brand: str
    temp: str
    district: str
    depart: datetime
    back: datetime
    expected_back: datetime
    weight_kg: float
    volume_m3: float
    units: int
    std_minutes: int
    litres: float
    usual: bool
    rules: list[RuleOut]
    broken: int
    stops: list[StopOut]
    note: str
    load_locked: bool
    """Packed or gone, so its stop order can no longer change: the cases went on in that order."""


class LaneOut(Schema):
    vehicle_id: str
    type: str
    temp: str
    weight_cap_kg: float
    volume_cap_m3: float
    driver: str | None
    status: str
    note: str
    fuel_week_l: float
    fuel_quota_l: float
    fresh_minutes: int
    daytime_minutes: int
    trips: list[TripOut]


class DeferralOut(Schema):
    kind: str
    unavoidable: bool
    rule: int | None
    reason: str
    reason_code: str | None
    suggested_reason: str | None
    to_date: date
    confirmed_at: datetime | None
    store_notice: str


class WaitingOut(Schema):
    order_ref: str
    outlet_id: str
    short_name: str
    brand: str
    temp: str
    units: int
    weight_kg: float
    volume_m3: float
    window_open: str
    window_close: str
    deferral: DeferralOut | None


class PlanOut(Schema):
    id: uuid.UUID
    depot: str
    run_date: date
    status: str
    version: int
    proposed_at: datetime | None
    published_at: datetime | None
    edited_at: datetime | None


class BoardOut(Schema):
    plan: PlanOut
    orders: int
    served: int
    trips: int
    lanes: list[LaneOut]
    waiting: list[WaitingOut]
    placed_by_type: dict[str, int]
    analyses: list[dict[str, Any]]
    can_undo: bool
    broken: int
    locked: bool
    """The run's orders are locked: its 4:00 PM cutoff has passed."""
    published_peers: list[dict[str, Any]]


class FitOut(Schema):
    vehicle_id: str
    trip_no: int
    fits: bool
    hint: str
