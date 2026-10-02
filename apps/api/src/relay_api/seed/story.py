"""Put the story day into a workspace: the orders already in at 2:05 PM on Tuesday, the ones that will
arrive later (as scheduled events for the world simulator), and each vehicle's status and driver.

Dilani's two Wednesday orders are left out on purpose: placing them is the first step of the judge
walkthrough. The story autopilot places them if a judge skips ahead, or at 2:14 PM if nobody is playing Dilani.

MAIN, the copy every browser opens until it starts or joins a private one, is shared by everyone, so its clock is
held at the start of the story: only a private copy's clock runs and jumps.
"""

from __future__ import annotations

import uuid
from datetime import UTC, date, datetime
from functools import cache
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from relay_api.clock import COLOMBO, DELIVERY_DAY, STORY_START
from relay_api.db import scope_to_workspace
from relay_api.models import (
    AppUser,
    Order,
    OrderLine,
    OrderSource,
    OrderStatus,
    Role,
    ScheduledEvent,
    VehicleDay,
    VehicleDayStatus,
    Workspace,
    WorkspaceScoped,
)
from relay_api.models.base import Base
from relay_api.seed.reference import read

MAIN = "MAIN"
"""The shared copy of the day."""


def parse_lines(text: str) -> list[tuple[str, int]]:
    """'rice_dhal:36;packet_foods:44' becomes [('rice_dhal', 36), ('packet_foods', 44)]."""
    out = []
    for part in filter(None, text.split(";")):
        code, qty = part.split(":")
        out.append((code, int(qty)))
    return out


@cache
def story_orders(seed_dir: Path) -> tuple[dict[str, str], ...]:
    return tuple(read(seed_dir / "story" / "orders.csv"))


def judge_order_rows(seed_dir: Path, outlet_id: str) -> list[dict[str, str]]:
    return [r for r in story_orders(seed_dir) if r["outlet_id"] == outlet_id and r["requested_date"] == DELIVERY_DAY]


def build_order(
    row: dict[str, str], placed_at: datetime, source: OrderSource, placed_by: AppUser | None = None
) -> Order:
    order = Order(
        order_ref=row["order_ref"],
        outlet_id=row["outlet_id"],
        brand=row["brand"],
        temp=row["temp"],
        requested_date=date.fromisoformat(row["requested_date"]),
        run_date=date.fromisoformat(row["requested_date"]),
        units=int(row["units"]),
        weight_kg=float(row["kg"]),
        volume_m3=float(row["m3"]),
        status=OrderStatus.RECEIVED,
        source=source,
        placed_at=placed_at,
        placed_by=placed_by.id if placed_by else None,
    )
    order.lines = [
        OrderLine(position=i, case_type=code, qty=qty) for i, (code, qty) in enumerate(parse_lines(row["lines"]))
    ]
    return order


def seed_workspace(db: Session, seed_dir: Path, workspace: Workspace) -> None:
    scope_to_workspace(db, workspace.id)
    users = list(db.scalars(select(AppUser)))
    judge_stores = {u.outlet_id for u in users if u.role is Role.STORE_MANAGER and u.judge_account}
    driver_of = {u.vehicle_id: u.id for u in users if u.role is Role.DRIVER and u.vehicle_id}

    for row in story_orders(seed_dir):
        if row["outlet_id"] in judge_stores and row["requested_date"] == DELIVERY_DAY:
            continue
        placed_at = datetime.fromisoformat(row["placed_at"]).replace(tzinfo=COLOMBO)
        if placed_at <= STORY_START:
            db.add(build_order(row, placed_at, OrderSource.SEED))
        else:
            db.add(ScheduledEvent(due_at=placed_at, kind="place_order", payload=dict(row)))

    for row in read(seed_dir / "story" / "vehicle_days.csv"):
        db.add(
            VehicleDay(
                vehicle_id=row["vehicle_id"],
                run_date=date.fromisoformat(row["run_date"]),
                status=VehicleDayStatus(row["status"]),
                driver_id=driver_of.get(row["vehicle_id"]),
                fuel_used_l=float(row["fuel_used_l"] or 0),
            )
        )
    db.flush()


def clear_workspace(db: Session, workspace: Workspace) -> None:
    """Delete every row of the workspace, children first, keeping the workspace itself."""
    for table in reversed(Base.metadata.sorted_tables):
        model = next((m.class_ for m in Base.registry.mappers if m.local_table is table), None)
        if model is not None and issubclass(model, WorkspaceScoped):
            db.execute(delete(table).where(table.c.workspace_id == workspace.id))


def held_at_start(workspace: Workspace) -> bool:
    """The shared copy's clock as it should be: held at Tuesday 2:05 PM."""
    return workspace.clock_rate == 0 and workspace.clock_anchor_sim == STORY_START


def _start_clock(workspace: Workspace, now: datetime) -> None:
    """The story starts again at 2:05 PM: running in real time in a private copy, held in the shared one."""
    workspace.clock_anchor_real = now
    workspace.clock_anchor_sim = STORY_START
    workspace.clock_rate = 0.0 if workspace.is_default else 1.0


def create_workspace(db: Session, seed_dir: Path, code: str, label: str, is_default: bool = False) -> Workspace:
    now = datetime.now(UTC)
    workspace = Workspace(
        code=code,
        label=label,
        is_default=is_default,
        created_at=now,
        last_active_at=now,
        state={"edition": uuid.uuid4().hex[:12]},
    )
    _start_clock(workspace, now)
    db.add(workspace)
    db.flush()
    seed_workspace(db, seed_dir, workspace)
    return workspace


def reset_workspace(db: Session, seed_dir: Path, workspace: Workspace) -> None:
    clear_workspace(db, workspace)
    _start_clock(workspace, datetime.now(UTC))
    workspace.state = {"edition": uuid.uuid4().hex[:12]}
    seed_workspace(db, seed_dir, workspace)
