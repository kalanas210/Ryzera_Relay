"""Build the seed's story day from the competition data and the Designathon scenario.

Run once, by someone who has the organizers' dataset in data/raw (git ignores it):

    uv run python seed/scripts/build_story.py

It writes the files under seed/data/story and seed/data/derived, which are committed, so
`docker compose up` never needs the raw data. The numbers come from the same model the
Designathon scenario was checked with (tools/data-check/relay_model.py): the Kandy hub's orders
are copied from the scenario appendix, and every other order is sized the same way.
"""

from __future__ import annotations

import csv
import json
import random
import re
import sys
from pathlib import Path

import numpy as np
import pandas as pd

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "tools" / "data-check"))
import relay_model as M  # noqa: E402

SCENARIO = REPO / "docs" / "design" / "05-scenario-data.md"
STORY = REPO / "seed" / "data" / "story"
DERIVED = REPO / "seed" / "data" / "derived"
REFERENCE = REPO / "seed" / "data" / "reference"

MON, TUE, WED, THU = "2026-04-06", "2026-04-07", "2026-04-08", "2026-04-09"

CASES = {
    # code: (name, brand, temp, kg, m3, load_rank)
    "rice_dhal": ("Rice and dhal case", "Fresh", "ambient", 10.0, 0.040, 1),
    "packet_foods": ("Packet foods case", "Fresh", "ambient", 5.2, 0.036, 2),
    "tea_biscuit": ("Tea and biscuit case", "Fresh", "ambient", 4.4, 0.034, 3),
    "dairy": ("Dairy crate", "Fresh", "chilled", 8.4, 0.038, 1),
    "meat_fish": ("Meat and fish box", "Fresh", "chilled", 7.2, 0.030, 2),
    "produce": ("Produce crate", "Fresh", "chilled", 5.6, 0.042, 3),
    "garment_carton": ("Garment carton", "Style", "ambient", 14.4, 0.230, 1),
    "appliance": ("Appliance", "Tech", "ambient", 213.6, 0.707, 1),
}
DRY = ["rice_dhal", "packet_foods", "tea_biscuit"]
CHILLED = ["dairy", "produce", "meat_fish"]  # the order the scenario lists case counts in

# Real towns and city areas in each outlet's district. The scenario's own names come first.
TOWNS = {
    "Colombo": ["Borella", "Kollupitiya", "Bambalapitiya", "Wellawatte", "Dehiwala", "Mount Lavinia", "Nugegoda",
                "Maharagama", "Kottawa", "Homagama", "Battaramulla", "Rajagiriya", "Kotahena", "Moratuwa",
                "Piliyandala", "Boralesgamuwa", "Kaduwela", "Malabe", "Narahenpita", "Havelock Town",
                "Kirulapone", "Ratmalana", "Pannipitiya", "Kolonnawa", "Hanwella", "Avissawella"],
    "Gampaha": ["Kadawatha", "Negombo", "Gampaha", "Ja-Ela", "Wattala", "Kiribathgoda", "Kelaniya", "Ragama",
                "Minuwangoda", "Nittambuwa", "Veyangoda", "Mirigama", "Katunayake", "Seeduwa", "Kandana",
                "Delgoda", "Biyagama"],
    "Kalutara": ["Panadura", "Kalutara", "Horana", "Beruwala", "Aluthgama", "Wadduwa", "Bandaragama", "Matugama",
                 "Ingiriya", "Agalawatta", "Bulathsinhala"],
    "Galle": ["Hikkaduwa", "Galle", "Karapitiya", "Ambalangoda", "Elpitiya", "Baddegama", "Unawatuna", "Ahangama",
              "Bentota", "Balapitiya"],
    "Matara": ["Matara", "Weligama", "Akuressa", "Dikwella", "Hakmana", "Kamburupitiya", "Deniyaya"],
    "Kurunegala": ["Kurunegala", "Kuliyapitiya", "Pannala", "Narammala", "Polgahawela", "Mawathagama", "Wariyapola",
                   "Nikaweratiya", "Alawwa"],
    "Puttalam": ["Chilaw", "Puttalam", "Wennappuwa", "Marawila"],
    "Kandy": ["Peradeniya", "Gampola", "Kundasale", "Digana", "Pilimathalawa", "Kadugannawa", "Nawalapitiya",
              "Akurana", "Katugastota"],
    "Matale": ["Dambulla", "Galewela", "Matale"],
    "Nuwara Eliya": ["Nuwara Eliya", "Hatton"],
    "Badulla": ["Badulla", "Bandarawela"],
    "Kegalle": ["Kegalle", "Mawanella"],
}

