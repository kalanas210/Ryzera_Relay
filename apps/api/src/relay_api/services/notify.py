"""Notices to stores and items in the dispatcher's feed."""

from __future__ import annotations

from datetime import date, datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import FeedItem, FeedKind, Notification
from relay_api.services.words import clock

CUTOFF_REMINDER = "cutoff_reminder"
REMIND_AGAIN_AFTER = timedelta(minutes=10)
"""A second Remind within this long of the first sends nothing new: the store already has it."""


def notify_store(
    db: Session,
    outlet_id: str,
    now: datetime,
    *,
    kind: str,
    title: str,
    body: str,
    data: dict[str, Any] | None = None,
    show_after: datetime | None = None,
) -> Notification:
    notice = Notification(
        outlet_id=outlet_id,
        kind=kind,
        title=title,
        body=body,
        data=data or {},
        created_at=now,
        show_after=show_after or now,
    )
    db.add(notice)
    return notice


def last_reminders(db: Session, run_date: date, now: datetime) -> dict[str, datetime]:
    """When each store was last reminded to order for this run, by outlet."""
    out: dict[str, datetime] = {}
    for notice in db.scalars(
        select(Notification).where(Notification.kind == CUTOFF_REMINDER, Notification.created_at <= now)
    ):
        if notice.outlet_id and notice.data.get("run_date") == run_date.isoformat():
            out[notice.outlet_id] = max(out.get(notice.outlet_id, notice.created_at), notice.created_at)
    return out


def remind_to_order(
    db: Session,
    outlet_id: str,
    now: datetime,
    *,
    run_date: date,
    cutoff: datetime,
    then: date,
    usual: str,
    last: datetime | None = None,
) -> datetime:
    """The dispatcher's Remind: a notice in the store's Relay app with the cutoff. Returns when the store was
    reminded, which is the earlier reminder when one went out a moment ago."""
    if last is not None and now - last < REMIND_AGAIN_AFTER:
        return last
    notify_store(
        db,
        outlet_id,
        now,
        kind=CUTOFF_REMINDER,
        title=f"Your {run_date:%A} order isn't in yet",
        body=(
            f"Orders for {run_date:%A} {run_date.day} {run_date:%B} close at {clock(cutoff)} today. We usually have "
            f"your {usual} by now. Anything that comes in after {clock(cutoff)} goes on {then:%A}'s run."
        ),
        data={"run_date": run_date.isoformat(), "cutoff": cutoff.isoformat()},
    )
    return now


def add_feed_item(
    db: Session,
    now: datetime,
    *,
    kind: FeedKind,
    depot: str,
    title: str,
    body: str = "",
    ref: dict[str, Any] | None = None,
) -> FeedItem:
    item = FeedItem(kind=kind, depot=depot, title=title, body=body, ref=ref or {}, created_at=now)
    db.add(item)
    return item
