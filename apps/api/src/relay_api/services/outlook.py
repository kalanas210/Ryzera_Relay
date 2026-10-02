"""The capacity outlook (DSP-05): for the six ISO weeks from today, a depot's forecast demand against its refrigerated
fleet, the vehicles each week's busiest day needs, and what to arrange.

The forecast and the fewest-vehicles search come with the seed (OutlookForecast, OutlookWeek and OutlookDay), because
both need the order history. The run being planned counts its own orders instead, so its row agrees with the queue
and the deferrals drawer in the same copy of the day, and a day the plan board holds vehicle statuses for takes its
workshop from there. Everything the page says is built here from those numbers."""

from __future__ import annotations

from collections import Counter
from collections.abc import Sequence
from datetime import date, datetime, timedelta
from typing import Literal

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.models import (
    CalendarDay,
    Deferral,
    DeferralKind,
    Order,
    Outlet,
    OutlookDay,
    OutlookForecast,
    OutlookWeek,
    Vehicle,
    VehicleDay,
    VehicleDayStatus,
)
from relay_api.schemas.outlook import (
    BusiestDay,
    CalendarChip,
    Demand,
    FleetState,
    Headline,
    KeyFigure,
    OutlookDayOut,
    OutlookLabels,
    OutlookOut,
    OutlookWeekOut,
    Segments,
)
from relay_api.services.ordering import current_run, cutoff_for
from relay_api.services.planning import DEPOT_LABEL
from relay_engine.model import EARLIEST_DEPARTURE, RELOAD_MINUTES
from relay_engine.rules import ampm

WEEKS = 6
NBSP = "\u00a0"
"""Keeps a day and its month, or a number and its unit, on one line."""
FESTIVALS = {"new_year": "New Year", "thai_pongal": "Thai Pongal"}
WORDS = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"]
ORDINALS = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth"]
WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
WAITS = (DeferralKind.CAPACITY, DeferralKind.MANUAL)
TONE: dict[FleetState, Literal["problem", "attention", "neutral"]] = {
    "over": "problem",
    "limit": "attention",
    "within": "neutral",
}


# ------------------------------------------------------------------------------------------------ words
def festival_name(code: str) -> str:
    """festival_name('new_year') is 'New Year'."""
    return FESTIVALS.get(code, code.replace("_", " ").title())


def _word(n: int) -> str:
    return WORDS[n] if 0 <= n < len(WORDS) else str(n)


def _ordinal(n: int) -> str:
    return ORDINALS[n] if 0 < n < len(ORDINALS) else f"{n}th"


def _join(parts: Sequence[str]) -> str:
    return parts[0] if len(parts) == 1 else f"{', '.join(parts[:-1])} and {parts[-1]}"


def _short(day: date) -> str:
    """'Wed 22 Apr'"""
    return f"{day:%a}{NBSP}{day.day}{NBSP}{day:%b}"


def _long(day: date) -> str:
    """'Wednesday 29 April'"""
    return f"{day:%A} {day.day}{NBSP}{day:%B}"


def _day_month(day: date) -> str:
    """'8 April'"""
    return f"{day.day}{NBSP}{day:%B}"


def _days(days: Sequence[date], *, weekday: bool = True, long: bool = False) -> str:
    """'Mon 13 and Tue 14' within a month (the week's dates carry it), 'Thu 30 Apr and Fri 1 May' across two;
    without weekdays and long, '11 and 25 April'."""
    if len(days) == 1:
        return _day_month(days[0]) if long else _short(days[0])
    if len({d.month for d in days}) == 1:
        heads = [f"{d:%a}{NBSP}{d.day}" if weekday else str(d.day) for d in days]
        return _join(heads) + (f"{NBSP}{days[-1]:%B}" if long else "")
    return _join([_day_month(d) if long else _short(d) for d in days])


def _kg(value: float) -> str:
    return f"{value:,.1f}{NBSP}kg"


