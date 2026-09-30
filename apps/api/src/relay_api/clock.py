"""The scenario clock.

The story Relay was designed around runs from Tuesday 7 April 2026, 2:05 PM, to the Wednesday
morning deliveries. The real date is months later, so each workspace carries its own clock: scenario
time runs at `clock_rate` from an anchor, and the demo bar can jump it to the next moment in the
story. Everything Relay records (orders, arrivals, proofs) is stamped in scenario time.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from zoneinfo import ZoneInfo

from relay_api.models import Workspace

COLOMBO = ZoneInfo("Asia/Colombo")


def at(day: str, clock: str) -> datetime:
    """at('2026-04-08', '05:41') is 5:41 AM Sri Lanka time on 8 April 2026."""
    return datetime.fromisoformat(f"{day}T{clock}:00").replace(tzinfo=COLOMBO)


PLANNING_DAY = "2026-04-07"
DELIVERY_DAY = "2026-04-08"
STORY_START = at(PLANNING_DAY, "14:05")
CUTOFF = at(PLANNING_DAY, "16:00")


@dataclass(frozen=True)
class Moment:
    key: str
    label: str
    at: datetime


MOMENTS: tuple[Moment, ...] = (
    Moment("orders", "Stores order for Wednesday", STORY_START),
    Moment("queue", "Chasing the last orders", at(PLANNING_DAY, "15:12")),
    Moment("cutoff", "Cutoff: the queue locks", CUTOFF),
    Moment("plan", "Planning the Kandy hub", at(PLANNING_DAY, "16:35")),
    Moment("publish", "Publishing the plan", at(PLANNING_DAY, "18:39")),
    Moment("evening", "Stores read their notices", at(PLANNING_DAY, "18:41")),
    Moment("loading", "Loading at the Kandy hub", at(DELIVERY_DAY, "02:40")),
    Moment("handover", "Handover at the dock", at(DELIVERY_DAY, "03:31")),
    Moment("first_stop", "First stop, Kegalle", at(DELIVERY_DAY, "04:52")),
    Moment("on_the_road", "On the road", at(DELIVERY_DAY, "05:20")),
    Moment("signal_lost", "Signal lost near Mawanella", at(DELIVERY_DAY, "05:41")),
    Moment("silence", "The office sees the silence", at(DELIVERY_DAY, "06:05")),
    Moment("receipt", "Hemmathagama confirms receipt", at(DELIVERY_DAY, "06:40")),
    Moment("signal_back", "Signal back at Aranayake", at(DELIVERY_DAY, "07:14")),
    Moment("settled", "Everything settled", at(DELIVERY_DAY, "07:22")),
)


def sim_now(workspace: Workspace, real_now: datetime | None = None) -> datetime:
    real = real_now or datetime.now(UTC)
    elapsed = (real - workspace.clock_anchor_real).total_seconds() * workspace.clock_rate
    return (workspace.clock_anchor_sim + timedelta(seconds=elapsed)).astimezone(COLOMBO)


def set_clock(workspace: Workspace, to: datetime, rate: float | None = None) -> None:
    workspace.clock_anchor_real = datetime.now(UTC)
    workspace.clock_anchor_sim = to
    if rate is not None:
        workspace.clock_rate = rate


def next_moment(now: datetime) -> Moment | None:
    return next((m for m in MOMENTS if m.at > now + timedelta(seconds=30)), None)
