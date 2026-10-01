from __future__ import annotations

import asyncio
import contextlib
import logging
from collections.abc import AsyncIterator
from datetime import UTC, datetime, timedelta

from fastapi import Depends, FastAPI
from fastapi.responses import JSONResponse
from sqlalchemy import select, text

from relay_api.db import SessionLocal
from relay_api.models import Workspace
from relay_api.routers import auth, demo, dispatch, dock, driver, live, photos, plan, runs, store
from relay_api.security import require_client_header
from relay_api.services.simulator import catch_up

log = logging.getLogger("relay")


async def _simulate_forever() -> None:
    """Keep every recently used copy of the day moving, even when nobody is looking at it."""
    while True:
        await asyncio.sleep(2)
        try:
            await asyncio.to_thread(_tick)
        except Exception:
            log.exception("Simulator tick failed")


def _tick() -> None:
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
    with SessionLocal() as db:
        db.execute(text("select 1"))
    return JSONResponse({"status": "ok"})
