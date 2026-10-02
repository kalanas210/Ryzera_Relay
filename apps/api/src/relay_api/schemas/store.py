"""What the store manager's phone reads and sends: My orders (STM-01), an order and a change to it (STM-02), the
store's notices (STM-03) and its receipt (STM-05)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field

from relay_api.models import DeferralKind
from relay_api.schemas.common import Schema


class CaseTypeOut(Schema):
    code: str
    name: str
    temp: str
    kg: float
    m3: float


class OutletOut(Schema):
    outlet_id: str
    name: str
    short_name: str
    brand: str
    district: str
    depot: str
    dock_type: str
    parking_constraint: str
    window_open: str
    window_close: str


class LineOut(Schema):
    case_type: str
    name: str
    qty: int
    carried_qty: int
    carried_from: str | None


class DeferralOut(Schema):
    id: uuid.UUID
    kind: DeferralKind
    from_date: date
    to_date: date
    store_notice: str
    notified_at: datetime | None
    acknowledged_at: datetime | None


class StoreOrderOut(Schema):
    id: uuid.UUID
    order_ref: str
    temp: str
    brand: str
    requested_date: date
    run_date: date
    units: int
    weight_kg: float
    volume_m3: float
    status: str
    placed_at: datetime
    locked: bool
    locks_at: datetime
    """When orders for its requested day close: the store can change it until then."""
    lines: list[LineOut]
    deferral: DeferralOut | None


class StoreHome(Schema):
    outlet: OutletOut
    now: datetime
    ordering_for: date
    """The run a new order joins right now."""
    cutoff: datetime
    """When orders for `ordering_for` close."""
    closed_for: date | None = None
    """The run whose orders closed at 4:00 PM today, while new orders go on the one after it."""
    closed_at: datetime | None = None
    next_run: date
    orders: list[StoreOrderOut]
    case_types: list[CaseTypeOut]
    unread_notices: int


class LineIn(BaseModel):
    case_type: str
    qty: int = Field(ge=1, le=999)


class PlaceOrder(BaseModel):
    temp: Literal["ambient", "chilled"]
    lines: list[LineIn] = Field(min_length=1, max_length=12)
    client_ref: str = Field(min_length=8, max_length=64)
    """Generated on the store's device, so pressing Try again never sends a second order."""
    for_date: date | None = None
    """The run the store's form showed. Relay's receive time still decides: a send that reaches it after that run's
    cutoff goes on the next run, and the store is told so."""


class ChangeOrder(BaseModel):
    lines: list[LineIn] = Field(min_length=1, max_length=12)
    """The store's own counts. Cases Waypoint carried onto the order from a short delivery stay on top of them."""


class NoticeOut(Schema):
    id: uuid.UUID
    kind: str
    title: str
    body: str
    data: dict[str, object]
    created_at: datetime
    read_at: datetime | None
    acknowledged_at: datetime | None


class IssueIn(BaseModel):
    case_type: str = Field(max_length=24)
    kind: Literal["missing", "damaged", "not_cold"]
    qty: int = Field(ge=1, le=9999)
    note: str = Field(default="", max_length=300)


class ReceiptIn(BaseModel):
    client_ref: str | None = Field(default=None, max_length=64)
    issues: list[IssueIn] = Field(default_factory=list, max_length=20)


class IssuesIn(BaseModel):
    client_ref: str = Field(min_length=8, max_length=64)
    """Made on the store's phone, so Try again never reports the same problem twice."""
    issues: list[IssueIn] = Field(min_length=1, max_length=20)