def _m3(value: float) -> str:
    return f"{value:,.1f}{NBSP}m³"


def _clock(minutes: int) -> str:
    """'2:00 AM'"""
    return ampm(minutes).replace(" ", NBSP)


def _hour(hhmm: str) -> str:
    """'8 AM' from '08:00', for a limit such as the last window close."""
    hour, minute = int(hhmm[:2]), int(hhmm[3:5])
    return f"{hour % 12 or 12}{f':{minute:02d}' if minute else ''}{NBSP}{'AM' if hour < 12 else 'PM'}"


# ------------------------------------------------------------------------------------------------ the calendar
class Calendar:
    """The shared calendar around the outlook's weeks: open days, closures, paydays and festival ramps."""

    def __init__(self, days: Sequence[CalendarDay]) -> None:
        self.days = {c.date: c for c in sorted(days, key=lambda c: c.date)}

    @classmethod
    def around(cls, db: Session, first: date, last: date) -> Calendar:
        """From a month before to four months after, so a ramp day finds the festival it leads up to."""
        span = CalendarDay.date.between(first - timedelta(days=31), last + timedelta(days=120))
        return cls(db.scalars(select(CalendarDay).where(span)).all())

    def week(self, monday: date) -> list[CalendarDay]:
        return [c for d in range(7) if (c := self.days.get(monday + timedelta(days=d))) is not None]

    def is_ramp(self, day: date) -> bool:
        c = self.days.get(day)
        return c is not None and c.festival_ramp > 0 and not c.festival

    def festival_after(self, day: date) -> CalendarDay | None:
        """The named festival a ramp day leads up to."""
        return next((c for d, c in self.days.items() if d >= day and c.festival), None)

    def ramp_start(self, day: date) -> date:
        while self.is_ramp(day - timedelta(days=1)):
            day -= timedelta(days=1)
        return day

    def _ramp_name(self, day: date) -> str | None:
        festival = self.festival_after(day) if self.is_ramp(day) else None
        return festival_name(festival.festival or "") if festival else None

    def context(self, day: date) -> list[str]:
        """Why a day is heavy: 'Vesak ramp', 'payday' or 'payday week'."""
        parts = [f"{name} ramp"] if (name := self._ramp_name(day)) else []
        monday = day - timedelta(days=day.weekday())
        if self.days[day].is_payday:
            parts.append("payday")
        elif any(c.is_payday for c in self.week(monday)):
            parts.append("payday week")
        return parts

    def reason(self, day: date) -> str | None:
        """One word for why a day breaks its weekday's pattern: 'payday', or the festival it ramps up to."""
        return "payday" if self.days[day].is_payday else self._ramp_name(day)

    def header(self, monday: date) -> tuple[CalendarChip | None, list[str]]:
        """The week's calendar chip, and its lines in date order. A festival that only closes days is neutral."""
        week = self.week(monday)
        ramp = [c.date for c in week if self.is_ramp(c.date)]
        named = [c for c in week if c.festival]
        chip = None
        if named:
            chip = CalendarChip(label=festival_name(named[0].festival or ""), tone="attention" if ramp else "neutral")
        elif ramp and (name := self._ramp_name(ramp[0])):
            chip = CalendarChip(label=f"{name} ramp", tone="attention")
        lines: list[tuple[date, str]] = []
        if ramp and (start := self.ramp_start(ramp[0])) >= monday:
            lines.append((start, f"From {_short(start)}"))
        lines += [(c.date, f"Payday {_short(c.date)}") for c in week if c.is_payday]
        if closed := [c.date for c in week if c.is_holiday]:
            lines.append((closed[0], f"Closed {_days(closed)}"))
        return chip, [text for _, text in sorted(lines)]


# ------------------------------------------------------------------------------------------------ the days
def _state(needed: int, available: int) -> FleetState:
    if needed > available:
        return "over"
    return "limit" if available - needed <= 1 else "within"


