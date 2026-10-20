"""The capacity outlook (DSP-05): six ISO weeks of forecast demand against a depot's refrigerated fleet."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from relay_api.schemas.common import Schema

# over: a day needs more refrigerated vehicles than are in service. limit: at most one is left (the
# standby). within: everything else.
FleetState = Literal["over", "limit", "within"]


class CalendarChip(Schema):
    label: str
    # attention while the week has ramp days, neutral (a lock) when the festival only closes days
    tone: Literal["attention", "neutral"]


class Demand(Schema):
    """Forecast m3 over the week's open days."""

    chilled: float
    dry: float
    style: float
    tech: float
    all: float


class OutlookDayOut(Schema):
    date: date
    chilled_orders: int
    chilled_kg: float
    chilled_m3: float
    needed: int
    # In service that day. From the plan board's statuses where it has them, else from the forecast.
    available: int
    in_workshop: list[str]
    state: FleetState
    # The run being planned counts the orders in, not the forecast.
    from_order_book: bool
    # Chilled orders the plan lets wait to another day (order book days only).
    waits: int
    # Chilled orders one vehicle fewer than needed can serve, on forecast days the search counted it.
    served_one_fewer: int | None


class Segments(Schema):
    """The vehicles meter, one segment per refrigerated vehicle at the depot."""

    # filled: needed and in service. short: needed but not in service.
    # standby: in service and not needed. workshop: out of service and not needed.
    filled: int
    short: int
    standby: int
    workshop: int


class BusiestDay(OutlookDayOut):
    segments: Segments
    headline: bool


class OutlookWeekOut(Schema):
    iso_year: int
    iso_week: int
    first_day: date
    last_day: date
    open_days: int
    chip: CalendarChip | None
    lines: list[str]
    demand: Demand | None
    # One load per refrigerated vehicle in service, summed over the week's open days.
    chilled_limit_m3: float | None
    chilled_pct: float | None
    # The day from the run on that needs the most refrigerated vehicles, ties broken by chilled m3.
    busiest: BusiestDay | None
    days: list[OutlookDayOut]


class KeyFigure(Schema):
    value: str
    label: str
    tone: Literal["attention", "problem", "neutral"]


class Headline(Schema):
    date: date
    needed: int
    available: int
    state: FleetState
    title: str
    detail: str
    support: str


class OutlookLabels(Schema):
    """Row labels that depend on the depot and its fleet."""

    fleet: str
    vehicles: str
    day: str
    tech: str


class OutlookOut(Schema):
    depot: str
    depot_label: str
    now: datetime
    run_date: date
    forecast_updated: date | None
    fleet: int
    weeks: list[OutlookWeekOut]
    headline: Headline | None
    key_figures: list[KeyFigure]
    arrange: list[str]
    notes: list[str]
    method: list[str]
    labels: OutlookLabels | None
    empty: str | None
