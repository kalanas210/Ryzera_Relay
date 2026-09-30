"""Notices to stores and items in the dispatcher's feed."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from sqlalchemy.orm import Session

from relay_api.models import FeedItem, FeedKind, Notification


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