def _segments(needed: int, available: int, fleet: int) -> Segments:
    filled = min(needed, available)
    short = max(0, min(needed, fleet) - available)
    standby = max(0, available - needed)
    return Segments(filled=filled, short=short, standby=standby, workshop=max(0, fleet - filled - short - standby))


Book = tuple[int, float, float, int]


def _order_book(db: Session, depot: str, day: date) -> Book:
    """The depot's Fresh chilled orders for the run as the queue counts them (late orders ride the next run), with
    their kg and m³, and how many of them the plan lets wait, as the deferrals drawer counts them."""
    orders = list(
        db.scalars(
            select(Order)
            .join(Outlet, Outlet.outlet_id == Order.outlet_id)
            .where(Outlet.depot == depot, Order.requested_date == day, Order.brand == "Fresh", Order.temp == "chilled")
        )
    )
    deferrals = list(db.scalars(select(Deferral).where(Deferral.order_id.in_([o.id for o in orders]))))
    late = {d.order_id for d in deferrals if d.kind is DeferralKind.CUTOFF}
    book = [o for o in orders if o.id not in late]
    waits = {d.order_id for d in deferrals if d.kind in WAITS and d.from_date == day and d.order_id not in late}
    return len(book), round(sum(o.weight_kg for o in book), 1), round(sum(o.volume_m3 for o in book), 1), len(waits)


def _planned_workshop(db: Session, fleet: set[str], first: date, last: date) -> dict[date, list[str]]:
    """The refrigerated vehicles in the workshop on each day the plan board holds vehicle statuses for (the run and
    the next), counted as the queue counts them. The forecast's workshop bookings cover the other days."""
    out: dict[date, list[str]] = {}
    for vd in db.scalars(
        select(VehicleDay).where(VehicleDay.vehicle_id.in_(fleet), VehicleDay.run_date.between(first, last))
    ):
        out.setdefault(vd.run_date, [])
        if vd.status is VehicleDayStatus.WORKSHOP:
            out[vd.run_date].append(vd.vehicle_id)
    return out


def _day(row: OutlookDay, fleet: set[str], in_workshop: Sequence[str], book: Book | None) -> OutlookDayOut:
    out = sorted(fleet & set(in_workshop))
    available = len(fleet) - len(out)
    orders, kg, m3, waits = book or (row.chilled_orders, row.chilled_kg, row.chilled_m3, 0)
    return OutlookDayOut(
        date=row.date,
        chilled_orders=orders,
        chilled_kg=kg,
        chilled_m3=m3,
        needed=row.needed,
        available=available,
        in_workshop=out,
        state=_state(row.needed, available),
        from_order_book=book is not None,
        waits=waits,
        # the search counted the forecast's orders; the run's own answer is the plan's, in the deferrals drawer
        served_one_fewer=None if book else row.served_one_fewer,
    )


def _same_weekday(peers: Sequence[OutlookDayOut]) -> str | None:
    """'Wednesday' when every day that needs the most vehicles falls on one."""
    names = {WEEKDAYS[d.date.weekday()] for d in peers}
    return names.pop() if len(peers) > 1 and len(names) == 1 else None


