from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import select
from starlette.exceptions import HTTPException
from starlette.types import ASGIApp, Message, Receive, Scope, Send

from relay_api.db import SessionLocal
from relay_api.models import Workspace
from relay_api.routers import auth, demo, dispatch, dock, driver, live, photos, plan, runs, store
from relay_api.security import require_client_header
from relay_api.services.engine_cache import warming_up
from relay_api.services.simulator import catch_up

log = logging.getLogger("relay")

# A proof photo plus its form. Caddy sets the same limit in front of the deployed API.
MAX_BODY_BYTES = 2_000_000
TOO_LARGE = "This is too large for Relay to take."


class LimitBody:
    def __init__(self, app: ASGIApp, limit: int) -> None:
        self.app = app
        self.limit = limit

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return
        length = dict(scope["headers"]).get(b"content-length")
        if length is not None and (not length.isdigit() or int(length) > self.limit):
            await JSONResponse({"detail": TOO_LARGE}, status_code=413)(scope, receive, send)
            return
        seen = 0

        async def counted() -> Message:
            nonlocal seen
            message = await receive()
            if message["type"] == "http.request":
                seen += len(message.get("body", b""))
                if seen > self.limit:
                    raise HTTPException(413, TOO_LARGE)
            return message

        await self.app(scope, counted, send)


async def _simulate_forever() -> None:
    while True:
        await asyncio.sleep(2)
        try:
            await asyncio.to_thread(_tick)
        except Exception:
            log.exception("Simulator tick failed")


def _tick() -> None:
    # Copies used in the last 6 hours keep moving, even when nobody is looking.
    cutoff = datetime.now(UTC) - timedelta(hours=6)
    with SessionLocal() as db:
        workspaces = db.scalars(select(Workspace).where(Workspace.last_active_at > cutoff)).all()
        for ws in workspaces:
            catch_up(db, ws)


@contextlib.asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    task = asyncio.create_task(_simulate_forever())
    yield
    task.cancel()


app = FastAPI(
    title="Relay API",
    version="0.1.0",
    summary="Delivery planning for Waypoint Group: orders, plans, loads, runs and receipts across four roles.",
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
    lifespan=lifespan,
    dependencies=[Depends(require_client_header)],
)

app.add_middleware(LimitBody, limit=MAX_BODY_BYTES)

app.include_router(auth.router)
app.include_router(demo.router)
app.include_router(store.router)
app.include_router(dispatch.router)
app.include_router(plan.router)
app.include_router(live.router)
app.include_router(dock.router)
app.include_router(runs.router)
app.include_router(driver.router)
app.include_router(photos.router)


@app.get("/api/health", tags=["health"])
def health() -> JSONResponse:
    """Up once the database answers. `warming` is true while the startup warm-up is still running."""
    with SessionLocal() as db:
        warming = warming_up(db)
    return JSONResponse({"status": "ok", "warming": warming})
