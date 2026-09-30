"""
Shared model for the Relay scenario checks (Team Ryzera, Designathon).

Everything here is computed from the competition CSVs in data/raw/data and the
organizers' data/raw/check_allocation.py. Nothing is read from anywhere else.
validate_scenario.py imports this module; so can any notebook that needs the
same numbers.

Contents
  load data ........ CSVs, calendar, route history, order history
  forecast ......... the team's method C (ordinary week x festival lift x payday lift x growth)
                     and method A (same week last year x growth), for the backtest
  order book ....... order streams per weekday, order numbers, forecast order sizes
  trip time ........ the published standard (imported from check_allocation.py),
                     the free-flow clock, and Relay's expected clock
  exact search ..... a small MILP over one or two trips per refrigerated vehicle
"""
import importlib.util
import itertools
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.optimize import milp, LinearConstraint, Bounds
from scipy.sparse import lil_matrix

REPO = Path(__file__).resolve().parents[2]
DATA = REPO / "data" / "raw" / "data"
GEN = DATA / "General Data"
CHECKER_PATH = REPO / "data" / "raw" / "check_allocation.py"

# ------------------------------------------------------------------ the organizers' standard
_spec = importlib.util.spec_from_file_location("check_allocation", CHECKER_PATH)
CHECKER = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(CHECKER)
TRIP_BUDGET_PREDAWN = CHECKER.TRIP_BUDGET_PREDAWN      # 270
TRIP_BUDGET_DAYTIME = CHECKER.TRIP_BUDGET_DAYTIME      # 480
MAX_TRIPS = CHECKER.MAX_TRIPS_PER_VEHICLE              # 2

# ------------------------------------------------------------------ data
OUT = pd.read_csv(GEN / "outlets.csv").set_index("outlet_id")
VEH = pd.read_csv(GEN / "vehicles.csv").set_index("vehicle_id")
CAL = pd.read_csv(GEN / "calendar.csv").set_index("date")
DT = pd.read_csv(GEN / "district_travel.csv").set_index("district")
AL = pd.read_csv(GEN / "service_allowance.csv")
SPD = pd.read_csv(GEN / "traffic_speed.csv").set_index(["district", "hour", "monsoon"]).speed_index
RC = pd.read_csv(GEN / "road_conditions.csv").set_index(["district", "date"]).disruption_index
DTRAVEL = pd.read_csv(GEN / "district_travel.csv").set_index("district").to_dict("index")
ALLOW = {(r.brand, r.dock_type): r.service_allowance_min for r in AL.itertuples()}

DEL = pd.concat([pd.read_csv(DATA / "Training Data" / "deliveries_train.csv"),
                 pd.read_csv(DATA / "Test Data" / "task1_test_inputs.csv")], ignore_index=True)
LEGS_TR = pd.read_csv(DATA / "Training Data" / "route_legs_train.csv")
LEGS_TE = pd.read_csv(DATA / "Test Data" / "route_legs_test.csv")

CAL["wk"] = CAL.iso_year * 100 + CAL.iso_week
DEL = DEL.merge(CAL[["dow", "dow_name", "iso_year", "iso_week", "wk", "festival_ramp", "is_payday", "monsoon"]],
                left_on="order_date", right_index=True, how="left")
DEL["g"] = np.where(DEL.brand == "Fresh", "Fresh_" + DEL.temp_requirement.map({"ambient": "dry", "chilled": "chilled"}), DEL.brand)
GROUPS = ["Fresh_dry", "Fresh_chilled", "Style", "Tech"]
DOWS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

# each ramp day belongs to the next festival
_c = CAL.reset_index()[["date", "festival", "festival_ramp"]].copy()
_c["d"] = pd.to_datetime(_c.date)
_f = _c[_c.festival.notna()][["d", "festival"]].rename(columns={"festival": "next_fest"})
_c = pd.merge_asof(_c.sort_values("d"), _f.sort_values("d"), on="d", direction="forward")
CAL["fest_group"] = pd.Series(np.where(_c.festival_ramp > 0, _c.next_fest, "none"), index=_c.date.values)
DEL["fest_group"] = DEL.order_date.map(CAL.fest_group)
DEL["yr"] = DEL.order_date.str[:4]


# ------------------------------------------------------------------ small helpers
def hm(s):
    h, m = str(s).split(":")
    return int(h) * 60 + int(m)


def fmt(x):
    x = int(round(x))
    return f"{x // 60:02d}:{x % 60:02d}"