# ------------------------------------------------------------------------------------------------ the outlook
def capacity_outlook(db: Session, now: datetime, depot: str) -> OutlookOut:
    today = now.astimezone(COLOMBO).date()
    run_date = current_run(db, now)
    year, week, _ = today.isocalendar()
    mondays = [date.fromisocalendar(year, week, 1) + timedelta(weeks=i) for i in range(WEEKS)]
    first, last = mondays[0], mondays[-1] + timedelta(days=6)
    caps = {
        v.vehicle_id: v.volume_cap_m3
        for v in db.scalars(select(Vehicle).where(Vehicle.depot == depot, Vehicle.temp == "reefer"))
    }
    fleet = set(caps)
    label = DEPOT_LABEL[depot]
    forecast = db.get(OutlookForecast, depot)
    rows = {
        r.date: r
        for r in db.scalars(select(OutlookDay).where(OutlookDay.depot == depot, OutlookDay.date.between(first, last)))
    }
    if forecast is None or not rows:
        return OutlookOut(
            depot=depot,
            depot_label=label,
            now=now,
            run_date=run_date,
            forecast_updated=forecast.forecast_updated if forecast else None,
            fleet=len(fleet),
            weeks=[],
            headline=None,
            key_figures=[],
            arrange=[],
            notes=[],
            method=[],
            labels=None,
            empty=(
                f"No forecast is set up for {label} yet, so Relay can't tell which days ahead need every "
                "refrigerated vehicle there."
                if forecast is None
                else f"The {label} forecast doesn't reach these weeks yet."
            ),
        )

    calendar = Calendar.around(db, first, last)
    demand = {(w.iso_year, w.iso_week): w for w in db.scalars(select(OutlookWeek).where(OutlookWeek.depot == depot))}
    book = _order_book(db, depot, run_date) if run_date in rows else None
    planned = _planned_workshop(db, fleet, first, last)
    days = {d: _day(r, fleet, planned.get(d, r.in_workshop), book if d == run_date else None) for d, r in rows.items()}

    def one_load(day: date) -> float:
        """One load per refrigerated vehicle in service that day."""
        out = days[day].in_workshop if day in days else []
        return sum(cap for v, cap in caps.items() if v not in out)

    # the headline: the day ahead that needs the most refrigerated vehicles, the heaviest of them if several do
    ahead = [d for d in days.values() if d.date > run_date]
    most = max((d.needed for d in ahead), default=0)
    peers = [d for d in ahead if d.needed == most]
    lead = max(peers, key=lambda d: (d.chilled_kg, -d.date.toordinal()), default=None)

    weeks = []
    for monday in mondays:
        y, w, _ = monday.isocalendar()
        open_days = [c.date for c in calendar.week(monday) if c.is_operating]
        mine = [days[d] for d in open_days if d in days]
        chip, lines = calendar.header(monday)
        f = demand.get((y, w))
        limit = round(sum(one_load(d) for d in open_days), 1)
        busiest = max((d for d in mine if d.date >= run_date), key=lambda d: (d.needed, d.chilled_m3), default=None)
        weeks.append(
            OutlookWeekOut(
                iso_year=y,
                iso_week=w,
                first_day=monday,
                last_day=monday + timedelta(days=6),
                open_days=len(open_days),
                chip=chip,
                lines=lines,
                demand=Demand(
                    chilled=f.chilled_m3,
                    dry=f.dry_m3,
                    style=f.style_m3,
                    tech=f.tech_m3,
                    all=round(f.chilled_m3 + f.dry_m3 + f.style_m3 + f.tech_m3, 1),
                )
                if f
                else None,
                chilled_limit_m3=limit if f and limit else None,
                chilled_pct=round(100 * f.chilled_m3 / limit, 1) if f and limit else None,
                busiest=BusiestDay(
                    **busiest.model_dump(),
                    segments=_segments(busiest.needed, busiest.available, len(fleet)),
                    headline=lead is not None and busiest.date == lead.date,
                )
                if busiest
                else None,
                days=mine,
            )
        )

    closes = db.scalars(select(Outlet.window_close).where(Outlet.depot == depot, Outlet.brand == "Fresh")).all()
    locked = now >= cutoff_for(run_date)
    return OutlookOut(
        depot=depot,
        depot_label=label,
        now=now,
        run_date=run_date,
        forecast_updated=forecast.forecast_updated,
        fleet=len(fleet),
        weeks=weeks,
        headline=_headline(lead, peers, calendar) if lead else None,
        key_figures=_key_figures(lead, peers) if lead else [],
        arrange=_arrange(lead, peers, calendar),
        notes=_notes(lead, peers, ahead, weeks, days.get(run_date), _hour(max(closes)) if closes else None),
        method=_method(db, forecast, weeks, list(days.values()), calendar, depot),
        labels=OutlookLabels(
            fleet=f"Against the {label}'s refrigerated fleet",
            vehicles=f"On the week's busiest day. The {_ordinal(len(fleet))} is the standby.",
            day=f"{_day_month(run_date)} from the order book{'' if locked else ' so far'}, the rest forecast"
            if book
            else "Forecast",
            tech=f"One {depot} Tech order can be {round(forecast.tech_order_max_m3)}{NBSP}m³",
        ),
        empty=None,
    )


