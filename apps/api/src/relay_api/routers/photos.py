"""Photos, for whoever may see them: a proof photo for the driver who took it, the store it was taken at and the
dispatcher; a photo of damaged cases for the dock and the dispatcher."""

from __future__ import annotations

import uuid

from fastapi import APIRouter, HTTPException, Response, status
from sqlalchemy import select

from relay_api.models import Photo, Role, Shortfall, Stop
from relay_api.security import CurrentUser
from relay_api.workspaces import ScopeDep

router = APIRouter(prefix="/api/photos", tags=["photos"])


@router.get("/{photo_id}")
def get_photo(photo_id: uuid.UUID, scope: ScopeDep, user: CurrentUser) -> Response:
    photo = scope.db.get(Photo, photo_id)
    if photo is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such photo")
    stop = scope.db.get(Stop, photo.stop_id) if photo.stop_id else None
    allowed = (
        user.role is Role.DISPATCHER
        or photo.uploaded_by == user.id
        or (user.role is Role.STORE_MANAGER and stop is not None and stop.outlet_id == user.outlet_id)
        or (
            user.role is Role.LOADER
            and scope.db.scalar(select(Shortfall.id).where(Shortfall.photo_id == photo.id)) is not None
        )
    )
    if not allowed:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No such photo")
    return Response(
        content=photo.data,
        media_type=photo.content_type,
        headers={"Cache-Control": "private, max-age=86400, immutable"},
    )
