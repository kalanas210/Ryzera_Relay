"""The order queue's Not ordered panel (DSP-01), through the API: Remind and Remind all put a notice with the cutoff in
each store's Relay app, a second press soon after sends nothing new, a store that ordered meanwhile is left out, and
the queue shows when each store was reminded."""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from copy_client import Copy


def _queue(copy: Copy) -> Any:
    return copy.get("/api/dispatch/queue", "dispatcher")


def test_remind_tells_each_store_once_and_the_queue_shows_it(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("queue")
    copy.sign_in("nuwan", "dispatcher")
    missing = [n["outlet_id"] for n in _queue(copy)["not_ordered"]]
    assert missing
    assert all(n["reminded_at"] is None for n in _queue(copy)["not_ordered"])

    first = copy.post("/api/dispatch/reminders", {"outlet_ids": [missing[0], "OUT117"]}, "dispatcher")
    # OUT117 Hemmathagama ordered already: only the store still missing an order is reminded
    assert [r["outlet_id"] for r in first] == [missing[0]]

    every = copy.post("/api/dispatch/reminders", {"outlet_ids": missing}, "dispatcher")
    assert [r["outlet_id"] for r in every] == missing
    # the store reminded a moment ago keeps its first reminder: nothing new is sent
    assert every[0]["reminded_at"] == first[0]["reminded_at"]

    rows = {n["outlet_id"]: n for n in _queue(copy)["not_ordered"]}
    assert {oid: rows[oid]["reminded_at"] is not None for oid in missing} == dict.fromkeys(missing, True)
    # no store manager on the list has a number on record, so the panel offers no Call
    assert all(rows[oid]["phone"] is None for oid in missing)


def test_the_reminder_reaches_the_store_with_the_cutoff(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("orders")
    copy.sign_in("nuwan", "dispatcher")
    copy.sign_in("dilani", "store_manager")
    # the story starts at 2:05 PM, before Hemmathagama orders at 2:10
    assert "OUT117" in [n["outlet_id"] for n in _queue(copy)["not_ordered"]]
    copy.post("/api/dispatch/reminders", {"outlet_ids": ["OUT117"]}, "dispatcher")
    [notice] = [n for n in copy.get("/api/store/notices", "store_manager") if n["kind"] == "cutoff_reminder"]
    assert notice["title"] == "Your Wednesday order isn't in yet"
    assert "close at 4:00 PM today" in notice["body"]
    assert "goes on Thursday's run" in notice["body"]


def test_remind_after_the_cutoff_is_refused(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("cutoff")
    copy.sign_in("nuwan", "dispatcher")
    copy.post("/api/dispatch/reminders", {"outlet_ids": ["OUT012"]}, "dispatcher", expect=409)
