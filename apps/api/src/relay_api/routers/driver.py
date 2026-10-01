"""The driver's phone (DRV-01 to DRV-05): the run, the outbox's records, proof photos and the minute check-in."""

from __future__ import annotations

import uuid
from datetime import datetime
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select

from relay_api.models import AppUser, FieldEventKind, Notification, Role
from relay_api.schemas.driver import CheckinIn, CheckinOut, DriverRunOut, RecordResult, RecordsIn, RecordsOut
from relay_api.security import require
from relay_api.services import driver as runs
from relay_api.services import field
from relay_api.workspaces import ScopeDep

router = APIRouter(prefix="/api/driver", tags=["driver"])
Driver = Annotated[AppUser, Depends(require(Role.DRIVER))]


@router.get("/run", response_model=DriverRunOut)
def get_run(scope: ScopeDep, user: Driver) -> DriverRunOut:
    data = runs.run(scope.db, scope.now, user, scope.workspace)
    scope.db.commit()  # held messages are now handed over
    return data


@router.post("/records", response_model=RecordsOut)
def post_records(body: RecordsIn, scope: ScopeDep, user: Driver) -> RecordsOut:
    """Records from the phone's outbox, in the order the phone saved them. Idempotent by each record's id: a resend
    is answered "duplicate" and changes nothing."""
    records = [
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
        for r in body.records
    ]
    results = field.receive(scope.db, scope.now, user, body.device_id, records)
    scope.db.commit()
    return RecordsOut(
        results=[RecordResult(id=r.id, outcome=r.outcome.value, reason=r.reason) for r in results],  # type: ignore[arg-type]
        run=runs.run(scope.db, scope.now, user, scope.workspace),
    )


@router.post("/checkin", response_model=CheckinOut)
def checkin(body: CheckinIn, scope: ScopeDep, user: Driver) -> CheckinOut:
    """Once a minute while the app is open, without a location: how the office knows the phone is in contact."""
    back_from = field.touch_contact(scope.db, scope.now, user, body.device_id)
    if back_from is not None:
        field.back_in_contact(scope.db, scope.now, user, back_from, 0)
    scope.db.commit()
    outage = (scope.workspace.state.get("outages") or {}).get(user.username)
    return CheckinOut(
        now=scope.now, outage={k: datetime.fromisoformat(v) for k, v in outage.items()} if outage else None
    )


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
    return RecordResult(id=photo_id, outcome=outcome.value)  # type: ignore[arg-type]


@router.post("/notices/{notice_id}/read", status_code=status.HTTP_204_NO_CONTENT)
def read_notice(notice_id: uuid.UUID, scope: ScopeDep, user: Driver) -> None:
    notice = scope.db.scalar(select(Notification).where(Notification.id == notice_id, Notification.user_id == user.id))
    if notice is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such message")
    notice.read_at = notice.read_at or scope.now
    scope.db.commit()
