"""The engine cache when two askers race: on a fresh install the warm-up and a judge's first Propose can ask the
engine the same question at once. The second waits for the first one's answer instead of searching beside it, a
different question never waits, a failed search leaves the next asker free to search, and /api/health says while
the warm-up is still running."""

from __future__ import annotations

import threading
import time
import uuid
from collections.abc import Callable
from types import SimpleNamespace
from typing import Any, cast

import pytest

from relay_engine.clock import Conditions
from relay_engine.model import Trip
from relay_engine.network import Network
from relay_engine.propose import RunInput

WAIT = 10.0


def question() -> RunInput:
    """A question no earlier run has asked. Only its key matters here: the engine is stood in for."""
    return RunInput(
        network=cast(Network, None),
        depot="Kandy",
        orders=[],
        vehicles=[],
        usual={},
        conditions=cast(Conditions, None),
        protected={uuid.uuid4().hex},
    )


class Search:
    """Stands in for the engine: counts its searches, and holds each one until `go` (or `meet`, when two must be
    searching at the same time) lets it finish."""

    def __init__(self, *, meet: int = 0, fail_first: bool = False) -> None:
        self.calls = 0
        self.started = threading.Event()
        self.go = threading.Event()
        self.meeting = threading.Barrier(meet) if meet else None
        self.fail_first = fail_first

    def __call__(self, run: RunInput) -> Any:
        self.calls += 1
        self.started.set()
        if self.fail_first and self.calls == 1:
            raise RuntimeError("the search failed")
        if self.meeting is not None:
            self.meeting.wait(WAIT)
        else:
            assert self.go.wait(WAIT)
        return SimpleNamespace(trips=[Trip("VEH045", 1, [run.depot], 300)], deferred=[], analyses=[])


@pytest.fixture
def ask(database: None) -> Callable[[RunInput, dict[str, Any], str], threading.Thread]:
    """Ask in a thread of its own, with a session of its own, as two requests (or the warm-up) do."""
    from relay_api.db import SessionLocal
    from relay_api.services.engine_cache import propose_cached

    def start(run: RunInput, out: dict[str, Any], who: str) -> threading.Thread:
        def work() -> None:
            try:
                with SessionLocal() as db:
                    out[who] = propose_cached(db, run)
            except Exception as exc:
                out[who] = exc

        thread = threading.Thread(target=work, daemon=True)
        thread.start()
        return thread

    return start


def waiting_on_a_search() -> bool:
    """Whether some connection is waiting for a search's lock (and so is not searching itself)."""
    from sqlalchemy import text

    from relay_api.db import SessionLocal
    from relay_api.services.engine_cache import SEARCHING

    with SessionLocal() as db:
        return bool(
            db.scalar(
                text(
                    "select exists (select 1 from pg_locks where locktype = 'advisory' and not granted"
                    " and database = (select oid from pg_database where datname = current_database())"
                    " and classid = :class)"
                ),
                {"class": SEARCHING},
            )
        )


def test_a_second_ask_for_the_same_plan_waits_for_the_first_answer(
    ask: Callable[..., threading.Thread], monkeypatch: pytest.MonkeyPatch
) -> None:
    from relay_api.db import SessionLocal
    from relay_api.services import engine_cache

    search = Search()
    monkeypatch.setattr(engine_cache, "propose", search)
    run, out = question(), {}
    try:
        warm_up = ask(run, out, "warm-up")
        assert search.started.wait(WAIT)
        judge = ask(run, out, "judge")
        deadline = time.monotonic() + WAIT
        while not waiting_on_a_search():
            assert time.monotonic() < deadline, "the second ask never waited for the first search"
            time.sleep(0.05)
        assert search.calls == 1
    finally:
        search.go.set()
    warm_up.join(WAIT)
    judge.join(WAIT)

    assert search.calls == 1
    assert isinstance(out["warm-up"], engine_cache.Answer)
    assert out["judge"] == out["warm-up"]
    with SessionLocal() as db:  # and from now on the answer is simply read
        assert engine_cache.propose_cached(db, run) == out["warm-up"]
    assert search.calls == 1


def test_different_questions_search_side_by_side(
    ask: Callable[..., threading.Thread], monkeypatch: pytest.MonkeyPatch
) -> None:
    from relay_api.services import engine_cache

    search = Search(meet=2)  # each search finishes only once the other has started
    monkeypatch.setattr(engine_cache, "propose", search)
    out: dict[str, Any] = {}
    threads = [ask(question(), out, "kandy"), ask(question(), out, "peliyagoda")]
    for thread in threads:
        thread.join(WAIT * 2)

    assert search.calls == 2
    assert all(isinstance(answer, engine_cache.Answer) for answer in out.values()), out


def test_a_failed_search_keeps_nothing_and_lets_the_next_ask_search(
    ask: Callable[..., threading.Thread], monkeypatch: pytest.MonkeyPatch
) -> None:
    from relay_api.services import engine_cache

    search = Search(fail_first=True)
    search.go.set()
    monkeypatch.setattr(engine_cache, "propose", search)
    run, out = question(), {}
    ask(run, out, "first").join(WAIT)
    again = ask(run, out, "again")
    again.join(WAIT)

    assert not again.is_alive(), "the failed search kept its lock"
    assert isinstance(out["first"], RuntimeError)
    assert isinstance(out["again"], engine_cache.Answer)
    assert search.calls == 2


def test_health_says_while_the_warm_up_is_running(database: None) -> None:
    from fastapi.testclient import TestClient

    from relay_api.db import engine
    from relay_api.main import app
    from relay_api.services.engine_cache import warming

    client = TestClient(app)  # no `with`: the background simulator stays off
    assert client.get("/api/health").json() == {"status": "ok", "warming": False}
    with warming(engine):
        assert client.get("/api/health").json() == {"status": "ok", "warming": True}
    assert client.get("/api/health").json() == {"status": "ok", "warming": False}
