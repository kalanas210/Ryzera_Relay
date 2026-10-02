"""The capacity outlook (DSP-05) through the API: at 6:45 PM on Tuesday, just after the Kandy plan is published, every
figure on the drawn frame comes out of the seeded forecast, the live order book and the plan board's vehicles, and
Peliyagoda says plainly that it has no forecast yet. Below those, the wording for forecasts the scenario never has."""

from __future__ import annotations

from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

from copy_client import Copy

from relay_api.models import CalendarDay
from relay_api.schemas.outlook import OutlookDayOut
from relay_api.services import outlook as service


def _outlook(copy: Copy, depot: str = "Kandy") -> Any:
    return copy.get(f"/api/dispatch/outlook?depot={depot}", "dispatcher")


def _plain(text: str) -> str:
    """The page keeps a day and its month, or a number and its unit, together with no-break spaces."""
    return text.replace("\u00a0", " ")


def _at_6_45(new_copy: Callable[[], Copy]) -> Copy:
    copy = new_copy()
    copy.jump("evening")  # 6:41 PM: the Kandy plan is published, one chilled order waits
    copy.advance(4)
    copy.sign_in("nuwan", "dispatcher")
    return copy


def test_the_weeks_as_drawn(new_copy: Callable[[], Copy]) -> None:
    outlook = _outlook(_at_6_45(new_copy))
    weeks = outlook["weeks"]

    assert [w["iso_week"] for w in weeks] == [15, 16, 17, 18, 19, 20]
    assert [(w["first_day"], w["last_day"]) for w in weeks][::5] == [
        ("2026-04-06", "2026-04-12"),
        ("2026-05-11", "2026-05-17"),
    ]
    assert [w["open_days"] for w in weeks] == [6, 4, 6, 5, 6, 6]
    assert [(w["chip"] or {}).get("label") for w in weeks] == [
        "New Year ramp",
        "New Year",
        "Vesak ramp",
        "Vesak",
        None,
        None,
    ]
    assert [(w["chip"] or {}).get("tone") for w in weeks][:4] == ["attention", "neutral", "attention", "attention"]
    assert [[_plain(line) for line in w["lines"]] for w in weeks] == [
        [],
        ["Closed Mon 13 and Tue 14"],
        ["From Wed 22 Apr", "Payday Sat 25 Apr"],
        ["Payday Thu 30 Apr", "Closed Fri 1 May"],
        [],
        [],
    ]
    demand = [w["demand"] for w in weeks]
    assert [d["chilled"] for d in demand] == [267.3, 133.2, 200.1, 188.6, 188.1, 188.3]
    assert [d["dry"] for d in demand] == [477.3, 230.4, 357.4, 333.5, 337.3, 337.7]
    assert [d["style"] for d in demand] == [118.0, 52.2, 78.2, 80.4, 75.2, 75.2]
    assert [d["tech"] for d in demand] == [22.4, 21.3, 22.4, 18.2, 22.4, 22.4]
    assert [d["all"] for d in demand] == [885.0, 437.1, 658.1, 620.7, 623.0, 623.6]

    # one load per refrigerated vehicle in service per open day: VEH039 and VEH058 are out from Monday to Wednesday
    assert [w["chilled_limit_m3"] for w in weeks] == [765.3, 584.0, 876.0, 730.0, 876.0, 876.0]
    assert [w["chilled_pct"] for w in weeks] == [34.9, 22.8, 22.8, 25.8, 21.5, 21.5]


def test_the_vehicles_needed_on_each_weeks_busiest_day(new_copy: Callable[[], Copy]) -> None:
    weeks = _outlook(_at_6_45(new_copy))["weeks"]
    busiest = [w["busiest"] for w in weeks]

    assert [b["date"] for b in busiest] == [
        "2026-04-08",
        "2026-04-15",
        "2026-04-22",
        "2026-04-29",
        "2026-05-06",
        "2026-05-13",
    ]
    assert [(b["needed"], b["available"], b["state"]) for b in busiest] == [(6, 5, "over")] + [(6, 7, "limit")] * 5
    assert busiest[0]["segments"] == {"filled": 5, "short": 1, "standby": 0, "workshop": 1}
    assert busiest[0]["in_workshop"] == ["VEH039", "VEH058"]
    assert busiest[3]["segments"] == {"filled": 6, "short": 0, "standby": 1, "workshop": 0}
    assert [b["chilled_kg"] for b in busiest] == [8144.5, 5958.8, 6015.1, 7510.9, 5980.5, 5987.5]
    assert [b["chilled_orders"] for b in busiest] == [23] * 6
    assert [b["headline"] for b in busiest] == [False, False, False, True, False, False]

    # 8 April is the run being planned: its row is the order book, with the order the plan lets wait
    assert (busiest[0]["from_order_book"], busiest[0]["waits"]) == (True, 1)
    assert not any(b["from_order_book"] for b in busiest[1:])


