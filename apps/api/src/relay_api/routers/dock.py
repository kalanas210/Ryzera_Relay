"""The dock tablet: tonight's loads (LDR-01), loading one vehicle (LDR-02), flagging a shortfall (LDR-03) and the
handover (LDR-04). Every change is recorded against the loader signed in on the tablet."""

from __future__ import annotations

import uuid
from collections.abc import Callable
from typing import Annotated, Literal, TypeVar

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel, Field

from relay_api.models import AppUser, LoadLine, Plan, Role, ShortfallKind, Trip
from relay_api.schemas.dock import TonightOut, TripLoadOut
from relay_api.security import require, verify_secret
from relay_api.services import dock
from relay_api.workspaces import Scope, ScopeDep

router = APIRouter(prefix="/api/dock", tags=["loader"])
Loader = Annotated[AppUser, Depends(require(Role.LOADER))]
T = TypeVar("T")


def _guard(fn: Callable[[], T]) -> T:
    try:
        return fn()
    except dock.DockError as exc:
        raise HTTPException(status.HTTP_409_CONFLICT, str(exc)) from exc


def _depot(user: AppUser) -> str:
    return user.depot or "Kandy"


def _trip(scope: Scope, user: AppUser, trip_id: uuid.UUID) -> Trip:
    """A load at the loader's own hub. Another hub's load reads as not there, the same as a load that does not
    exist, so a crafted request learns nothing about it."""
    trip = scope.db.get(Trip, trip_id)
    plan = scope.db.get(Plan, trip.plan_id) if trip else None
    if trip is None or plan is None or plan.depot != _depot(user):
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such load")
    return trip


def _line(scope: Scope, user: AppUser, line_id: uuid.UUID) -> LoadLine:
    line = scope.db.get(LoadLine, line_id)
    if line is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such line")
    _trip(scope, user, line.trip_id)
    return line


def _load(scope: Scope, user: AppUser, trip_id: uuid.UUID) -> TripLoadOut:
    scope.db.commit()
    return dock.trip_load(scope.db, _trip(scope, user, trip_id))


@router.get("/loads", response_model=TonightOut)
def tonight(scope: ScopeDep, user: Loader) -> TonightOut:
    return dock.tonight(scope.db, scope.now, _depot(user))


@router.get("/trips/{trip_id}", response_model=TripLoadOut)
def load(trip_id: uuid.UUID, scope: ScopeDep, user: Loader) -> TripLoadOut:
    return dock.trip_load(scope.db, _trip(scope, user, trip_id))


class LineIn(BaseModel):
    loaded: int = Field(ge=0, le=9999, description="Cases of this line on the truck: all of them checks the line")


@router.post("/lines/{line_id}", response_model=TripLoadOut)
def set_line(line_id: uuid.UUID, body: LineIn, scope: ScopeDep, user: Loader) -> TripLoadOut:
    line = _line(scope, user, line_id)
    _guard(lambda: dock.set_loaded(scope.db, scope.now, user, line, body.loaded))
    return _load(scope, user, line.trip_id)


class FlagIn(BaseModel):
    kind: Literal["missing", "damaged"]
    qty: int = Field(ge=1, le=9999)


@router.post("/lines/{line_id}/flag", response_model=TripLoadOut)
def flag(line_id: uuid.UUID, body: FlagIn, scope: ScopeDep, user: Loader) -> TripLoadOut:
    """Flag missing or damaged cases. The dispatcher on call sees it at once; loading goes on."""
    line = _line(scope, user, line_id)
    _guard(lambda: dock.flag(scope.db, scope.now, user, line, ShortfallKind(body.kind), body.qty))
    return _load(scope, user, line.trip_id)


@router.put("/lines/{line_id}/flag/photo", response_model=TripLoadOut)
def flag_photo(line_id: uuid.UUID, scope: ScopeDep, user: Loader, file: Annotated[UploadFile, File()]) -> TripLoadOut:
    """A photo of the damaged cases, resized on the tablet. Sent after the flag; a second photo replaces it. Not
    async: the load's lock may have to wait for the simulator's tick."""
    line = _line(scope, user, line_id)
    data = file.file.read(dock.MAX_PHOTO_BYTES + 1)
    _guard(lambda: dock.attach_photo(scope.db, scope.now, user, line, data, file.content_type or "image/jpeg"))
    return _load(scope, user, line.trip_id)


@router.delete("/lines/{line_id}/flag", response_model=TripLoadOut)
def withdraw_flag(line_id: uuid.UUID, scope: ScopeDep, user: Loader) -> TripLoadOut:
    """The cases turned up before the dispatcher answered."""
    line = _line(scope, user, line_id)
    _guard(lambda: dock.cancel_flag(scope.db, scope.now, user, line))
    return _load(scope, user, line.trip_id)


@router.post("/trips/{trip_id}/complete", response_model=TripLoadOut)
def complete(trip_id: uuid.UUID, scope: ScopeDep, user: Loader) -> TripLoadOut:
    """Load complete: sends the handover to the driver's phone."""
    trip = _trip(scope, user, trip_id)
    _guard(lambda: dock.complete(scope.db, scope.now, user, trip))
    return _load(scope, user, trip_id)


class TabletAcceptIn(BaseModel):
    pin: str = Field(pattern=r"^\d{4}$")


@router.post("/trips/{trip_id}/accept", response_model=TripLoadOut)
def accept_here(trip_id: uuid.UUID, body: TabletAcceptIn, scope: ScopeDep, user: Loader) -> TripLoadOut:
    """The driver accepts on the dock tablet with their own PIN, when their phone has no signal. The tablet stays
    signed in as the loader."""
    trip = _trip(scope, user, trip_id)
    plan = scope.db.get(Plan, trip.plan_id)
    driver = dock.Lookup(scope.db).driver_of(trip, plan.run_date) if plan else None
    if driver is None or not verify_secret(driver.pin_hash, body.pin):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "That PIN did not match. Try again.")
    _guard(lambda: dock.accept(scope.db, scope.now, driver, trip, on="tablet"))
    return _load(scope, user, trip_id)
