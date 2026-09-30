"""The world simulator: the stores, loaders and drivers a judge is not playing.

Scripted events (a store placing its order at 3:40 PM) wait in scheduled_event until the scenario
clock reaches them, then run through the same services a person would use. Catching up is
idempotent and ordered, so jumping the clock forward by hours applies everything in between once.
Rows are claimed with SKIP LOCKED, so several API workers never apply the same event twice.
"""

from __future__ import annotations

import logging
from datetime import date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import sim_now
from relay_api.db import scope_to_workspace
from relay_api.models import OrderSource, Outlet, ScheduledEvent, Workspace
from relay_api.seed.story import parse_lines
from relay_api.services.ordering import LineInput, place_order

log = logging.getLogger("relay.simulator")


def _place_order(db: Session, event: ScheduledEvent) -> None:
    row = event.payload
    outlet = db.get(Outlet, row["outlet_id"])
    if outlet is None:
        return
    place_order(
        db,
        event.due_at,
        outlet,
        row["temp"],
        [LineInput(code, qty) for code, qty in parse_lines(row["lines"])],
        requested_date=date.fromisoformat(row["requested_date"]),
        source=OrderSource.SIMULATOR,
        order_ref=row["order_ref"],
        size=(int(row["units"]), float(row["kg"]), float(row["m3"])),
    )


HANDLERS = {"place_order": _place_order}


def catch_up(db: Session, workspace: Workspace, until: datetime | None = None) -> int:
    """Apply every scheduled event due by `until` (default: the workspace's scenario time now)."""
    scope_to_workspace(db, workspace.id)
    now = until or sim_now(workspace)
    events = db.scalars(
        select(ScheduledEvent)
        .where(ScheduledEvent.done_at.is_(None), ScheduledEvent.due_at <= now)
        .order_by(ScheduledEvent.due_at)
        .with_for_update(skip_locked=True)
    ).all()
    for event in events:
        handler = HANDLERS.get(event.kind)
        if handler is None:
            log.warning("No handler for scheduled event %s", event.kind)
        else:
            handler(db, event)
        event.done_at = event.due_at
    if events:
        db.commit()
    return len(events)
