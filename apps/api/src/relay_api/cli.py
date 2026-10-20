"""relay-api migrate | seed | setup | warm | serve"""

from __future__ import annotations

import argparse
import logging
import multiprocessing
import time
from pathlib import Path

from alembic import command
from alembic.config import Config

API_ROOT = Path(__file__).resolve().parents[2]

log = logging.getLogger("relay_api.cli")


def alembic_config() -> Config:
    cfg = Config(str(API_ROOT / "alembic.ini"))
    cfg.set_main_option("script_location", str(API_ROOT / "migrations"))
    return cfg


def migrate() -> None:
    command.upgrade(alembic_config(), "head")


def seed() -> None:
    from relay_api.db import SessionLocal
    from relay_api.seed import seed_all

    with SessionLocal() as db:
        seed_all(db)


def warm() -> None:
    # Fills the engine cache with the story day's first plans, so the first Propose is quick.
    from sqlalchemy import delete

    from relay_api.clock import sim_now
    from relay_api.config import get_settings
    from relay_api.db import SessionLocal, engine, scope_to_workspace
    from relay_api.models import Workspace
    from relay_api.seed.story import create_workspace
    from relay_api.services import planning, story
    from relay_api.services.engine_cache import warming
    from relay_api.services.ordering import current_run
    from relay_api.services.simulator import catch_up
    from relay_api.workspaces import find_workspace, new_code

    started = time.perf_counter()
    with warming(engine), SessionLocal() as db:
        code = new_code()
        while find_workspace(db, code) is not None:
            code = new_code()
        scratch = create_workspace(db, get_settings().seed_dir, code, "Engine cache warm-up")
        db.commit()
        try:
            # Same jump a judge makes, so the cache key matches the one they will ask for.
            catch_up(db, scratch, story.moment_time("plan"), jumped_from=sim_now(scratch))
            scope_to_workspace(db, scratch.id)
            now = sim_now(scratch)
            planning.propose_plan(db, now, planning.get_plan(db, "Peliyagoda", current_run(db, now)))
            db.commit()
        finally:
            db.rollback()
            db.execute(delete(Workspace).where(Workspace.id == scratch.id))
            db.commit()
    log.info("Engine cache warm for the story day in %.0f s", time.perf_counter() - started)


def _warm_quietly() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    try:
        warm()
    except Exception:  # a cold cache only slows the first Propose, it must not stop the API
        log.exception("Warming the engine cache failed")


def serve(host: str, port: int, workers: int) -> None:
    import uvicorn

    # A process, not a thread. The search is heavy and requests keep the GIL.
    multiprocessing.Process(target=_warm_quietly, name="relay-warm", daemon=True).start()
    uvicorn.run(
        "relay_api.main:app", host=host, port=port, workers=workers, proxy_headers=True, forwarded_allow_ips="*"
    )


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    parser = argparse.ArgumentParser(prog="relay-api")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("migrate", help="apply database migrations")
    sub.add_parser("seed", help="load the network, the people and the story day, if missing")
    sub.add_parser("setup", help="migrate, then seed")
    sub.add_parser("warm", help="fill the engine cache with the story day's first proposals")
    run = sub.add_parser("serve", help="run the API, warming the engine cache alongside")
    run.add_argument("--host", default="0.0.0.0")
    run.add_argument("--port", type=int, default=8000)
    run.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    if args.command in ("migrate", "setup"):
        migrate()
    if args.command in ("seed", "setup"):
        seed()
    if args.command == "warm":
        warm()
    if args.command == "serve":
        serve(args.host, args.port, args.workers)


if __name__ == "__main__":
    main()
