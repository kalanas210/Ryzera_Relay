#!/usr/bin/env python3
"""
validate_scenario.py: checks docs/design/05-scenario-data.md (v0.4, data aligned) against the competition data.

It reads the CSVs in data/raw/data, imports the organizers' trip-time standard from data/raw/check_allocation.py,
parses the machine-readable appendix at the end of the scenario (fenced ```csv relay:<name>``` and ```json relay:<name>```
blocks), recomputes every checkable fact and compares. It also checks that the numbers the story prints appear in the
text, that the timeline table matches its appendix block, that wording found wrong in review stays out, and that the
text has no em dash, en dash or arrow.

Run from anywhere:
    python tools/data-check/validate_scenario.py            full check (about 6 minutes: exact searches for 33 days and
                                                            the five-vehicle case for each Wednesday ahead)
    python tools/data-check/validate_scenario.py --quick    skip those searches
    python tools/data-check/validate_scenario.py -v         also list every check that passed
"""
import argparse
import csv
import io
import json
import math
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import pandas as pd  # noqa: E402
import relay_model as M  # noqa: E402
from relay_model import hm, fmt, ampm, r5, num, OUT, VEH, CAL, DT  # noqa: E402

MD_PATH = M.REPO / "docs" / "design" / "05-scenario-data.md"
DAY, PLAN_DAY, THU, MON, TUE = "2026-04-08", "2026-04-07", "2026-04-09", "2026-04-06", "2026-04-07"

# Team knowledge (not in the data): the district each store name lies in. outlets.csv has no names.
TOWN_DISTRICT = {
    "Katugastota": "Kandy", "Mahaiyawa": "Kandy", "Asgiriya": "Kandy", "Bahirawakanda": "Kandy", "Watapuluwa": "Kandy",
    "Hantana": "Kandy", "Ampitiya": "Kandy", "Suduhumpola": "Kandy", "Bogambara": "Kandy", "Kandy Town": "Kandy",
    "Lewella": "Kandy", "Mulgampola": "Kandy", "Tennekumbura": "Kandy",
    "Ukuwela": "Matale", "Matale Town": "Matale", "Aluvihare": "Matale", "Rattota": "Matale", "Palapathwela": "Matale",
    "Elkaduwa": "Matale",
    "Talawakele": "Nuwara Eliya", "Nuwara Eliya": "Nuwara Eliya", "Hatton": "Nuwara Eliya", "Maskeliya": "Nuwara Eliya",
    "Nanu Oya": "Nuwara Eliya",
    "Badulla Town": "Badulla", "Hali-Ela": "Badulla", "Bandarawela": "Badulla", "Welimada": "Badulla", "Passara": "Badulla",
    "Aranayake": "Kegalle", "Hemmathagama": "Kegalle", "Mawanella": "Kegalle", "Kegalle": "Kegalle",
    "Borella": "Colombo", "Kadawatha": "Gampaha", "Panadura": "Kalutara", "Hikkaduwa": "Galle",
}
# district_travel.csv puts Kandy district stores 8 km from the hub and 3 km apart: only Kandy city areas fit.
# Team knowledge (approximate road distance from Kandy Town in km, read off a map). A Fresh store must sit within about
# 4.5 km, so any two Kandy Fresh stores are a short city drive apart, as the data's 3 km between stops assumes.
# Peradeniya and Kundasale are separate towns on opposite sides of Kandy, about 14 km apart through the city; they are
# listed only so the check can reject them. Tennekumbura (the Tech store, one stop on a daytime trip) is a suburb.
KANDY_KM_FROM_TOWN = {"Kandy Town": 0.0, "Asgiriya": 1.0, "Bogambara": 1.5, "Mahaiyawa": 1.5, "Bahirawakanda": 2.0,
                      "Lewella": 2.0, "Mulgampola": 2.5, "Watapuluwa": 3.0, "Suduhumpola": 3.0, "Ampitiya": 4.0,
                      "Hantana": 4.0, "Katugastota": 4.0, "Tennekumbura": 5.5, "Peradeniya": 6.5, "Kundasale": 8.0}
KANDY_CITY_AREAS = {n for n, km in KANDY_KM_FROM_TOWN.items() if km <= 6.0}
# Nuwara Eliya stores in road order from the hub via Nuwara Eliya town (A5 then A7)
NE_ROAD_ORDER = ["OUT105", "OUT108", "OUT104", "OUT106", "OUT107"]
BANNED = {chr(0x2014): "em dash", chr(0x2013): "en dash", "-" + ">": "ASCII arrow", "<" + "-": "ASCII arrow", "=" + ">": "ASCII arrow"}
# wording that review found wrong or overclaimed; each must stay out of the scenario (outside the Changes section,
# which may quote old strings)
BANNED_PHRASES = {
    "heaviest morning ahead": "29 April is the heaviest Wednesday ahead, not the heaviest day",
    "Why nothing else can move": "the publish check column is 'Why Relay keeps it'",
    "exactly its median order": "OUT115's figures are the medians of three columns, not one order",
    "Kandy 20 (dry)": "Kandy's not-run orders are 5 Fresh dry, 7 Style and 8 Tech",
    "Queue locked": "orders close at 4:00 PM; the queue does not lock at 4:02",
    "Finish trip on the way back": "drivers act only when stopped",
    "in spring": "Sri Lanka has no spring; name the months",
    "New Year is Monday 13 April": "the New Year holidays are Monday 13 and Tuesday 14 April",
    "2 AM Kandy delivery": "no Kandy store opens before 3:00 AM",
    "Every number below comes from a script": "story times are authored, not computed",
    "Every planned arrival is inside its window": "early arrivals wait for the store to open",
    "every planned arrival is inside its window": "early arrivals wait for the store to open",
    "the only refrigerated trip that reaches Kegalle": "Relay expects that trip after the windows: say 'planned to reach'",
    "before stores close is full": "the van has room left, not for her order",
    "This is the one place where Relay is stricter": "the checker checks no windows, departure times or drive back",
    "Kasun Bandara has no signal": "Relay cannot tell a lost signal from a flat battery",
    "low-signal area near Mawanella": "Relay does not know where Kasun is",
    "Waypoint Fresh Peradeniya": "Peradeniya is a separate town, not a Kandy city area 3 km from the others",
    "Waypoint Fresh Kundasale": "Kundasale is a separate town, not a Kandy city area 3 km from the others",
    "OUT084 Peradeniya": "OUT084 is Bogambara", "OUT087 Kundasale": "OUT087 is Mulgampola",
    "Unavoidable: one chilled order": "unavoidable only on a clock where a vehicle is in one place at a time",
    "5 of the 6 were chilled orders": "days are not orders",
    "a monsoon thunderstorm": "April is inter-monsoon",
    "Load Aranayake first.": "at 2:40 Aranayake is already loaded",
    "in monsoon rain": "the data flags monsoon months, not rain; April is inter-monsoon",
    "normal in the rain": "the statistic is scoped to the data's monsoon months, not to rain",
    "29 April needs 6 of the 7 refrigerated vehicles": "every Wednesday ahead needs 6 of 7; the headline says 29 April is the heaviest of them",
    "moves from 6:35 to 7:15": "the dispatcher sees the swap's cost to the minute (6:36 to 7:13), so it matches the 54 and 17 minute margins",
}


# ------------------------------------------------------------------ bookkeeping
class Checks:
    def __init__(self, verbose=False):
        self.n = 0
        self.fails = []
        self.section = ""
        self.verbose = verbose
        self.per = {}

    def sec(self, name):
        self.section = name
        self.per.setdefault(name, [0, 0])

    def __call__(self, cond, msg):
        self.per.setdefault(self.section, [0, 0])
        if cond:
            self.n += 1
            self.per[self.section][0] += 1
            if self.verbose:
                print(f"  ok   [{self.section}] {msg}")
        else:
            self.fails.append(f"[{self.section}] {msg}")
            self.per[self.section][1] += 1
            print(f"  FAIL [{self.section}] {msg}")
        return cond


def parse_appendix(md):
    blocks = {}
    for kind, name, body in re.findall(r"^```(csv|json) relay:([a-z0-9_]+)[ \t]*\n(.*?)^```[ \t]*$", md, re.M | re.S):
        blocks[name] = list(csv.DictReader(io.StringIO(body))) if kind == "csv" else json.loads(body)
    return blocks


def f1(x):
    return float(x)


def close(a, b, tol=1e-6):
    return abs(float(a) - float(b)) <= tol