# Drivers the scenario names; the rest of the fleet gets generated names.
STORY_DRIVERS = {
    "VEH042": "Sampath Lakmal",
    "VEH045": "Kasun Bandara",
    "VEH057": "Priyantha Silva",
    "VEH060": "Nimal Fernando",
}
# Generated driver names keep a first name and a surname from the same community.
NAMES = {
    "sinhala": (
        ["Chaminda", "Ruwan", "Tharindu", "Mahesh", "Ajith", "Pradeep", "Lasith", "Dinesh", "Nalin", "Roshan", "Kamal",
         "Sunil", "Janaka", "Asanka", "Sameera", "Upul", "Ranjith", "Thilina", "Saman", "Gayan", "Indika", "Buddhika",
         "Chathura", "Heshan", "Nimesh", "Dilshan", "Kelum", "Ravindu", "Isuru", "Shiran", "Prasanna", "Hasitha", "Anura",
         "Malith", "Charith", "Thushara", "Waruna", "Rajitha", "Dhanushka", "Sajith", "Lahiru", "Chanaka", "Jagath"],
        ["Perera", "Fernando", "Silva", "Jayasinghe", "Wijesinghe", "Rathnayake", "Dissanayake", "Herath", "Gunawardena",
         "Senanayake", "Bandara", "Ekanayake", "Karunaratne", "Weerasinghe", "Rajapaksha", "Samarasinghe", "Kumara",
         "Pathirana", "Liyanage", "Ranasinghe", "Abeysekara", "Munasinghe", "Kodithuwakku", "Rodrigo"],
    ),
    "tamil": (
        ["Suresh", "Arun", "Vijay", "Senthil", "Mohan", "Rajan", "Prakash", "Ganesh", "Sathish", "Kannan"],
        ["Nadarajah", "Sivakumar", "Rajendran", "Thangarajah", "Selvaraj", "Krishnan", "Kanagaratnam"],
    ),
    "muslim": (
        ["Faisal", "Rifkhan", "Imran", "Nazeer", "Fazal", "Ashraf", "Irshad"],
        ["Hameed", "Marikkar", "Ismail", "Farook", "Cassim", "Lafir"],
    ),
}


def driver_name(rng: random.Random) -> str:
    community = rng.choices(["sinhala", "tamil", "muslim"], weights=[70, 18, 12])[0]
    first, last = NAMES[community]
    return f"{rng.choice(first)} {rng.choice(last)}"


def block(name: str) -> str:
    text = SCENARIO.read_text(encoding="utf-8")
    m = re.search(rf"```(?:csv|json) relay:{name}\n(.*?)```", text, re.S)
    if not m:
        raise SystemExit(f"relay:{name} not found in {SCENARIO}")
    return m.group(1)


def rows(name: str) -> list[dict[str, str]]:
    return list(csv.DictReader(block(name).splitlines()))


