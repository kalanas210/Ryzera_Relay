"""Keeping a copy of the day up to its scenario clock.

Four things move with the clock, applied in time order so a jump of hours lands on a consistent day:
- scheduled events: the stores that order later in the afternoon, and what Kasun's phone saved with no signal,
  sent when the signal returns; each run through the same service a person's device uses;
- the world simulator (`world.advance`): the loaders and drivers nobody is playing, at the dock and on the road;
- what Relay notices on its own (`watch`): a running trip's phone gone quiet, a question nobody answers;
- the story autopilot (`story`): the judge characters' own steps. A jump plays every step it skipped past; as the
  clock simply runs, only the steps of characters nobody is playing, as their times come. Kasun's phone checks in as
  the clock runs (`story.phone`) while the autopilot carries it.

Everything is idempotent. The workspace row is locked while a copy catches up, so the background tick and a jump
never apply the same step twice; the tick simply skips a copy that is busy.
"""

from __future__ import annotations

import logging
from collections.abc import Callable
from datetime import UTC, date, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.clock import set_clock, sim_now
from relay_api.db import scope_to_workspace
from relay_api.models import OrderSource, Outlet, ScheduledEvent, Workspace
from relay_api.seed.story import parse_lines
from relay_api.services import story, world
from relay_api.services.ordering import LineInput, place_order
from relay_api.services.watch import watch
from relay_api.workspaces import playing

log = logging.getLogger("relay.simulator")

REACHED = "reached"
"""Key in Workspace.state: the scenario time the copy was last caught up to, where its world stands."""


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


HANDLERS = {"place_order": _place_order, story.RELEASE: story.release}


def _apply_events(db: Session, until: datetime) -> None:
    events = db.scalars(
        select(ScheduledEvent)
        .where(ScheduledEvent.done_at.is_(None), ScheduledEvent.due_at <= until)
        .order_by(ScheduledEvent.due_at)
    ).all()
    for event in events:
        handler = HANDLERS.get(event.kind)
        if handler is None:
            log.warning("No handler for scheduled event %s", event.kind)
        else:
            handler(db, event)
        event.done_at = event.due_at
    if events:
        db.flush()


def catch_up(
    db: Session,
    workspace: Workspace,
    until: datetime | Callable[[Session], datetime] | None = None,
    *,
    jumped_from: datetime | None = None,
) -> list[str]:
    """Bring a copy of the day up to `until` (default: its scenario time now). With `jumped_from`, also play
    the story steps the jump skipped; without it, the steps of characters nobody is playing that have come due.
    Returns the labels of the steps played.

    `until` can be a story moment's time as a function of the day (`story.moment_time`): the handover follows the
    truck the story publishes on the way, so it is worked out again after every step played, a step later than it
    is never played, and the clock lands on it, never before a step already played."""
    scope_to_workspace(db, workspace.id)
    locked = db.scalar(
        select(Workspace)
        .where(Workspace.id == workspace.id)
        .with_for_update(skip_locked=jumped_from is None)
        .execution_options(populate_existing=True)
    )
    if locked is None:
        return []  # a jump is catching this copy up; the next tick will find it current
    fixed = until if isinstance(until, datetime) else sim_now(locked)
    reached = jumped_from

    def target() -> datetime:
        if not callable(until):
            return fixed
        moment = until(db)
        return max(moment, reached) if reached is not None else moment

    now = target()
    played: list[str] = []
    if jumped_from is not None:
        people = story.cast(db)
        while people is not None:
            now = target()
            due = story.pending(db, locked, now)
            if not due:
                break
            moment, step = due[0]
            stamp = max(moment, reached or moment)
            reached = stamp
            _move(db, locked, stamp)
            try:
                with db.begin_nested():  # a step that fails leaves no half-done change behind
                    did = step.play(db, stamp, people)
            except Exception:
                log.exception("Story step %s failed", step.key)
                did = False
            story.settle(locked, step, did)
            if did:
                played.append(story.label(db, step))
            db.flush()
    else:
        played = _on_time(db, locked, now)
    if callable(until):
        now = target()
        set_clock(locked, now)
    _move(db, locked, now)
    if locked.state.get(REACHED) != now.isoformat():
        locked.state = {**locked.state, REACHED: now.isoformat()}
    db.commit()
    return played


def _on_time(db: Session, workspace: Workspace, now: datetime) -> list[str]:
    """The clock ran on by itself: each character nobody is playing takes the steps that have come due. A step that
    came due since the copy was last caught up is taken at its own time; one that waited (for a judge who has gone,
    or for a load to be completed) is taken now. One that cannot be taken yet is not settled, and is tried again on
    a later tick."""
    people = story.cast(db)
    if people is None:
        return []
    known = workspace.state.get(REACHED)
    reached = datetime.fromisoformat(known) if known else now
    here = playing(workspace, datetime.now(UTC))
    tried: set[str] = set()
    played: list[str] = []
    while True:
        due = [(t, step) for t, step in story.on_time(db, workspace, now, people, here) if step.key not in tried]
        if not due:
            return played
        moment, step = due[0]
        tried.add(step.key)
        stamp = moment if moment > reached else now
        reached = stamp
        _move(db, workspace, stamp)
        try:
            with db.begin_nested():
                did = step.play(db, stamp, people)
        except Exception:
            log.exception("Story step %s failed", step.key)
            story.settle(workspace, step, False)  # failed, not waiting: never tried again
            continue
        if did:
            story.settle(workspace, step, True)
            played.append(story.label(db, step))
        db.flush()


def _move(db: Session, workspace: Workspace, now: datetime) -> None:
    """Everything that moves by itself, up to `now`: the scheduled events, the world, Kasun's phone, and what Relay
    notices once they have moved."""
    _apply_events(db, now)
    world.advance(db, now)
    story.phone(db, workspace, now)
    watch(db, now)
