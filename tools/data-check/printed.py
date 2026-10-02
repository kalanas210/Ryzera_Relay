"""
Numbers the scenario text prints, rebuilt from values validate_scenario.py has already checked against the data.
Each string must appear word for word in docs/design/05-scenario-data.md, so a table row or sentence that
drifts from the data fails the validator.
"""
import pandas as pd

from relay_model import hm, fmt, ampm, num, OUT, VEH


def t12(x):
    return ampm(hm(x) if isinstance(x, str) else x, suffix=False)


def strings(orders, trips, EXPT, F, KT, EV, A, NAME, M):
    L = []
    o = orders
    dd, dc = o[("OUT117", "ambient")], o[("OUT117", "chilled")]
    L += [("Dilani dry row", f"| {dd['id']} | Dry | 36 rice and dhal cases, 44 packet foods cases, 22 tea and biscuit cases | {dd['units']} cases, {num(dd['kg'])} kg, {num(dd['m3'], 3)} m³ |"),
          ("Dilani chilled row", f"| {dc['id']} | Chilled | 40 dairy crates, 32 produce crates, 20 meat and fish boxes | {dc['units']} cases, {num(dc['kg'])} kg, {num(dc['m3'], 3)} m³ |")]
    k = trips[("VEH045", 1)]
    sh = F["thursday"]["short_cases"]
    L += [("Kasun load", f"Planned {k['units']} cases, {num(k['kg'])} kg and {num(k['m3'], 3)} m³ ({k['kg'] / 4200 * 100:.1f}% of 4,200 kg); "
                         f"loaded {k['units'] - sh} cases, {num(k['kg'] - sh * 10.0)} kg and {num(k['m3'] - sh * 0.040, 3)} m³"),
          ("Kasun standard", f"{k['std']} of 270 standard minutes"),
          ("stop 3 after short", f"{dd['units'] - sh} cases: {num(dd['kg'] - sh * 10.0)} kg, {num(dd['m3'] - sh * 0.040, 3)} m³")]
    thu = [r for r in A["orders"] if r["delivery_date"] == "2026-04-09" and r["outlet_id"] == "OUT117" and r["temp"] == "dry"][0]
    own = F["thursday"]["own_cases"]
    own_kg = round(own[0] * 10.0 + own[1] * 5.2 + own[2] * 4.4, 1)
    own_m3 = round(own[0] * 0.040 + own[1] * 0.036 + own[2] * 0.034, 3)
    rg = M.RANGE.loc[("OUT117", "ambient")]
    L += [("Thursday dry order", f"That order grows from {sum(own)} cases ({own[0]} rice and dhal, {own[1]} packet foods, {own[2]} tea and biscuit; "
                                 f"{num(own_kg)} kg, {num(own_m3, 3)} m³) to {thu['units']} cases ({thu['cases'].replace(' ', ', ')}; {num(float(thu['kg']))} kg, {num(float(thu['m3']), 3)} m³)"),
          ("Thursday dry id", f"Dilani's own Thursday dry order **{thu['order_id']}**"),
          ("OUT117 range", f"({int(rg.u0)} to {int(rg.u1)} cases, {num(rg.k0)} to {num(rg.k1)} kg, {num(rg.v0, 3)} to {num(rg.v1, 3)} m³)")]
    kk = {x: o[(x, "chilled")]["kg"] for x in ["OUT116", "OUT117", "OUT119"]}
    mm = {x: o[(x, "chilled")]["m3"] for x in ["OUT116", "OUT117", "OUT119"]}
    D = F["deferral"]
    L += [("van share", f"it carries 1,040 kg of the {num(sum(kk.values()))} kg (and 7.0 of the {num(sum(mm.values()), 3)} m³)"),
          ("pair 116+119", f"({num(kk['OUT116'] + kk['OUT119'])} kg together)"), ("pair 117+119", f"would be {num(kk['OUT117'] + kk['OUT119'])} kg"),
          ("pool", f"{len(D['pool'])} of the 23 chilled orders could each have been the one to wait"),
          ("lightest", f"OUT111 Waypoint Fresh Hali-Ela ({num(D['lightest'][1])} kg). Leaving it would keep {num(kk['OUT117'] - D['lightest'][1])} kg more moving"),
          ("without rule 2", f"OUT119's order ({num(kk['OUT119'])} kg) would wait instead: {num(kk['OUT117'] - kk['OUT119'])} kg less"),
          ("659.2 waits", f"{num(kk['OUT117'])} kg of chilled goods waits a day")]
    e57 = {x: a for x, a, _, _ in EXPT[("VEH057", 2)]["rows"]}
    L += [("protected expected", f"Relay expects OUT119 at {ampm(e57['OUT119'])}, {round(e57['OUT119'] - hm('08:00'))} minutes after its 8:00 close"),
          ("Aranayake chilled expected", f"expected at {ampm(e57['OUT116'])} (window closes 7:30)")]
    pm = D["paper_minutes"]
    L += [("paper 042", f"({pm['VEH042'] - 124} + 124 = {pm['VEH042']} minutes)"), ("paper 057", f"(120 + {pm['VEH057'] - 120} = {pm['VEH057']})"),
          ("paper 040", f"(239 + {pm['VEH040'] - 239} = {pm['VEH040']})"),
          ("paper 040 kegalle", f"a Kegalle trip after Badulla is 239 + {D['veh040_kegalle_paper'] - 239} = {D['veh040_kegalle_paper']} minutes"),
          ("lightest example", f"VEH040 would deliver the chilled order for {D['lightest_example']['VEH040'][0][0]} {NAME[D['lightest_example']['VEH040'][0][0]]} at "
                               f"{t12(M.simulate_ff(D['lightest_example']['VEH040'][0], M.EARLIEST, 'Fresh')[0][0][2])} AM and then run a shorter Badulla trip, {D['lightest_example']['veh040_minutes'][0]} + "
                               f"{D['lightest_example']['veh040_minutes'][1]} = {sum(D['lightest_example']['veh040_minutes'])} minutes"),
          ("paper clock 040", f"back from Badulla at {t12(D['paper_veh040'][0])} AM and would reach Mulgampola at {t12(D['paper_veh040'][1])}"),
          ("paper clock 042", f"back from Matale at {t12(fmt(trips[('VEH042', 1)]['back']))}, would reach its third Kegalle store at {t12(D['paper_veh042_third_stop'])}"),
          ("history second trips", f"{F['story']['second_trip_before_first_ends_pct']}% of Kandy second Fresh trips")]
    T = F["thursday"]
    ids = {r["outlet_id"]: r["order_id"] for r in A["orders"] if r["delivery_date"] == "2026-04-09" and r["temp"] == "chilled"}
    L += [("next run load", f"{num(T['kegalle_kg'])} of 6,180 kg and {num(T['kegalle_m3'], 3)} of 29.9 m³, {T['kegalle_std']} of 270 standard minutes"),
          ("next run ids", f"Hemmathagama ({ids['OUT117']}), Mawanella ({ids['OUT118']}) and Kegalle ({ids['OUT119']})"),
          ("next run times", f"Leaving at {t12(T['kegalle_depart'])} AM, it is planned at Kegalle {t12(T['kegalle_planned'][0])}, Mawanella {t12(T['kegalle_planned'][1])} and "
                             f"Hemmathagama {t12(T['kegalle_planned'][2])} (two orders, planned as two stops, the second at {t12(T['kegalle_planned'][3])}), every one inside its window, "
                             f"and back at {t12(T['kegalle_back'])}"),
          ("next run matale", f"{T['day_std']} of 270 standard minutes for the day; leaving Kegalle at {t12(T['too_late_depart'])} or later, the Matale trip no longer fits"),
          ("veh039 thursdays", f"it ran Kegalle and Matale on {T['veh039_kegalle_matale']} of the {T['veh039_thursdays']} Thursdays it ran in the route history"),
          ("next run needed", f"Thursday needs {T['needed_of_7']} of the 7 refrigerated vehicles"),
          ("thursday dry run", f"({num(T['dry_run_kg'])} kg and {num(T['dry_run_m3'], 3)} m³ with the other three Kegalle dry orders")]
    MO = F["monday"]
    L += [("monday veh042", f"it ran on {MO['veh042_mondays']} of {MO['mondays']} Mondays in the data"),
          ("monday times", f"left at {t12(MO['veh042_ready'])} AM. Back from Matale at {t12(MO['veh042_back'])}, it would have reached Kegalle at {t12(MO['veh042_kegalle_earliest'])} at the earliest"),
          ("monday kegalle", f"Kegalle ({num(MO['kegalle_kg'])} kg)"), ("monday van", f"OUT116 and OUT118 ({num(MO['van_kg'])} kg)"),
          ("monday 119", f"OUT119 ({num(MO['out119_kg'])} kg) waited for Tuesday"),
          ("tuesday", f"all {F['tuesday']['served']} Tuesday chilled orders were served")]
    # Kasun's table and the 9:12 PM change
    acc = {"rear_dock": "Rear dock", "street": "Curb"}
    for r in KT:
        x = r["outlet_id"]
        w = r["window"].split(" to ")
        L.append((f"Kasun row {r['stop']}", f"| {r['stop']} | {x} {NAME[x]} | {acc[OUT.loc[x, 'dock_type']]} | {t12(w[0])} to {t12(w[1])} | stop {r['stop_before_912']}: "
                                            f"{t12(r['planned_before_912'])} / {t12(r['expected_before_912'])} | {t12(r['planned'])} | {t12(r['expected'])} | "
                                            f"{t12(r['arrived'])} to {t12(r['left'])} |"))
    by = {r["outlet_id"]: r for r in KT}
    # the dispatcher sees the swap's cost to the minute (store and driver screens round to 5 minutes)
    seq_b = [r["outlet_id"] for r in sorted(KT, key=lambda r: int(r["stop_before_912"]))]
    seq_a = [r["outlet_id"] for r in KT]
    e116 = [[a_ for x_, a_, _, _ in M.simulate_model(s_, hm(EV["planned_departure"]), "Fresh", "2026-04-08")[0] if x_ == "OUT116"][0] for s_ in (seq_b, seq_a)]
    L += [("dilani earlier", f"her dry order was expected around {ampm(hm(by['OUT117']['expected_before_912']))} and is now expected around {ampm(hm(by['OUT117']['expected']))}"),
          ("aranayake later", f"to the minute as on every dispatcher screen: Aranayake's expected arrival moves from {t12(e116[0])} to {t12(e116[1])}, and its margin before the 7:30 close "
                              f"drops from {F['kasun']['margin_before_912']} to {F['kasun']['margin_after_912']} minutes"),
          ("first light legs", f"leaves Hemmathagama for Aranayake at {ampm(hm(by['OUT116']['planned']) - 13)}, instead of leaving Mawanella for it at {ampm(hm(by['OUT116']['planned_before_912']) - 13)}"),
          ("behind plan", f"Arrived {ampm(hm(KT[0]['arrived']))}. {hm(KT[0]['arrived']) - hm(KT[0]['planned'])} min behind plan"),
          ("behind plan 2", f"{hm(KT[0]['arrived']) - hm(KT[0]['planned'])} minutes behind the plan's {t12(KT[0]['planned'])}. Relay expected {t12(F['kasun']['expected_first_stop_3_40'])} "
                            f"for a {t12(EV['planned_departure'])} start (shown to Kasun as around {t12(KT[0]['expected'])}); he left {hm(EV['departed']) - hm(EV['planned_departure'])} minutes late, "
                            f"so he arrived on Relay's time"),
          ("behind plan frame", f"with \"Expected around {t12(KT[0]['expected'])}\" beside it"),
          ("behind history", f"{F['story']['keg_first_after_planned_pct']}% of first Kegalle stops in the route history arrived after their planned time, a median {F['story']['keg_first_behind_median']} minutes behind (10th to 90th percentile {F['story']['keg_first_behind_p10']} to {F['story']['keg_first_behind_p90']})")]
    # estimates
    nm = {"OUT117": "Hemmathagama", "OUT116": "Aranayake"}
    for r in A["estimates"]:
        est = f"around {ampm(hm(r['estimate']))}" if r["passed"] == "0" else f"estimate passed ({ampm(hm(r['estimate']))})"
        cells = [ampm(hm(r["at"])), f"{r['stop']} {nm[r['outlet_id']]}", est,
                 f"{t12(r['low'])} to {ampm(hm(r['high']))}" if r["passed"] == "0" else "", f"{r['silence_min']} min", ampm(hm(r["actual_arrival"]))]
        L.append((f"estimate {r['at']} {r['stop']}", "| " + " | ".join(cells).replace("|  |", "| |") + " |"))
    e605 = [r for r in A["estimates"] if r["at"] == "06:05" and r["stop"] == "3"][0]
    e642 = [r for r in A["estimates"] if r["at"] == EV["store_receipt"]][0]
    L += [("DEG-03 receipt in", f"Aranayake now around {ampm(hm(e642['estimate']))}, likely {t12(e642['low'])} to {ampm(hm(e642['high']))}"),
          ("DEG-03 keep", f"at {t12(EV['backup_kept'])} Nuwan taps Keep backup"),
          ("DEG-04 range", f"\"Likely between {t12(e605['low'])} and {ampm(hm(e605['high']))}.\""),
          ("DEG-04 estimate", f"\"Arriving around {ampm(hm(e605['estimate']))}\"")]
    # backup and standby
    B = F["backup"]
    bo = o[("OUT116", "ambient")]
    L += [("backup eta", f"expected at Aranayake around {ampm(hm(B['eta']))}, after its 7:30 close"),
          ("backup drawer", f"weight {num(bo['kg'])} of 1,200 kg, volume {num(bo['m3'], 3)} of 9.0 m³, fuel 0.0 of 520 L this week (this trip about {B['trip_litres']} L) and Fresh time {B['std']} of 270 minutes"),
          ("no room", f"Its second trip would also carry {num(B['veh057_with'])} of 1,040 kg"),
          ("backup ending", f"He turns back {B['out_min']} minutes out and reaches the hub around {ampm(hm(B['home']))}"),
          ("backup cost", f"The cancelled trip used about {B['litres']} L."),
          ("VEH058 idle", f"it ran on only {F['story']['veh058_wednesdays_run']} of {F['story']['kandy_wednesdays']} Wednesdays in the data")]
    # queue and board
    Q = F["queue"]
    a, b = Q["at_312"], Q["at_400"]
    L += [("queue 3:12", f"{a['total']} orders received for Wednesday ({a['dry']} Fresh dry, {a['chilled']} Fresh chilled, {a['style']} Style, {a['tech']} Tech; Peliyagoda {a['peliyagoda']}, Kandy hub {a['kandy']})"),
          ("queue 4:00", f"{b['total']} orders ({b['dry']} Fresh dry, {b['chilled']} Fresh chilled, {b['style']} Style, {b['tech']} Tech). Peliyagoda {b['peliyagoda']}, Kandy hub {b['kandy']}"),
          ("late ids", f"dry at 4:01 PM ({Q['late_ids'][0]}) and chilled at 4:02 PM ({Q['late_ids'][1]})")]
    t2 = trips[("VEH057", 2)]
    t1 = trips[("VEH057", 1)]
    ff = {x: a_ for x, a_, _, _ in t2["ff"]}
    three = t2["dep"] + 53 + 2 * (15 + 13)
    L += [("right panel", f"OUT116 Aranayake planned {t12(ff['OUT116'])}, OUT119 Kegalle planned {t12(ff['OUT119'])}; {num(t2['kg'])} of 1,040 kg, {num(t2['m3'], 3)} of 7.0 m³; "
                          f"{t2['std']} standard minutes, {t1['std'] + t2['std']} of 270 with trip 1; back {t12(t2['back'])}"),
          ("drag warning", f"the trip would carry {num(t2['kg'] + dc['kg'])} kg (limit 1,040 kg) and {num(t2['m3'] + dc['m3'], 3)} m³ (limit 7.0 m³), and its third stop would arrive at {t12(three)}"),
          ("banner", f"\"Kandy hub: {len(orders)} orders, {len(orders) - 1} on {len(trips)} trips, 1 waits\"")]
    # publish check
    late = [(v, tn, x, a_) for (v, tn), e in EXPT.items() for x, a_, _, _ in e["rows"] if a_ > hm(OUT.loc[x, "window_close_time"])]
    for v, tn, x, a_ in late:
        p = [pa for xx, pa, _, _ in trips[(v, tn)]["ff"] if xx == x][0]
        L.append((f"late {x}", f"| {v} trip {tn} | {x} {NAME[x]} | {t12(OUT.loc[x, 'window_close_time'])} | {t12(p)} | {t12(a_)} |"))
    L.append(("late share", f"That is {len(late)} of 53 ({len(late) / 53 * 100:.1f}%) expected after the window. In the route history {F['story']['kandy_fresh_monsoon_late_pct']}% of "
                            f"{F['story']['kandy_fresh_monsoon_stops']:,} Kandy Fresh stops in monsoon months actually arrived after the window"))
    so = o[("OUT120", "ambient")]
    L += [("style flag", f"OUT120 Waypoint Style Kegalle ({so['units']} cases, {num(so['kg'])} kg, {num(so['m3'], 3)} m³: light and bulky, needs a large truck)"),
          ("style board", f"the Style order fills {so['m3'] / VEH.loc['VEH056', 'volume_cap_m3'] * 100:.1f}% of VEH056's volume and {so['kg'] / VEH.loc['VEH056', 'weight_cap_kg'] * 100:.1f}% of its weight")]
    O7 = F["publish"]["out107_alone"]
    PM_ = F["publish"]["matale_departures"]
    L += [("maskeliya alone", f"An idle truck could take Maskeliya alone (expected about {ampm(hm(O7['expected']))}), but that is a second truck and driver for about {O7['hours']} hours "
                              f"at free flow and about {O7['litres']} L of fuel for one store"),
          ("matale 048", f"Leaving at {t12(PM_['VEH048']['depart'])}, VEH048 would have {PM_['VEH048']['late']} stops expected after their window (none at {t12(fmt(trips[('VEH048', 1)]['dep']))})"),
          ("matale 042", f"Leaving at {t12(PM_['VEH042']['depart'])}, VEH042 would have all {PM_['VEH042']['trip2_late']} Kandy stores on its second trip expected after their window "
                         f"({PM_['VEH042']['trip2_late_now']} at {t12(fmt(trips[('VEH042', 1)]['dep']))})"),
          ("matale history", f"the history's earliest Matale departures are {ampm(hm(F['story']['matale_first_dep_min_dry']))} dry and {ampm(hm(F['story']['matale_first_dep_min_chilled']))} chilled "
                             f"(medians {t12(F['story']['matale_first_dep_median_dry'])} and {t12(F['story']['matale_first_dep_median_chilled'])})")]
    # plan and fuel tables
    for (v, tn), t in sorted(trips.items()):
        x = VEH.loc[v]
        load = t["brand"] + (" chilled" if t["temp"] == "chilled" else (" dry" if t["brand"] == "Fresh" else ""))
        stops = ", ".join(f"{s} {fmt(a_)}" for s, a_, _, _ in t["ff"])
        L.append((f"plan row {v} {tn}", f"| {v} | {tn} | {x.type} {x.temp} | {load}, {t['district']} | {fmt(t['dep'])} | {stops} | {num(t['kg'])} kg / {num(t['m3'], 3)} m³ "
                                         f"({t['kg'] / x.weight_cap_kg * 100:.1f}% / {t['m3'] / x.volume_cap_m3 * 100:.1f}%) | {t['std']} | {fmt(t['back'])} |"))
    for r in A["fuel"]:
        wk, q = float(r["week_l"]), int(r["quota_l"])
        L.append((f"fuel row {r['vehicle_id']}", f"| {r['vehicle_id']} | {r['fresh_min']} of 270 | {r['daytime_min']} of 480 | Mon {r['mon_l']} + Tue {r['tue_l']} + Wed {r['wed_l']} = {r['week_l']} of {q} L ({wk / q * 100:.1f}%) |"))
    ref = [t for t in trips.values() if VEH.loc[t["v"], "temp"] == "reefer" and VEH.loc[t["v"], "type"] == "truck"]
    shares = [t["kg"] / VEH.loc[t["v"], "weight_cap_kg"] * 100 for t in ref]
    vans = [trips[("VEH057", 1)]["kg"] / 1040 * 100, trips[("VEH057", 2)]["kg"] / 1040 * 100]
    top = max(A["fuel"], key=lambda r: float(r["week_l"]) / int(r["quota_l"]))
    L += [("reefer truck shares", f"the refrigerated trucks carry {min(shares):.1f}% to {max(shares):.1f}% of their weight capacity"),
          ("van shares", f"(VEH057 at {vans[0]:.1f}% and {vans[1]:.1f}% of 1,040 kg)"),
          ("fullest fuel", f"The fullest vehicle is {top['vehicle_id']} at {float(top['week_l']) / int(top['quota_l']) * 100:.1f}% of its weekly quota")]
    # outlook
    W = sorted(int(r["iso_week"]) for r in A["outlook"])
    R = {int(r["iso_week"]): r for r in A["outlook"]}
    FO = F["outlook"]
    L += [("outlook chilled", "| Fresh chilled, m³ | " + " | ".join(R[w]["chilled_m3"] for w in W) + " |"),
          ("outlook total", "| All brands, m³ | " + " | ".join(R[w]["all_m3"] for w in W) + " |"),
          ("outlook vehicle-days", "| Refrigerated vehicle-days available | " + " | ".join(str(FO["vehicle_days"][str(w)]) for w in W) + " |"),
          ("outlook needed", "| Busiest day from 8 April: refrigerated vehicles needed / available | " + " | ".join(
              f"{R[w]['needed']} / {R[w]['available']} ({pd.Timestamp(R[w]['busiest_day_from_8_april']).strftime('%a')} {pd.Timestamp(R[w]['busiest_day_from_8_april']).day} "
              f"{pd.Timestamp(R[w]['busiest_day_from_8_april']).strftime('%b')})" for w in W) + " |")]
    od = pd.DataFrame(A["outlook_days"])
    other_wed = od[(od.date > "2026-04-08") & (od.date != FO["headline_day"]) & (od.date.map(lambda d: pd.Timestamp(d).dayofweek == 2))].chilled_kg.astype(float)
    ch15 = float(R[15]["chilled_m3"])
    six_wed = [d for d in FO["six_days"] if pd.Timestamp(d).dayofweek == 2]
    L += [("headline", f"\"Wednesday {pd.Timestamp(FO['headline_day']).day} {pd.Timestamp(FO['headline_day']).strftime('%B')} is the heaviest of the {len(six_wed)} Wednesdays ahead, "
                       f"and like each of them it needs 6 of the 7 refrigerated vehicles."),
          ("headline change", f"headline **Wednesday {pd.Timestamp(FO['headline_day']).day} {pd.Timestamp(FO['headline_day']).strftime('%B')}, the heaviest of the {len(six_wed)} Wednesdays ahead, each of which needs 6 of 7**")]
    L += [("headline kg", f"gives it {num(FO['headline_kg'])} kg of chilled orders against {num(other_wed.min())} to {num(other_wed.max())} kg on the other Wednesdays ahead"),
          ("week 15 ratio", f"{ch15} m³, {FO['week15_ratio']} times an ordinary 2026 week ({F['story']['kandy_2026_w1_13_chilled_mean']} m³)"),
          ("week 15 share", f"{ch15 / FO['one_load_m3']['15'] * 100:.1f}% of one load per refrigerated vehicle per open day"),
          ("backtest", f"missed Kandy Fresh by {FO['backtest'][0]}% a week on average, against {FO['backtest'][1]}% for"),
          ("key figure", f"\"The heaviest Wednesday ahead: {num(FO['headline_kg'])} kg chilled (Vesak ramp, payday week)\""),
          ("five serve", f"\"{FO['five_serve_wednesdays']} of 23\" / \"chilled orders five refrigerated vehicles can serve on a Wednesday\""),
          ("five serve text", f"five refrigerated vehicles serve only {FO['five_serve_wednesdays']} of 23 on each of them")]
    # totals and order rows
    P = F["plan"]
    L += [("totals", f"Fresh dry {P['fresh_dry'][0]} orders, {P['fresh_dry'][1]:,} cases, {num(P['fresh_dry'][2])} kg, {num(P['fresh_dry'][3], 3)} m³; "
                     f"Fresh chilled {P['fresh_chilled'][0]} orders, {P['fresh_chilled'][1]:,} cases, {num(P['fresh_chilled'][2])} kg, {num(P['fresh_chilled'][3], 3)} m³"),
          ("wednesdays below", f"higher than on {P['wednesdays_below']} of the 115 Kandy Wednesdays")]
    for s in [("OUT117", "ambient"), ("OUT117", "chilled"), ("OUT116", "ambient"), ("OUT116", "chilled"), ("OUT118", "ambient"), ("OUT119", "ambient"),
              ("OUT119", "chilled"), ("OUT081", "chilled")]:
        x = o[s]
        L.append((f"order row {s}", f"{x['id']} {s[0]} {'dry' if s[1] == 'ambient' else 'chilled'} {x['units']}, {num(x['kg'])}, {num(x['m3'], 3)}"))
    for s, lab in [(("OUT120", "ambient"), "Style"), (("OUT115", "ambient"), "Tech"), (("OUT095", "ambient"), "Tech")]:
        x = o[s]
        L.append((f"order row {s}", f"{x['id']} {s[0]} {lab} {x['units']}, {num(x['kg'])}, {num(x['m3'], 3)}"))
    # loading, morning, legs
    LD = {r["time"]: int(r["loaded_cases"]) for r in A["loading"]}
    sec = [(v, trips[(v, 2)]) for v in ["VEH059", "VEH057", "VEH042"]]
    L.append(("LDR-01 second trips", "three second trips, picked before each vehicle is back: " + ", ".join(
        f"{v} trip 2 ({t['units']} cases, leaves {t12(fmt(t['dep']))})" for v, t in sec[:2]) + f" and {sec[2][0]} trip 2 ({sec[2][1]['units']} cases, leaves {t12(fmt(sec[2][1]['dep']))})"))
    L += [("loading", f"{LD['02:40']} of {k['units']} cases at 2:40 AM (stop 4 done), {LD['02:47']} at 2:47 AM"),
          ("loading 2", f"{LD['02:48']} at 2:48 AM, {LD['02:52']} at 2:52 AM, every line loaded or decided by 3:30 AM ({LD['03:30']} cases)"),
          ("LDR-01 VEH045", f"VEH045, {LD['02:40']} of {k['units']} cases (Mohamed Rizwan")]
    S_ = F["sampath"]
    L += [("sampath", f"VEH042 left at {t12(S_['departed'])} (planned {t12(fmt(trips[('VEH042', 1)]['dep']))}"),
          ("sampath 2", f"{S_['behind_plan'][0]}, {S_['behind_plan'][1]} and {S_['behind_plan'][2]} minutes behind the free-flow plan ({S_['behind_plan'][3]} at the fourth: "
                        f"the plan had him waiting {round([st - a_ for x_, a_, st, _ in trips[('VEH042', 1)]['ff'] if x_ == 'OUT099'][0])} minutes at Rattota for its "
                        f"{t12(OUT.loc['OUT099', 'window_open_time'])} opening)"),
          ("sampath 3", f"at {ampm(hm(S_['stop2_arrival']))}, {S_['behind_plan'][1]} minutes behind plan, and reports \"Delayed, {S_['reported']} min\"")]
    C_ = F["counts"]
    L.append(("counts", f"{C_['05:20']} of 53 at 5:20, {C_['06:05']} at 6:05, {C_['06:15']} at 6:15, {C_['06:42']} at 6:42 (Hemmathagama counted from the store's receipt), "
                        f"{C_['07:14']} at 7:14 (Kasun's stop 4 held until settled), {C_['07:16']} at 7:16"))
    tp = hm(EV["departed"])
    ratios, travel, dw = [], [], []
    rq = []
    for i, r in enumerate(KT):
        a_, l_ = hm(r["arrived"]), hm(r["left"])
        ffm = 53 if i == 0 else 13
        q = M.RATIO_KEG.loc[(i > 0, tp // 60)]
        travel.append(a_ - tp)
        ratios.append(f"{(a_ - tp) / ffm:.2f}")
        rq.append(f"{q[0.1]:.2f} to {q[0.9]:.2f}")
        dw.append(l_ - max(a_, hm(OUT.loc[r['outlet_id'], 'window_open_time'])))
        tp = l_
    dl4 = hm(KT[3]["delivered"]) - hm(KT[3]["arrived"])
    L += [("legs", f"depot to Kegalle {travel[0]} minutes ({ratios[0]} times free flow; history 10th to 90th percentile {rq[0]}); between stops {travel[1]}, {travel[2]} and {travel[3]} minutes "
                   f"({ratios[1]}, {ratios[2]} and {ratios[3]} times; history {rq[1]}, {rq[2]} and {rq[3]})"),
          ("unloading", f"Time at the store {dw[0]} minutes at Kegalle, {dw[1]} at Mawanella, {dw[2]} at Hemmathagama and {dw[3]} at Aranayake (delivered after {dl4}"),
          ("first leg ratio", f"His first leg took {ratios[0]} times free flow; in monsoon months the first leg of a Kegalle run takes a median {F['story']['keg_first_ratio_median']} times its planned travel time"),
          ("mawanella median", f"median {F['story']['out118_monsoon_unload_median']} minutes against a {F['story']['street_allowance']} minute allowance")]
    ex, eb = M.simulate_model(trips[("VEH045", 1)]["seq"], trips[("VEH045", 1)]["dep"], "Fresh", "2026-04-08")
    home = hm(EV["finish"]) + 53 * M.factor("Kegalle", hm(EV["finish"]), "2026-04-08")
    L += [("kasun expected back", f"At publish, Relay expected him back at the hub around {ampm(M.r5(eb))} (planned {t12(fmt(trips[('VEH045', 1)]['back']))})"),
          ("kasun home now", f"Relay now expects him at the hub around {ampm(M.r5(home))}"),
          ("kasun home fact", f"Kasun taps Finish trip at {ampm(hm(EV['finish']))} at the dock and leaves at {t12(EV['left_last_stop'])}; Relay expects him at the hub around "
                              f"{t12(M.r5(home))} (at publish it expected {t12(M.r5(eb))})")]
    L += [("lift 38", "Fresh orders are about 38% larger than on an ordinary Wednesday"),
          ("VEH045 93", "VEH045 ran a Kandy Fresh trip as well as its Kegalle trip on 93 of 115 Wednesdays")]
    # story list
    S = F["story"]
    L += [("story deferrals", f"the Kandy hub deferred {S['Kandy_deferred_orders']} orders on {S['Kandy_deferral_days']} days ({S['Kandy_deferred_chilled']} chilled, {S['Kandy_deferred_dry']} dry) out of {S['Kandy_orders']:,} orders; "
                              f"Peliyagoda deferred {S['Peliyagoda_deferred_orders']:,} on {S['Peliyagoda_deferral_days']} days, all chilled, out of {S['Peliyagoda_orders']:,}"),
          ("story not run", f"Kandy {S['Kandy_not_run']} ({S['Kandy_not_run_fresh_dry']} Fresh dry, {S['Kandy_not_run_style']} Style, {S['Kandy_not_run_tech']} Tech), "
                            f"Peliyagoda {S['Peliyagoda_not_run']} (all Fresh chilled)"),
          ("story monsoon days", f"all {S['Kandy_deferral_days_monsoon']} fell in monsoon months; on {S['Kandy_deferral_days_chilled']} of them the deferred orders were chilled "
                                 f"(on {pd.Timestamp(S['Kandy_dry_deferral_day']).strftime('%A')} {pd.Timestamp(S['Kandy_dry_deferral_day']).day} "
                                 f"{pd.Timestamp(S['Kandy_dry_deferral_day']).strftime('%B %Y')}, {S['Kandy_dry_deferral_orders']} Fresh dry orders waited)"),
          ("story five reefers", f"{S['five_reefer_wednesdays']} Kandy Wednesdays ran only five refrigerated vehicles. On {S['five_reefer_all_served']} of them all 23 chilled orders were attempted "
                                 f"and none waited, with {S['five_reefer_planned_late']} of {S['five_reefer_planned_stops']} planned refrigerated arrivals after the window. Every one of those "
                                 f"{S['five_reefer_days_with_early_truck']} days planned the Matale or Kegalle truck's second trip to leave {S['five_reefer_early_min']} to "
                                 f"{S['five_reefer_early_max']} minutes before its first trip could be back at free flow"),
          ("story five reefers 2", f"planning a second trip to leave {S['five_reefer_early_min']} to {S['five_reefer_early_max']} minutes before the first trip could be back"),
          ("story matale", f"the earliest planned departure of any Matale Fresh trip in the route history is {ampm(hm(S['matale_first_dep_min_dry']))} for dry runs and "
                           f"{ampm(hm(S['matale_first_dep_min_chilled']))} for chilled runs (medians {t12(S['matale_first_dep_median_dry'])} and {t12(S['matale_first_dep_median_chilled'])} for the day's first trips"),
          ("story missed", f"of the {S['missed_chilled']:,} chilled orders that missed their day (deferred or not run), {S['missed_chilled_with_dry']:,} had the same store's Fresh dry order delivered that day"),
          ("story late", f"{S['kandy_fresh_monsoon_late_pct']}% of {S['kandy_fresh_monsoon_stops']:,} Kandy-depot Fresh stops in monsoon months arrived after the store's window"),
          ("story late districts", f"By district, Fresh only: Kandy {S['late_pct_fresh_Kandy']}%, Matale {S['late_pct_fresh_Matale']}%, Kegalle {S['late_pct_fresh_Kegalle']}%, "
                                   f"Nuwara Eliya {S['late_pct_fresh_Nuwara Eliya']}%, Badulla {S['late_pct_fresh_Badulla']}%"),
          ("story behind", f"{S['keg_first_after_planned_pct']}% of {S['keg_first_stops']} first stops of Kegalle Fresh runs"),
          ("story behind all", f"across all {S['keg_stops']:,} Kegalle Fresh stops in monsoon months, {S['keg_stops_after_planned_pct']}%"),
          ("story standby", f"VEH058 ran on {S['veh058_wednesdays_run']} of {S['kandy_wednesdays']} Kandy Wednesdays (idle on {S['kandy_wednesdays'] - S['veh058_wednesdays_run']}); VEH060 ran on {S['veh060_wednesdays_run']}"),
          ("story VEH045", f"VEH045 ran Kegalle Fresh dry on {S['veh045_kegalle_dry_wednesdays']} of {S['kandy_wednesdays']} Wednesdays"),
          ("story median", f"the median Kandy Wednesday ran {S['wed_median_trips']} trips on {S['wed_median_vehicles']} vehicles"),
          ("story mixing", f"{S['trips_mixing_temps']} of {S['trips_in_orders']:,} trips in the order history mix chilled and dry, and {S['kandy_fresh_dry_on_reefer']} of {S['kandy_fresh_dry_attempted']:,} delivered Kandy Fresh dry orders"),
          ("story second trips", f"{S['second_trip_before_first_ends_pct']}% of {S['kandy_second_fresh_trips']:,} Kandy second Fresh trips"),
          ("story peak", f"2025 week 15, {S['kandy_top_chilled_m3']} m³"),
          ("story departures", f"a median {S['kandy_departure_delay_median']} minutes after their planned time")]
    return L
