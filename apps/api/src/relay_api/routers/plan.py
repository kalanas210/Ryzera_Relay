"""The plan board (DSP-02), deferrals (DSP-03), the publish check and publishing."""

from __future__ import annotations

import uuid
from datetime import date
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select

from relay_api.models import AppUser, Plan, Role, VehicleDay, VehicleDayStatus
from relay_api.schemas.plan import BoardOut, FitOut
from relay_api.security import require
from relay_api.services import board as boards
from relay_api.services import drawer as drawers
from relay_api.services import planning
from relay_api.services.ordering import current_run
from relay_api.workspaces import Scope, ScopeDep

router = APIRouter(prefix="/api/dispatch/plan", tags=["dispatcher: plan"])
Dispatcher = Annotated[AppUser, Depends(require(Role.DISPATCHER))]
Depot = Literal["Peliyagoda", "Kandy"]


def _plan(scope: Scope, plan_id: uuid.UUID) -> Plan:
    plan = scope.db.get(Plan, plan_id)
    if plan is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such plan")
    return plan


def _guard(fn: Any) -> Any:
    try:
        return fn()
    except planning.PlanError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


@router.get("", response_model=BoardOut)
def get_board(
    scope: ScopeDep, _user: Dispatcher, depot: Depot = "Kandy", run_date: Annotated[date | None, Query()] = None
) -> BoardOut:
    plan = planning.get_plan(scope.db, depot, run_date or current_run(scope.db, scope.now))
    scope.db.commit()
    return boards.board(scope.db, scope.now, plan)


class ProposeIn(BaseModel):
    depot: Depot
    run_date: date | None = None


@router.post("/propose", response_model=BoardOut)
def propose(body: ProposeIn, scope: ScopeDep, _user: Dispatcher) -> BoardOut:
    """Ask Relay for a plan. It checks every rule for every order, so this takes a few seconds."""
    plan = planning.get_plan(scope.db, body.depot, body.run_date or current_run(scope.db, scope.now))
    _guard(lambda: planning.propose_plan(scope.db, scope.now, plan, forced=plan.summary.get("overridden", [])))
    scope.db.commit()
    return boards.board(scope.db, scope.now, plan)


class MoveIn(BaseModel):
    order_ref: str
    vehicle_id: str | None = None
    trip_no: int | None = Field(default=None, ge=1, le=2)


@router.post("/{plan_id}/move", response_model=BoardOut)
def move(plan_id: uuid.UUID, body: MoveIn, scope: ScopeDep, user: Dispatcher) -> BoardOut:
    plan = _plan(scope, plan_id)
    target = planning.Target(body.vehicle_id, body.trip_no) if body.vehicle_id and body.trip_no else None
    _guard(lambda: planning.move_order(scope.db, scope.now, plan, body.order_ref, target, user))
    scope.db.commit()
    return boards.board(scope.db, scope.now, plan)


@router.post("/{plan_id}/undo", response_model=BoardOut)
def undo(plan_id: uuid.UUID, scope: ScopeDep, _user: Dispatcher) -> BoardOut:
    plan = _plan(scope, plan_id)
    _guard(lambda: planning.undo(scope.db, scope.now, plan))
    scope.db.commit()
    return boards.board(scope.db, scope.now, plan)


@router.get("/{plan_id}/fit", response_model=list[FitOut])
def fit(plan_id: uuid.UUID, scope: ScopeDep, _user: Dispatcher, order_ref: str) -> list[FitOut]:
    return boards.fits(scope.db, _plan(scope, plan_id), order_ref)


@router.get("/{plan_id}/deferrals")
def deferrals(plan_id: uuid.UUID, scope: ScopeDep, _user: Dispatcher) -> dict[str, Any]:
    plan = _plan(scope, plan_id)
    data = drawers.drawer(scope.db, scope.now, plan)
    scope.db.commit()  # the next-run check is kept once computed
    return data


class ConfirmIn(BaseModel):
    reason: str
    note: str = Field(default="", max_length=500)


@router.post("/{plan_id}/deferrals/{order_ref}/confirm")
def confirm(plan_id: uuid.UUID, order_ref: str, body: ConfirmIn, scope: ScopeDep, user: Dispatcher) -> dict[str, Any]:
    plan = _plan(scope, plan_id)
    _guard(lambda: planning.confirm_deferral(scope.db, scope.now, plan, order_ref, body.reason, body.note, user))
    scope.db.commit()
    return drawers.drawer(scope.db, scope.now, plan)


class OverrideIn(BaseModel):
    order_ref: str
    note: str = Field(min_length=3, max_length=500)


@router.post("/{plan_id}/override", response_model=BoardOut)
def override(plan_id: uuid.UUID, body: OverrideIn, scope: ScopeDep, user: Dispatcher) -> BoardOut:
    """Defer a protected order anyway. Relay re-plans the rest and keeps the note with the order."""
    plan = _plan(scope, plan_id)
    forced = {*plan.summary.get("overridden", []), body.order_ref}
    _guard(lambda: planning.propose_plan(scope.db, scope.now, plan, forced=forced))
    _guard(lambda: planning.confirm_deferral(scope.db, scope.now, plan, body.order_ref, "other", body.note, user))
    scope.db.commit()
    return boards.board(scope.db, scope.now, plan)


@router.get("/{plan_id}/check")
def check(plan_id: uuid.UUID, scope: ScopeDep, _user: Dispatcher) -> dict[str, Any]:
    return planning.publish_check(scope.db, _plan(scope, plan_id))


@router.post("/{plan_id}/publish", response_model=BoardOut)
def publish(plan_id: uuid.UUID, scope: ScopeDep, user: Dispatcher) -> BoardOut:
    plan = _plan(scope, plan_id)
    _guard(lambda: planning.publish(scope.db, scope.now, plan, user))
    scope.db.commit()
    return boards.board(scope.db, scope.now, plan)


class VehicleStatusIn(BaseModel):
    run_date: date
    status: Literal["available", "workshop", "standby"]
    note: str = Field(default="", max_length=120)


@router.patch("/vehicles/{vehicle_id}", response_model=BoardOut)
def set_vehicle_status(
    vehicle_id: str, body: VehicleStatusIn, scope: ScopeDep, _user: Dispatcher, depot: Depot = "Kandy"
) -> BoardOut:
    """Send a vehicle to the workshop, back into service, or onto standby for a run. Propose again to re-plan."""
    day = scope.db.scalar(
        select(VehicleDay).where(VehicleDay.vehicle_id == vehicle_id, VehicleDay.run_date == body.run_date)
    )
    if day is None:
        day = VehicleDay(vehicle_id=vehicle_id, run_date=body.run_date, status=VehicleDayStatus(body.status))
        scope.db.add(day)
    day.status = VehicleDayStatus(body.status)
    day.note = body.note
    plan = planning.get_plan(scope.db, depot, body.run_date)
    scope.db.commit()
    return boards.board(scope.db, scope.now, plan)