def write(path: Path, header: list[str], data: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as fh:
        w = csv.DictWriter(fh, fieldnames=header, lineterminator="\n")
        w.writeheader()
        for r in data:
            w.writerow({k: r.get(k, "") for k in header})
    print(f"wrote {path.relative_to(REPO)} ({len(data)} rows)")


# ---------------------------------------------------------------- store names
def store_names() -> dict[str, tuple[str, str]]:
    given = {r["outlet_id"]: r["store_name"] for r in rows("outlets")}
    used: dict[tuple[str, str], set[str]] = {}
    names: dict[str, tuple[str, str]] = {}
    for oid, name in given.items():
        brand = M.OUT.loc[oid, "brand"]
        town = name.replace(f"Waypoint {brand} ", "")
        names[oid] = (name, town)
        used.setdefault((M.OUT.loc[oid, "district"], brand), set()).add(town)
    for oid, r in M.OUT.sort_index().iterrows():
        if oid in names:
            continue
        taken = used.setdefault((r.district, r.brand), set())
        fresh_towns = used.get((r.district, "Fresh"), set())
        pool = TOWNS[r.district]
        # Style and Tech stores prefer the bigger towns (early in the list); Fresh takes the next free one.
        town = next(t for t in pool if t not in taken and (r.brand != "Fresh" or t not in fresh_towns))
        taken.add(town)
        names[oid] = (f"Waypoint {r.brand} {town}", town)
    return names


# ---------------------------------------------------------------- order sizes and case lines
def mult(day: str, group: str, depot: str) -> float:
    fc = M.FC[(M.FC.date == day) & (M.FC.depot == depot) & (M.FC.g == group)]
    return float(fc.iloc[0].lift * fc.iloc[0].growth) if len(fc) else 1.0


def forecast_size(outlet: str, temp: str, day: str) -> dict:
    """The scenario's forecast order: the outlet's mean on ordinary days of that weekday in 2026 weeks 1 to 13,
    times the forecast's lift and growth for its depot."""
    dow = M.CAL.loc[day, "dow_name"]
    depot = M.OUT.loc[outlet, "depot"]
    brand = M.OUT.loc[outlet, "brand"]
    d = M.DEL
    k = d[(d.outlet_id == outlet) & (d.temp_requirement == temp) & (d.dow_name == dow) & (d.wk >= 202601)
          & (d.wk <= 202613) & (d.festival_ramp == 0) & (d.is_payday == 0)]
    if brand == "Tech" or len(k) < 3:
        x = d[(d.outlet_id == outlet) & (d.temp_requirement == temp)]
        return dict(units=int(x.order_units.median()), kg=round(float(x.order_weight_kg.median()), 1),
                    m3=round(float(x.order_volume_m3.median()), 3))
    group = "Style" if brand == "Style" else ("Fresh_chilled" if temp == "chilled" else "Fresh_dry")
    m = mult(day, group, depot)
    return dict(units=int(round(k.order_units.mean() * m)), kg=round(k.order_weight_kg.mean() * m, 1),
                m3=round(k.order_volume_m3.mean() * m, 3))


# Typical shares of each case type, from the case mixes the scenario gives (OUT116 to OUT119).
TYPICAL = {"ambient": (0.35, 0.39, 0.26), "chilled": (0.43, 0.35, 0.22)}


def case_mix(temp: str, units: int, kg: float, m3: float) -> list[tuple[str, int]]:
    """A whole-case mix of the three case types that stays close to the order's weight and volume and
    to a store's usual mix. The order's own weight and volume stay as the data gives them."""
    codes = DRY if temp == "ambient" else CHILLED
    k = [CASES[c][3] for c in codes]
    v = [CASES[c][4] for c in codes]
    typical = TYPICAL[temp]
    best, best_err = (units, 0, 0), float("inf")
    for a in range(units + 1):
        for b in range(units - a + 1):
            c = units - a - b
            fit = abs(a * k[0] + b * k[1] + c * k[2] - kg) / max(kg, 1) + abs(a * v[0] + b * v[1] + c * v[2] - m3) / max(m3, 0.01)
            usual = sum(abs(n / units - t) for n, t in zip((a, b, c), typical))
            err = fit + 0.12 * usual
            if err < best_err:
                best, best_err = (a, b, c), err
    return [(code, n) for code, n in zip(codes, best) if n > 0]


def lines_for(outlet: str, brand: str, temp: str, units: int, kg: float, m3: float, given: str) -> str:
    if given:
        counts = [int(x) for x in given.split()]
        codes = DRY if temp == "ambient" else CHILLED
        return ";".join(f"{c}:{n}" for c, n in zip(codes, counts) if n > 0)
    if brand == "Style":
        return f"garment_carton:{units}"
    if brand == "Tech":
        return f"appliance:{units}"
    return ";".join(f"{c}:{n}" for c, n in case_mix(temp, units, kg, m3))


# ---------------------------------------------------------------- the order book
def order_book(day: str, tech: list[str], appendix: dict[tuple[str, str], dict]) -> list[dict]:
    streams = M.day_streams(M.CAL.loc[day, "dow_name"], tech)
    first = M.first_id(day)
    out = []
    for i, (outlet, temp) in enumerate(streams):
        ref = f"ORD{first + i:07d}"
        brand = M.OUT.loc[outlet, "brand"]
        a = appendix.get((outlet, temp))
        if a and a["order_id"] != ref:
            raise SystemExit(f"{outlet} {temp}: scenario says {a['order_id']}, numbering gives {ref}")
        if a:
            size = dict(units=int(a["units"]), kg=float(a["kg"]), m3=float(a["m3"]))
            given = a["cases"]
        else:
            size = forecast_size(outlet, temp, day)
            given = ""
        out.append(dict(order_ref=ref, outlet_id=outlet, brand=brand, temp=temp, requested_date=day,
                        units=size["units"], kg=size["kg"], m3=size["m3"],
                        lines=lines_for(outlet, brand, temp, size["units"], size["kg"], size["m3"], given)))
    return out


def placement_times(book: list[dict], facts: dict) -> None:
    """When each Wednesday order reached Relay on Tuesday. The scenario fixes Dilani's two orders, the
    outlets still to order at 3:12 PM and OUT032's two late orders; the rest arrive through the day."""
    rng = random.Random(20260407)
    q = facts["queue"]
    late = set(q["late_ids"])
    after_312 = set(q["not_ordered_312"]) | set(q["style_tech_after_312"])
    fixed = {("OUT117", "chilled"): "14:10", ("OUT117", "ambient"): "14:14"}
    for o in book:
        key = (o["outlet_id"], o["temp"])
        if o["order_ref"] in late:
            o["placed_at"] = "16:01" if o["temp"] == "ambient" else "16:02"
        elif key in fixed:
            o["placed_at"] = fixed[key]
        elif o["outlet_id"] in after_312:
            o["placed_at"] = M.fmt(rng.randint(M.hm("15:14"), M.hm("15:58")))
        else:
            o["placed_at"] = M.fmt(rng.randint(M.hm("08:30"), M.hm("15:10")))
        o["placed_at"] = f"{TUE} {o['placed_at']}"
    # the same outlet's dry and chilled orders arrive a few minutes apart, dry first
    by_outlet: dict[str, list[dict]] = {}
    for o in book:
        by_outlet.setdefault(o["outlet_id"], []).append(o)
    for outlet, orders in by_outlet.items():
        if len(orders) == 2 and outlet not in {"OUT117", "OUT032"}:
            dry, chilled = sorted(orders, key=lambda x: x["temp"])
            t = M.hm(dry["placed_at"][-5:])
            chilled["placed_at"] = f"{TUE} {M.fmt(min(t + rng.randint(2, 9), M.hm('15:59')))}"


def main() -> None:
    facts = json.loads(block("facts"))
    appendix = {(r["delivery_date"], r["outlet_id"], "chilled" if r["temp"] == "chilled" else "ambient"): r
                for r in rows("orders")}
    wed_appendix = {(o, t): v for (d, o, t), v in appendix.items() if d == WED}
    thu_appendix = {(o, t): v for (d, o, t), v in appendix.items() if d == THU}
    # The scenario's ORD0098747 already carries the 6 rice and dhal cases that go short on Wednesday night.
    # In the product the dispatcher's decision adds them, so the seed holds Dilani's own Thursday order.
    short = facts["thursday"]["short_cases"]
    own = dict(thu_appendix[("OUT117", "ambient")])
    rice = CASES["rice_dhal"]
    own.update(units=str(int(own["units"]) - short), kg=f"{float(own['kg']) - short * rice[3]:.1f}",
               m3=f"{float(own['m3']) - short * rice[4]:.3f}",
               cases=" ".join(str(n) for n in facts["thursday"]["own_cases"]))
    thu_appendix[("OUT117", "ambient")] = own

    # store names -------------------------------------------------------------
    names = store_names()
    write(REFERENCE / "store_names.csv", ["outlet_id", "name", "short_name"],
          [dict(outlet_id=o, name=n, short_name=s) for o, (n, s) in sorted(names.items())])

    # case types ----------------------------------------------------------------
    write(REFERENCE / "case_types.csv", ["code", "name", "brand", "temp", "kg", "m3", "load_rank"],
          [dict(code=c, name=v[0], brand=v[1], temp=v[2], kg=v[3], m3=v[4], load_rank=v[5]) for c, v in CASES.items()])

    # orders --------------------------------------------------------------------
    wed_tech = sorted(o for (o, t) in wed_appendix if M.OUT.loc[o, "brand"] == "Tech")
    wed = order_book(WED, ["OUT049", *wed_tech], wed_appendix)
    placement_times(wed, facts)
    thu = order_book(THU, facts["thursday"]["tech_outlets"], thu_appendix)
    for o in thu:  # standing orders for Thursday, already in when the story starts
        o["placed_at"] = f"{TUE} 11:00"
    counts = pd.Series([o["brand"] + ("" if o["brand"] != "Fresh" else "_" + o["temp"]) for o in wed
                        if o["order_ref"] not in facts["queue"]["late_ids"]]).value_counts().to_dict()
    print("Wednesday orders at 4:00 PM:", len(wed) - 2, counts)
    header = ["order_ref", "outlet_id", "brand", "temp", "requested_date", "units", "kg", "m3", "placed_at", "lines"]
    write(STORY / "orders.csv", header, wed + thu)

    # the shortfall's destination: Dilani's Thursday dry order carries 6 cases from Wednesday
    # (the appendix already includes them in ORD0098747's rice and dhal count)

    # people --------------------------------------------------------------------
    people = [
        dict(username="nuwan", display_name="Nuwan Perera", role="dispatcher", depot="", locale="en", judge="1"),
        # The four judge accounts start in English so the screens can be reviewed; Rizwan reads Tamil most easily
        # and switches with one tap, and the tablet brings each loader's own language back at sign-in.
        dict(username="rizwan", display_name="Mohamed Rizwan", role="loader", depot="Kandy", locale="en", pin="2580", judge="1"),
        dict(username="anjali", display_name="Anjali Wickramasinghe", role="loader", depot="Kandy", locale="si", pin="1357"),
        dict(username="suresh", display_name="Suresh Kumar", role="loader", depot="Kandy", locale="ta", pin="4826"),
        dict(username="dilani", display_name="Dilani Jayawardena", role="store_manager", outlet_id="OUT117", locale="en", judge="1"),
    ]
    rng = random.Random(45)
    used_names = set(STORY_DRIVERS.values())
    for vid in sorted(M.VEH.index):
        if vid in STORY_DRIVERS:
            name = STORY_DRIVERS[vid]
        else:
            while True:
                name = driver_name(rng)
                if name not in used_names:
                    break
        used_names.add(name)
        username = "kasun" if vid == "VEH045" else f"driver.{vid.lower()}"
        people.append(dict(username=username, display_name=name, role="driver", depot=M.VEH.loc[vid, "depot"],
                           vehicle_id=vid, locale="en" if vid == "VEH045" else "si", judge="1" if vid == "VEH045" else "",
                           pin="3690" if vid == "VEH045" else ""))
    write(STORY / "people.csv", ["username", "display_name", "role", "depot", "outlet_id", "vehicle_id", "locale", "pin", "judge"], people)

    # vehicle days ----------------------------------------------------------------
    status_wed = {r["vehicle_id"]: r["wednesday"] for r in rows("vehicles")}
    fuel = {r["vehicle_id"]: float(r["mon_l"]) + float(r["tue_l"]) for r in rows("fuel")}
    typ = weekday_litres()
    vdays = []
    for day in (WED, THU):
        for vid in sorted(M.VEH.index):
            # Thursday: VEH039 is repaired, and VEH058 is back from its service as the hub's usual standby
            st = status_wed.get(vid, "running") if day == WED else ("standby" if vid == "VEH058" else "available")
            status = {"workshop": "workshop", "standby": "standby"}.get(st, "available")
            if day == WED:
                used = fuel.get(vid, round(typ.get((vid, "Mon"), 0.0) + typ.get((vid, "Tue"), 0.0), 1))
            else:
                used = None
            vdays.append(dict(run_date=day, vehicle_id=vid, status=status,
                              fuel_used_l="" if used is None else round(used, 1)))
    write(STORY / "vehicle_days.csv", ["run_date", "vehicle_id", "status", "fuel_used_l"], vdays)

    # service history: last delivery and last deferral per store and temperature ---------------
    write(STORY / "history.csv", ["outlet_id", "temp", "last_delivered", "deferred_on"], history())

    # derived: usual runs, unloading times, and which stores order on which weekday ------------------
    write(DERIVED / "usual_runs.csv", ["vehicle_id", "dow_name", "trip_no", "brand", "temp", "district", "share"], usual_runs())
    write(DERIVED / "usual_stops.csv",
          ["vehicle_id", "dow_name", "trip_no", "brand", "temp", "district", "outlet_id", "share", "run_share"],
          usual_stops())
    write(DERIVED / "outlet_dwell.csv", ["outlet_id", "monsoon", "p10", "p50", "p90"], outlet_dwell())
    streams = [dict(dow_name=dow, outlet_id=o, temp=t) for dow in M.DOWS for (o, t) in M.fixed_streams(dow)]
    write(DERIVED / "order_streams.csv", ["dow_name", "outlet_id", "temp"], streams)


def weekday_litres() -> dict[tuple[str, str], float]:
    """Each vehicle's average litres per weekday in 2026 weeks 1 to 13, counting the drive back to the depot."""
    leg = pd.concat([M.LEGS_TR, M.LEGS_TE]).merge(M.CAL[["iso_year", "iso_week", "dow_name"]], left_on="date", right_index=True)
    leg = leg[(leg.iso_year == 2026) & (leg.iso_week <= 13)]
    rt = leg.groupby(["date", "dow_name", "vehicle_id", "route_id", "district"]).distance_km.sum().reset_index()
    rt["L"] = (rt.distance_km + rt.district.map(M.DT.depot_to_district_km)) / rt.vehicle_id.map(M.VEH.km_per_l)
    vd = rt.groupby(["date", "dow_name", "vehicle_id"]).L.sum().unstack(fill_value=0)
    ops = M.CAL[(M.CAL.iso_year == 2026) & (M.CAL.iso_week <= 13) & (M.CAL.is_operating == 1)].reset_index()[["date", "dow_name"]]
    vd = vd.reindex(pd.MultiIndex.from_frame(ops), fill_value=0)
    mean = vd.groupby(level=1).mean().T
    return {(v, d): float(mean.loc[v, d]) for v in mean.index for d in mean.columns}


def history() -> list[dict]:
    """For every Wednesday order stream: the store's previous delivery of that temperature before Wednesday,
    walking back over operating days on which that stream usually orders. The scenario fixes two facts:
    OUT119's Monday chilled order waited a day, and Hemmathagama's last chilled delivery was Saturday 4 April."""
    out = []
    days = [d for d in M.CAL.index if "2026-03-23" <= d < WED and M.CAL.loc[d, "is_operating"] == 1]
    streams_by_day = {d: set(M.fixed_streams(M.CAL.loc[d, "dow_name"])) for d in days}
    for outlet, temp in M.fixed_streams("Wed"):
        last = next((d for d in reversed(days) if (outlet, temp) in streams_by_day[d]), "")
        deferred = ""
        if (outlet, temp) == ("OUT119", "chilled"):
            last, deferred = TUE, MON  # Monday's order waited and rode on Tuesday
        if (outlet, temp) == ("OUT117", "chilled"):
            last = "2026-04-04"
        out.append(dict(outlet_id=outlet, temp=temp, last_delivered=last, deferred_on=deferred))
    return out


def usual_runs() -> list[dict]:
    lg = pd.concat([M.LEGS_TR, M.LEGS_TE]).merge(M.CAL[["dow_name"]], left_on="date", right_index=True)
    first = lg[lg.seq == 0].copy()
    temp = M.DEL.dropna(subset=["route_id"]).groupby("route_id").temp_requirement.first()
    first["temp"] = first.route_id.map(temp).fillna("ambient")
    first["dep"] = M._mm(first.planned_depart_time)
    first = first.sort_values(["date", "vehicle_id", "dep"])
    first["trip_no"] = first.groupby(["date", "vehicle_id"]).cumcount() + 1
    days = lg.groupby("dow_name").date.nunique()
    out = []
    for (vid, dow, tn), g in first.groupby(["vehicle_id", "dow_name", "trip_no"]):
        top = g.groupby(["brand", "temp", "district"]).size().sort_values(ascending=False)
        (brand, t, district), n = top.index[0], int(top.iloc[0])
        share = n / days[dow]
        if share >= 0.25:
            out.append(dict(vehicle_id=vid, dow_name=dow, trip_no=int(tn), brand=brand, temp=t, district=district,
                            share=round(share, 3)))
    return out


def usual_stops() -> list[dict]:
    """The stores each vehicle's usual trip visits on a weekday. A trip that goes to one run (brand, temperature and
    district) on some weeks and another on others has one row set per run it makes on at least a quarter of those
    weekdays; its stores are the ones on at least half of those trips. run_share is how often the run happens."""
    lg = pd.concat([M.LEGS_TR, M.LEGS_TE]).merge(M.CAL[["dow_name"]], left_on="date", right_index=True)
    temp = M.DEL.dropna(subset=["route_id"]).groupby("route_id").temp_requirement.first()
    starts = lg[lg.seq == 0].copy()
    starts["temp"] = starts.route_id.map(temp).fillna("ambient")
    starts["dep"] = M._mm(starts.planned_depart_time)
    starts = starts.sort_values(["date", "vehicle_id", "dep"])
    starts["trip_no"] = starts.groupby(["date", "vehicle_id"]).cumcount() + 1
    lg = lg.merge(starts[["route_id", "trip_no", "temp"]], on="route_id")
    days = lg.groupby("dow_name").date.nunique()
    keys = ["vehicle_id", "dow_name", "trip_no", "brand", "temp", "district"]
    runs_by = starts.groupby(keys).route_id.nunique()
    visits = lg.groupby([*keys, "to_outlet"]).route_id.nunique()
    out = []
    for (vid, dow, tn, brand, t, district, outlet), n in visits.items():
        runs = runs_by[(vid, dow, tn, brand, t, district)]
        if runs / days[dow] >= 0.25 and n / runs >= 0.5:
            out.append(dict(vehicle_id=vid, dow_name=dow, trip_no=int(tn), brand=brand, temp=t, district=district,
                            outlet_id=outlet, share=round(n / runs, 3), run_share=round(runs / days[dow], 3)))
    return out


def outlet_dwell() -> list[dict]:
    lt = M.LEGS_TR.copy()
    lt["svc"] = M._mm(lt.leave_outlet_time) - np.maximum(M._mm(lt.arrival_time), M._mm(lt.to_outlet.map(M.OUT.window_open_time)))
    q = lt.groupby(["to_outlet", "monsoon"]).svc.quantile([0.1, 0.5, 0.9]).unstack()
    return [dict(outlet_id=o, monsoon=int(m), p10=round(float(r[0.1]), 1), p50=round(float(r[0.5]), 1), p90=round(float(r[0.9]), 1))
            for (o, m), r in q.iterrows()]


if __name__ == "__main__":
    main()
