"""Placing an order, and the 4:00 PM cutoff.

Orders for the next delivery day close at 4:00 PM. An order that arrives later is still confirmed
at once, but it goes on the following run, and the store is told so in the same moment.
"""

from __future__ import annotations

import uuid
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import date, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO
from relay_api.config import get_settings
from relay_api.models import (
    AppUser,
    CalendarDay,
    CaseType,
    Deferral,
    DeferralKind,
    Order,
    OrderLine,
    OrderSource,
    OrderStatus,
    Outlet,
)
from relay_api.seed.story import story_orders
from relay_api.services.notify import notify_store

CUTOFF_HOUR = 16


def next_operating_day(db: Session, after: date) -> date:
    day = db.scalar(
        select(CalendarDay.date)
        .where(CalendarDay.date > after, CalendarDay.is_operating.is_(True))
        .order_by(CalendarDay.date)
        .limit(1)
    )
    return day or after + timedelta(days=1)


def cutoff_for(run_date: date) -> datetime:
    """4:00 PM on the day before the run."""
    day_before = run_date - timedelta(days=1)
    return datetime(day_before.year, day_before.month, day_before.day, CUTOFF_HOUR, tzinfo=COLOMBO)


def delivery_day_for(db: Session, now: datetime) -> date:
    """The run a store is ordering for right now: tomorrow's until 4:00 PM, the one after that later on."""
    today = now.astimezone(COLOMBO).date()
    first = next_operating_day(db, today)
    return first if now < cutoff_for(first) else next_operating_day(db, first)


def current_run(db: Session, now: datetime) -> date:
    """The run being planned or on the road: tomorrow's run until midday on its own day, when the office
    moves on to the next one."""
    return next_operating_day(db, (now.astimezone(COLOMBO) - timedelta(hours=12)).date())


@dataclass(frozen=True)
class LineInput:
    case_type: str
    qty: int


def _order_ref(db: Session, requested: date, outlet_id: str, temp: str) -> str:
    """Use the number the order book reserves for this store's stream on that day, so the story's orders keep
    their scenario ids; otherwise the next free number."""
    taken = set(db.scalars(select(Order.order_ref)))
    for row in story_orders(get_settings().seed_dir):
        if (row["requested_date"], row["outlet_id"], row["temp"]) == (requested.isoformat(), outlet_id, temp):
            if row["order_ref"] not in taken:
                return row["order_ref"]
            break
    top = db.scalar(select(func.max(Order.order_ref)))
    return f"ORD{int(top[3:]) + 1:07d}" if top else "ORD0100001"


def place_order(
    db: Session,
    now: datetime,
    outlet: Outlet,
    temp: str,
    lines: Sequence[LineInput],
    *,
    requested_date: date,
    source: OrderSource,
    placed_by: AppUser | None = None,
    order_ref: str | None = None,
    client_ref: str | None = None,
    size: tuple[int, float, float] | None = None,
) -> Order:
    if client_ref:
        existing = db.scalar(select(Order).where(Order.client_ref == client_ref))
        if existing is not None:
            return existing
    types = {c.code: c for c in db.scalars(select(CaseType))}
    if size is None:
        units = sum(line.qty for line in lines)
        kg = round(sum(line.qty * types[line.case_type].kg for line in lines), 1)
        m3 = round(sum(line.qty * types[line.case_type].m3 for line in lines), 3)
    else:
        units, kg, m3 = size

    late = now >= cutoff_for(requested_date)
    run_date = next_operating_day(db, requested_date) if late else requested_date
    order = Order(
        id=uuid.uuid4(),
        order_ref=order_ref or _order_ref(db, requested_date, outlet.outlet_id, temp),
        outlet_id=outlet.outlet_id,
        brand=outlet.brand,
        temp=temp,
        requested_date=requested_date,
        run_date=run_date,
        units=units,
        weight_kg=kg,
        volume_m3=m3,
        status=OrderStatus.RECEIVED,
        source=source,
        placed_at=now,
        placed_by=placed_by.id if placed_by else None,
        client_ref=client_ref,
    )
    order.lines = [OrderLine(position=i, case_type=line.case_type, qty=line.qty) for i, line in enumerate(lines)]
    db.add(order)
    db.flush()

    kind = "chilled" if temp == "chilled" else ("dry" if outlet.brand == "Fresh" else outlet.brand)
    if late:
        run_label = f"{run_date:%A} {run_date.day} {run_date:%B}"
        notice = (
            f"Your {kind} order {order.order_ref} came in after 4:00 PM, so it goes on {_day(run_date)}'s run. "
            f"Orders for the next day close at 4:00 PM."
        )
        db.add(
            Deferral(
                order_id=order.id,
                kind=DeferralKind.CUTOFF,
                from_date=requested_date,
                to_date=run_date,
                reason="Received after the 4:00 PM cutoff",
                store_notice=notice,
                created_at=now,
                confirmed_at=now,
                notified_at=now,
            )
        )
        notify_store(
            db,
            outlet.outlet_id,
            now,
            kind="order_after_cutoff",
            title=f"Order moved to {_day(run_date)}",
            body=notice,
            data={"order_ref": order.order_ref, "run_label": run_label},
        )
    else:
        notify_store(
            db,
            outlet.outlet_id,
            now,
            kind="order_received",
            title="Received by Waypoint",
            body=f"Your {kind} order {order.order_ref} for {_day(requested_date)} is confirmed.",
            data={"order_ref": order.order_ref},
        )
    return order


def _day(d: date) -> str:
    return d.strftime("%A")