# ------------------------------------------------------------------ main
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--quick", action="store_true")
    ap.add_argument("-v", "--verbose", action="store_true")
    args = ap.parse_args()
    C = Checks(args.verbose)
    md = MD_PATH.read_text(encoding="utf-8")
    A = parse_appendix(md)
    F = A.get("facts", {})

    # ============================================================== text
    C.sec("text")
    C("v0.4 (data aligned)" in md, "the scenario is headed v0.4 (data aligned)")
    for ch, label in BANNED.items():
        C(ch not in md, f"no {label} in the text")
    body_ = md.split("## Changes from v0.3")[0] + md.split("## The day", 1)[1]
    for ph, why in BANNED_PHRASES.items():
        C(ph not in body_, f"the text does not say '{ph}' ({why})")
    import inspect
    chk = inspect.getsource(M.CHECKER.check)
    C(not any(w in chk for w in ["window_open", "window_close", "depart", "freeflow"]) and "trip_time(" in chk,
      "check_allocation.check() tests no store window, departure time or drive back, only standard minutes (the text says so)")
    arrows = [c for c in md if 0x2190 <= ord(c) <= 0x21FF or 0x27F0 <= ord(c) <= 0x27FF or 0x2900 <= ord(c) <= 0x297F or 0x2B00 <= ord(c) <= 0x2BFF]
    C(not arrows, f"no arrow characters in the text ({sorted(set(arrows))})")
    for name in ["dates", "vehicles", "outlets", "cases", "orders", "trips", "expected", "fuel", "kasun", "kasun_events",
                 "estimates", "loading", "timeline", "outlook", "outlook_days", "facts"]:
        C(name in A, f"appendix block relay:{name} is present")
    for h in ["## Changes from v0.3", "## Numbers for the story boards", "## The day", "## People", "## Why one chilled order waits",
              "## The shortfall", "## Timeline and screen snapshot times", "## Capacity outlook (DSP-05)", "## Additional facts"]:
        C(h in md, f"section '{h}' is present")

    # ============================================================== dates
    C.sec("calendar")
    for r in A["dates"]:
        d = r["date"]
        c = CAL.loc[d]
        fest = "" if pd.isna(c.festival) else c.festival
        C((c.dow_name, int(c.iso_week), f"{c.festival_ramp:.1f}", int(c.monsoon), int(c.is_payday), int(c.is_holiday), int(c.is_operating), fest)
          == (r["dow"], int(r["iso_week"]), r["festival_ramp"], int(r["monsoon"]), int(r["is_payday"]), int(r["is_holiday"]), int(r["is_operating"]), r["festival"]),
          f"calendar row {d} matches calendar.csv")
    C(CAL.index.max() == "2026-06-28", "calendar ends 28 June 2026 (v0.2's October dates were outside it)")
    wk_ops = CAL[(CAL.iso_year == 2026) & (CAL.iso_week.between(15, 20))].groupby("iso_week").is_operating.sum().to_dict()

    # ============================================================== vehicles
    C.sec("vehicles")
    VT = {r["vehicle_id"]: r for r in A["vehicles"]}
    C(sorted(VT) == sorted(VEH[VEH.depot == "Kandy"].index), "the vehicles table lists the whole Kandy fleet, VEH039 to VEH060")
    for v, r in VT.items():
        x = VEH.loc[v]
        C((x.type, x.temp, int(x.weight_cap_kg), f"{x.volume_cap_m3:.1f}", f"{x.km_per_l:.1f}", int(x.weekly_fuel_quota_l), x.depot)
          == (r["type"], r["temp"], int(r["weight_cap_kg"]), r["volume_cap_m3"], r["km_per_l"], int(r["weekly_fuel_quota_l"]), r["depot"]),
          f"{v} attributes match vehicles.csv")
    workshop = sorted(v for v, r in VT.items() if r["wednesday"] == "workshop")
    standby = [v for v, r in VT.items() if r["wednesday"] == "standby"]
    C(workshop == ["VEH039", "VEH058"], "VEH039 and VEH058 are the two in the workshop")
    C(standby == ["VEH060"] and VEH.loc["VEH060", "temp"] == "ambient", "VEH060, an ambient van, is the standby this Wednesday")
    counts = {}
    for v, r in VT.items():
        counts.setdefault((VEH.loc[v, "temp"], r["wednesday"]), 0)
        counts[(VEH.loc[v, "temp"], r["wednesday"])] += 1

    # ============================================================== outlets and names
    C.sec("outlets")
    OT = {r["outlet_id"]: r for r in A["outlets"]}
    for o, r in OT.items():
        x = OUT.loc[o]
        C((x.brand, x.district, x.depot, x.dock_type, x.parking_constraint, x.window_open_time, x.window_close_time)
          == (r["brand"], r["district"], r["depot"], r["dock_type"], r["parking_constraint"], r["window_open"], r["window_close"]),
          f"{o} attributes match outlets.csv")
        name = r["store_name"].replace(f"Waypoint {x.brand} ", "")
        C(r["store_name"].startswith(f"Waypoint {x.brand} "), f"{o} store name carries its brand")
        C(TOWN_DISTRICT.get(name) == x.district, f"{o} {name} lies in its district {x.district}")
        if x.district == "Kandy":
            C(name in KANDY_CITY_AREAS, f"{o} {name} is a Kandy city area (the data puts Kandy stores 8 km out and 3 km apart)")
            if x.brand == "Fresh":
                C(KANDY_KM_FROM_TOWN.get(name, 99) <= 4.5, f"{o} {name} is within about 4 km of Kandy Town by road, so every pair of Kandy Fresh stores is a short city drive apart")
    fresh_names = [OT[o]["store_name"] for o in OT if OUT.loc[o, "brand"] == "Fresh"]
    C(len(fresh_names) == len(set(fresh_names)), "no two Fresh stores share a name")
    NAME = {o: r["store_name"] for o, r in OT.items()}
    C(DT.loc["Kandy", "depot_to_district_km"] == 8 and DT.loc["Kandy", "inter_stop_km"] == 3.0, "Kandy district: 8 km out, 3 km between stops")
    for o in ["OUT116", "OUT117", "OUT118", "OUT119"]:
        C(o in OT, f"{o} is named on the screens")

    # ============================================================== case types
    C.sec("cases")
    CASES = {r["case_type"]: (r["temp"], float(r["kg"]), float(r["m3"])) for r in A["cases"]}
    pu = M.PER_UNIT.loc["Fresh"]
    for c, (t, kg, m3) in CASES.items():
        C(pu.k0 <= kg <= pu.k1 and pu.v0 <= m3 <= pu.v1, f"{c} ({kg} kg, {m3} m3) inside the data's per-unit range for Fresh")
    DRY3 = [c for c, v in CASES.items() if v[0] == "dry"]
    CH3 = [c for c, v in CASES.items() if v[0] == "chilled"]

    def from_cases(temp, counts_):
        names = DRY3 if temp == "dry" else CH3
        return (sum(counts_), round(sum(n * CASES[c][1] for c, n in zip(names, counts_)), 1),
                round(sum(n * CASES[c][2] for c, n in zip(names, counts_)), 3))

    # ============================================================== order book and numbering
    C.sec("orders")
    ORD = A["orders"]
    wed = [r for r in ORD if r["delivery_date"] == DAY]
    tech_wed = sorted(r["outlet_id"] for r in wed if OUT.loc[r["outlet_id"], "brand"] == "Tech")
    C(M.LAST_ID == 97345 and M.LAST_ID_DATE == "2026-03-28", "the last order in the data is ORD0097345 (Saturday 28 March)")
    wed_streams = M.day_streams("Wed", ["OUT049"] + tech_wed)
    C(len(wed_streams) == M.expected_orders("Wed"), f"Wednesday has {len(wed_streams)} orders network-wide, the expected count for a Wednesday")
    w0 = M.first_id(DAY)
    ids = {s: f"ORD{w0 + i:07d}" for i, s in enumerate(wed_streams)}
    C(w0 == 98463, "Wednesday's block starts at ORD0098463 (numbers run on one block per operating day after 28 March)")
    tech_cand = M.tech_candidates("Wed")
    C(all(o in tech_cand for o in tech_wed + ["OUT049"]), "the Tech outlets that order on Wednesday are Wednesday Tech outlets in the data")
    kandy_streams = [s for s in wed_streams if OUT.loc[s[0], "depot"] == "Kandy"]
    got = {(r["outlet_id"], "chilled" if r["temp"] == "chilled" else "ambient"): r for r in wed}
    C(sorted(s for s in got if OUT.loc[s[0], "depot"] == "Kandy") == sorted(kandy_streams), "every Kandy Wednesday order stream is listed once")
    for s, r in got.items():
        C(r["order_id"] == ids[s], f"{s[0]} {r['temp']} is {ids[s]} (sorted by outlet, dry before chilled)")
    orders = {}
    for s, r in got.items():
        if OUT.loc[s[0], "depot"] != "Kandy":
            continue
        u, kg, m3 = int(r["units"]), float(r["kg"]), float(r["m3"])
        b = OUT.loc[s[0], "brand"]
        if r["cases"]:
            cu = [int(x) for x in r["cases"].split()]
            C(from_cases(r["temp"], cu) == (u, round(kg, 1), round(m3, 3)), f"{r['order_id']} size equals its cases")
            f = M.forecast_size(s[0], s[1], DAY)
            C(f["units"] == u and abs(kg / f["kg"] - 1) <= 0.03 and abs(m3 / f["m3"] - 1) <= 0.06,
              f"{r['order_id']} built from cases keeps the forecast's {f['units']} cases and is within 3% of its weight and 6% of its volume")
        elif b == "Fresh":
            f = M.forecast_size(s[0], s[1], DAY)
            C((f["units"], f["kg"], f["m3"]) == (u, kg, m3), f"{r['order_id']} is the forecast for {s[0]} ({u}, {kg}, {m3})")
        elif b == "Style":
            f = style_size(s[0], DAY)
            C((f["units"], f["kg"], f["m3"]) == (u, kg, m3), f"{r['order_id']} is the Style forecast for {s[0]}")
        else:
            x = M.DEL[M.DEL.outlet_id == s[0]]
            C((int(x.order_units.median()), round(float(x.order_weight_kg.median()), 1), round(float(x.order_volume_m3.median()), 3)) == (u, kg, m3),
              f"{r['order_id']} is {s[0]}'s median Tech order")
        rg = M.RANGE.loc[(s[0], s[1])]
        C(rg.u0 <= u <= rg.u1 and rg.k0 <= kg <= rg.k1 and rg.v0 <= m3 <= rg.v1, f"{r['order_id']} inside {s[0]}'s recorded range")
        orders[s] = dict(id=r["order_id"], outlet=s[0], temp=s[1], brand=b, district=OUT.loc[s[0], "district"], dock=OUT.loc[s[0], "dock_type"],
                         park=OUT.loc[s[0], "parking_constraint"], units=u, kg=kg, m3=m3, status=r["status"], vehicle=r["vehicle_id"],
                         trip=r["trip"], stop=r["stop"])
    mix = pd.Series([(o["brand"], o["temp"]) for o in orders.values()]).value_counts().to_dict()
    C(mix == {("Fresh", "ambient"): 31, ("Fresh", "chilled"): 23, ("Style", "ambient"): 1, ("Tech", "ambient"): 2},
      f"Kandy hub Wednesday: 31 Fresh dry, 23 Fresh chilled, 1 Style, 2 Tech ({mix})")
    deferred = [s for s, o in orders.items() if o["status"] == "deferred"]
    C(deferred == [("OUT117", "chilled")], "exactly one Kandy order waits: Dilani's chilled order")
    late = [r for r in wed if r["status"].startswith("late")]
    C(sorted((r["outlet_id"], r["temp"]) for r in late) == [("OUT032", "chilled"), ("OUT032", "dry")], "the two late orders are OUT032's")

    # Thursday
    thu = [r for r in ORD if r["delivery_date"] == THU]
    tech_thu = sorted(o for o in M.tech_candidates("Thu") if o in F["thursday"]["tech_outlets"])
    C(len(tech_thu) == M.expected_orders("Thu") - len(M.fixed_streams("Thu")), "Thursday's Tech count is the expected count")
    thu_streams = M.day_streams("Thu", tech_thu)
    t0 = M.first_id(THU)
    C(t0 == w0 + len(wed_streams), "Thursday's block follows Wednesday's")
    tids = {s: f"ORD{t0 + i:07d}" for i, s in enumerate(thu_streams)}
    C(F["thursday"]["block"] == [tids[thu_streams[0]], tids[thu_streams[-1]]], "Thursday block first and last numbers")
    for r in thu:
        s = (r["outlet_id"], "chilled" if r["temp"] == "chilled" else "ambient")
        C(r["order_id"] == tids[s], f"Thursday {s[0]} {r['temp']} is {tids[s]}")
        u, kg, m3 = int(r["units"]), float(r["kg"]), float(r["m3"])
        if r["cases"]:
            C(from_cases(r["temp"], [int(x) for x in r["cases"].split()]) == (u, kg, m3), f"{r['order_id']} size equals its cases")
        else:
            f = M.forecast_size(s[0], s[1], THU)
            C((f["units"], f["kg"], f["m3"]) == (u, kg, m3), f"{r['order_id']} is the Thursday forecast for {s[0]}")
        rg = M.RANGE.loc[(s[0], s[1])]
        C(rg.u0 <= u <= rg.u1 and rg.k0 <= kg <= rg.k1 and rg.v0 <= m3 <= rg.v1, f"{r['order_id']} inside {s[0]}'s recorded range")
    dthu = [r for r in thu if r["outlet_id"] == "OUT117" and r["temp"] == "dry"][0]
    own = [int(x) for x in dthu["cases"].split()]
    ft = F["thursday"]
    C(own[0] - ft["short_cases"] == ft["own_cases"][0] and own[1:] == ft["own_cases"][1:], "Thursday's dry order is Dilani's own order plus the short cases")
    f = M.forecast_size("OUT117", "ambient", THU)
    oc = from_cases("dry", ft["own_cases"])
    C(oc[0] == f["units"], f"Dilani's own Thursday dry order has the forecast's {f['units']} cases")
    C(abs(oc[1] / f["kg"] - 1) <= 0.05 and abs(oc[2] / f["m3"] - 1) <= 0.08, "Dilani's own Thursday dry order is within 5% of the forecast's weight and 8% of its volume")
    C("within 3% of its weight and 6% of its volume (5% and 8% for the Thursday order)" in md, "the text states the case-built tolerances the checks use")

    # ============================================================== the plan
    C.sec("plan")
    TR = A["trips"]
    trips = {}
    for r in TR:
        v, tn = r["vehicle_id"], int(r["trip"])
        seq = r["stops"].split()
        rows = []
        for o in seq:
            cand = [x for x in orders.values() if x["outlet"] == o and x["vehicle"] == v and str(x["trip"]) == str(tn)]
            C(len(cand) == 1, f"{v} trip {tn} stop {o} has exactly one order")
            if cand:
                rows.append(cand[0])
        C([x["stop"] for x in rows] == [str(i + 1) for i in range(len(rows))], f"{v} trip {tn} stop numbers run 1 to {len(rows)}")
        V_ = VEH.loc[v]
        brands = {x["brand"] for x in rows}
        dists = {x["district"] for x in rows}
        temps = {x["temp"] for x in rows}
        C(len(brands) == 1 and len(dists) == 1, f"{v} trip {tn}: one brand and one district")
        C(len(temps) == 1, f"{v} trip {tn}: chilled only or dry only (no trip in the data mixes them)")
        brand, dist, temp = rows[0]["brand"], rows[0]["district"], rows[0]["temp"]
        C(temp != "chilled" or V_.temp == "reefer", f"{v} trip {tn}: chilled rides only a refrigerated vehicle")
        C(not (brand == "Fresh" and temp == "ambient") or V_.temp == "ambient", f"{v} trip {tn}: Fresh dry never rides a refrigerated vehicle")
        C(all(x["park"] != "van_only" for x in rows) or V_.type == "van", f"{v} trip {tn}: van-only stores get a van")
        C(V_.depot == "Kandy" and all(OUT.loc[o, "depot"] == "Kandy" for o in seq), f"{v} trip {tn}: home depot")
        kg, m3, units = round(sum(x["kg"] for x in rows), 1), round(sum(x["m3"] for x in rows), 3), sum(x["units"] for x in rows)
        C((units, kg, m3) == (int(r["units"]), f1(r["kg"]), f1(r["m3"])), f"{v} trip {tn}: load {units} units, {kg} kg, {m3} m3")
        C(kg <= V_.weight_cap_kg and m3 <= V_.volume_cap_m3, f"{v} trip {tn}: within weight and volume caps")
        sm = M.std_minutes(dist, brand, [x["dock"] for x in rows])
        C(sm == int(r["std_min"]), f"{v} trip {tn}: {sm} minutes by the published standard (check_allocation.trip_time)")
        ff, back = M.simulate_ff(seq, hm(r["depart"]), brand)
        C(" ".join(fmt(a) for _, a, _, _ in ff) == r["planned_arrivals"], f"{v} trip {tn}: planned arrivals at free flow")
        C(fmt(back) == r["back_at_hub"], f"{v} trip {tn}: back at the hub {fmt(back)}")
        for o, a, _, _ in ff:
            C(a <= hm(OUT.loc[o, "window_close_time"]), f"{v} trip {tn}: planned arrival at {o} inside its window")
        C(hm(r["depart"]) >= M.EARLIEST, f"{v} trip {tn}: leaves no earlier than 2:00 AM (the earliest in the route history)")
        trips[(v, tn)] = dict(v=v, tn=tn, dep=hm(r["depart"]), seq=seq, rows=rows, brand=brand, district=dist, temp=temp, kg=kg, m3=m3,
                              std=sm, ff=ff, back=back, units=units)
        if dist == "Nuwara Eliya":
            C(seq == [o for o in NE_ROAD_ORDER if o in seq], f"{v} trip {tn}: Nuwara Eliya stops follow the road")
    served = [(x["outlet"], x["temp"]) for t in trips.values() for x in t["rows"]]
    C(len(served) == len(set(served)) and sorted(served + deferred) == sorted(orders), "every Kandy order is served once or waits")
    C(not any(v in workshop or v in standby for v, _ in trips), "no workshop or standby vehicle has a trip")
    for v in sorted({v for v, _ in trips}):
        ts = sorted(t for (vv, t) in trips if vv == v)
        C(len(ts) <= M.MAX_TRIPS, f"{v}: at most two trips")
        fresh = sum(trips[(v, t)]["std"] for t in ts if trips[(v, t)]["brand"] == "Fresh")
        day = sum(trips[(v, t)]["std"] for t in ts if trips[(v, t)]["brand"] != "Fresh")
        C(fresh <= M.TRIP_BUDGET_PREDAWN and day <= M.TRIP_BUDGET_DAYTIME, f"{v}: {fresh} of 270 Fresh and {day} of 480 daytime minutes")
        if 2 in ts:
            C(trips[(v, 2)]["dep"] >= trips[(v, 1)]["back"] + M.RELOAD, f"{v}: trip 2 leaves at least 10 minutes after trip 1 is back")
    running = {v for v, _ in trips}
    C(all((VT[v]["wednesday"] == "running") == (v in running) for v in VT if v not in workshop + standby), "vehicle statuses match the plan")
    C(len(running) == 12 and len(trips) == 18, f"12 vehicles and 18 trips ({len(running)}, {len(trips)})")
    lgw = pd.concat([M.LEGS_TR, M.LEGS_TE]).merge(CAL[["dow_name"]], left_on="date", right_index=True)
    k45 = lgw[(lgw.vehicle_id == "VEH045") & (lgw.seq == 0) & (lgw.dow_name == "Wed") & (lgw.brand == "Fresh")]
    C(int(k45.groupby("date").district.apply(lambda s_: {"Kegalle", "Kandy"} <= set(s_)).sum()) == 93, "VEH045 ran Kegalle and Kandy Fresh trips on 93 Wednesdays")
    b45 = trips[("VEH045", 1)]["back"]
    C(b45 + M.RELOAD + DT.loc["Kandy", "depot_to_district_freeflow_min"] > hm(OUT.loc["OUT085", "window_close_time"]),
      "on Relay's clock VEH045 would reach Kandy Town after its 7:30 close on a second trip, so VEH049 takes the Kandy dry run")
    C(15.0 < M.DEL[(M.DEL.depot == "Kandy") & (M.DEL.brand == "Tech")].order_volume_m3.max() < 15.5, "a single Kandy Tech order can be 15 m3")
    ref = sorted(v for v in VT if VEH.loc[v, "temp"] == "reefer")
    C(sum(1 for v in ref if v in running) == 5 and sum(1 for v in ref if v in workshop) == 2, "refrigerated: 5 running, 2 in the workshop")
    amb = [v for v in VT if VEH.loc[v, "temp"] == "ambient"]
    C((sum(v in running for v in amb), sum(v in standby for v in amb), sum(VT[v]["wednesday"] == "not needed" for v in amb)) == (7, 1, 7),
      "ambient: 7 running, 1 standby, 7 not needed")

    # fuel
    C.sec("fuel")
    tfuel = {(v, tn): dict(district=t["district"], stops=t["seq"], std=t["std"], brand=t["brand"]) for (v, tn), t in trips.items()}
    mon_matale = sum(1 for o, t in M.fixed_streams("Mon") if t == "chilled" and OUT.loc[o, "district"] == "Matale")
    FU = M.fuel_week(tfuel, mon_extra={"VEH042": ("Matale", mon_matale), "VEH057": ("Kegalle", 2)},
                     tue_extra={"VEH042": ("Kandy", M.tue_v39_kandy_stops())}, out=workshop)
    for r in A["fuel"]:
        v = r["vehicle_id"]
        x = FU[v]
        C((x["fresh"], x["day"], f"{x['mon']:.1f}", f"{x['tue']:.1f}", f"{x['wed']:.1f}", f"{x['week']:.1f}", x["quota"])
          == (int(r["fresh_min"]), int(r["daytime_min"]), r["mon_l"], r["tue_l"], r["wed_l"], r["week_l"], int(r["quota_l"])), f"{v} fuel row")
        C(x["week"] <= x["quota"], f"{v}: {x['week']:.1f} of {x['quota']} L this week, within the weekly quota")

    # ============================================================== expected times at publish
    C.sec("expected")
    EXPT = {}
    for (v, tn) in sorted(trips):
        t = trips[(v, tn)]
        if t["brand"] != "Fresh":
            continue
        dep = t["dep"] if tn == 1 else max(t["dep"], EXPT[(v, 1)]["back"] + M.RELOAD)
        rows, back = M.simulate_model(t["seq"], dep, "Fresh", DAY)
        EXPT[(v, tn)] = dict(rows=rows, back=back)
    er = {(r["vehicle_id"], int(r["trip"]), r["outlet_id"]): r for r in A["expected"]}
    late_pub = []
    for (v, tn), e in EXPT.items():
        for (o, a, _, _), (_, p, _, _) in zip(e["rows"], trips[(v, tn)]["ff"]):
            r = er.get((v, tn, o))
            lt = a > hm(OUT.loc[o, "window_close_time"])
            if lt:
                late_pub.append((v, tn, o, a))
            C(r is not None and (r["planned"], r["expected"], int(r["after_window"])) == (fmt(p), fmt(a), int(lt)), f"{v} trip {tn} {o}: planned {fmt(p)}, expected {fmt(a)}")
    n_fresh = sum(len(t["seq"]) for t in trips.values() if t["brand"] == "Fresh")
    C(n_fresh == 53, "53 Fresh stops on Wednesday")
    C(len(late_pub) == F["publish"]["expected_after_window"], f"{len(late_pub)} of 53 Fresh stops expected after their window")
    # Relay's departures: no other departure for the same stop order has fewer stops expected after the window
    for (v, tn), t in trips.items():
        if t["brand"] != "Fresh" or tn == 2:
            continue
        cur = count_late(t["seq"], t["dep"], trips.get((v, 2)))
        best = min(count_late(t["seq"], d, trips.get((v, 2))) for d in range(M.EARLIEST, t["dep"] + 61, 5)
                   if feasible_first(t["seq"], d, trips.get((v, 2))))
        C(cur <= best, f"{v}: its departure has the fewest stops expected late for its stop order ({cur})")

    import itertools as _it
    for (v, tn), t in trips.items():
        if t["brand"] != "Fresh" or tn != 2:
            continue
        edep = max(t["dep"], EXPT[(v, 1)]["back"] + M.RELOAD)
        def late_n(seq_):
            rows_, _ = M.simulate_model(list(seq_), edep, "Fresh", DAY)
            return sum(1 for o_, a_, _, _ in rows_ if a_ > hm(OUT.loc[o_, "window_close_time"]))
        options_ = [p_ for p_ in _it.permutations(t["seq"]) if all(a_ <= hm(OUT.loc[o_, "window_close_time"]) for o_, a_, _, _ in M.simulate_ff(list(p_), t["dep"], "Fresh")[0])]
        C(late_n(t["seq"]) == min(late_n(p_) for p_ in options_), f"{v} trip 2: its stop order has the fewest stops expected late ({late_n(t['seq'])})")
    edep42 = max(trips[("VEH042", 2)]["dep"], EXPT[("VEH042", 1)]["back"] + M.RELOAD)
    a85 = [[a_ for o_, a_, _, _ in M.simulate_model(list(p_), edep42, "Fresh", DAY)[0] if o_ == "OUT085"][0] for p_ in _it.permutations(trips[("VEH042", 2)]["seq"])]
    C(min(a85) > hm(OUT.loc["OUT085", "window_close_time"]), "Kandy Town would miss its 7:30 close in any stop order")
    # Matale runs leave earlier than the route history ever has; the text says so and what a usual departure would cost
    PM_ = F["publish"]["matale_departures"]
    SBm = M.matale_first_departures()
    C(trips[("VEH048", 1)]["dep"] < hm(SBm["matale_first_dep_min_dry"])
      and trips[("VEH042", 1)]["dep"] < hm(SBm["matale_first_dep_min_chilled"]),
      "Relay's Matale departures (2:30 dry, 2:44 chilled) are earlier than any in the route history (3:33, 2:55)")
    C(PM_["VEH048"]["depart"] == SBm["matale_first_dep_median_dry"], "VEH048's counterfactual departure is the history's median Matale dry departure")
    C(PM_["VEH042"]["depart"] == SBm["matale_first_dep_min_chilled"], "VEH042's counterfactual departure is the history's earliest Matale chilled departure")
    r48, _ = M.simulate_model(trips[("VEH048", 1)]["seq"], hm(PM_["VEH048"]["depart"]), "Fresh", DAY)
    n48 = sum(1 for o_, a_, _, _ in r48 if a_ > hm(OUT.loc[o_, "window_close_time"]))
    n48now = sum(1 for o_, a_, _, _ in EXPT[("VEH048", 1)]["rows"] if a_ > hm(OUT.loc[o_, "window_close_time"]))
    C((n48, n48now) == (PM_["VEH048"]["late"], PM_["VEH048"]["late_now"]), f"VEH048 leaving {PM_['VEH048']['depart']}: {n48} stops expected late ({n48now} now)")
    _, b42x = M.simulate_model(trips[("VEH042", 1)]["seq"], hm(PM_["VEH042"]["depart"]), "Fresh", DAY)
    _, b42f = M.simulate_ff(trips[("VEH042", 1)]["seq"], hm(PM_["VEH042"]["depart"]), "Fresh")
    r42x, _ = M.simulate_model(trips[("VEH042", 2)]["seq"], max(trips[("VEH042", 2)]["dep"], b42f + M.RELOAD, b42x + M.RELOAD), "Fresh", DAY)
    n42 = sum(1 for o_, a_, _, _ in r42x if a_ > hm(OUT.loc[o_, "window_close_time"]))
    n42now = sum(1 for o_, a_, _, _ in EXPT[("VEH042", 2)]["rows"] if a_ > hm(OUT.loc[o_, "window_close_time"]))
    C((n42, n42now) == (PM_["VEH042"]["trip2_late"], PM_["VEH042"]["trip2_late_now"]), f"VEH042 leaving {PM_['VEH042']['depart']}: {n42} of its second-trip stores expected late ({n42now} now)")
    # Maskeliya: an idle truck could take it alone; the text states the cost of that choice
    O7 = F["publish"]["out107_alone"]
    f7, b7 = M.simulate_ff(["OUT107"], hm(O7["depart"]), "Fresh")
    e7, _ = M.simulate_model(["OUT107"], hm(O7["depart"]), "Fresh", DAY)
    C(VT[O7["truck"]]["wednesday"] == "not needed" and VEH.loc[O7["truck"], "type"] == "truck" and VEH.loc[O7["truck"], "temp"] == "ambient",
      f"{O7['truck']} is an idle ambient truck on Wednesday")
    C((fmt(f7[0][1]), fmt(e7[0][1]), M.std_minutes("Nuwara Eliya", "Fresh", ["rear_dock"]), round(M.trip_litres(O7["truck"], "Nuwara Eliya", 1)), round((b7 - hm(O7["depart"])) / 60))
      == (O7["planned"], O7["expected"], O7["std"], O7["litres"], O7["hours"]), "Maskeliya alone: planned 3:51, expected about 4:21, 126 minutes, about 23 L, about 4 hours at free flow")
    C(e7[0][1] <= hm(OUT.loc["OUT107", "window_close_time"]), "alone, Maskeliya would be expected inside its window")
    for v in ["VEH040", "VEH041", "VEH043"]:
        C(trips[(v, 1)]["back"] > hm("08:40"), f"publish check: {v} is back after 8:40 AM")
    C(trips[("VEH057", 1)]["back"] == hm("06:02"), "publish check: VEH057 is back at 6:02 (needed for Kegalle, rule 1)")

    # ============================================================== why one chilled order waits
    C.sec("deferral")
    chilled = {s: dict(district=o["district"], kg=o["kg"], m3=o["m3"]) for s, o in orders.items() if o["temp"] == "chilled"}
    opts = M.trip_options(chilled)
    R5 = ["VEH040", "VEH041", "VEH042", "VEH043", "VEH057"]
    R7 = sorted(R5 + workshop)
    FD = F["deferral"]
    n5, _ = M.solve(chilled, R5, options=opts)
    C(n5 == FD["served_max_5"] == 22, f"with 5 refrigerated vehicles no plan serves more than {n5} of 23 inside the windows")
    n5b, _ = M.solve(chilled, R5, options=opts, reload=0)
    C(n5b == FD["served_max_5_no_reload"] == 22, "even with no reload time at the dock: at most 22")
    np5, pplan = M.solve(chilled, R5, options=opts, clock=False)
    C(np5 == FD["served_paper_5"] == 23, "by the organizers' rules alone (no clock) all 23 fit on paper")
    n7, _ = M.solve(chilled, R7, options=opts)
    C(n7 == FD["served_max_7"] == 23, "with all 7 refrigerated vehicles all 23 fit")
    for extra, key in [("VEH058", "served_max_6_with_VEH058"), ("VEH039", "served_max_6_with_VEH039")]:
        n6, _ = M.solve(chilled, R5 + [extra], options=opts)
        C(n6 == FD[key] == 23, f"with {extra} back all 23 fit")
    need, _ = M.solve(chilled, R7, options=opts, objective="min_vehicles")
    C(need == FD["needed_of_7"] == 6, "Wednesday 8 April needs 6 refrigerated vehicles")
    ordinary = ordinary_wednesday()
    no, _ = M.solve(ordinary, R5)
    C(no == FD["ordinary_wednesday_served_5"], f"on an ordinary Wednesday five refrigerated vehicles serve {no} of 23")
    usual = {v: {tuple(s) for s in ss} for v, ss in FD["usual_runs"].items()}
    usual = {v: {(o, "chilled") for o in ss} for v, ss in FD["usual_runs"].items()}
    pool, kept5 = [], []
    for k in chilled:
        others = [x for x in chilled if x != k]
        v, _ = M.solve(chilled, R5, forbid=[k], force=others, options=opts)
        if v == 22:
            pool.append(k[0])
            kv, _ = M.solve(chilled, R5, objective="max_kept", usual=usual, forbid=[k], force=others, options=opts)
            if kv == 5:
                kept5.append(k[0])
    C(sorted(pool) == sorted(FD["pool"]), f"{len(pool)} orders could each have been the one to wait")
    C(sorted(kept5) == sorted(FD["pool_keeping_usual_runs"]) == ["OUT117", "OUT119"], "only OUT117 or OUT119 waiting keeps all five on their usual runs")
    lightest = min(pool, key=lambda o: chilled[(o, "chilled")]["kg"])
    C([lightest, chilled[(lightest, "chilled")]["kg"]] == FD["lightest"], f"the lightest order in the pool is {lightest}")
    kk = {o: chilled[(o, "chilled")]["kg"] for o in ["OUT116", "OUT117", "OUT119"]}
    mm = {o: chilled[(o, "chilled")]["m3"] for o in ["OUT116", "OUT117", "OUT119"]}
    van = VEH.loc["VEH057"]
    C(round(sum(kk.values()), 1) == FD["kegalle_kg"] and round(sum(mm.values()), 3) == FD["kegalle_m3"], "the three Kegalle chilled orders")
    C(sum(kk.values()) > van.weight_cap_kg and sum(mm.values()) > van.volume_cap_m3, "the three Kegalle orders overfill a refrigerated van")
    C(kk["OUT116"] + kk["OUT119"] <= van.weight_cap_kg and kk["OUT117"] + kk["OUT119"] > van.weight_cap_kg, "with OUT119 protected, OUT116 rides and OUT117 waits")
    C(kk["OUT117"] > kk["OUT119"], "without the protection rule Relay would keep OUT117 (more goods) and OUT119 would wait")
    C(M.latest_departure(["OUT116", "OUT117", "OUT119"]) < trips[("VEH057", 1)]["back"] + M.RELOAD,
      "VEH057 cannot leave in time to reach all three Kegalle stores inside their windows")
    for v in ["VEH040", "VEH041", "VEH043"]:
        C(trips[(v, 1)]["back"] > hm("08:40"), f"{v} is back after 8:40 AM, too late for any second Fresh trip")
    C(trips[("VEH042", 1)]["district"] == "Matale" and trips[("VEH042", 2)]["district"] == "Kandy" and trips[("VEH057", 2)]["seq"] == ["OUT116", "OUT119"],
      "rule 1: VEH042 runs Matale before its Kandy run; VEH057's second trip runs Kegalle")
    C(M.earliest_back(["OUT116", "OUT117", "OUT119"], trips[("VEH057", 2)]["dep"]) is None, "dragging Dilani's order onto VEH057 trip 2 also breaks a window")
    # paper plan
    P = FD["paper_plan"]
    pmin = {}
    for v, tn, st in P:
        sk = [(o, "chilled") for o in st]
        sm = M.std_minutes(chilled[sk[0]]["district"], "Fresh", [OUT.loc[o, "dock_type"] for o in st])
        C(sum(chilled[s]["kg"] for s in sk) <= VEH.loc[v, "weight_cap_kg"] and sum(chilled[s]["m3"] for s in sk) <= VEH.loc[v, "volume_cap_m3"],
          f"paper plan {v} trip {tn} within caps")
        C(len({chilled[s]["district"] for s in sk}) == 1, f"paper plan {v} trip {tn} one district")
        pmin[v] = pmin.get(v, 0) + sm
    C(sorted((o, "chilled") for *_, st in P for o in st) == sorted(chilled), "the paper plan serves all 23")
    C(max(pmin.values()) <= 270 and pmin == FD["paper_minutes"], f"paper plan minutes {pmin}")
    _, b40 = M.simulate_ff(["OUT110", "OUT111"], hm("02:00"), "Fresh")
    r87, _ = M.simulate_ff(["OUT087"], b40 + M.RELOAD, "Fresh")
    C([fmt(b40), fmt(r87[0][1])] == FD["paper_veh040"], "paper plan: VEH040 back 9:05, Mulgampola at 9:31, after its 8:00 close")
    C(r87[0][1] > hm(OUT.loc["OUT087", "window_close_time"]), "Mulgampola would be reached after it closes")
    C(pmin["VEH040"] - 31 + M.std_minutes("Kegalle", "Fresh", ["rear_dock"]) == FD["veh040_kegalle_paper"] > M.TRIP_BUDGET_PREDAWN,
      "VEH040 cannot take Dilani's order even on paper: 239 + 68 = 307 of 270 minutes")
    # the example behind "every plan that leaves OUT111 moves another vehicle off its usual run"
    LX = FD["lightest_example"]
    (s1, s2) = LX["VEH040"]
    m1, m2 = [M.std_minutes(OUT.loc[x[0], "district"], "Fresh", [OUT.loc[o, "dock_type"] for o in x]) for x in (s1, s2)]
    b1 = M.earliest_back(s1, M.EARLIEST)
    C([m1, m2] == LX["veh040_minutes"] and m1 + m2 <= 270 and b1 is not None and M.latest_departure(s2) >= b1 + M.RELOAD,
      "the example: VEH040 delivers Kegalle at dawn, then a shorter Badulla run, inside 270 minutes and every window")
    v57 = LX["VEH057_trip_2"]
    C(sum(chilled[(o, "chilled")]["kg"] for o in v57) <= VEH.loc["VEH057", "weight_cap_kg"] and M.latest_departure(v57) >= trips[("VEH057", 1)]["back"] + M.RELOAD,
      "the example: VEH057's second trip takes Aranayake and Hemmathagama")
    cover = set(s1 + s2 + v57) | {o for v in ["VEH041", "VEH042", "VEH043"] for t in (1, 2) if (v, t) in trips for o in trips[(v, t)]["seq"] if trips[(v, t)]["temp"] == "chilled"}         | set(trips[("VEH057", 1)]["seq"])
    C(sorted((o, "chilled") for o in cover) == sorted(k for k in chilled if k[0] != "OUT111"), "the example serves every chilled order but Hali-Ela's")
    b42 = trips[("VEH042", 1)]["back"]
    C(M.earliest_back(["OUT116", "OUT117", "OUT119"], b42 + M.RELOAD) is None, "VEH042 after Matale cannot reach all three Kegalle stores in time")
    third = b42 + M.RELOAD + DT.loc["Kegalle", "depot_to_district_freeflow_min"] + 2 * (15 + DT.loc["Kegalle", "inter_stop_freeflow_min"])
    C(fmt(third) == FD["paper_veh042_third_stop"], f"its third Kegalle stop would be {fmt(third)}")
    # protected store on VEH057 trip 2
    e57 = {o: a for o, a, _, _ in EXPT[("VEH057", 2)]["rows"]}
    C(fmt(e57["OUT119"]) == FD["protected_expected"] and e57["OUT119"] > hm("08:00"), "OUT119 is expected after its window, the same morning")
    # Monday: VEH039 fails at 2:50 AM loaded for Matale; the Matale load moves whole to VEH042; Kegalle goes to VEH057 trip 2
    MO = F["monday"]
    mon = forecast_day(MON)
    keg = {s: x for s, x in mon.items() if x["district"] == "Kegalle"}
    mat = {s: x for s, x in mon.items() if x["district"] == "Matale"}
    C(sorted(s[0] for s in keg) == ["OUT116", "OUT118", "OUT119"], "Monday's Kegalle chilled orders are OUT116, OUT118, OUT119")
    C(round(sum(x["kg"] for x in keg.values()), 1) == MO["kegalle_kg"], "Monday Kegalle chilled weight")
    C(round(sum(x["kg"] for x in mat.values()), 1) == MO["matale_kg"], "Monday Matale chilled weight")
    C(all(M.SHARE.loc[(o, "Fresh", "chilled"), "Mon"] > 0.9 for o, _ in keg), "the Kegalle stores order chilled on Mondays")
    r42 = hm(MO["veh042_ready"])
    C(r42 - hm("02:50") >= 60, "VEH042 leaves at least an hour after the failure (cool-down and loading)")
    b42m = M.earliest_back([s[0] for s in mat], r42)
    C(b42m is not None and fmt(b42m) == MO["veh042_back"], f"VEH042 runs Matale whole from {MO['veh042_ready']} and is back at {MO['veh042_back']}")
    C(fmt(b42m + M.RELOAD + DT.loc["Kegalle", "depot_to_district_freeflow_min"]) == MO["veh042_kegalle_earliest"]
      and all(M.earliest_back([s[0]], b42m + M.RELOAD) is None for s in keg), "back from Matale, VEH042 cannot reach any Kegalle store before it closes")
    vanm = [s[0] for s, x in mon.items() if x["district"] == "Kandy" and OUT.loc[s[0], "parking_constraint"] == "van_only"]
    b57 = M.earliest_back(vanm, hm("03:40"))
    C(fmt(b57) == MO["veh057_first_trip_back"], "VEH057's Monday first trip (the van-only stores) is back in time for a second trip")
    best = None
    for r_ in range(1, len(keg) + 1):
        for S in __import__("itertools").combinations(sorted(keg), r_):
            kgs = sum(keg[x]["kg"] for x in S)
            if kgs <= VEH.loc["VEH057", "weight_cap_kg"] and sum(keg[x]["m3"] for x in S) <= VEH.loc["VEH057", "volume_cap_m3"] \
                    and M.earliest_back([x[0] for x in S], b57 + M.RELOAD) is not None and (best is None or kgs > best[0]):
                best = (kgs, S)
    C(sorted(x[0] for x in best[1]) == ["OUT116", "OUT118"] and round(best[0], 1) == MO["van_kg"], "the van takes OUT116 and OUT118, the pair that fits and moves the most goods")
    C(round(keg[("OUT119", "chilled")]["kg"], 1) == MO["out119_kg"] and sum(keg[x]["kg"] for x in keg) > VEH.loc["VEH057", "weight_cap_kg"], "OUT119 waited for Tuesday")
    lg = pd.concat([M.LEGS_TR, M.LEGS_TE]).merge(CAL[["dow_name"]], left_on="date", right_index=True)
    C(lg[(lg.vehicle_id == "VEH042") & (lg.dow_name == "Mon")].date.nunique() == MO["veh042_mondays"], "VEH042 runs on few Mondays")
    tue = forecast_day(TUE)
    tue[("OUT119", "chilled-mon")] = dict(district="Kegalle", kg=keg[("OUT119", "chilled")]["kg"], m3=keg[("OUT119", "chilled")]["m3"])
    nt, _ = M.solve(tue, R5)
    C(nt == len(tue) == F["tuesday"]["served"], f"Tuesday: 5 refrigerated vehicles serve all {len(tue)} chilled orders, OUT119's Monday order included")
    # Thursday: the next run can carry it
    th = forecast_day(THU)
    th[("OUT117", "chilled-wed")] = dict(district="Kegalle", kg=orders[("OUT117", "chilled")]["kg"], m3=orders[("OUT117", "chilled")]["m3"])
    nth, _ = M.solve(th, R7, objective="min_vehicles")
    C(nth == ft["needed_of_7"], f"Thursday with Dilani's order added needs {nth} of 7 refrigerated vehicles")
    kt = [s for s in th if th[s]["district"] == "Kegalle"]
    C(round(sum(th[s]["kg"] for s in kt), 1) == ft["kegalle_kg"] and round(sum(th[s]["m3"] for s in kt), 3) == ft["kegalle_m3"], "Thursday Kegalle chilled load")
    C(sum(th[s]["kg"] for s in kt) <= VEH.loc["VEH039", "weight_cap_kg"], "it fits VEH039")
    kseq = ft["kegalle_sequence"]
    C(M.std_minutes("Kegalle", "Fresh", [OUT.loc[o, "dock_type"] for o in kseq]) == ft["kegalle_std"], "Thursday Kegalle standard minutes")
    ffk, bk = M.simulate_ff(kseq, hm(ft["kegalle_depart"]), "Fresh")
    C([fmt(a) for _, a, _, _ in ffk] == ft["kegalle_planned"] and all(a <= hm(OUT.loc[o, "window_close_time"]) for o, a, _, _ in ffk),
      "Thursday Kegalle run: every planned arrival inside its window")
    C(fmt(bk) == ft["kegalle_back"], f"Thursday Kegalle run back at {fmt(bk)}")
    # VEH039's usual Thursday is Kegalle then Matale: the extra Hemmathagama stop must still leave room for Matale
    tmat = sorted(o for o, t in M.fixed_streams("Thu") if t == "chilled" and OUT.loc[o, "district"] == "Matale")
    C(tmat == ft["matale_outlets"], "Thursday's Matale chilled stores")
    day_std = ft["kegalle_std"] + M.std_minutes("Matale", "Fresh", [OUT.loc[o, "dock_type"] for o in tmat])
    C(day_std == ft["day_std"] <= M.TRIP_BUDGET_PREDAWN, f"VEH039 on Thursday: {day_std} of 270 standard minutes with both trips")
    C(M.earliest_back(tmat, bk + M.RELOAD) is not None, "VEH039's Thursday Matale trip still fits after the Kegalle trip")
    _, bk_late = M.simulate_ff(kseq, hm(ft["too_late_depart"]), "Fresh")
    C(M.earliest_back(tmat, bk_late + M.RELOAD) is None, "leaving Kegalle at 3:00 or later, the Matale trip no longer fits")
    lg39 = pd.concat([M.LEGS_TR, M.LEGS_TE])
    lg39 = lg39[(lg39.vehicle_id == "VEH039") & (lg39.brand == "Fresh") & (lg39.seq == 0)]
    lg39 = lg39[lg39.date.map(CAL.dow_name) == "Thu"]
    dd39 = lg39.groupby("date").district.apply(set)
    C((len(dd39), int((dd39 == {"Kegalle", "Matale"}).sum())) == (ft["veh039_thursdays"], ft["veh039_kegalle_matale"]),
      f"VEH039 ran Kegalle and Matale on {int((dd39 == {'Kegalle', 'Matale'}).sum())} of the {len(dd39)} Thursdays it ran")

    # ============================================================== Kasun
    C.sec("kasun")
    KT = A["kasun"]
    EV = {r["event"]: r["time"] for r in A["kasun_events"]}
    after = [r["outlet_id"] for r in KT]
    before = [r["outlet_id"] for r in sorted(KT, key=lambda r: int(r["stop_before_912"]))]
    C(after == ["OUT119", "OUT118", "OUT117", "OUT116"] == trips[("VEH045", 1)]["seq"], "Kasun's stops after 9:12 PM")
    C(before == ["OUT119", "OUT118", "OUT116", "OUT117"], "before 9:12 PM Aranayake was stop 3 and Hemmathagama stop 4")
    for label, seq, pcol, ecol in [("before", before, "planned_before_912", "expected_before_912"), ("after", after, "planned", "expected")]:
        ff, _ = M.simulate_ff(seq, hm(EV["planned_departure"]), "Fresh")
        ex, eb = M.simulate_model(seq, hm(EV["planned_departure"]), "Fresh", DAY)
        for (o, a, _, _), (_, e, _, _) in zip(ff, ex):
            r = [x for x in KT if x["outlet_id"] == o][0]
            C((r[pcol], r[ecol]) == (fmt(a), fmt(r5(e))), f"{label} 9:12 PM, {o}: planned {fmt(a)}, expected about {fmt(r5(e))}")
            C(a <= hm(OUT.loc[o, "window_close_time"]) and e <= hm(OUT.loc[o, "window_close_time"]), f"{label} 9:12 PM, {o}: planned and expected inside the window")
    C(M.std_minutes("Kegalle", "Fresh", [OUT.loc[o, "dock_type"] for o in after]) == 153, "Kasun's run is 153 standard minutes")
    # why Kegalle town first: Mawanella is the slowest of the four to unload, and the data has no map inside a district
    med = {o: M.DWELL.loc[o, 0.5] for o in after}
    C(max(med, key=med.get) == "OUT118" and OUT.loc["OUT118", "dock_type"] == "street", f"Mawanella is the slowest stop of the run to unload (medians {med})")
    C(f"every pair of Kegalle stores is the same {int(DT.loc['Kegalle', 'inter_stop_freeflow_min'])} minutes apart at free flow" in md,
      "the text states the data's single inter-stop time for Kegalle")
    # the 9:12 PM swap: the reason holds on the planned clock only, and Relay states its cost on the expected clock
    FK = F["kasun"]
    ffb, _ = M.simulate_ff(before, hm(EV["planned_departure"]), "Fresh")
    ffa, _ = M.simulate_ff(after, hm(EV["planned_departure"]), "Fresh")
    exb, _ = M.simulate_model(before, hm(EV["planned_departure"]), "Fresh", DAY)
    exa, eba = M.simulate_model(after, hm(EV["planned_departure"]), "Fresh", DAY)
    first_light = hm("05:40")   # story knowledge: first light in Kandy in early April
    leave_b = [lv for o_, _, _, lv in ffb if o_ == "OUT118"][0]
    leave_a = [lv for o_, _, _, lv in ffa if o_ == "OUT117"][0]
    C(leave_b < first_light <= leave_a, "on the planned clock the swap moves the Aranayake hill road from before first light (5:17) to after it (5:45)")
    C(all([lv for o_, _, _, lv in ex if o_ == pre][0] >= first_light for ex, pre in [(exb, "OUT118"), (exa, "OUT117")]),
      "on the expected clock Kasun reaches the hill road after first light in either order (the text says so)")
    mb = hm("07:30") - [a_ for o_, a_, _, _ in exb if o_ == "OUT116"][0]
    ma = hm("07:30") - [a_ for o_, a_, _, _ in exa if o_ == "OUT116"][0]
    C((round(mb), round(ma)) == (FK["margin_before_912"], FK["margin_after_912"]), f"Aranayake's expected margin before its 7:30 close drops from {round(mb)} to {round(ma)} minutes")
    a116 = [fmt([a_ for o_, a_, _, _ in ex if o_ == "OUT116"][0]) for ex in (exb, exa)]
    C([hm("07:30") - hm(x) for x in a116] == [FK["margin_before_912"], FK["margin_after_912"]]
      and f"moves from {ampm(hm(a116[0]), suffix=False)} to {ampm(hm(a116[1]), suffix=False)}" in md,
      f"the swap's cost is printed to the minute ({a116[0]} to {a116[1]}), so the times and the margins agree")
    C(fmt(exa[0][1]) == FK["expected_first_stop_3_40"], "Relay expected Kegalle at 4:48 for a 3:40 start")
    e44, _ = M.simulate_model(after, hm(EV["departed"]), "Fresh", DAY)
    C(fmt(e44[0][1]) == KT[0]["arrived"], "leaving 4 minutes late, Kasun arrives at Kegalle on Relay's time (4:52)")
    C(fmt(r5(eba)) == FK["home_at_publish"], "at publish Relay expected him back at the hub around 9:20")
    t_prev = hm(EV["departed"])
    C(0 <= t_prev - hm(EV["planned_departure"]) <= 15, "Kasun leaves within the route history's 90th percentile departure delay")
    for i, r in enumerate(KT):
        o, a, dl, l = r["outlet_id"], hm(r["arrived"]), hm(r["delivered"]), hm(r["left"])
        C(t_prev < a < dl <= l, f"stop {i + 1}: arrived, delivered and left in order")
        C(hm(OUT.loc[o, "window_open_time"]) <= a <= hm(OUT.loc[o, "window_close_time"]), f"stop {i + 1} {o}: arrived inside its window")
        ffm = DT.loc["Kegalle", "depot_to_district_freeflow_min"] if i == 0 else DT.loc["Kegalle", "inter_stop_freeflow_min"]
        q = M.RATIO_KEG.loc[(i > 0, t_prev // 60)]
        C(q[0.1] - 1e-9 <= (a - t_prev) / ffm <= q[0.9] + 1e-9, f"stop {i + 1}: travel {(a - t_prev) / ffm:.2f} times free flow, inside Kegalle monsoon p10 to p90")
        dw = l - max(a, hm(OUT.loc[o, "window_open_time"]))
        C(M.DWELL.loc[o, 0.1] <= dw <= M.DWELL.loc[o, 0.9], f"stop {i + 1}: {dw} minutes at the store, inside {o}'s monsoon p10 to p90")
        t_prev = l
    lost, back = hm(EV["signal_lost"]), hm(EV["signal_back"])
    C(back - lost == 93, "offline 93 minutes, 5:41 to 7:14")
    C(hm(KT[1]["arrived"]) < lost < hm(KT[1]["left"]), "signal lost during stop 2, Mawanella")
    C(hm(KT[3]["delivered"]) < back, "stop 4 delivered before the signal returns")
    C(hm(EV["backup_moved"]) - lost == 34, "stop 4 moved after 34 minutes of silence")
    C(hm(KT[2]["delivered"]) < hm(EV["store_receipt"]) < hm(EV["backup_kept"]) < back, "the store confirms receipt after the goods arrived, Nuwan keeps the backup, then Kasun reconnects")
    C(EV["answered"] == EV["backup_cancelled"] and hm(EV["resolved"]) == hm(EV["answered"]) + 1, "answer, cancel and resolve times")
    # drivers act only when stopped (booklet p.6): every tap on Kasun's phone falls while he is at the dock or at a store
    stops_ = [(hm(EV["planned_departure"]) - 60, hm(EV["departed"]))] + [(hm(r["arrived"]), hm(r["left"])) for r in KT]
    for ev in ["answered", "summary", "finish"]:
        C(any(a_ <= hm(EV[ev]) <= l_ for a_, l_ in stops_), f"Kasun's {ev} at {EV[ev]} happens while he is stopped")
    C(EV["left_last_stop"] == KT[3]["left"] and hm(EV["finish"]) < hm(EV["left_last_stop"]), "Kasun taps Finish trip at Aranayake's dock, then leaves")
    home = hm(EV["finish"]) + DT.loc["Kegalle", "depot_to_district_freeflow_min"] * M.factor("Kegalle", hm(EV["finish"]), DAY)
    C(fmt(r5(home)) == FK["home_after_finish"], f"after Finish trip Relay expects him at the hub around {fmt(r5(home))}")
    C(not any(r["time"] == "07:40" and r["day"] == "Wed" for r in A["timeline"]), "no Finish trip on the road at 7:40")
    # the estimate rule: last stop event (+ usual unloading if it is an arrival) + legs by the expected model; a store's
    # confirmed receipt counts as a delivery at the receipt time; range +-(15 + silence/2) rounded out, never before now
    e530 = estimate_chain(hm(KT[1]["arrived"]), 1, after)
    erec = estimate_chain(hm(EV["store_receipt"]), 2, after, arrived=False)
    for r in A["estimates"]:
        j = int(r["stop"]) - 1
        at = hm(r["at"])
        chain = erec if at >= hm(EV["store_receipt"]) else e530
        est = r5(chain[j])
        silence = at - lost
        w = 15 + silence / 2.0
        lo, hi = max(5 * math.ceil(at / 5.0), 5 * math.floor((est - w) / 5.0)), 5 * math.ceil((est + w) / 5.0)
        passed = at > est
        C(int(r["passed"]) == int(passed), f"past-estimate flag at {r['at']} stop {j + 1}")
        C(r["actual_arrival"] == KT[j]["arrived"], f"the {r['at']} row for stop {j + 1} names the actual arrival")
        if passed:
            C((r["estimate"], r["low"], r["high"], int(r["silence_min"])) == (fmt(est), "", "", silence), f"estimate at {r['at']} for stop {j + 1} has passed; no range shown")
            continue
        C((r["estimate"], r["low"], r["high"], int(r["silence_min"])) == (fmt(est), fmt(lo), fmt(hi), silence), f"estimate at {r['at']} for stop {j + 1}")
        C(lo >= at, f"the {r['at']} range for stop {j + 1} does not start before the time shown")
        C(lo <= hm(r["actual_arrival"]) <= hi, f"the {r['at']} range for stop {j + 1} contains the actual {r['actual_arrival']}")
    r642 = [r for r in A["estimates"] if r["at"] == EV["store_receipt"]]
    C(len(r642) == 1 and r642[0]["stop"] == "4" and hm(r642[0]["high"]) > hm(OUT.loc["OUT116", "window_close_time"]),
      "after the store's receipt Aranayake's estimate moves, and its range still runs past the 7:30 close (so Nuwan keeps the backup)")
    at605 = [r for r in A["estimates"] if r["at"] == "06:05" and r["stop"] == "4"][0]
    C(hm(at605["high"]) > hm(OUT.loc["OUT116", "window_close_time"]), "at 6:05 stop 4's range runs past Aranayake's 7:30 close")
    # the backup
    BK = F["backup"]
    bo = orders[("OUT116", "ambient")]
    C(VEH.loc["VEH060", "temp"] == "ambient" and bo["kg"] <= VEH.loc["VEH060", "weight_cap_kg"] and bo["m3"] <= VEH.loc["VEH060", "volume_cap_m3"],
      "Aranayake's dry order fits VEH060")
    C(round(trips[("VEH057", 2)]["kg"] + bo["kg"], 1) == BK["veh057_with"] and BK["veh057_with"] > 1040, "VEH057 has no room for it")
    eta = hm(EV["backup_leaves"]) + DT.loc["Kegalle", "depot_to_district_freeflow_min"] * M.factor("Kegalle", hm(EV["backup_leaves"]), DAY)
    C(fmt(r5(eta)) == BK["eta"] and eta > hm(OUT.loc["OUT116", "window_close_time"]), "VEH060 is expected after Aranayake's 7:30 close")
    C(M.std_minutes("Kegalle", "Fresh", ["rear_dock"]) == BK["std"], "backup trip standard minutes")
    C(round(M.trip_litres("VEH060", "Kegalle", 1), 1) == BK["trip_litres"], "backup trip litres")
    out_min = hm(EV["backup_cancelled"]) - hm(EV["backup_leaves"])
    f_out = M.factor("Kegalle", hm(EV["backup_leaves"]), DAY)
    out_km = DT.loc["Kegalle", "depot_to_district_km"] * out_min / (DT.loc["Kegalle", "depot_to_district_freeflow_min"] * f_out)
    back_min = out_km / DT.loc["Kegalle", "depot_to_district_km"] * DT.loc["Kegalle", "depot_to_district_freeflow_min"] * M.factor("Kegalle", hm(EV["backup_cancelled"]), DAY)
    C([out_min, round(2 * out_km), round(2 * out_km / VEH.loc["VEH060", "km_per_l"]), fmt(r5(hm(EV["backup_cancelled"]) + back_min))]
      == [BK["out_min"], BK["km"], BK["litres"], BK["home"]], "the cancelled backup: minutes out, km, litres, home time")

    # ============================================================== loading
    C.sec("loading")
    LD = A["loading"]
    kas_units = trips[("VEH045", 1)]["units"]
    short = ft["short_cases"]
    C(int(LD[-1]["loaded_cases"]) == kas_units - short, f"{kas_units - short} of {kas_units} cases loaded, {short} short")
    for a_, b_ in zip(LD, LD[1:]):
        dt = hm(b_["time"]) - hm(a_["time"])
        du = int(b_["loaded_cases"]) - int(a_["loaded_cases"])
        C(du >= 0 and (dt == 0 or du / dt <= 6.1), f"loading {a_['time']} to {b_['time']}: {du} cases in {dt} minutes (about 6 a minute at most)")
    stop4 = orders[("OUT116", "ambient")]["units"]
    rice3 = int(dthu_rice_wed(ORD))
    C(int([r for r in LD if r["time"] == "02:40"][0]["loaded_cases"]) == stop4, "at 2:40 stop 4 (Aranayake) is loaded: reverse stop order")
    C(int([r for r in LD if r["time"] == "02:47"][0]["loaded_cases"]) == stop4 + rice3 - short, "at 2:47 stop 3's rice and dhal runs out, heaviest case type first")
    C(LD[0]["time"] == "02:20" and int(LD[0]["loaded_cases"]) == 0, "loading starts about 2:20 AM")
    tlk = {(r["day"], r["time"]) for r in A["timeline"]}
    C(("Wed", "02:18") in tlk and ("Wed", "02:36") in tlk and ("Wed", "02:40") in tlk,
      "Rizwan signs in (2:18) before loading starts (2:20); Anjali signs in at 2:36, so Rizwan switches back at 2:40")

    # ============================================================== the morning on Nuwan's screen
    C.sec("morning")
    ACT = {}
    for (v, tn) in sorted(trips):
        t = trips[(v, tn)]
        if t["brand"] != "Fresh" or v == "VEH045":
            continue
        dep = t["dep"] + F["story"]["kandy_departure_delay_median"]
        if tn == 2:
            dep = max(dep, ACT[(v, 1)]["back"] + M.RELOAD)
        rows, bk_ = M.simulate_model(t["seq"], dep, "Fresh", DAY)
        ACT[(v, tn)] = dict(rows=rows, back=bk_, dep=dep)

    def known(T):
        n = sum(1 for a in ACT.values() for (_, _, _, lv) in a["rows"] if lv <= T)
        n += int(hm(KT[0]["left"]) <= T) + int(T >= hm(EV["store_receipt"])) + int(T >= back) + int(T >= hm(EV["answered"]))
        return n

    for T, n in F["counts"].items():
        C(known(hm(T)) == n, f"stops delivered as Relay knows them at {T}: {n} of 53")
    s42 = ACT[("VEH042", 1)]
    d42 = [round(a - f) for (_, a, _, _), (_, f, _, _) in zip(s42["rows"], trips[("VEH042", 1)]["ff"])]
    SP = F["sampath"]
    C(fmt(s42["dep"]) == SP["departed"] and fmt(s42["rows"][1][1]) == SP["stop2_arrival"] and d42 == SP["behind_plan"], "Sampath's Matale run behind plan")
    C(SP["reported"] == 5 * math.ceil(d42[1] / 5.0), "Sampath reports the delay rounded up to 5 minutes")
    C(M.RC[("Matale", DAY)] == 72 and M.RC[("Kegalle", DAY)] == 100 and M.RC[("Matale", PLAN_DAY)] == 82, "road index: Matale 72 (82 on Tuesday), Kegalle 100")
    mat = M.RC.xs("Matale")
    C(all(mat[d] < 90 for d in pd.date_range("2026-03-27", DAY).strftime("%Y-%m-%d")) and mat["2026-03-26"] >= 90, "Matale below 90 every day since 27 March")
    C(round((M.mult(DAY, "Fresh_chilled") - 1) * 100) == 38 and round((M.mult(DAY, "Fresh_dry") - 1) * 100) == 38, "Fresh orders about 38% larger (New Year lift times growth)")
    C(all(M.RC[(d, DAY)] == 100 for d in ["Kandy", "Badulla", "Nuwara Eliya"]), "road index 100 in the other Kandy districts")

    # ============================================================== the queue (DSP-01)
    C.sec("queue")
    Q = F["queue"]
    at400 = [s for s in wed_streams if s[0] != "OUT032"]
    at312 = [s for s in at400 if s[0] not in Q["not_ordered_312"] and s[0] not in Q["style_tech_after_312"]]
    C(bybrand(at312) == Q["at_312"], f"3:12 PM: {bybrand(at312)}")
    C(bybrand(at400) == Q["at_400"], f"4:00 PM: {bybrand(at400)}")
    C([ids[("OUT032", "ambient")], ids[("OUT032", "chilled")]] == Q["late_ids"], "OUT032's late orders keep Wednesday's numbers")
    C(all(OUT.loc[o, "brand"] == "Fresh" for o in Q["not_ordered_312"]), "the outlets not yet ordered at 3:12 PM are Fresh")

    # ============================================================== capacity outlook (DSP-05)
    C.sec("outlook")
    fc = M.FC[(M.FC.depot == "Kandy") & (M.FC.wk.between(202615, 202620))].pivot_table(index="wk", columns="g", values="pred", aggfunc="sum")
    for r in A["outlook"]:
        w = int(r["iso_week"])
        x = fc.loc[202600 + w]
        vals = [round(x.Fresh_chilled, 1), round(x.Fresh_dry, 1), round(x.Style, 1), round(x.Tech, 1)]
        C([f"{v:.1f}" for v in vals] == [r["chilled_m3"], r["dry_m3"], r["style_m3"], r["tech_m3"]], f"week {w} forecast m3 by group")
        C(f"{round(sum(vals), 1):.1f}" == r["all_m3"] and int(r["operating_days"]) == int(wk_ops[w]), f"week {w} total and operating days")
    C(M.backtest_kandy_fresh() == tuple(F["outlook"]["backtest"]), "backtest: method C against same week last year x growth, Kandy Fresh, 2025 weeks 14 to 23")
    OD = {r["date"]: r for r in A["outlook_days"]}
    days = list(CAL[(CAL.iso_year == 2026) & (CAL.iso_week.between(15, 20)) & (CAL.is_operating == 1)].index)
    C(sorted(OD) == days, f"{len(days)} operating days in weeks 15 to 20")
    for d in days:
        o_ = forecast_day(d) if d != DAY else dict(chilled)   # 8 April uses the order book
        if d == THU:
            o_[("OUT117", "chilled-wed")] = dict(district="Kegalle", kg=orders[("OUT117", "chilled")]["kg"], m3=orders[("OUT117", "chilled")]["m3"])
        r = OD[d]
        C((len(o_), f"{round(sum(x['kg'] for x in o_.values()), 1):.1f}", f"{round(sum(x['m3'] for x in o_.values()), 1):.1f}")
          == (int(r["chilled_orders"]), r["chilled_kg"], r["chilled_m3"]), f"{d} chilled orders forecast")
        C(int(r["available"]) == (5 if d <= DAY else 7), f"{d} refrigerated vehicles available")
        if not args.quick:
            n_, _ = M.solve(o_, R7, objective="min_vehicles")
            C(n_ == int(r["needed"]), f"{d} needs {n_} refrigerated vehicles (exact search, the plan's rules)")
    ND = pd.DataFrame(A["outlook_days"]).astype({"needed": int, "chilled_m3": float, "chilled_kg": float})
    for r in A["outlook"]:
        w = int(r["iso_week"])
        g = ND[(ND.date.map(lambda d: int(CAL.loc[d, "iso_week"])) == w) & (ND.date >= DAY)]
        top = g.sort_values(["needed", "chilled_m3"], ascending=[False, False]).iloc[0]
        C((top.date, int(top.needed)) == (r["busiest_day_from_8_april"], int(r["needed"])), f"week {w} busiest day from 8 April")
    FO = F["outlook"]
    cap = round(float(VEH[(VEH.depot == "Kandy") & (VEH.temp == "reefer")].volume_cap_m3.sum()), 1)
    C(cap == 146.0, "the 7 Kandy refrigerated vehicles hold 146.0 m3 in one load")
    for w in range(15, 21):
        vd = 7 * int(wk_ops[w]) - (2 * 3 if w == 15 else 0)
        ol = round(3 * (cap - VEH.loc["VEH039", "volume_cap_m3"] - VEH.loc["VEH058", "volume_cap_m3"]) + 3 * cap, 1) if w == 15 else round(int(wk_ops[w]) * cap, 1)
        C(FO["vehicle_days"][str(w)] == vd and close(FO["one_load_m3"][str(w)], ol), f"week {w}: {vd} refrigerated vehicle-days, one load {ol} m3 per open day")
    wed = ND[ND.date.map(lambda d: CAL.loc[d, "dow_name"] == "Wed")]
    C((wed.needed == 6).all(), "every Wednesday in weeks 15 to 20 needs 6 of the 7 refrigerated vehicles")
    fut = ND[ND.date > DAY]
    C(int(fut.needed.max()) == 6 and sorted(fut[fut.needed == 6].date) == FO["six_days"], "the days ahead that need 6")
    C(sorted(fut[fut.date.map(lambda d: CAL.loc[d, "dow_name"] == "Wed")].date) == FO["six_days"] and len(FO["six_days"]) == 5,
      "the days ahead that need 6 are exactly the 5 Wednesdays ahead (the headline says 29 April is the heaviest of them)")
    hd = FO["headline_day"]
    C(hd == "2026-04-29" and fut.sort_values(["needed", "chilled_kg"], ascending=False).iloc[0].date == hd, "29 April is the heaviest day that needs 6")
    C(fut.chilled_kg.max() > FO["headline_kg"] and "heaviest morning ahead" not in md, "29 April is the heaviest Wednesday ahead, not the heaviest day; the text scopes it so")
    top_day = fut.sort_values("chilled_kg").iloc[-1]
    C(f"{num(top_day.chilled_kg)} kg on {pd.Timestamp(top_day.date).strftime('%A')} {pd.Timestamp(top_day.date).day} {pd.Timestamp(top_day.date).strftime('%B')}" in md
      and int(top_day.needed) <= 5, "the heaviest day ahead is named and needs 5 or fewer")
    C(int(ND[ND.date.map(lambda d: CAL.loc[d, "dow_name"] != "Wed")].needed.max()) <= 5, "every day ahead that is not a Wednesday needs 5 or fewer")
    if not args.quick:
        for d in FO["six_days"]:
            n5w, _ = M.solve(forecast_day(d), R5)
            C(n5w == FO["five_serve_wednesdays"] == 22, f"{d}: five refrigerated vehicles serve {n5w} of 23 on Relay's clock")
    C(CAL.loc[hd, "festival_ramp"] == 0.8 and CAL.loc["2026-04-30", "is_payday"] == 1 and int(CAL.loc["2026-04-30", "iso_week"]) == 18, "29 April: Vesak ramp 0.8, payday week")
    C(round(float(ND.set_index("date").chilled_kg[hd]), 1) == FO["headline_kg"], "29 April chilled kg")
    ch15 = round(fc.loc[202615].Fresh_chilled, 1)
    C(round(ch15 / F["story"]["kandy_2026_w1_13_chilled_mean"], 2) == FO["week15_ratio"], "week 15 chilled against an ordinary 2026 week")

    # ============================================================== numbers for the story boards
    C.sec("story")
    SB = M.story_numbers()
    for k, v in F["story"].items():
        C(SB.get(k) == v, f"story number {k} = {v}")
    d1 = M.DEL[(M.DEL.depot == "Kandy") & (M.DEL.order_date == "2024-04-22") & (M.DEL.dispatch_status == "deferred")]
    ran = set(M.LEGS_TR[M.LEGS_TR.date == "2024-04-22"].vehicle_id)
    C(set(d1.outlet_id) == {"OUT116", "OUT118", "OUT119"} and "VEH039" not in ran and "VEH040" not in ran and CAL.loc["2024-04-22", "dow_name"] == "Mon",
      "precedent: Monday 22 April 2024, VEH039 and VEH040 did not run and the three Kegalle chilled orders waited")
    d2 = M.DEL[(M.DEL.depot == "Kandy") & (M.DEL.order_date == "2025-04-09") & (M.DEL.dispatch_status == "deferred")]
    C(sorted(d2.outlet_id) == ["OUT084", "OUT085", "OUT087"] and CAL.loc["2025-04-09", "festival_ramp"] == CAL.loc[DAY, "festival_ramp"] == 0.5,
      "precedent: 9 April 2025 (New Year ramp 0.5, as 8 April 2026), three Kandy chilled orders waited")
    rr = M.LEGS_TR[M.LEGS_TR.route_id == "R015108"].sort_values("seq")
    C(list(rr.to_outlet) == ["OUT085", "OUT084", "OUT084", "OUT087", "OUT087"] and set(rr.date) == {"2025-04-10"},
      "route R015108 on 10 April 2025 carried OUT084 and OUT087 twice each (the waited order and the new one as two stops)")
    ov = M.LEGS_TR[(M.LEGS_TR.date == "2024-04-17") & (M.LEGS_TR.vehicle_id == "VEH039") & M.LEGS_TR.to_outlet.isin(["OUT116", "OUT099"])].set_index("to_outlet")
    C([ov.loc["OUT116", "arrival_time"], ov.loc["OUT116", "leave_outlet_time"], ov.loc["OUT099", "arrival_time"], ov.loc["OUT099", "leave_outlet_time"]]
      == ["04:47", "05:17", "04:40", "05:09"] and ov.route_id.nunique() == 2,
      "17 April 2024: VEH039 at Aranayake 4:47 to 5:17 and at Rattota 4:40 to 5:09, on two routes at the same minutes")
    wch = M.DEL[(M.DEL.depot == "Kandy") & (M.DEL.temp_requirement == "chilled") & (M.DEL.dow_name == "Wed")].groupby("order_date").order_volume_m3.sum()
    tot_ch = round(sum(o["m3"] for o in orders.values() if o["temp"] == "chilled"), 3)
    C(int((wch < tot_ch).sum()) == F["plan"]["wednesdays_below"] and len(wch) == 115, f"this Wednesday's chilled {tot_ch} m3 is above {F['plan']['wednesdays_below']} of 115")
    tot = {}
    for s, o in orders.items():
        if o["brand"] == "Fresh":
            k = "dry" if o["temp"] == "ambient" else "chilled"
            t_ = tot.setdefault(k, [0, 0, 0.0, 0.0])
            t_[0] += 1
            t_[1] += o["units"]
            t_[2] += o["kg"]
            t_[3] += o["m3"]
    C([tot["dry"][0], tot["dry"][1], round(tot["dry"][2], 1), round(tot["dry"][3], 3)] == F["plan"]["fresh_dry"], "Kandy Fresh dry totals")
    C([tot["chilled"][0], tot["chilled"][1], round(tot["chilled"][2], 1), round(tot["chilled"][3], 3)] == F["plan"]["fresh_chilled"], "Kandy Fresh chilled totals")

    # ============================================================== timeline
    C.sec("timeline")
    TL = A["timeline"]
    order_day = {"Mon": 0, "Tue": 1, "Wed": 2, "Thu": 3}
    keys = [(order_day[r["day"]], hm(r["time"])) for r in TL]
    C(keys == sorted(keys), "timeline rows are in time order")
    tl = {(r["day"], r["time"]): r for r in TL}
    for k_ in [("Wed", "05:41"), ("Wed", "06:05"), ("Wed", "06:15"), ("Wed", "06:36"), ("Wed", "06:40"), ("Wed", "07:14"), ("Wed", "07:15"),
               ("Wed", "07:16"), ("Tue", "21:12"), ("Wed", "02:47"), ("Wed", "02:52"), ("Wed", "03:32")]:
        C(k_ in tl, f"timeline has {k_[0]} {k_[1]}")
    C(tl[("Wed", "06:40")]["frames"].startswith("STM-04 / past estimate"), "STM-04 / past estimate at 6:40 AM")
    tbl = re.search(r"## Timeline and screen snapshot times\n\n\| Time \| Event \| Screen snapshot \|\n\|---\|---\|---\|\n(.*?)\n\n", md, re.S).group(1)
    rows_md = []
    for line in tbl.strip().split("\n"):
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        day_, t_ = cells[0].split(" ", 1)
        rows_md.append((day_, fmt(hm(t_.split(" ")[0]) % 720 + (720 if t_.endswith("PM") else 0)), cells[1], cells[2]))
    C(rows_md == [(r["day"], r["time"], r["event"], r["frames"]) for r in TL], "the timeline table and relay:timeline match row for row")
    C(("Wed", "06:44") in tl and ("Wed", "07:17") in tl and "DEG-03 / receipt in" in tl[("Wed", "06:42")]["frames"], "timeline: receipt in and Keep backup, Finish trip at the dock")
    C("DRV-02 / Behind plan" in " ".join(r["frames"] for r in TL) and "DRV-02 / Early" not in md.split("## Changes from v0.3")[0] + md.split("## Appendix")[1],
      "DRV-02 / Behind plan replaces DRV-02 / Early")

    # ============================================================== printed values in the text
    C.sec("printed")
    for label, s in printed_strings(orders, trips, EXPT, F, KT, EV, A, NAME):
        C(s in md, f"text prints {label}: '{s}'")

    # ============================================================== summary
    print()
    for s, (p, f_) in C.per.items():
        print(f"  {s:<10} {p:>4} passed" + (f", {f_} failed" if f_ else ""))
    print(f"\nPASSED {C.n} checks, FAILED {len(C.fails)}" + (" (quick: the outlook and five-vehicle searches skipped)" if args.quick else ""))
    if C.fails:
        for f_ in C.fails:
            print(" -", f_)
        sys.exit(1)
    print("ALL CHECKS PASSED")


# ------------------------------------------------------------------ helpers used above
def style_size(o, day):
    dow = CAL.loc[day, "dow_name"]
    k = M.DEL[(M.DEL.outlet_id == o) & (M.DEL.dow_name == dow) & (M.DEL.wk >= 202601) & (M.DEL.wk <= 202613)
              & (M.DEL.festival_ramp == 0) & (M.DEL.is_payday == 0)]
    m = M.mult(day, "Style")
    return dict(units=int(round(k.order_units.mean() * m)), kg=round(k.order_weight_kg.mean() * m, 1), m3=round(k.order_volume_m3.mean() * m, 3))


def forecast_day(day):
    dow = CAL.loc[day, "dow_name"]
    o_ = {}
    for s in M.fixed_streams(dow):
        if s[1] == "chilled" and OUT.loc[s[0], "depot"] == "Kandy":
            f = M.forecast_size(s[0], "chilled", day)
            o_[s] = dict(district=OUT.loc[s[0], "district"], kg=f["kg"], m3=f["m3"])
    return o_


def ordinary_wednesday():
    b = M.DEL[(M.DEL.depot == "Kandy") & (M.DEL.temp_requirement == "chilled") & (M.DEL.wk >= 202601) & (M.DEL.wk <= 202613)
              & (M.DEL.festival_ramp == 0) & (M.DEL.is_payday == 0) & (M.DEL.dow_name == "Wed")]
    t = b.groupby("outlet_id").agg(n=("order_units", "size"), kg=("order_weight_kg", "mean"), m3=("order_volume_m3", "mean"))
    t = t[t.n >= 4]
    return {(o, "chilled"): dict(district=OUT.loc[o, "district"], kg=r.kg, m3=r.m3) for o, r in t.iterrows()}


def estimate_chain(event_at, idx, seq, arrived=True):
    """expected arrival at each later stop from a stop event at stop idx: an arrival adds that store's usual unloading
    time, a delivery (or a store's confirmed receipt) does not"""
    t = event_at + (M.dwell(seq[idx]) if arrived else 0)
    out = {}
    for j in range(idx + 1, len(seq)):
        t += DT.loc["Kegalle", "inter_stop_freeflow_min"] * M.factor("Kegalle", t, DAY)
        out[j] = t
        t += M.dwell(seq[j])
    return out


def count_late(seq, dep, trip2):
    rows, back = M.simulate_model(seq, dep, "Fresh", DAY)
    n = sum(1 for o, a, _, _ in rows if a > hm(OUT.loc[o, "window_close_time"]))
    if trip2:
        d2 = max(trip2["dep"], back + M.RELOAD)
        rows2, _ = M.simulate_model(trip2["seq"], d2, "Fresh", DAY)
        n += sum(1 for o, a, _, _ in rows2 if a > hm(OUT.loc[o, "window_close_time"]))
    return n


def feasible_first(seq, dep, trip2):
    ff, back = M.simulate_ff(seq, dep, "Fresh")
    if any(a > hm(OUT.loc[o, "window_close_time"]) for o, a, _, _ in ff):
        return False
    if trip2 and trip2["dep"] < back + M.RELOAD:
        return False
    return True


def bybrand(streams):
    return dict(total=len(streams),
                dry=sum(1 for o, t in streams if OUT.loc[o, "brand"] == "Fresh" and t == "ambient"),
                chilled=sum(1 for o, t in streams if t == "chilled"),
                style=sum(1 for o, t in streams if OUT.loc[o, "brand"] == "Style"),
                tech=sum(1 for o, t in streams if OUT.loc[o, "brand"] == "Tech"),
                kandy=sum(1 for o, t in streams if OUT.loc[o, "depot"] == "Kandy"),
                peliyagoda=sum(1 for o, t in streams if OUT.loc[o, "depot"] == "Peliyagoda"))


def dthu_rice_wed(ORD):
    r = [x for x in ORD if x["delivery_date"] == DAY and x["outlet_id"] == "OUT117" and x["temp"] == "dry"][0]
    return int(r["cases"].split()[0])


def printed_strings(orders, trips, EXPT, F, KT, EV, A, NAME):
    """numbers the story prints, rebuilt from the checked values; each must appear word for word in the scenario"""
    from printed import strings
    return strings(orders=orders, trips=trips, EXPT=EXPT, F=F, KT=KT, EV=EV, A=A, NAME=NAME, M=M)


if __name__ == "__main__":
    main()
