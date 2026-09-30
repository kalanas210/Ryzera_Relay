"""relay-api migrate | seed | serve"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from alembic import command
from alembic.config import Config

API_ROOT = Path(__file__).resolve().parents[2]


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


def serve(host: str, port: int, workers: int) -> None:
    import uvicorn

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
    run = sub.add_parser("serve", help="run the API")
    run.add_argument("--host", default="0.0.0.0")
    run.add_argument("--port", type=int, default=8000)
    run.add_argument("--workers", type=int, default=1)
    args = parser.parse_args()
    if args.command in ("migrate", "setup"):
        migrate()
    if args.command in ("seed", "setup"):
        seed()
    if args.command == "serve":
        serve(args.host, args.port, args.workers)
