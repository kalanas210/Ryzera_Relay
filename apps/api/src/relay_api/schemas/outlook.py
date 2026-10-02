"""The capacity outlook (DSP-05): six ISO weeks of forecast demand against a depot's refrigerated fleet."""

from __future__ import annotations

from datetime import date, datetime
from typing import Literal

from relay_api.schemas.common import Schema

FleetState = Literal["over", "limit", "within"]
"""Over when a day needs more refrigerated vehicles than are in service, at the limit when at most one is left
(the standby), within capacity otherwise."""


class CalendarChip(Schema):
    label: str
    """For example "New Year ramp" or "Vesak"."""
    tone: Literal["attention", "neutral"]
    """Attention while the week has ramp days; neutral (a lock) when the festival only closes days."""


class Demand(Schema):
    """Forecast m³ over the week's open days."""

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
    """The fewest refrigerated vehicles that carry every chilled order that day on Relay's clock."""
    available: int
    """Refrigerated vehicles in service that day: the plan board's statuses where it has them, else the forecast's."""
    in_workshop: list[str]
    state: FleetState
    from_order_book: bool
    """The run being planned counts the orders in, not the forecast."""
    waits: int
    """Chilled orders the plan lets wait to another day (order book days only)."""
    served_one_fewer: int | None
    """Chilled orders one refrigerated vehicle fewer than needed can serve, on forecast days the search counted it."""


class Segments(Schema):
    """The vehicles meter: one segment per refrigerated vehicle at the depot."""

    filled: int
    """Needed and in service."""
    short: int
    """Needed but not in service."""
    standby: int
    """In service and not needed."""
    workshop: int
    """Out of service and not needed."""


class BusiestDay(OutlookDayOut):
    segments: Segments
    headline: bool
    """The heaviest of the days ahead that need the most vehicles."""


class OutlookWeekOut(Schema):
    iso_year: int
    iso_week: int
    first_day: date
    last_day: date
    open_days: int
    chip: CalendarChip | None
    lines: list[str]
    """Calendar lines: "From Wed 22 Apr", "Payday Sat 25 Apr", "Closed Mon 13 and Tue 14"."""
    demand: Demand | None
    chilled_limit_m3: float | None
    """One load per refrigerated vehicle in service, summed over the week's open days."""
    chilled_pct: float | None
    busiest: BusiestDay | None
    """The day from the run on that needs the most refrigerated vehicles, ties broken by chilled m³."""
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
    """Refrigerated vehicles at the depot."""
    weeks: list[OutlookWeekOut]
    headline: Headline | None
    key_figures: list[KeyFigure]
    arrange: list[str]
    notes: list[str]
    method: list[str]
    """How the numbers are made, one paragraph each."""
    labels: OutlookLabels | None
    empty: str | None
    """Why there is nothing to show, for a depot with no forecast."""