def ampm(x, suffix=True):
    x = int(round(x))
    h, m = (x // 60) % 24, x % 60
    suf = "AM" if h < 12 else "PM"
    h12 = h if 1 <= h <= 12 else (h - 12 if h > 12 else 12)
    return f"{h12}:{m:02d} {suf}" if suffix else f"{h12}:{m:02d}"


def r5(x):
    return int(5 * round(x / 5.0))


def num(x, d=1):
    return f"{x:,.{d}f}"


# ------------------------------------------------------------------ forecast (team method C and method A)
def _lift_tables(oh):
    ordy = oh[(oh.festival_ramp == 0) & (oh.is_payday == 0)]
    bm = ordy.groupby(["outlet_id", "temp_requirement", "yr", "dow"]).order_volume_m3.mean().rename("bm")
    x = oh.join(bm, on=["outlet_id", "temp_requirement", "yr", "dow"])
    x["rel"] = x.order_volume_m3 / x.bm
    out = {}
    for fam in ["Fresh", "Style"]:
        xx = x[(x.brand == fam) & x.rel.notna()]
        pay = xx[(xx.festival_ramp == 0) & (xx.is_payday == 1)].rel.mean()
        rp = xx[(xx.festival_ramp > 0) & (xx.is_payday == 0)]
        byf = rp.groupby(["fest_group", "festival_ramp"]).rel.mean() if fam == "Fresh" else rp.groupby("fest_group").rel.mean()
        out[fam] = {"pay": pay, "byf": byf, "other": rp.groupby("festival_ramp").rel.mean()}
    return out


def _lift(L, fam, fest, ramp, pay):
    if fam not in L:
        return 1.0
    t = L[fam]
    f = 1.0
    if ramp > 0:
        r = round(ramp, 1)
        if fam == "Fresh":
            f = t["byf"].get((fest, r), np.nan)
            if np.isnan(f):
                f = t["other"].get(r, 1.0)
        else:
            f = t["byf"].get(fest, np.nan)
            if np.isnan(f):
                f = t["other"].mean()
    if pay == 1:
        f *= t["pay"]
    return f


def method_c(origin_wk, target_wks, base_weeks=13, tech_weeks=52):
    """daily forecast m3 per depot and group: ordinary weekday base x festival lift x payday lift x growth"""
    oh = DEL[DEL.wk <= origin_wk]
    ch = CAL[CAL.wk <= origin_wk].reset_index()
    L = _lift_tables(oh)
    ops = ch[ch.is_operating == 1]
    d = oh.groupby(["depot", "g", "order_date"]).order_volume_m3.sum()
    idx = pd.MultiIndex.from_product([["Kandy", "Peliyagoda"], GROUPS, ops.date], names=["depot", "g", "order_date"])
    d = d.reindex(idx, fill_value=0).rename("m3").reset_index().merge(ch, left_on="order_date", right_on="date")
    d["fam"] = np.where(d.g.str.startswith("Fresh"), "Fresh", d.g)
    d["adj"] = [_lift(L, f, fe, r, p) for f, fe, r, p in zip(d.fam, d.fest_group, d.festival_ramp, d.is_payday)]
    d["norm"] = d.m3 / d.adj
    wks = sorted(ch.wk.unique())
    fut = CAL[(CAL.wk.isin(target_wks)) & (CAL.is_operating == 1)].reset_index()
    rows = []
    for (dep, g), dd in d.groupby(["depot", "g"]):
        bw = wks[-(tech_weeks if g == "Tech" else base_weeks):]
        b = dd[dd.wk.isin(bw)]
        if g == "Style":
            b = b[b.iso_week != 10]   # recurring pre-season Style spike in ISO week 10
        base = b.groupby("dow_name").norm.mean()
        gr = 1.0
        if g.startswith("Fresh"):
            bp = dd[dd.wk.isin([w - 100 for w in bw])]
            gr = b.norm.sum() / bp.norm.sum()
        c0 = pd.Timestamp(ch[ch.wk == bw[len(bw) // 2]].date.min())
        fam = "Fresh" if g.startswith("Fresh") else g
        for r in fut.itertuples():
            gf = gr ** (((pd.Timestamp(r.date) - c0).days / 7) / 52)
            lf = _lift(L, fam, r.fest_group, r.festival_ramp, r.is_payday)
            rows.append((dep, g, r.wk, r.date, r.dow_name, base.get(r.dow_name, 0.0), lf, gf, base.get(r.dow_name, 0.0) * lf * gf))
    return pd.DataFrame(rows, columns=["depot", "g", "wk", "date", "dow", "base", "lift", "growth", "pred"])


def method_a(origin_wk, target_wks):
    """same ISO week last year x growth of the last 13 weeks against the same 13 weeks a year earlier"""
    oh = DEL[DEL.wk <= origin_wk]
    w = oh.groupby(["depot", "g", "wk"]).order_volume_m3.sum().unstack("wk").fillna(0)
    last13 = sorted(CAL[CAL.wk <= origin_wk].wk.unique())[-13:]
    gr = w[last13].sum(axis=1) / w[[x - 100 for x in last13]].sum(axis=1)
    return pd.DataFrame({t: w[t - 100] * gr for t in target_wks})


def backtest_kandy_fresh(origin_wk=202513, target_wks=tuple(range(202514, 202524))):
    """mean absolute weekly error of Kandy Fresh (dry plus chilled) volume, in %: (method C, method A)"""
    tw = list(target_wks)
    act = DEL[DEL.wk.isin(tw) & (DEL.depot == "Kandy") & (DEL.brand == "Fresh")].groupby("wk").order_volume_m3.sum()
    c = method_c(origin_wk, tw)
    c = c[(c.depot == "Kandy") & c.g.str.startswith("Fresh")].groupby("wk").pred.sum()
    a = method_a(origin_wk, tw)
    a = a.loc[[("Kandy", "Fresh_dry"), ("Kandy", "Fresh_chilled")]].sum()
    return (round(((c - act).abs() / act).mean() * 100, 1), round(((a - act).abs() / act).mean() * 100, 1))


FC = method_c(202613, list(range(202614, 202624)))


def mult(day, group, depot="Kandy"):
    r = FC[(FC.date == day) & (FC.depot == depot) & (FC.g == group)].iloc[0]
    return float(r.lift * r.growth)


# ------------------------------------------------------------------ order streams and order numbers
_nd = DEL.groupby("dow_name").order_date.nunique()
SHARE = DEL.groupby(["outlet_id", "brand", "temp_requirement", "dow_name"]).size().unstack(fill_value=0).div(_nd)


def fixed_streams(dow):
    s = SHARE[dow]
    return sorted((o, t) for (o, b, t), v in s.items() if v > 0.9)


def tech_candidates(dow):
    s = SHARE[dow]
    return {o: v for (o, b, t), v in s.items() if b == "Tech" and 0.2 < v < 0.9}


def expected_orders(dow):
    """orders on an operating day of this weekday: fixed streams plus the expected number of Tech orders"""
    s = SHARE[dow]
    return int((s > 0.9).sum()) + int(round(s[(s > 0.2) & (s < 0.9)].sum()))


def day_streams(dow, tech_outlets):
    return sorted(fixed_streams(dow) + [(o, "ambient") for o in tech_outlets])


LAST_ID = int(DEL.delivery_id.str.slice(3).astype(int).max())
LAST_ID_DATE = DEL.loc[DEL.delivery_id.str.slice(3).astype(int).idxmax(), "order_date"]


def first_id(day):
    """first order number of a delivery day after the data ends: numbers run on from the last order in the data,
    one block per operating day, each block sized by expected_orders for its weekday"""
    days = CAL[(CAL.index > LAST_ID_DATE) & (CAL.index < day) & (CAL.is_operating == 1)]
    return LAST_ID + sum(expected_orders(d) for d in days.dow_name) + 1


def forecast_size(outlet, temp, day):
    """forecast order: that outlet's mean on the same weekday on ordinary days (no ramp, no payday) in 2026 weeks 1
    to 13, times the method C multiplier (lift x growth) for that day and group"""
    dow = CAL.loc[day, "dow_name"]
    k = DEL[(DEL.outlet_id == outlet) & (DEL.temp_requirement == temp) & (DEL.dow_name == dow) & (DEL.wk >= 202601)
            & (DEL.wk <= 202613) & (DEL.festival_ramp == 0) & (DEL.is_payday == 0)]
    if len(k) < 4:
        return None
    m = mult(day, "Fresh_chilled" if temp == "chilled" else "Fresh_dry")
    return dict(units=int(round(k.order_units.mean() * m)), kg=round(k.order_weight_kg.mean() * m, 1),
                m3=round(k.order_volume_m3.mean() * m, 3), n=len(k), mult=m)


RANGE = DEL.groupby(["outlet_id", "temp_requirement"]).agg(u0=("order_units", "min"), u1=("order_units", "max"),
                                                           k0=("order_weight_kg", "min"), k1=("order_weight_kg", "max"),
                                                           v0=("order_volume_m3", "min"), v1=("order_volume_m3", "max"))
DEL["kpu"] = DEL.order_weight_kg / DEL.order_units
DEL["vpu"] = DEL.order_volume_m3 / DEL.order_units
PER_UNIT = DEL.groupby("brand").agg(k0=("kpu", "min"), k1=("kpu", "max"), v0=("vpu", "min"), v1=("vpu", "max"))

# ------------------------------------------------------------------ trip time
EARLIEST = hm("02:00")     # earliest planned depot departure in the Kandy route history
RELOAD = 10                # minutes at the dock between trips


def std_minutes(district, brand, docks):
    """the published trip-time standard, from check_allocation.py"""
    return int(round(CHECKER.trip_time(district, brand, list(docks), DTRAVEL, ALLOW)))


def simulate_ff(seq, dep, brand):
    """planned clock at free flow (as the route history plans): (outlet, arrive, start, leave) rows and back at the hub"""
    d = DT.loc[OUT.loc[seq[0], "district"]]
    t = dep
    rows = []
    for i, o in enumerate(seq):
        t += d.depot_to_district_freeflow_min if i == 0 else d.inter_stop_freeflow_min
        arr = t
        start = max(arr, hm(OUT.loc[o, "window_open_time"]))
        t = start + ALLOW[(brand, OUT.loc[o, "dock_type"])]
        rows.append((o, arr, start, t))
    return rows, t + d.depot_to_district_freeflow_min


def factor(district, minute, date):
    h = int(minute // 60) % 24
    return 100.0 / SPD[(district, h, int(CAL.loc[date, "monsoon"]))] * 100.0 / RC[(district, date)]


_mm = lambda s: s.str.slice(0, 2).astype(int) * 60 + s.str.slice(3, 5).astype(int)
_l = LEGS_TR.copy()
_l["svc"] = _mm(_l.leave_outlet_time) - np.maximum(_mm(_l.arrival_time), _mm(_l.to_outlet.map(OUT.window_open_time)))
_l["dep"] = _mm(_l.actual_depart_time)
DWELL = _l[(_l.monsoon == 1) & (_l.brand == "Fresh")].groupby("to_outlet").svc.quantile([.1, .25, .5, .75, .9]).unstack()
_k = _l[(_l.district == "Kegalle") & (_l.monsoon == 1)].copy()
_k["r"] = _k.actual_travel_duration_min / _k.planned_travel_duration_min
_k["h"] = _k.dep // 60
RATIO_KEG = _k.groupby([_k.seq > 0, "h"]).r.quantile([.1, .5, .9]).unstack()
LEGS_HIST = _l


def dwell(o, brand="Fresh"):
    """each store's usual unloading time: median in monsoon months (Fresh), else the allowance"""
    if brand == "Fresh" and o in DWELL.index:
        return float(DWELL.loc[o, 0.5])
    return float(ALLOW[(brand, OUT.loc[o, "dock_type"])])


def simulate_model(seq, dep, brand, date):
    """Relay's expected clock: free flow x 100/speed index x 100/road index per leg, plus each store's usual unloading time"""
    dist = OUT.loc[seq[0], "district"]
    d = DT.loc[dist]
    t = dep
    rows = []
    for i, o in enumerate(seq):
        ff = d.depot_to_district_freeflow_min if i == 0 else d.inter_stop_freeflow_min
        t += ff * factor(dist, t, date)
        arr = t
        start = max(arr, hm(OUT.loc[o, "window_open_time"]))
        t = start + dwell(o, brand)
        rows.append((o, arr, start, t))
    back = t + d.depot_to_district_freeflow_min * factor(dist, t, date)
    return rows, back


# ------------------------------------------------------------------ exact search over refrigerated vehicle days
def earliest_back(stops, ready, brand="Fresh"):
    """earliest free-flow return to the hub over every stop order that keeps each arrival inside its window
    (exact over subsets; every pair of stores in a district is the same inter-stop time apart). None if no order works."""
    d = DT.loc[OUT.loc[stops[0], "district"]]
    n = len(stops)
    op = [hm(OUT.loc[o, "window_open_time"]) for o in stops]
    cl = [hm(OUT.loc[o, "window_close_time"]) for o in stops]
    sv = [ALLOW[(brand, OUT.loc[o, "dock_type"])] for o in stops]
    dp = {}
    for i in range(n):
        arr = ready + d.depot_to_district_freeflow_min
        if arr <= cl[i]:
            dp[(1 << i, i)] = max(arr, op[i]) + sv[i]
    for mask in range(1, 1 << n):
        for last in range(n):
            t = dp.get((mask, last))
            if t is None:
                continue
            for j in range(n):
                if mask & (1 << j):
                    continue
                arr = t + d.inter_stop_freeflow_min
                if arr > cl[j]:
                    continue
                lv = max(arr, op[j]) + sv[j]
                key = (mask | (1 << j), j)
                if key not in dp or lv < dp[key]:
                    dp[key] = lv
    full = (1 << n) - 1
    ends = [dp[(full, l)] for l in range(n) if (full, l) in dp]
    return None if not ends else min(ends) + d.depot_to_district_freeflow_min


def latest_departure(stops, lo=EARLIEST, hi=hm("08:00")):
    """latest departure from the hub that still reaches every stop inside its window (feasibility only gets worse later)"""
    if earliest_back(stops, lo) is None:
        return None
    while lo < hi:
        mid = (lo + hi + 1) // 2
        if earliest_back(stops, mid) is not None:
            lo = mid
        else:
            hi = mid - 1
    return lo


def trip_options(ords):
    """every trip one vehicle could run: a non-empty set of orders in one district, with its load, published standard
    minutes, earliest free-flow return (leaving at 2:00 AM) and latest departure"""
    keys = list(ords)
    groups = {}
    for i, k in enumerate(keys):
        groups.setdefault(ords[k]["district"], []).append(i)
    options = []
    for d, idx in groups.items():
        for r in range(1, len(idx) + 1):
            for S in itertools.combinations(idx, r):
                outs = [keys[i][0] for i in S]
                options.append(dict(S=S, d=d, kg=sum(ords[keys[i]]["kg"] for i in S), m3=sum(ords[keys[i]]["m3"] for i in S),
                                    vo=any(OUT.loc[keys[i][0], "parking_constraint"] == "van_only" for i in S),
                                    sm=std_minutes(d, "Fresh", [OUT.loc[o, "dock_type"] for o in outs]),
                                    eb=earliest_back(outs, EARLIEST), ld=latest_departure(outs)))
    return keys, options


def solve(ords, vehicles, clock=True, reload=RELOAD, objective="max_served", forbid=(), force=(), ready=None,
          budget=TRIP_BUDGET_PREDAWN, options=None, usual=None, max_trips=None):
    """exact search. objective 'max_served' returns (orders served, plan); 'min_vehicles' returns (vehicles used, plan).
    clock=False applies only the organizers' rules (capacity, van only, one district, 270 minutes, two trips).
    clock=True also needs every planned arrival inside its window at free flow, first trips leaving from 2:00 AM
    (or ready[v]), and a second trip leaving at least `reload` minutes after the first is back at the hub."""
    keys, opts = options if options is not None else trip_options(ords)
    ready = ready or {}
    max_trips = max_trips or {}
    bud = budget if isinstance(budget, dict) else {v: budget for v in vehicles}
    var = []   # (vehicle, trip, option index)
    for v in vehicles:
        V = VEH.loc[v]
        r0 = ready.get(v, EARLIEST)
        ok = [i for i, t in enumerate(opts) if t["kg"] <= V.weight_cap_kg + 1e-9 and t["m3"] <= V.volume_cap_m3 + 1e-9
              and (not t["vo"] or V.type == "van") and t["sm"] <= bud[v]
              and (not clock or t["eb"] is not None)]
        for i in ok:
            if clock:
                first_ok = opts[i]["ld"] >= r0
            else:
                first_ok = True
            if first_ok:
                var.append((v, 1, i))
            if max_trips.get(v, MAX_TRIPS) >= 2:
                var.append((v, 2, i))
    n = len(var)
    I = len(keys)
    rows = []
    A = lil_matrix((I + 5 * len(vehicles), n))
    lo, hi = [], []
    # each order at most (or exactly) once
    for k in range(n):
        for i in opts[var[k][2]]["S"]:
            A[i, k] = 1
    for i, key in enumerate(keys):
        if key in forbid:
            lo.append(0), hi.append(0)
        elif key in force or objective == "min_vehicles":
            lo.append(1), hi.append(1)
        else:
            lo.append(0), hi.append(1)
    r = I
    M = 3000.0
    for v in vehicles:
        r0 = ready.get(v, EARLIEST)
        for k, (vv, t, i) in enumerate(var):
            if vv != v:
                continue
            o = opts[i]
            A[r, k] = 1 if t == 1 else 0                                  # at most one first trip
            A[r + 1, k] = -1 if t == 1 else 1                             # a second trip needs a first trip
            A[r + 2, k] = o["sm"]                                         # 270 minute budget
            if clock:
                if t == 1:
                    # first trip leaves no earlier than ready: back no earlier than earliest_back from ready
                    eb = earliest_back([keys[j][0] for j in o["S"]], r0) if r0 != EARLIEST else o["eb"]
                    A[r + 3, k] = (eb if eb is not None else M) + reload
                else:
                    A[r + 3, k] = -o["ld"] + M
        lo += [0, -np.inf, 0, -np.inf]
        hi += [1, 0, bud[v], M if clock else np.inf]
        r += 4
    A = A[:r].tocsr()
    if objective == "max_served":
        c = np.array([-len(opts[i]["S"]) for (_, _, i) in var], dtype=float)
    elif objective == "max_kept":
        # most vehicles whose usual run (a set of orders) is one of their trips
        c = np.array([-1.0 if usual and set(keys[j] for j in opts[i]["S"]) == set(usual.get(v, ())) else 0.0
                      for (v, _, i) in var])
    else:
        c = np.array([1.0 if t == 1 else 0.0 for (_, t, _) in var])
    res = milp(c, constraints=[LinearConstraint(A, lo, hi)], integrality=np.ones(n), bounds=Bounds(0, 1),
               options={"time_limit": 600})
    if res.x is None:
        return None, None
    plan = [(var[k][0], var[k][1], [keys[j] for j in opts[var[k][2]]["S"]]) for k in range(n) if res.x[k] > 0.5]
    val = int(round(-res.fun)) if objective in ("max_served", "max_kept") else int(round(res.fun))
    return val, plan


# ------------------------------------------------------------------ fuel
def trip_litres(v, district, n):
    """one trip with n stops, counting the drive back to the hub at district_travel.csv distances"""
    d = DT.loc[district]
    return (2 * d.depot_to_district_km + (n - 1) * d.inter_stop_km) / VEH.loc[v, "km_per_l"]


def typical_weekday_litres():
    """each Kandy vehicle's average litres per weekday in 2026 weeks 1 to 13 (route legs plus the drive back)"""
    leg = pd.concat([LEGS_TR, LEGS_TE]).merge(CAL[["iso_year", "iso_week", "dow_name"]], left_on="date", right_index=True)
    leg = leg[(leg.iso_year == 2026) & (leg.iso_week <= 13) & (leg.depot == "Kandy")]
    rt = leg.groupby(["date", "dow_name", "vehicle_id", "route_id", "district"]).distance_km.sum().reset_index()
    rt["L"] = (rt.distance_km + rt.district.map(DT.depot_to_district_km)) / rt.vehicle_id.map(VEH.km_per_l)
    vd = rt.groupby(["date", "dow_name", "vehicle_id"]).L.sum().unstack(fill_value=0)
    ops = CAL[(CAL.iso_year == 2026) & (CAL.iso_week <= 13) & (CAL.is_operating == 1)].reset_index()[["date", "dow_name"]]
    vd = vd.reindex(pd.MultiIndex.from_frame(ops), fill_value=0)
    return vd.groupby(level=1).mean().T


def tue_v39_kandy_stops():
    """VEH039 usually runs Kandy district chilled on Tuesdays; its stores are the Tuesday Kandy chilled orders a truck
    can reach (the van-only ones ride VEH057)"""
    return sum(1 for o, t in fixed_streams("Tue") if t == "chilled" and OUT.loc[o, "district"] == "Kandy"
               and OUT.loc[o, "parking_constraint"] != "van_only")


def fuel_week(trips, mon_extra, tue_extra, out, vehicles=None):
    """litres Monday + Tuesday (each vehicle's 2026 weekday average, with VEH039's runs moved as the story says)
    + Wednesday's plan, against the weekly quota; also Fresh and daytime standard minutes on Wednesday"""
    typ = typical_weekday_litres()
    vs = vehicles or sorted(set(v for v, _ in trips) | set(out) | {"VEH060"})
    res = {}
    for v in vs:
        mon = 0.0 if v in out else float(typ.loc[v, "Mon"]) if v in typ.index else 0.0
        tue = 0.0 if v in out else float(typ.loc[v, "Tue"]) if v in typ.index else 0.0
        if v in mon_extra:
            mon += trip_litres(v, *mon_extra[v])
        if v in tue_extra:
            tue += trip_litres(v, *tue_extra[v])
        ts = [t for (vv, _), t in trips.items() if vv == v]
        wed = sum(trip_litres(v, t["district"], len(t["stops"])) for t in ts)
        mon, tue, wed = round(mon, 1), round(tue, 1), round(wed, 1)
        res[v] = dict(mon=mon, tue=tue, wed=wed, week=round(mon + tue + wed, 1), quota=int(VEH.loc[v, "weekly_fuel_quota_l"]),
                      fresh=sum(t["std"] for t in ts if t["brand"] == "Fresh"), day=sum(t["std"] for t in ts if t["brand"] != "Fresh"))
    return res


# ------------------------------------------------------------------ numbers for the story boards
def story_numbers():
    """history statistics quoted on the story boards, each with its exact scope"""
    s = {}
    d = DEL
    s["orders_first"], s["orders_last"] = d.order_date.min(), d.order_date.max()
    for dep in ["Kandy", "Peliyagoda"]:
        x = d[(d.depot == dep) & (d.dispatch_status == "deferred")]
        s[f"{dep}_deferred_orders"] = len(x)
        s[f"{dep}_deferral_days"] = int(x.order_date.nunique())
        s[f"{dep}_deferred_chilled"] = int((x.temp_requirement == "chilled").sum())
        s[f"{dep}_deferred_dry"] = int((x.temp_requirement == "ambient").sum())
        s[f"{dep}_not_run"] = int(((d.depot == dep) & (d.dispatch_status == "not_run")).sum())
        s[f"{dep}_orders"] = int((d.depot == dep).sum())
    kd = d[(d.depot == "Kandy") & (d.dispatch_status == "deferred")]
    s["Kandy_deferral_days_monsoon"] = int(kd.drop_duplicates("order_date").monsoon.sum())
    s["Kandy_deferral_days_chilled"] = int(kd[kd.temp_requirement == "chilled"].order_date.nunique())
    miss = d[(d.temp_requirement == "chilled") & (d.dispatch_status != "attempted")]
    ok = d[(d.temp_requirement == "ambient") & (d.brand == "Fresh") & (d.dispatch_status == "attempted")]
    dry_ok = set(zip(ok.order_date, ok.outlet_id))
    s["missed_chilled"] = len(miss)
    s["missed_chilled_with_dry"] = int(sum((a, b) in dry_ok for a, b in zip(miss.order_date, miss.outlet_id)))
    nr = d[(d.dispatch_status == "not_run")]
    s["Kandy_not_run_fresh_dry"] = int(((nr.depot == "Kandy") & (nr.brand == "Fresh") & (nr.temp_requirement == "ambient")).sum())
    s["Kandy_not_run_style"] = int(((nr.depot == "Kandy") & (nr.brand == "Style")).sum())
    s["Kandy_not_run_tech"] = int(((nr.depot == "Kandy") & (nr.brand == "Tech")).sum())
    s["Peliyagoda_not_run_fresh_chilled"] = int(((nr.depot == "Peliyagoda") & (nr.brand == "Fresh") & (nr.temp_requirement == "chilled")).sum())
    kdry = kd[kd.temp_requirement == "ambient"]
    s["Kandy_dry_deferral_day"] = kdry.order_date.iloc[0] if kdry.order_date.nunique() == 1 else None
    s["Kandy_dry_deferral_orders"] = int(((kdry.brand == "Fresh")).sum())
    lt = LEGS_TR.copy()
    lt["late"] = _mm(lt.arrival_time) > _mm(lt.to_outlet.map(OUT.window_close_time))
    s["legs_first"], s["legs_last"] = LEGS_TR.date.min(), LEGS_TR.date.max()
    k = lt[(lt.depot == "Kandy") & (lt.monsoon == 1) & (lt.brand == "Fresh")]
    s["kandy_fresh_monsoon_stops"] = len(k)
    s["kandy_fresh_monsoon_late_pct"] = round(k.late.mean() * 100, 1)
    for dist in ["Kandy", "Kegalle", "Matale", "Nuwara Eliya", "Badulla"]:
        s[f"late_pct_fresh_{dist}"] = round(k[k.district == dist].late.mean() * 100, 1)
    kg = lt[(lt.district == "Kegalle") & (lt.monsoon == 1) & (lt.brand == "Fresh") & (lt.seq == 0)].copy()
    kg["behind"] = _mm(kg.arrival_time) - _mm(kg.planned_arrival_time)
    kg["r"] = kg.actual_travel_duration_min / kg.planned_travel_duration_min
    s["keg_first_stops"] = len(kg)
    s["keg_first_after_planned_pct"] = round((kg.behind > 0).mean() * 100, 1)
    s["keg_first_behind_median"] = int(kg.behind.median())
    s["keg_first_behind_p10"], s["keg_first_behind_p90"] = int(kg.behind.quantile(.1)), int(kg.behind.quantile(.9))
    s["keg_first_ratio_median"] = round(float(kg.r.median()), 2)
    kall = lt[(lt.district == "Kegalle") & (lt.monsoon == 1) & (lt.brand == "Fresh")]
    s["keg_stops"] = len(kall)
    s["keg_stops_after_planned_pct"] = round((_mm(kall.arrival_time) > _mm(kall.planned_arrival_time)).mean() * 100, 1)
    lg = pd.concat([LEGS_TR, LEGS_TE]).merge(CAL[["dow_name"]], left_on="date", right_index=True)
    kw = lg[(lg.depot == "Kandy") & (lg.dow_name == "Wed")]
    s["kandy_wednesdays"] = int(kw.date.nunique())
    s["veh058_wednesdays_run"] = int(kw[kw.vehicle_id == "VEH058"].date.nunique())
    s["veh060_wednesdays_run"] = int(kw[kw.vehicle_id == "VEH060"].date.nunique())
    kd0 = kw[(kw.district == "Kegalle") & (kw.brand == "Fresh") & (kw.vehicle_temp == "ambient") & (kw.seq == 0)]
    s["veh045_kegalle_dry_wednesdays"] = int(kd0[kd0.vehicle_id == "VEH045"].date.nunique())
    kr = kw.groupby("date").agg(trips=("route_id", "nunique"), veh=("vehicle_id", "nunique"))
    s["wed_median_trips"], s["wed_median_vehicles"] = int(kr.trips.median()), int(kr.veh.median())
    routes = d.dropna(subset=["route_id"]).groupby("route_id").temp_requirement.nunique()
    s["trips_in_orders"] = len(routes)
    s["trips_mixing_temps"] = int((routes > 1).sum())
    a = d[(d.depot == "Kandy") & (d.brand == "Fresh") & (d.temp_requirement == "ambient") & (d.dispatch_status == "attempted")]
    s["kandy_fresh_dry_attempted"] = len(a)
    s["kandy_fresh_dry_on_reefer"] = int((a.vehicle_temp == "reefer").sum())
    L = lg[(lg.depot == "Kandy") & (lg.brand == "Fresh")]
    r = L.groupby(["date", "vehicle_id", "route_id"]).agg(dep=("planned_depart_time", "min"), last=("planned_arrival_time", "max")).reset_index()
    r["dep"], r["last"] = _mm(r.dep), _mm(r["last"])
    r = r.sort_values(["date", "vehicle_id", "dep"])
    r["n"] = r.groupby(["date", "vehicle_id"]).cumcount()
    j = r[r.n == 1].set_index(["date", "vehicle_id"]).join(r[r.n == 0].set_index(["date", "vehicle_id"]), rsuffix="_1")
    s["kandy_second_fresh_trips"] = len(j)
    s["second_trip_before_first_ends_pct"] = round(float((j.dep < j.last_1).mean() * 100), 1)
    kc = d[(d.depot == "Kandy") & (d.temp_requirement == "chilled")].groupby("wk").order_volume_m3.sum()
    s["kandy_top_chilled_week"], s["kandy_top_chilled_m3"] = int(kc.idxmax()), round(float(kc.max()), 1)
    s["kandy_2026_w1_13_chilled_mean"] = round(float(kc.loc[202601:202613].mean()), 1)
    s["out118_monsoon_unload_median"] = int(DWELL.loc["OUT118", 0.5])
    s["street_allowance"] = int(ALLOW[("Fresh", "street")])
    dep0 = LEGS_TR[(LEGS_TR.depot == "Kandy") & (LEGS_TR.seq == 0)]
    s["kandy_departure_delay_median"] = int((_mm(dep0.actual_depart_time) - _mm(dep0.planned_depart_time)).median())
    s["kandy_earliest_departure"] = dep0.planned_depart_time.min()
    s.update(five_reefer_wednesdays())
    s.update(matale_first_departures())
    return s


def _fmt(x):
    """a clock time, whole minutes (a median of 4:27 and 30 seconds reads 4:27)"""
    x = int(x)
    return f"{x // 60:02d}:{x % 60:02d}"


def five_reefer_wednesdays():
    """Kandy Wednesdays in the route history (train and test legs) that ran only five refrigerated vehicles: how many
    served all 23 chilled orders, how many planned refrigerated arrivals fell after the window on those days, and how
    far before its first trip's free-flow return the Matale or Kegalle truck's second trip was planned to leave"""
    lg = pd.concat([LEGS_TR, LEGS_TE])
    k = lg[(lg.depot == "Kandy") & (lg.vehicle_temp == "reefer")]
    n = k.groupby("date").vehicle_id.nunique()
    wed = n[n.index.map(CAL.dow_name) == "Wed"]
    five = sorted(wed[wed <= 5].index)
    ch = DEL[(DEL.depot == "Kandy") & (DEL.temp_requirement == "chilled")]
    full = [d_ for d_ in five if (ch.order_date == d_).sum() == 23 and (ch[ch.order_date == d_].dispatch_status == "attempted").all()]
    kk = k[k.date.isin(full)]
    late = int((_mm(kk.planned_arrival_time) > _mm(kk.to_outlet.map(OUT.window_close_time))).sum())
    early = []
    for (_, v), t in kk.groupby(["date", "vehicle_id"]):
        trips = sorted(t.groupby("route_id"), key=lambda z: _mm(z[1].planned_depart_time).min())
        if len(trips) < 2:
            continue
        t1, t2 = trips[0][1].sort_values("seq"), trips[1][1]
        if not ({t1.district.iloc[0], t2.district.iloc[0]} & {"Matale", "Kegalle"}):
            continue
        last = t1.iloc[-1]
        back = max(hm(last.planned_arrival_time), hm(OUT.loc[last.to_outlet, "window_open_time"])) \
            + ALLOW[("Fresh", OUT.loc[last.to_outlet, "dock_type"])] + DT.loc[last.district, "depot_to_district_freeflow_min"]
        early.append(back - _mm(t2.planned_depart_time).min())
    return {"five_reefer_wednesdays": len(five), "five_reefer_all_served": len(full), "five_reefer_planned_stops": len(kk),
            "five_reefer_planned_late": late, "five_reefer_early_min": int(min(early)), "five_reefer_early_max": int(max(early)),
            "five_reefer_days_with_early_truck": len(early)}


def matale_first_departures():
    """Matale Fresh departures from the Kandy hub (train and test legs): the earliest planned departure of any Matale
    trip, and the median planned departure of Matale trips that are the vehicle's first trip of the day"""
    x = pd.concat([LEGS_TR, LEGS_TE])
    x = x[(x.depot == "Kandy") & (x.brand == "Fresh") & (x.seq == 0)].copy()
    x["dep"] = _mm(x.planned_depart_time)
    allm = x[x.district == "Matale"]            # every Matale trip, first or second
    x = x.sort_values(["date", "vehicle_id", "dep"])
    x = x[x.groupby(["date", "vehicle_id"]).cumcount() == 0]
    m = x[x.district == "Matale"]
    out = {}
    for t, lab in [("ambient", "dry"), ("reefer", "chilled")]:
        g = m[m.vehicle_temp == t].dep
        out[f"matale_first_dep_min_{lab}"] = _fmt(allm[allm.vehicle_temp == t].dep.min())
        out[f"matale_first_dep_median_{lab}"] = _fmt(g.quantile(0.5))
    return out
