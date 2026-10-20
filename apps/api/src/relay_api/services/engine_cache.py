"""The engine's answers, stored under a hash of every input and the engine's own source."""

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


# Advisory lock classes. SEARCHING is held per key, WARMING by the warm-up while it runs.
SEARCHING = 7101
WARMING = 7102


def _lock_id(key: str) -> int:
    return int.from_bytes(bytes.fromhex(key[:8]), "big", signed=True)


def propose_cached(db: Session, run: RunInput) -> Answer:
    key = proposal_key(run)
    row = db.get(EngineCache, key)
    if row is not None:
        return _decode(row.result)
    # A search takes 20 to 40 seconds, so each key is searched once. Others wait on its lock.
    # It uses its own connection, so the answer is stored and the lock let go together.
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
    with engine.connect() as conn, conn.begin():
        conn.execute(select(func.pg_advisory_xact_lock_shared(WARMING, 0)))
        yield


def warming_up(db: Session) -> bool:
    # True while a warm-up runs. A Propose that starts now may wait up to half a minute.
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
