"""What Relay notices on its own: a driver's phone gone quiet, and a question nobody answered."""

from __future__ import annotations

import uuid
from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from relay_api.models import AppUser, DeviceContact, FeedItem, FeedKind, Plan, Trip, VehicleDay
from relay_api.services import field, words
from relay_api.services.estimates import SILENCE_MINUTES
from relay_api.services.notify import add_feed_item


def watch(db: Session, now: datetime) -> None:
    field.escalate_unanswered(db, now)
    # Freshest contact per phone. A stale second row from two first check-ins is not silence.
    last = func.max(DeviceContact.last_contact_at)
    quiet_users: dict[uuid.UUID, datetime] = dict(
        db.execute(
            select(DeviceContact.user_id, last)
            .group_by(DeviceContact.user_id)
            .having(last <= now - timedelta(minutes=SILENCE_MINUTES))
        ).all()
    )
    if quiet_users:
        drivers = _at_the_wheel(db)
        quiet_users = {u: at for u, at in quiet_users.items() if u in drivers}
    if not quiet_users:
        return
    open_silences = {
        item.ref.get("user_id"): item
        for item in db.scalars(select(FeedItem).where(FeedItem.kind == FeedKind.SILENCE, FeedItem.handled_at.is_(None)))
    }
    for user_id, since in quiet_users.items():
        user = db.get(AppUser, user_id)
        if user is None or str(user.id) in open_silences:
            continue
        trip = field.running_trip(db, user)
        if trip is None:
            continue
        plan = db.get(Plan, trip.plan_id)
        add_feed_item(
            db,
            since + timedelta(minutes=SILENCE_MINUTES),
            kind=FeedKind.SILENCE,
            depot=plan.depot if plan else "Kandy",
            title=f"No contact from {user.display_name.split()[0]} since {words.clock(since)}",
            body=f"{trip.vehicle_id}, {trip.district} run. Relay shows each store still to come with an estimate and "
            "a likely range until the phone is back.",
            ref={"user_id": str(user.id), "trip_id": str(trip.id), "since": since.isoformat()},
        )


def _at_the_wheel(db: Session) -> set[uuid.UUID | None]:
    # Only drivers on a trip now. Finished drivers have quiet phones and would all look silent.
    vehicles = set(db.scalars(select(Trip.vehicle_id).where(Trip.departed_at.is_not(None), Trip.finished_at.is_(None))))
    if not vehicles:
        return set()
    drivers = set(db.scalars(select(VehicleDay.driver_id).where(VehicleDay.vehicle_id.in_(vehicles))))
    drivers |= set(db.scalars(select(AppUser.id).where(AppUser.vehicle_id.in_(vehicles))))
    return drivers
