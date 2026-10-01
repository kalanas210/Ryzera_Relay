"""What Relay notices on its own as the clock runs: a driver's phone gone quiet on a running trip, and a question to a
driver that nobody has answered. Called on every tick and every jump, after the world has moved; idempotent."""

from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.models import AppUser, DeviceContact, FeedItem, FeedKind, Plan
from relay_api.services import field, words
from relay_api.services.estimates import SILENCE_MINUTES
from relay_api.services.notify import add_feed_item


def watch(db: Session, now: datetime) -> None:
    field.escalate_unanswered(db, now)
    open_silences = {
        item.ref.get("user_id"): item
        for item in db.scalars(select(FeedItem).where(FeedItem.kind == FeedKind.SILENCE, FeedItem.handled_at.is_(None)))
    }
    for contact in db.scalars(select(DeviceContact)):
        if now - contact.last_contact_at < timedelta(minutes=SILENCE_MINUTES):
            continue
        user = db.get(AppUser, contact.user_id)
        if user is None or str(user.id) in open_silences:
            continue
        trip = field.running_trip(db, user)
        if trip is None:
            continue
        plan = db.get(Plan, trip.plan_id)
        add_feed_item(
            db,
            contact.last_contact_at + timedelta(minutes=SILENCE_MINUTES),
            kind=FeedKind.SILENCE,
            depot=plan.depot if plan else "Kandy",
            title=f"No contact from {user.display_name.split()[0]} since {words.clock(contact.last_contact_at)}",
            body=f"{trip.vehicle_id}, {trip.district} run. Relay shows each store still to come with an estimate and "
            "a likely range until the phone is back.",
            ref={"user_id": str(user.id), "trip_id": str(trip.id), "since": contact.last_contact_at.isoformat()},
        )