def _headline(lead: OutlookDayOut, peers: Sequence[OutlookDayOut], calendar: Calendar) -> Headline:
    weekday = _same_weekday(peers)
    vehicles = f"{lead.needed} of the {lead.available} refrigerated vehicles"
    if len(peers) > 1:
        among = f"{len(peers)} {weekday}s" if weekday else f"{len(peers)} busiest days"
        title = f"{_long(lead.date)} is the heaviest of the {among} ahead, and like each of them it needs {vehicles}."
    else:
        title = f"{_long(lead.date)} is the busiest day ahead: it needs {vehicles}."
    spare = lead.available - lead.needed
    if spare < 0:
        back = f"{_word(-spare)} {'comes' if spare == -1 else 'come'} back from the workshop"
        detail = f"Only {lead.available} are in service that day, so chilled orders wait unless {back}."
    elif spare == 0:
        detail = (
            f"Every one in service is needed and there is no standby: keep all {lead.available} in service that day."
        )
    elif spare == 1:
        detail = (
            f"The {_ordinal(lead.available)} is the standby and nothing is spare: "
            f"keep all {lead.available} in service that day."
        )
    else:
        detail = f"That leaves the standby and {_word(spare - 1)} more free that day."
    context = calendar.context(lead.date)
    which = f"The heaviest {weekday} ahead" if weekday else "The heaviest of them" if len(peers) > 1 else "That day"
    support = f"{which}: {_kg(lead.chilled_kg)} chilled" + (f" ({', '.join(context)})" if context else "")
    return Headline(
        date=lead.date,
        needed=lead.needed,
        available=lead.available,
        state=lead.state,
        title=title,
        detail=detail,
        support=support,
    )


def _key_figures(lead: OutlookDayOut, peers: Sequence[OutlookDayOut]) -> list[KeyFigure]:
    weekday = _same_weekday(peers)
    every = f", as on every {weekday} ahead" if weekday else ", as on each busiest day ahead" if len(peers) > 1 else ""
    figures = [
        KeyFigure(
            value=f"{lead.needed} of {lead.available}",
            label=f"refrigerated vehicles needed, {_short(lead.date)}{every}",
            tone=TONE[lead.state],
        )
    ]
    if (served := lead.served_one_fewer) is not None:
        # the figure speaks for the weekday only when each of the busiest days gives the same answer
        alike = all((d.served_one_fewer, d.chilled_orders) == (served, lead.chilled_orders) for d in peers)
        on = f"on a {weekday}" if weekday and alike else f"on {_short(lead.date)}"
        figures.append(
            KeyFigure(
                value=f"{served} of {lead.chilled_orders}",
                label=f"chilled orders {_word(lead.needed - 1)} refrigerated vehicles can serve {on}",
                tone="neutral",
            )
        )
    return figures


def _arrange(lead: OutlookDayOut | None, peers: Sequence[OutlookDayOut], calendar: Calendar) -> list[str]:
    lines = []
    if lead and lead.available - lead.needed <= 1:
        needs = f"{lead.needed} of {lead.available}"
        if weekday := _same_weekday(peers):
            lines.append(
                f"Book refrigerated servicing away from {weekday}s: on Relay's clock every {weekday} needs {needs}"
            )
        else:
            each = "each needs" if len(peers) > 1 else "it needs"
            away = _join([_short(d.date) for d in peers])
            lines.append(f"Book refrigerated servicing away from {away}: on Relay's clock {each} {needs}")
        context = calendar.context(lead.date)
        lines.append(
            f"Keep all {lead.available} in service on {_long(lead.date)}"
            + (f" ({', '.join(context)})" if context else "")
        )
    lines.append("Tell stores early when a refrigerated vehicle is out")
    return lines