def test_the_answer_arrange_card_and_notes(new_copy: Callable[[], Copy]) -> None:
    outlook = _outlook(_at_6_45(new_copy))
    headline = outlook["headline"]

    assert (headline["date"], headline["needed"], headline["available"], headline["state"]) == (
        "2026-04-29",
        6,
        7,
        "limit",
    )
    assert _plain(headline["title"]) == (
        "Wednesday 29 April is the heaviest of the 5 Wednesdays ahead, and like each of them it needs 6 of the "
        "7 refrigerated vehicles."
    )
    assert headline["detail"] == "The seventh is the standby and nothing is spare: keep all 7 in service that day."
    assert _plain(headline["support"]) == "The heaviest Wednesday ahead: 7,510.9 kg chilled (Vesak ramp, payday week)"
    assert [(f["value"], _plain(f["label"]), f["tone"]) for f in outlook["key_figures"]] == [
        ("6 of 7", "refrigerated vehicles needed, Wed 29 Apr, as on every Wednesday ahead", "attention"),
        ("22 of 23", "chilled orders five refrigerated vehicles can serve on a Wednesday", "neutral"),
    ]
    assert [_plain(line) for line in outlook["arrange"]] == [
        "Book refrigerated servicing away from Wednesdays: on Relay's clock every Wednesday needs 6 of 7",
        "Keep all 7 in service on Wednesday 29 April (Vesak ramp, payday week)",
        "Tell stores early when a refrigerated vehicle is out",
    ]
    assert [_plain(note) for note in outlook["notes"]] == [
        "Space is not the limit: week 15's chilled volume is 34.9% of one load per refrigerated vehicle per open "
        "day. The number of stores and their windows before 8 AM are. Saturday 11 April carries 10,857.6 kg and "
        "needs 5.",
        "Needed is the fewest refrigerated vehicles that carry every chilled order that day on Relay's clock, where "
        "a vehicle is in one place at a time. One out on a Wednesday means no standby; two out means a chilled "
        "order waits, as on 8 April.",
    ]
    method = _plain(" ".join(outlook["method"]))
    assert "In April to June 2025 this method missed Kandy Fresh by 2.7% a week on average, against 11.1%" in method
    assert "2:00 AM earliest, 10 minutes to reload" in method
    assert (
        "Wednesdays need 6, Mondays and Thursdays 5, most other days 4 (the New Year and payday Saturdays, "
        "11 and 25 April, need 5)." in method
    )
    assert (
        "Week 15 carries the New Year ramp: 267.3 m³ chilled, 1.41 times an ordinary 2026 week (189.0 m³); the "
        "week before New Year 2025 was Kandy's highest chilled week on record at 260.2 m³." in method
    )
    assert [_plain(v) for v in outlook["labels"].values()] == [
        "Against the Kandy hub's refrigerated fleet",
        "On the week's busiest day. The seventh is the standby.",
        "8 April from the order book, the rest forecast",
        "One Kandy Tech order can be 15 m³",
    ]
    assert outlook["forecast_updated"] == "2026-04-06"


