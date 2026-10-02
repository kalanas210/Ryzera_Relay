"""The driver's phone (DRV-01 to DRV-05): the run, the outbox's records, proof photos and the minute check-in.

Inside the story's scripted outage the phone has no signal, whatever it tries: Relay notes no contact, applies no
record and stores no photo until the window ends. The demo keeps a stand-in for the phone's own memory meanwhile
(services/story.py), which is all the run and the held records below ever read from in that window. The demo bar's
"no signal" switch cuts the phone off at any time; the phone says so on the demo's own channel (/signal), so the
story's autopilot leaves that driver alone until the phone is back.
"""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile, status
from sqlalchemy import select

from relay_api.config import get_settings
from relay_api.models import AppUser, FieldEventKind, Notification, Role, Workspace
from relay_api.schemas.driver import (
    CheckinIn,
    CheckinOut,
    DriverRunOut,
    HeldIn,
    RecordIn,
    RecordResult,
    RecordsIn,
    RecordsOut,
    SignalIn,
)
from relay_api.security import require
from relay_api.services import driver as runs
from relay_api.services import field, story
from relay_api.workspaces import ScopeDep

router = APIRouter(prefix="/api/driver", tags=["driver"])
Driver = Annotated[AppUser, Depends(require(Role.DRIVER))]


def _no_signal(workspace: Workspace, user: AppUser, now: datetime) -> None:
    """The phone is inside its scripted outage: the request never reached Relay."""
    if story.no_signal(workspace, user, now):
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "No signal")


def _records(rows: list[RecordIn]) -> list[field.RecordIn]:
    return [
        field.RecordIn(
            id=r.id,
            kind=FieldEventKind(r.kind),
            trip_id=r.trip_id,
            stop_id=r.stop_id,
            occurred_at=r.occurred_at,
            base_version=r.base_version,
            lat=r.lat,
            lng=r.lng,
            accuracy_m=r.accuracy_m,
            payload=r.payload,
        )
        for r in rows
    ]


@router.get("/run", response_model=DriverRunOut)
def get_run(scope: ScopeDep, user: Driver) -> DriverRunOut:
    data = runs.run(scope.db, scope.now, user, scope.workspace)
    scope.db.commit()  # held messages are now handed over
    return data


@router.post("/records", response_model=RecordsOut)
def post_records(body: RecordsIn, scope: ScopeDep, user: Driver) -> RecordsOut:
    """Records from the phone's outbox, in the order the phone saved them. Idempotent by each record's id: a resend
    is answered "duplicate" and changes nothing."""
    _no_signal(scope.workspace, user, scope.now)
    field.switch_signal(scope.db, user, scope.now, on=False)  # the phone reached Relay: it has signal
    results = field.receive(scope.db, scope.now, user, body.device_id, _records(body.records))
    scope.db.commit()
    return RecordsOut(
        results=[RecordResult.model_validate(vars(r)) for r in results],
        run=runs.run(scope.db, scope.now, user, scope.workspace),
    )


@router.post("/checkin", response_model=CheckinOut)
def checkin(body: CheckinIn, scope: ScopeDep, user: Driver) -> CheckinOut:
    """Once a minute while the app is open, without a location: how the office knows the phone is in contact. Inside
    the story's outage it only tells the phone so: Relay notes nothing."""
    if story.no_signal(scope.workspace, user, scope.now) is None:
        field.switch_signal(scope.db, user, scope.now, on=False)
        back_from = field.touch_contact(scope.db, scope.now, user, body.device_id)
        if back_from is not None:
            field.back_in_contact(scope.db, scope.now, user, back_from, 0)
        scope.db.commit()
    return CheckinOut(now=scope.now, outage=story.outage(scope.workspace, user))


@router.put("/signal", status_code=status.HTTP_204_NO_CONTENT, tags=["demo"])
def switch_signal(body: SignalIn, scope: ScopeDep, user: Driver) -> None:
    """Demo mode: the demo bar's "no signal" switch on this driver's phone went on or off. While it is on, the phone
    sends nothing and Relay hears nothing from it, so the story's autopilot leaves the driver's phone to the judge
    holding it and a jump never plays a stop that phone may have saved. A record or a check-in from the phone ends it
    as well."""
    if not get_settings().demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo mode is off")
    field.switch_signal(scope.db, user, scope.now, on=body.on)
    scope.db.commit()


@router.post("/held", status_code=status.HTTP_204_NO_CONTENT, tags=["demo"])
def hold(body: HeldIn, scope: ScopeDep, user: Driver) -> None:
    """Demo mode, inside the story's outage only: what this phone saved with no signal joins the story's stand-in for
    the phone's memory, so a demo jump leaves those stops to this phone instead of playing them again. Relay applies
    nothing from it until the signal returns."""
    if not get_settings().demo_mode:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Demo mode is off")
    if story.no_signal(scope.workspace, user, scope.now) is None:
        raise HTTPException(status.HTTP_409_CONFLICT, "The phone has signal: send the records instead.")
    photos = [p.model_dump(mode="json", exclude={"stand_in"}) for p in body.photos]
    story.hold(scope.db, user, body.device_id, _records(body.records), photos)
    scope.db.commit()


@router.get("/held/photos/{photo_id}", tags=["demo"])
def held_photo(photo_id: uuid.UUID, scope: ScopeDep, user: Driver) -> Response:
    """A photo the story's autopilot took on this driver's phone in the storm, for the phone to keep with its record."""
    data = story.stand_in(scope.db, photo_id)
    if data is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such photo")
    return Response(content=data, media_type="image/png")


@router.put("/photos/{photo_id}", response_model=RecordResult)
async def put_photo(
    photo_id: uuid.UUID,
    scope: ScopeDep,
    user: Driver,
    file: Annotated[UploadFile, File()],
    taken_at: Annotated[datetime, Form()],
    stop_id: Annotated[uuid.UUID | None, Form()] = None,
    event_id: Annotated[uuid.UUID | None, Form()] = None,
    width: Annotated[int | None, Form()] = None,
    height: Annotated[int | None, Form()] = None,
) -> RecordResult:
    """A proof photo, resized on the phone to about 180 KB. Sent after its stop record; idempotent by its id."""
    _no_signal(scope.workspace, user, scope.now)
    data = await file.read(field.MAX_PHOTO_BYTES + 1)
    try:
        outcome = field.store_photo(
            scope.db,
            scope.now,
            user,
            photo_id,
            data,
            file.content_type or "image/jpeg",
            stop_id=stop_id,
            event_id=event_id,
            taken_at=taken_at,
            width=width,
            height=height,
        )
    except field.FieldError as exc:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, str(exc)) from exc
    scope.db.commit()
    return RecordResult.model_validate({"id": photo_id, "outcome": outcome})


@router.post("/notices/{notice_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_notice(notice_id: uuid.UUID, scope: ScopeDep, user: Driver) -> None:
    _no_signal(scope.workspace, user, scope.now)
    notice = scope.db.scalar(select(Notification).where(Notification.id == notice_id, Notification.user_id == user.id))
    if notice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such message")
    notice.read_at = notice.read_at or scope.now
    scope.db.commit()