def _notes(
    lead: OutlookDayOut | None,
    peers: Sequence[OutlookDayOut],
    ahead: Sequence[OutlookDayOut],
    weeks: Sequence[OutlookWeekOut],
    run: OutlookDayOut | None,
    closes: str | None,
) -> list[str]:
    notes = []
    tight = max((w for w in weeks if w.chilled_pct is not None), key=lambda w: w.chilled_pct or 0.0, default=None)
    if tight and tight.chilled_pct is not None:
        share = (
            f"week {tight.iso_week}'s chilled volume is {tight.chilled_pct}% of one load per refrigerated vehicle "
            "per open day."
        )
        if tight.chilled_pct < 90:
            space = f"Space is not the limit: {share}"
            if closes:
                space += f" The number of stores and their windows before {closes} are."
        else:
            space = f"Space is close to the limit: {share}"
        heaviest = max(ahead, key=lambda d: d.chilled_kg, default=None)
        if heaviest and lead and heaviest.needed < lead.needed:
            space += f" {_long(heaviest.date)} carries {_kg(heaviest.chilled_kg)} and needs {heaviest.needed}."
        notes.append(space)
    needed = (
        "Needed is the fewest refrigerated vehicles that carry every chilled order that day on Relay's clock, "
        "where a vehicle is in one place at a time."
    )
    if lead and (weekday := _same_weekday(peers)):
        spare = lead.available - lead.needed
        served = lead.served_one_fewer
        missed = lead.chilled_orders - served if served is not None else 0
        waits = "a chilled order waits" if missed == 1 else f"{missed} chilled orders wait" if missed else ""
        # the run being planned is the proof, when it is one of these days and two were out
        if waits and run and run.waits and run.needed > run.available and WEEKDAYS[run.date.weekday()] == weekday:
            waits += f", as on {_day_month(run.date)}"
        if spare == 1:
            needed += f" One out on a {weekday} means no standby" + (f"; two out means {waits}." if waits else ".")
        elif spare == 0:
            needed += f" Every one is needed on a {weekday}, so one out means a chilled order waits."
    notes.append(needed)
    return notes


def _method(
    db: Session,
    forecast: OutlookForecast,
    weeks: Sequence[OutlookWeekOut],
    days: Sequence[OutlookDayOut],
    calendar: Calendar,
    depot: str,
) -> list[str]:
    f = forecast
    first = date.fromisocalendar(f.backtest_year, f.backtest_first_week, 4)  # a week's Thursday names its month
    last = date.fromisocalendar(f.backtest_year, f.backtest_last_week, 4)
    paragraphs = [
        "The forecast is an ordinary week for each group and weekday "
        f"({f.baseline_year} weeks {f.baseline_first_week} to {f.baseline_last_week}) times the festival lift for "
        "that festival and ramp day times the payday lift, times growth, counted over open days. "
        f"In {first:%B} to {last:%B} {f.backtest_year} this method missed {depot} Fresh by {f.backtest_pct}% a week "
        f'on average, against {f.last_year_pct}% for "same week last year times growth".'
    ]
    needed = (
        '"Needed" is the fewest refrigerated vehicles that carry every chilled order that day, found by exact search '
        "under the plan's rules (published standard, windows at free flow, "
        f"{_clock(EARLIEST_DEPARTURE)} earliest, {RELOAD_MINUTES} minutes to reload, "
        "a vehicle in one place at a time). "
    )
    if run := next((d for d in days if d.from_order_book), None):
        needed += f"{_day_month(run.date)} uses the order book; every other day uses the forecast. "
    paragraphs.append(needed + _pattern(days, calendar))
    peak = max((w for w in weeks if w.demand), key=lambda w: w.demand.chilled if w.demand else 0.0, default=None)
    if peak and peak.demand:
        if peak.chip and peak.chip.label.endswith(" ramp"):
            carries = f"Week {peak.iso_week} carries the {peak.chip.label}"
        elif peak.chip:
            carries = f"Week {peak.iso_week} carries {peak.chip.label}"
        else:
            carries = f"Week {peak.iso_week} is the heaviest chilled week"
        paragraphs.append(
            f"{carries}: {_m3(peak.demand.chilled)} chilled, {peak.demand.chilled / f.ordinary_week_m3:.2f} times an "
            f"ordinary {f.baseline_year} week ({_m3(f.ordinary_week_m3)}); {_record_week(db, f)} was {depot}'s highest "
            f"chilled week on record at {_m3(f.record_week_m3)}."
        )
    return paragraphs