def test_the_run_row_agrees_with_the_queue_and_the_drawer(new_copy: Callable[[], Copy]) -> None:
    copy = _at_6_45(new_copy)
    run = _outlook(copy)["weeks"][0]["busiest"]
    board = copy.get("/api/dispatch/plan?depot=Kandy", "dispatcher")
    drawer = copy.get(f"/api/dispatch/plan/{board['plan']['id']}/deferrals", "dispatcher")
    chilled = next(g for g in drawer["groups"] if g["temp_class"] == "chilled")
    queue = copy.get("/api/dispatch/queue", "dispatcher")
    waiting = [w for w in drawer["waiting"] if w["temp"] == "chilled"]
    in_queue = [o for o in queue["orders"] if o["depot"] == "Kandy" and o["temp"] == "chilled"]
    fleet = next(c for c in queue["chilled"] if c["depot"] == "Kandy")

    assert (run["chilled_orders"], run["chilled_kg"], run["waits"]) == (
        chilled["orders"],
        chilled["total_kg"],
        chilled["waits"],
    )
    # the queue lists what rides on Wednesday; the order that waits now rides on Thursday
    assert len(in_queue) + len(waiting) == run["chilled_orders"] == 23
    assert (run["available"], run["in_workshop"]) == (fleet["reefers_free"], fleet["in_workshop"])


