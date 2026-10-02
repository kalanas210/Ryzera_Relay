"""Seeding: the shared network and people once, then one copy of the story day per workspace."""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from relay_api.config import get_settings
from relay_api.models import Workspace
from relay_api.seed.reference import load_people, load_reference
from relay_api.seed.story import MAIN, create_workspace, held_at_start, reset_workspace

log = logging.getLogger("relay.seed")


def seed_all(db: Session) -> None:
    settings = get_settings()
    filled = load_reference(db, settings.seed_dir)
    if filled:
        log.info("Loaded %s", ", ".join(filled))
    people = load_people(db, settings.seed_dir, settings.seed_password)
    if people:
        log.info("Created %d people", people)
    main = db.scalar(select(Workspace).where(Workspace.code == MAIN))
    if main is None:
        create_workspace(db, settings.seed_dir, MAIN, "Shared walkthrough", is_default=True)
        log.info("Seeded the story day into workspace %s", MAIN)
    elif not held_at_start(main):
        # a shared copy from before its clock was held, run on in real time to a day long over
        reset_workspace(db, settings.seed_dir, main)
        log.info("Put workspace %s back to the start of the story", MAIN)
    db.commit()
