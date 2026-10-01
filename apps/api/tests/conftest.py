"""API tests run against a real PostgreSQL, the same database the app uses.

A throwaway database is created for the run, migrated and seeded like a fresh install, and dropped at the end.
RELAY_TEST_ADMIN_URL names a server where the user may create databases (the compose database or the local dev
one). Without a reachable server the API tests are skipped and the engine tests still run.
"""

from __future__ import annotations

import os
import uuid
from collections.abc import Callable, Iterator

import pytest
from copy_client import Copy
from sqlalchemy.engine import make_url

ADMIN_URL = os.environ.get("RELAY_TEST_ADMIN_URL", "postgresql://relay:relay@localhost:55432/postgres")
TEST_DB = f"relay_test_{uuid.uuid4().hex[:8]}"

# Settings are read once, at first import of relay_api, so the test database is named before anything imports it.
_test_url = make_url(ADMIN_URL).set(drivername="postgresql+psycopg", database=TEST_DB)
os.environ["RELAY_DATABASE_URL"] = _test_url.render_as_string(hide_password=False)
os.environ.setdefault("RELAY_SECRET_KEY", "test-only-secret-key-at-least-32-bytes-long")


@pytest.fixture(scope="session")
def database() -> Iterator[None]:
    import psycopg

    try:
        admin = psycopg.connect(ADMIN_URL, autocommit=True, connect_timeout=3)
    except psycopg.OperationalError as exc:
        pytest.skip(f"No PostgreSQL for the API tests at RELAY_TEST_ADMIN_URL ({exc.__class__.__name__})")
    with admin:
        admin.execute(f'CREATE DATABASE "{TEST_DB}"')

    from relay_api.cli import migrate
    from relay_api.db import SessionLocal, engine
    from relay_api.seed import seed_all

    migrate()
    with SessionLocal() as db:
        seed_all(db)
    yield
    engine.dispose()
    with psycopg.connect(ADMIN_URL, autocommit=True) as admin:
        admin.execute(f'DROP DATABASE IF EXISTS "{TEST_DB}" WITH (FORCE)')


@pytest.fixture
def new_copy(database: None) -> Callable[[], Copy]:
    from fastapi.testclient import TestClient

    from relay_api.main import app

    def make() -> Copy:
        # no `with`: the background simulator stays off, so every change in a test comes from the test itself
        return Copy(TestClient(app, headers={"X-Relay-Client": "web"}))

    return make
