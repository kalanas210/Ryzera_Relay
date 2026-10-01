"""What the dock tablet reads: tonight's loads (LDR-01), one load in loading order (LDR-02), a flag and its
answer (LDR-03) and the handover (LDR-04)."""

from __future__ import annotations

import uuid
from datetime import date, datetime
from typing import Literal

from relay_api.schemas.common import Schema

LoadState = Literal["not_started", "loading", "ready", "left"]
LineStatus = Literal["to_load", "in_progress", "checked", "flag_waiting", "decided"]


class PersonOut(Schema):
    username: str
    display_name: str
    initials: str


class LoadCardOut(Schema):
    trip_id: uuid.UUID
    vehicle_id: str
    vehicle_type: str
    vehicle_kind: str
    trip_no: int
    temp: str
    brand: str
    district: str
    stops: int
    cases: int
    loaded: int
    short: int
    flags_waiting: int
    state: LoadState
    planned_depart: datetime
    departed_at: datetime | None
    completed_at: datetime | None
    accepted_at: datetime | None
    accepted_by: str | None
    driver: str | None
    loader: str | None
    plan_changed_at: datetime | None
    pick_before: datetime | None
    """A second trip is picked before its vehicle is back from the first: the first trip's planned return."""


class DepartedOut(Schema):
    """The loads that left for one district: the first departure, and the last when they left over a spread."""

    at: datetime
    until: datetime | None
    district: str
    vehicles: list[str]


class WorkshopOut(Schema):
    vehicle_id: str
    vehicle_type: str
    vehicle_kind: str
    back_on: date | None


class DockNoticeOut(Schema):
    """A plan change the dock must see. The words are built on the tablet in the loader's language from the
    fields; `title` and `body` are the English."""

    id: uuid.UUID
    trip_id: uuid.UUID
    vehicle_id: str
    kind: Literal["swap", "reorder"]
    stops: list[int]
    by: str | None
    first_place: str | None
    """For a swap: the stop that now goes onto the truck earlier."""
    other_place: str | None
    loads_first: bool
    done: bool
    title: str
    body: str
    at: datetime


class TonightOut(Schema):
    depot: str
    depot_label: str
    run_date: date
    published_at: datetime | None
    loads: int
    loading: list[LoadCardOut]
    ready: list[LoadCardOut]
    to_load: list[LoadCardOut]
    left: list[DepartedOut]
    left_count: int
    workshop: list[WorkshopOut]
    daytime: int
    """Style and Tech loads, picked by the day shift."""
    notices: list[DockNoticeOut]
    loaders: list[PersonOut]
    dispatcher: str | None


class ShortfallOut(Schema):
    id: uuid.UUID
    kind: Literal["missing", "damaged"]
    qty: int
    flagged_at: datetime
    flagged_by: str | None
    decision: Literal["send_short", "no_replacement"] | None
    decided_at: datetime | None
    decided_by: str | None
    added_to_order_ref: str | None
    added_to_day: date | None
    store_contact: str | None


class LoadLineOut(Schema):
    id: uuid.UUID
    case_type: str
    qty: int
    loaded: int
    status: LineStatus
    shortfall: ShortfallOut | None


class StopGroupOut(Schema):
    stop_id: uuid.UUID
    seq: int
    outlet_id: str
    place: str
    order_ref: str
    cases: int
    loaded: int
    short: int
    moved_from: int | None
    moved_at: datetime | None
    state: Literal["done", "loading", "to_load"]
    lines: list[LoadLineOut]


class HandoverStopOut(Schema):
    seq: int
    place: str
    planned: int
    loaded: int


class HandoverOut(Schema):
    completed_at: datetime | None
    completed_by: str | None
    accepted_at: datetime | None
    accepted_by: str | None
    accepted_on: str | None
    difference: str
    stops: list[HandoverStopOut]
    planned_cases: int
    loaded_cases: int
    planned_kg: float
    loaded_kg: float
    planned_m3: float
    loaded_m3: float


class TripLoadOut(Schema):
    trip_id: uuid.UUID
    vehicle_id: str
    vehicle_kind: str
    trip_no: int
    temp: str
    brand: str
    district: str
    driver: str | None
    loader: str | None
    planned_depart: datetime
    departed_at: datetime | None
    state: LoadState
    plan_changed_at: datetime | None
    cases: int
    loaded: int
    short: int
    lines_total: int
    lines_done: int
    flags_waiting: int
    groups: list[StopGroupOut]
    handover: HandoverOut
    dispatcher: str | None
