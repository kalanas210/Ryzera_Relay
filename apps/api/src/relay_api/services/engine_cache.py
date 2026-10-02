"""The engine's answers, kept by their exact inputs.

The planning engine is deterministic: the same orders, vehicles, conditions and usual runs always give the same
plan. A search takes 20 to 40 seconds on a desktop, and every judge's private copy of the day asks the same first
question, so the answer is stored under a hash of everything the engine reads, including the engine's own source.
Change any input, or the engine, and the key changes with it. `relay-api serve` fills the story day's first
answers in the background (see relay_api.cli.warm); a new fleet or new orders still make the engine search, and
the plan board shows that wait.

One key is searched once at a time. A Propose that asks while the warm-up, or another request, is already searching
for the same key waits on that key's advisory lock in PostgreSQL and then reads the answer, instead of running a
second search beside the first. While the warm-up runs it holds a lock of its own, which `warming_up` reports.
"""

from __future__ import annotations

import dataclasses
import enum
import hashlib
import json
from collections.abc import Iterator, Mapping
from contextlib import contextmanager
from datetime import UTC, datetime
from functools import cache
from importlib import resources
from typing import Any

from sqlalchemy import Engine, func, select, text
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from relay_api.models import EngineCache
from relay_engine.model import Deferred, GroupAnalysis
from relay_engine.model import Trip as EngineTrip
from relay_engine.propose import RunInput, propose


def _canonical(value: Any) -> Any:
    if dataclasses.is_dataclass(value) and not isinstance(value, type):
        return {f.name: _canonical(getattr(value, f.name)) for f in dataclasses.fields(value)}
    if isinstance(value, enum.Enum):
        return value.value
    if isinstance(value, Mapping):
        return sorted(([_canonical(k), _canonical(v)] for k, v in value.items()), key=lambda kv: json.dumps(kv[0]))
    if isinstance(value, set | frozenset):
        return sorted((_canonical(v) for v in value), key=json.dumps)
    if isinstance(value, list | tuple):
        return [_canonical(v) for v in value]
    if isinstance(value, float):
        return round(value, 6)
    return value


@cache
def engine_fingerprint() -> str:
    digest = hashlib.sha256()
    package = resources.files("relay_engine")
    for name in sorted(p.name for p in package.iterdir() if p.name.endswith(".py")):
        digest.update(name.encode())
        digest.update(package.joinpath(name).read_bytes())
    return digest.hexdigest()


def proposal_key(run: RunInput) -> str:
    payload = json.dumps({"engine": engine_fingerprint(), "run": _canonical(run)}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()


@dataclasses.dataclass(frozen=True)
class Answer:
    trips: list[EngineTrip]
    deferred: list[Deferred]
    analyses: list[GroupAnalysis]


SEARCHING = 7101
"""The class of the advisory lock that one search for a key holds, with the key's first 32 bits as its id."""
WARMING = 7102
"""The class of the advisory lock the warm-up holds while it runs (id 0)."""


def _lock_id(key: str) -> int:
    return int.from_bytes(bytes.fromhex(key[:8]), "big", signed=True)


def propose_cached(db: Session, run: RunInput) -> Answer:
    key = proposal_key(run)
    row = db.get(EngineCache, key)
    if row is not None:
        return _decode(row.result)
    # The search runs on a connection of its own, holding the key's lock, and keeps its answer there: the answer is
    # stored and the lock let go together, so whoever waited on the lock finds the answer, whatever the caller's own
    # transaction does next.
    with db.get_bind().engine.connect() as conn, conn.begin():
        conn.execute(select(func.pg_advisory_xact_lock(SEARCHING, _lock_id(key))))
        kept = conn.scalar(select(EngineCache.result).where(EngineCache.key == key))
        if kept is not None:
            return _decode(kept)
        result = propose(run)
        answer = Answer(result.trips, result.deferred, result.analyses)
        conn.execute(
            insert(EngineCache)
            .values(key=key, depot=run.depot, created_at=datetime.now(UTC), result=_encode(answer))
            .on_conflict_do_nothing()
        )
    return answer


@contextmanager
def warming(engine: Engine) -> Iterator[None]:
    """Hold the warm-up's lock while the block runs. A shared lock, so two processes warming at once both count,
    and PostgreSQL lets it go by itself if the process dies."""
    with engine.connect() as conn, conn.begin():
        conn.execute(select(func.pg_advisory_xact_lock_shared(WARMING, 0)))
        yield


def warming_up(db: Session) -> bool:
    """Whether a warm-up is still asking the engine the story day's first questions. A Propose that starts now may
    wait for the warm-up's answer, up to half a minute, rather than be quick."""
    held = db.scalar(
        text(
            "select exists (select 1 from pg_locks where locktype = 'advisory' and granted"
            " and database = (select oid from pg_database where datname = current_database())"
            " and classid = :class and objid = 0 and objsubid = 2)"
        ),
        {"class": WARMING},
    )
    return bool(held)


def _encode(answer: Answer) -> dict[str, Any]:
    return {
        "trips": [dataclasses.asdict(t) for t in answer.trips],
        "deferred": [dataclasses.asdict(d) for d in answer.deferred],
        "analyses": [dataclasses.asdict(a) for a in answer.analyses],
    }


def _decode(data: dict[str, Any]) -> Answer:
    return Answer(
        trips=[EngineTrip(**t) for t in data["trips"]],
        deferred=[Deferred(**d) for d in data["deferred"]],
        analyses=[GroupAnalysis(**a) for a in data["analyses"]],
    )
