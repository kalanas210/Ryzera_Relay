"""Placing an order, changing it, and the 4:00 PM cutoff.

Orders for the next delivery day close at 4:00 PM. An order that arrives later is still confirmed
at once, but it goes on the following run, and the store is told so in the same moment. Until the
cutoff a store can change what it ordered; from then on the order is the dispatcher's to plan.
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
    AuditLog,
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


def closed_run(db: Session, now: datetime) -> date | None:
    """The run whose orders closed at 4:00 PM today, while new orders go on the one after it; None before then."""
    first = next_operating_day(db, now.astimezone(COLOMBO).date())
    return first if now >= cutoff_for(first) else None


def delivery_day_for(db: Session, now: datetime) -> date:
    """The run a store is ordering for right now: tomorrow's until 4:00 PM, the one after that later on."""
    return next_operating_day(db, closed_run(db, now) or now.astimezone(COLOMBO).date())


def current_run(db: Session, now: datetime) -> date:
    """The run being planned or on the road: tomorrow's run until midday on its own day, when the office
    moves on to the next one."""
    return next_operating_day(db, (now.astimezone(COLOMBO) - timedelta(hours=12)).date())


@dataclass(frozen=True)
class LineInput:
    case_type: str
    qty: int


def order_ref_for(db: Session, requested: date, outlet_id: str, temp: str) -> str:
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

    # Relay's receive time decides the run: a late order joins the run taking orders now, never one already closed
    late = now >= cutoff_for(requested_date)
    run_date = delivery_day_for(db, now) if late else requested_date
    order = Order(
        id=uuid.uuid4(),
        order_ref=order_ref or order_ref_for(db, requested_date, outlet.outlet_id, temp),
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
        told = notify_store(
            db,
            outlet.outlet_id,
            now,
            kind="order_after_cutoff",
            title=f"Order moved to {_day(run_date)}",
            body=notice,
            data={"order_ref": order.order_ref, "run_label": run_label},
        )
    else:
        told = notify_store(
            db,
            outlet.outlet_id,
            now,
            kind="order_received",
            title="Received by Waypoint",
            body=f"Your {kind} order {order.order_ref} for {_day(requested_date)} is confirmed.",
            data={"order_ref": order.order_ref},
        )
    if placed_by is not None:
        told.read_at = now  # the store read it on the confirmation screen, so it is no news to them
    return order


class OrderClosed(Exception):
    """A change Relay cannot take, in words for the store."""


def change_order(db: Session, now: datetime, order: Order, lines: Sequence[LineInput], *, changed_by: AppUser) -> Order:
    """The store's new counts, until the cutoff for the day it ordered for. Cases Waypoint carried onto the order
    from an earlier short delivery are not the store's to remove: they stay on top of its own counts."""
    if now >= cutoff_for(order.requested_date):
        raise OrderClosed(
            f"Orders for {_day(order.requested_date)} closed at 4:00 PM, so this order can't be changed now."
        )
    if order.status is not OrderStatus.RECEIVED or order.run_date != order.requested_date:
        raise OrderClosed("The dispatcher is already planning this order, so it can't be changed now.")
    carried = {line.case_type: (line.carried_qty, line.carried_from) for line in order.lines if line.carried_qty}
    own = {line.case_type: line.qty for line in lines}
    types = {c.code: c for c in db.scalars(select(CaseType))}
    before = order.units
    new_lines = []
    for i, code in enumerate([*own, *(code for code in carried if code not in own)]):
        carried_qty, carried_from = carried.get(code, (0, None))
        new_lines.append(
            OrderLine(
                position=i,
                case_type=code,
                qty=own.get(code, 0) + carried_qty,
                carried_qty=carried_qty,
                carried_from=carried_from,
            )
        )
    order.lines = new_lines
    order.units = sum(line.qty for line in order.lines)
    order.weight_kg = round(sum(line.qty * types[line.case_type].kg for line in order.lines), 1)
    order.volume_m3 = round(sum(line.qty * types[line.case_type].m3 for line in order.lines), 3)
    db.add(
        AuditLog(
            at=now,
            actor_id=changed_by.id,
            actor_label=changed_by.display_name,
            action="order.changed",
            entity="order",
            entity_id=order.order_ref,
            summary=f"{order.order_ref} changed by the store, from {before} to {order.units} cases",
        )
    )
    db.flush()
    return order


def _day(d: date) -> str:
    return d.strftime("%A")