def _pattern(days: Sequence[OutlookDayOut], calendar: Calendar) -> str:
    """'Wednesdays need 6, Mondays and Thursdays 5, most other days 4 (the New Year and payday Saturdays, 11 and
    25 April, need 5).'"""
    counts: dict[int, Counter[int]] = {}
    for d in days:
        counts.setdefault(d.date.weekday(), Counter())[d.needed] += 1
    usual = {wd: max(c.items(), key=lambda kv: (kv[1], kv[0]))[0] for wd, c in counts.items()}
    odd = [d for d in days if d.needed != usual[d.date.weekday()]]
    groups: dict[int, list[int]] = {}
    for wd in sorted(usual):
        groups.setdefault(usual[wd], []).append(wd)
    # the group with the most weekdays reads "other days" when it holds at least three of them
    widest = max(groups, key=lambda n: (len(groups[n]), -n))
    rest = widest if len(groups) > 1 and len(groups[widest]) >= 3 else None
    parts = []
    for n in sorted(groups, key=lambda n: (n == rest, -n)):
        if n == rest:
            parts.append(f"{'most other' if odd else 'other'} days {n}")
        else:
            parts.append(f"{_join([f'{WEEKDAYS[wd]}s' for wd in groups[n]])} {'' if parts else 'need '}{n}")
    exceptions = []
    by_kind: dict[tuple[int, int], list[date]] = {}
    for d in sorted(odd, key=lambda d: d.date):
        by_kind.setdefault((d.date.weekday(), d.needed), []).append(d.date)
    for (wd, n), dates in by_kind.items():
        reasons = [calendar.reason(d) for d in dates]
        verb = "needs" if len(dates) == 1 else "need"
        when = _days(dates, weekday=False, long=True)
        if all(reasons):
            plural = "s" if len(dates) > 1 else ""
            exceptions.append(f"the {_join([r for r in reasons if r])} {WEEKDAYS[wd]}{plural}, {when}, {verb} {n}")
        else:
            exceptions.append(f"{WEEKDAYS[wd]} {when} {verb} {n}")
    return ", ".join(parts) + (f" ({'; '.join(exceptions)})" if exceptions else "") + "."


def _record_week(db: Session, f: OutlookForecast) -> str:
    """'the week before New Year 2025', from the calendar around the record week."""
    monday = date.fromisocalendar(f.record_year, f.record_week, 1)
    festival = Calendar.around(db, monday, monday + timedelta(days=6)).festival_after(monday)
    if festival is not None:
        name = festival_name(festival.festival or "")
        if festival.date <= monday + timedelta(days=6):
            return f"the {name} week of {f.record_year}"
        if festival.date <= monday + timedelta(days=13):
            return f"the week before {name} {festival.date.year}"
    return f"{f.record_year} week {f.record_week}"


__all__ = ["capacity_outlook", "festival_name"]