def test_the_run_row_follows_the_plan_board_when_a_vehicle_comes_back(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("plan")  # 4:35 PM: the Kandy plan is still a draft, so its fleet can change
    copy.sign_in("nuwan", "dispatcher")
    back = copy.client.patch(
        "/api/dispatch/plan/vehicles/VEH058?depot=Kandy",
        json={"run_date": "2026-04-08", "status": "available"},
        headers={"X-Relay-Role": "dispatcher"},
    )
    assert back.status_code == 200, back.text
    outlook = _outlook(copy)
    week = outlook["weeks"][0]
    run = week["busiest"]
    fleet = next(c for c in copy.get("/api/dispatch/queue", "dispatcher")["chilled"] if c["depot"] == "Kandy")

    assert (run["needed"], run["available"], run["state"], run["in_workshop"]) == (6, 6, "limit", ["VEH039"])
    assert run["segments"] == {"filled": 6, "short": 0, "standby": 0, "workshop": 1}
    assert (run["available"], run["in_workshop"]) == (fleet["reefers_free"], fleet["in_workshop"])
    # Monday and Tuesday keep both out; Wednesday loses only VEH039 (29.9 m³) from the 146.0 m³ fleet
    assert week["chilled_limit_m3"] == round(2 * (146.0 - 29.9 - 7.0) + (146.0 - 29.9) + 3 * 146.0, 1) == 772.3
    assert week["chilled_pct"] == 34.6
    # with a vehicle back, 8 April no longer proves that two out make a chilled order wait
    assert _plain(outlook["notes"][1]).endswith(
        "One out on a Wednesday means no standby; two out means a chilled order waits."
    )


def test_before_the_cutoff_the_run_counts_the_orders_in_so_far(new_copy: Callable[[], Copy]) -> None:
    copy = new_copy()
    copy.jump("queue")  # 3:12 PM, two Kandy outlets still to order
    copy.sign_in("nuwan", "dispatcher")
    outlook = _outlook(copy)
    run = outlook["weeks"][0]["busiest"]

    assert run["from_order_book"]
    assert run["waits"] == 0
    assert run["chilled_orders"] < 23
    assert _plain(outlook["labels"]["day"]) == "8 April from the order book so far, the rest forecast"


def test_peliyagoda_has_no_outlook_yet(new_copy: Callable[[], Copy]) -> None:
    copy = _at_6_45(new_copy)
    outlook = _outlook(copy, "Peliyagoda")

    assert outlook["weeks"] == []
    assert outlook["headline"] is None
    assert outlook["key_figures"] == []
    assert outlook["forecast_updated"] is None
    assert outlook["empty"].startswith("No forecast is set up for Peliyagoda yet")
    assert copy.client.get("/api/dispatch/outlook?depot=All", headers={"X-Relay-Role": "dispatcher"}).status_code == 422


# ------------------------------------------------------------------------------------------------ other forecasts
# The drawn moment runs one path through the wording. These build the sentences for days the scenario never has.


def _day(iso: str, needed: int, available: int = 7, kg: float = 6000.0, served: int | None = None) -> OutlookDayOut:
    return OutlookDayOut(
        date=date.fromisoformat(iso),
        chilled_orders=23,
        chilled_kg=kg,
        chilled_m3=round(kg / 180, 1),
        needed=needed,
        available=available,
        in_workshop=[],
        state=service._state(needed, available),
        from_order_book=False,
        waits=0,
        served_one_fewer=served,
    )


def _calendar(first: str, last: str, paydays: tuple[str, ...] = ()) -> service.Calendar:
    start, end = date.fromisoformat(first), date.fromisoformat(last)
    days = []
    for n in range((end - start).days + 1):
        d = start + timedelta(days=n)
        days.append(
            CalendarDay(
                date=d,
                dow=d.weekday(),
                dow_name=f"{d:%a}",
                is_weekend=d.weekday() >= 5,
                iso_year=d.isocalendar()[0],
                iso_week=d.isocalendar()[1],
                is_payday=d.isoformat() in paydays,
                festival=None,
                festival_ramp=0.0,
                is_holiday=False,
                monsoon=False,
                is_operating=d.weekday() < 6,
            )
        )
    return service.Calendar(days)


def test_the_fleet_state_and_its_segments() -> None:
    assert [service._state(*n) for n in [(6, 5), (6, 6), (6, 7), (4, 7)]] == ["over", "limit", "limit", "within"]
    segments = [service._segments(needed, available, 7).model_dump() for needed, available in [(6, 4), (4, 7)]]
    assert segments == [
        {"filled": 4, "short": 2, "standby": 0, "workshop": 1},
        {"filled": 4, "short": 0, "standby": 3, "workshop": 0},
    ]


def test_the_weekday_pattern_names_its_exceptions() -> None:
    calendar = _calendar("2026-06-01", "2026-06-20", paydays=("2026-06-13",))
    usual = {0: 5, 2: 6}
    days = [_day(d.isoformat(), usual.get(d.weekday(), 4)) for d in calendar.days if d.weekday() < 6]

    assert _plain(service._pattern(days, calendar)) == "Wednesdays need 6, Mondays 5, other days 4."
    odd = [_day("2026-06-05", 5) if d.date.isoformat() == "2026-06-05" else d for d in days]
    odd = [_day("2026-06-13", 5) if d.date.isoformat() == "2026-06-13" else d for d in odd]
    assert _plain(service._pattern(odd, calendar)) == (
        "Wednesdays need 6, Mondays 5, most other days 4 (Friday 5 June needs 5; the payday Saturday, 13 June, "
        "needs 5)."
    )


def test_the_answer_for_busiest_days_on_different_weekdays() -> None:
    calendar = _calendar("2026-06-01", "2026-06-30")
    peers = [_day("2026-06-08", 6, kg=5000.0, served=21), _day("2026-06-11", 6, kg=7000.0, served=22)]
    lead = peers[1]
    headline = service._headline(lead, peers, calendar)

    assert _plain(headline.title) == (
        "Thursday 11 June is the heaviest of the 2 busiest days ahead, and like each of them it needs 6 of the 7 "
        "refrigerated vehicles."
    )
    assert _plain(headline.support) == "The heaviest of them: 7,000.0 kg chilled"
    assert [(f.value, _plain(f.label)) for f in service._key_figures(lead, peers)] == [
        ("6 of 7", "refrigerated vehicles needed, Thu 11 Jun, as on each busiest day ahead"),
        ("22 of 23", "chilled orders five refrigerated vehicles can serve on Thu 11 Jun"),
    ]
    book, keep, _ = (_plain(line) for line in service._arrange(lead, peers, calendar))
    assert book == "Book refrigerated servicing away from Mon 8 Jun and Thu 11 Jun: on Relay's clock each needs 6 of 7"
    assert keep == "Keep all 7 in service on Thursday 11 June"


def test_the_answer_with_no_standby_with_room_and_over() -> None:
    calendar = _calendar("2026-06-01", "2026-06-30", paydays=("2026-06-25",))
    details = [
        service._headline(lead, [lead], calendar).detail
        for lead in [_day("2026-06-24", 7), _day("2026-06-24", 4), _day("2026-06-24", 6, available=4)]
    ]
    assert details == [
        "Every one in service is needed and there is no standby: keep all 7 in service that day.",
        "That leaves the standby and two more free that day.",
        "Only 4 are in service that day, so chilled orders wait unless two come back from the workshop.",
    ]
    lead = _day("2026-06-24", 7)
    assert _plain(service._headline(lead, [lead], calendar).support) == "That day: 6,000.0 kg chilled (payday week)"
    assert service._key_figures(lead, [lead])[1:] == []
    roomy = _day("2026-06-24", 4)
    assert service._arrange(roomy, [roomy], calendar) == ["Tell stores early when a refrigerated vehicle is out"]
