"""Live runs on the dispatcher's desk (DSP-04 desktop, DEG-03, DEG-05): the runs panel, moving a stop to a backup
while its driver is silent, keeping or cancelling that backup, settling a two-copy stop, and marking feed items."""

from __future__ import annotations

import uuid
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field

from relay_api.models import AppUser, Conflict, FeedItem, Role, Stop, Trip
from relay_api.security import require
from relay_api.services import backup, field, runs
from relay_api.workspaces import Scope, ScopeDep

router = APIRouter(prefix="/api/dispatch/live", tags=["dispatcher: live"])
Dispatcher = Annotated[AppUser, Depends(require(Role.DISPATCHER))]
Depot = Literal["Peliyagoda", "Kandy"]


def _get(scope: Scope, model: type, key: uuid.UUID, what: str) -> Any:
    row = scope.db.get(model, key)
    if row is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, f"No such {what}")
    return row


@router.get("/runs")
def get_runs(scope: ScopeDep, _user: Dispatcher, depot: Depot = "Kandy") -> dict[str, Any]:
    """Every Fresh run of the depot's published plan, stop by stop, needing attention first."""
    return runs.panel(scope.db, scope.now, depot).as_dict()


@router.get("/stops/{stop_id}/move-options")
def move_options(stop_id: uuid.UUID, scope: ScopeDep, _user: Dispatcher) -> list[dict[str, Any]]:
    stop: Stop = _get(scope, Stop, stop_id, "stop")
    trip: Trip = _get(scope, Trip, stop.trip_id, "trip")
    return [o.__dict__ for o in backup.move_options(scope.db, scope.now, trip, stop)]


class MoveIn(BaseModel):
    vehicle_id: str = Field(min_length=1, max_length=8)
    reason: str = Field(min_length=3, max_length=300)


@router.post("/stops/{stop_id}/move")
def move_stop(stop_id: uuid.UUID, body: MoveIn, scope: ScopeDep, user: Dispatcher) -> dict[str, Any]:
    """Send one stop with a backup vehicle. The dock picks it, and the driver, the backup's driver and the store are
    told; a message to a silent phone waits for its next contact."""
    stop: Stop = _get(scope, Stop, stop_id, "stop")
    try:
        trip = backup.move_stop(scope.db, scope.now, user, stop, body.vehicle_id, body.reason)
    except backup.BackupError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    scope.db.commit()
    return {"backup_trip_id": str(trip.id), "panel": runs.panel(scope.db, scope.now, _depot(scope, trip)).as_dict()}


class BackupIn(BaseModel):
    action: Literal["keep", "cancel"]
    note: str = Field(default="", max_length=300)


@router.post("/feed/{item_id}/backup")
def decide_backup(item_id: uuid.UUID, body: BackupIn, scope: ScopeDep, user: Dispatcher) -> dict[str, Any]:
    """After a store confirmed receipt from a silent run: keep the backup on the road, or call it off."""
    item: FeedItem = _get(scope, FeedItem, item_id, "item")
    copy_id = item.ref.get("copy_stop_id")
    if not copy_id:
        raise HTTPException(status.HTTP_409_CONFLICT, "This item has no backup to decide on.")
    if item.handled_at is not None:
        raise HTTPException(status.HTTP_409_CONFLICT, "This was already decided.")
    if body.action == "keep":
        backup.keep_backup(scope.db, scope.now, user, item, body.note)
    else:
        copy: Stop = _get(scope, Stop, uuid.UUID(copy_id), "stop")
        backup.cancel_backup(scope.db, scope.now, user, copy)
        item.handled_at = scope.now
        item.handled_by = user.id
        item.outcome = "You cancelled the backup." + (f" {body.note.strip()}" if body.note.strip() else "")
    scope.db.commit()
    return runs.panel(scope.db, scope.now, item.depot).as_dict()


@router.post("/conflicts/{conflict_id}/settle")
def settle(conflict_id: uuid.UUID, scope: ScopeDep, user: Dispatcher) -> dict[str, Any]:
    """Cancel the backup's copy of a two-copy stop: the driver's delivery stands."""
    conflict: Conflict = _get(scope, Conflict, conflict_id, "conflict")
    field.settle(scope.db, scope.now, conflict, by=user, how="dispatcher")
    scope.db.commit()
    stop: Stop = _get(scope, Stop, conflict.stop_id, "stop")
    trip: Trip = _get(scope, Trip, stop.trip_id, "trip")
    return runs.panel(scope.db, scope.now, _depot(scope, trip)).as_dict()


class HandleIn(BaseModel):
    note: str = Field(default="", max_length=300)


@router.post("/feed/{item_id}/handle", status_code=status.HTTP_204_NO_CONTENT)
def handle(item_id: uuid.UUID, body: HandleIn, scope: ScopeDep, user: Dispatcher) -> None:
    """Mark as handled, or reviewed: the item moves to Earlier today with the time and who did it."""
    item: FeedItem = _get(scope, FeedItem, item_id, "item")
    if item.handled_at is None:
        item.handled_at = scope.now
        item.handled_by = user.id
        item.outcome = item.outcome or ("Marked as handled." + (f" {body.note.strip()}" if body.note.strip() else ""))
    scope.db.commit()


def _depot(scope: Scope, trip: Trip) -> str:
    from relay_api.models import Plan

    plan = scope.db.get(Plan, trip.plan_id)
    return plan.depot if plan else "Kandy"
