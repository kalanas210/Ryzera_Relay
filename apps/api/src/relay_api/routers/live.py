"""Live runs (DSP-04): the exceptions feed and the decisions it asks for."""

from __future__ import annotations

import uuid
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from relay_api.models import AppUser, Role, Shortfall, ShortfallDecision
from relay_api.schemas.live import FeedOut
from relay_api.security import require
from relay_api.services import dock, live
from relay_api.workspaces import ScopeDep

router = APIRouter(prefix="/api/dispatch/live", tags=["dispatcher: live"])
Dispatcher = Annotated[AppUser, Depends(require(Role.DISPATCHER))]
Depot = Literal["Peliyagoda", "Kandy"]


@router.get("/feed", response_model=FeedOut)
def feed(scope: ScopeDep, _user: Dispatcher, depot: Depot = "Kandy") -> FeedOut:
    return live.feed(scope.db, scope.now, depot)


class DecisionIn(BaseModel):
    decision: Literal["send_short", "no_replacement"]


@router.post("/shortfalls/{shortfall_id}/decide", response_model=FeedOut)
def decide(shortfall_id: uuid.UUID, body: DecisionIn, scope: ScopeDep, user: Dispatcher) -> FeedOut:
    """Answer a flag from the dock. The answer reaches the dock tablet, and the store is told."""
    shortfall = scope.db.get(Shortfall, shortfall_id)
    if shortfall is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such flag")
    try:
        dock.decide(scope.db, scope.now, user, shortfall, ShortfallDecision(body.decision))
    except dock.DockError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc
    scope.db.commit()
    return live.feed(scope.db, scope.now, dock.depot_of(scope.db, shortfall))
