# Scenario Data: one day at Waypoint

> **v0.4 (data aligned).** "Signal Lost on the Kandy Corridor", rebuilt on the competition data. Every vehicle, outlet and date is a real record with its real attributes (`vehicles.csv`, `outlets.csv`, `calendar.csv`). Every trip time uses the organizers' published standard, imported from `data/raw/check_allocation.py`. Order sizes are forecasts made with the team's forecast method, except the Kegalle orders built from cases on the order form (Kasun's four dry orders, the three Kegalle chilled orders and Dilani's Thursday dry order), which keep the forecast's case count and sit within 3% of its weight and 6% of its volume (5% and 8% for the Thursday order); every order sits inside that outlet's recorded range. Store names are ours (`outlets.csv` has no names); each is a real town or Kandy city area inside the outlet's district. Every data figure comes from a script. Story times (when people act) are authored, and the validator checks them against the data and against each other. `tools/data-check/validate_scenario.py` reads the appendix at the end of this file, recomputes each fact from the CSVs and checks the numbers printed in the text. Frame owners: copy strings from here, and run the validator after any change.

## Changes from v0.3

v0.3 is the state of the five specs after their consistency pass (story from v0.2). Everything below changes meaning, not just spelling. Frame owners should treat each line as a string or layout change.

**Dates and context**
- Planning day: Tuesday 13 October 2026 becomes **Tuesday 7 April 2026**. Delivery: Wednesday 14 October becomes **Wednesday 8 April 2026**. The catch-up day: Thursday 15 October becomes **Thursday 9 April 2026**. (October 2026 is past the end of `calendar.csv`, which stops on 28 June 2026.)
- "A festival weekend is four days away" becomes **the week before the Sinhala and Tamil New Year holidays** (Monday 13 and Tuesday 14 April, closed). Every day in the story falls in the data's monsoon months (`calendar.csv` flags monsoon and inter-monsoon months alike; April is the first inter-monsoon).
- "Dry-box truck VEH053 in the workshop" becomes **two refrigerated vehicles in the workshop: VEH039 (refrigeration fault since Monday 6 April, 2:50 AM) and VEH058 (booked service, Monday 6 to Wednesday 8 April)**.

**People and vehicles**
- Dilani's store: OUT057 Waypoint Fresh Nawalapitiya (Kandy district) becomes **OUT117 Waypoint Fresh Hemmathagama (Kegalle district)**.
- Kasun: VEH047, refrigerated truck, Fresh chilled, Kandy district, 5 stops, becomes **VEH045, ambient (dry-box) truck, Fresh dry, Kegalle district, 4 stops**. VEH047 is an ambient truck in the data and is not needed on Wednesday.
- Sampath Lakmal: VEH052 dry-box truck becomes **VEH042 refrigerated truck** (Matale, then Kandy district).
- Priyantha Silva: VEH049 refrigerated truck becomes **VEH057 refrigerated van** (Kandy van-only stores, then Kegalle).
- Nimal Fernando: VEH058 refrigerated van, the chilled standby, becomes **VEH060 ambient van, the hub's standby this week** (VEH058 is in the workshop).
- Vehicle capacities are now the data's: refrigerated vans 1,040 kg and 7.0 m³, not 1,200 kg and 6 m³; VEH045 4,200 kg and 24.0 m³.

**Kasun's run**
- Stops: 1 OUT048 Peradeniya, 2 OUT050 Gampola, 3 OUT053 Ulapane, 4 OUT057 Nawalapitiya (Dilani), 5 OUT060 Kotmale Road become **1 OUT119 Kegalle, 2 OUT118 Mawanella (curb), 3 OUT117 Hemmathagama (Dilani, rear dock), 4 OUT116 Aranayake (rear dock)**.
- Stop numbers that change meaning: Dilani is **stop 3** (was 4); the stop moved to the backup is **stop 4, Aranayake** (was 5, Kotmale Road); the signal is lost during **stop 2, Mawanella** (was stop 3, Ulapane). Every "Stop 5" string becomes "Stop 4", "Stop 4 offline" becomes "Stop 3 offline".
- The 9:12 PM change: "swaps stops 4 and 5 on VEH047 so Nawalapitiya is reached earlier" becomes **"swaps stops 3 and 4 on VEH045 so that even on the plan's times Kasun reaches the Aranayake hill road after first light; Hemmathagama is reached earlier"**. Relay now shows the cost when Nuwan swaps: **Aranayake's expected margin before its 7:30 close drops from 54 to 17 minutes**.
- Kasun's run now goes to Kegalle town first, past Mawanella; the run sheet gives the reason (see "VEH045 trip 1").
- Signal lost "near Ulapane" becomes: **the last contact is at 5:41 AM, during stop 2, Mawanella**. Screens no longer name a place or claim "no signal": Nuwan sees "No contact from Kasun since 5:41 AM". The silence has a named cause in the story (an inter-monsoon thunderstorm takes Kasun's mobile network down). 5:41 to 7:14 AM, 93 minutes, is unchanged.
- Kasun is at Aranayake's dock, not driving, when the signal returns: he answers the stop 4 question at 7:15 there and taps **Finish trip at 7:17 AM at the dock** (was 7:40 on the way back).
- The load: "108 cases planned, 106 loaded" becomes **383 cases planned, 377 loaded**; "2 dairy crates short" becomes **6 rice and dhal cases short**.

**Orders and IDs** (numbers now continue the data's own numbering: one block per delivery day, sorted by outlet, dry before chilled)
- Dilani's dry order ORD0094611 (deferred) becomes **ORD0098595 (delivered on Kasun's run, 6 cases short)**. Her chilled order ORD0094612 (on Kasun's run) becomes **ORD0098596 (waits for Thursday)**. The deferred order is now **chilled**, not dry.
- ORD0094705 (2 dairy crates as their own order) is gone: the **6 short cases are added to Dilani's own Thursday dry order ORD0098747, marked "from Wednesday"**.
- The backup's order ORD0094603 (Kotmale Road, chilled) becomes **ORD0098593 (Aranayake, dry, 86 cases)**.
- Case types: dairy crate, frozen box, produce crate, dry carton (4 types) become **rice and dhal case, packet foods case, tea and biscuit case (dry); dairy crate, produce crate, meat and fish box (chilled)**, with new weights and volumes.

**Rules and policy**
- "Chilled runs take small dry orders (12 cartons or fewer)" is **removed**: no trip in the data mixes chilled and dry, and no Kandy Fresh dry order ever rode a refrigerated vehicle. The store-facing line "Our refrigerated vehicles take only small dry orders" is removed with it.
- "Dry orders wait before chilled ones" becomes a **numbered rule**: 1 keep every other vehicle on its usual run, 2 never make a store wait twice in a row without an override, 3 keep the most goods moving. DSP-03 now separates what was unavoidable from what was Relay's choice.
- Protected store: OUT055 (skipped on Tuesday's run) becomes **OUT119 Kegalle (its Monday chilled order waited a day)**.
- Standby rule: "one refrigerated vehicle at each depot keeps its second trip free" becomes **"each depot keeps one vehicle and driver free until 8 AM for problems"**; at the Kandy hub that is normally VEH058, this week VEH060.
- Two named times on every role: **Planned** (the published standard at free flow) and **Expected** (Relay's model). The estimate range now follows one stated rule: a store's confirmed receipt counts as a stop event, and the low end is never earlier than the time shown.
- Lead decision 7, as applied: "unavoidable" is **one chilled order waits** on a clock where a vehicle is in one place at a time; that it is a Kegalle order is Relay's choice (rule 1). **VEH040 cannot take Dilani's order even on paper** (239 + 68 = 307 of 270 minutes), so the paper alternative is VEH042 taking Kegalle and VEH040 taking Mulgampola; VEH040 is back from Badulla at 9:05, after every Kandy and Kegalle store closes.

**Frames whose meaning changes**
- DSP-01: counts (125 at 3:12 PM, 136 at 4:00 PM), 2 late orders not 3, new flags. The queue flag for the Style order no longer cites a vehicle (the plan does not exist yet).
- DSP-02: the board is filtered to **refrigerated vehicles at the Kandy hub** ("Refrigerated: 5 running, 2 in the workshop"), the right panel shows **VEH057 trip 2**, and the broken-rule drag is **Dilani's chilled order onto VEH057 trip 2** (was OUT064 onto truck VEH049). The publish check lists **5 stops Relay expects after their window**, and its last column is **"Why Relay keeps it"**.
- DSP-03: 1 chilled order, not 3 dry orders; new reason, rule, pool, cost, paper alternative and next-run check.
- DSP-04: the shortfall decision adds the cases to Thursday's order; Sampath's delay replaces Priyantha's; new counts.
- DSP-05: weeks 15 to 20 of 2026, headline **Wednesday 29 April, the heaviest of the 5 Wednesdays ahead, each of which needs 6 of 7**. The key figures are vehicles ("6 of 7", "22 of 23"); every "needs 6 of 7" line is scoped to Relay's clock; 8 April uses the order book.
- LDR-01 to LDR-04: VEH045, 4 stops, dry case types, new statuses and counts; the "Plan changed 9:12 PM" banner stays, now for stops 3 and 4. LDR-01 also lists the three second-trip loads. Rizwan signs in at 2:18 AM and switches back with his PIN at 2:40 (LDR-01 / PIN switch) after Anjali marks VEH042 complete.
- DRV-01 to DRV-05: VEH045, Kegalle, 4 stops. **DRV-02 / Early (3:52 AM, Peradeniya) is replaced by DRV-02 / Behind plan (4:52 AM, Kegalle).**
- DEG-01 to DEG-05 and the scenario card: stop numbers, place names, backup VEH060, new estimates and ranges, the storm as the cause. **New state DEG-03 / receipt in (6:42 AM):** the store's receipt moves Aranayake's estimate and asks Nuwan "Keep backup / Cancel backup"; he keeps it at 6:44.
- DRV-05: **Finish trip moves from 7:40 AM on the road to 7:17 AM at Aranayake's dock.**
- STM-03: the deferral notice is for the chilled order; the short-delivery notice adds cases to Thursday's order. **STM-04 / past estimate moves from 6:30 to 6:40 AM** and offers "confirm receipt". **STM-05 now has a 6:42 AM state (confirmed before the driver's proof arrives)** as well as 7:22 AM. STM-04's copy no longer says "low-signal area".

## The day

- **Planning:** Tuesday 7 April 2026 (ISO week 15, New Year ramp 0.4, monsoon, not a payday). Orders for Wednesday close at 4:00 PM.
- **Delivery:** Wednesday 8 April 2026 (New Year ramp 0.5, monsoon, not a payday, an operating day). The Sinhala and Tamil New Year holidays are Monday 13 and Tuesday 14 April; both are closed, as is Sunday 12 April.
- **Monsoon months:** in this document, the months `calendar.csv` flags as monsoon (March to June, October and November). The booklet defines the flag as a monsoon or inter-monsoon month; April is the first inter-monsoon.
- **The Fresh window:** the booklet's budget is 3:30 to 8:00 AM, 270 minutes per vehicle. In the route history Kandy runs are planned from 2:00 AM (the Badulla and Nuwara Eliya runs), and Relay's plan starts those that early too. Relay also starts both Matale runs earlier than the route history ever has: VEH048 (dry) at 2:30 and VEH042 (chilled) at 2:44, where the history's earliest Matale departures are 3:33 AM dry and 2:55 AM chilled (medians 4:27 and 4:29). The reason is the Matale road index of 72. Leaving at 4:27, VEH048 would have 3 stops expected after their window (none at 2:30). Leaving at 2:55, VEH042 would have all 3 Kandy stores on its second trip expected after their window (2 at 2:44). This is the main reason only 5 stops are expected late on 8 April.
- **Context:** Fresh orders are about 38% larger than on an ordinary Wednesday (the New Year lift times growth). At the Kandy hub two of the seven refrigerated vehicles are in the workshop:
  - **VEH039**, refrigerated truck: its refrigeration unit failed the temperature check at the dock on Monday 6 April at 2:50 AM. Parts arrive Wednesday; it is back on Thursday 9 April.
  - **VEH058**, refrigerated van: booked service, Monday 6 to Wednesday 8 April; back on Thursday 9 April. VEH058 is normally the Kandy hub's standby: it ran on only 4 of 115 Wednesdays in the data.
- **Roads (`road_conditions.csv`, 8 April):** Matale 72 (below 90 every day since 27 March; 82 on planning day); Kandy, Kegalle, Nuwara Eliya and Badulla 100.
- **Weather (story assumption):** an inter-monsoon thunderstorm crosses the Kandy corridor before dawn on Wednesday. Kasun's mobile network is down around Mawanella and the hill roads to Hemmathagama and Aranayake from 5:41 to 7:14 AM. The data has no coverage file; the booklet says coverage can drop across hill country and the Kandy corridor.

## People

| Person | Role | Where | Vehicle |
|---|---|---|---|
| Nuwan Perera | Dispatcher | Peliyagoda planning office, plans both depots; on call by phone on Fresh nights | |
| Mohamed Rizwan | Loading supervisor | Kandy hub dock, night shift | |
| Suresh Kumar, Anjali Wickramasinghe | Loaders on the same shift | Kandy hub dock | |
| Kasun Bandara | Driver | Kandy hub | VEH045, ambient truck (dry-box), Kegalle Fresh dry run |
| Sampath Lakmal | Driver | Kandy hub | VEH042, refrigerated truck, Matale then Kandy district chilled |
| Priyantha Silva | Driver | Kandy hub | VEH057, refrigerated van, Kandy van-only chilled then Kegalle chilled |
| Nimal Fernando | Driver | Kandy hub | VEH060, ambient van, the hub's standby this week |
| Dilani Jayawardena | Store Manager | Waypoint Fresh Hemmathagama (OUT117), Kegalle district | |

## Vehicles at the Kandy hub (the ones on screens)

All from `vehicles.csv`, depot Kandy. The full fleet and its Wednesday status is in the appendix (relay:vehicles).

| Vehicle | Type | Temperature | Weight cap | Volume cap | Fuel quota a week | Status on Wednesday |
|---|---|---|---|---|---|---|
| VEH039 | Truck | Refrigerated | 6,180 kg | 29.9 m³ | 370 L | In the workshop (refrigeration fault, since Mon 6 Apr 2:50 AM) |
| VEH040 | Truck | Refrigerated | 5,510 kg | 26.4 m³ | 380 L | Trip 1 Fresh chilled, Badulla |
| VEH041 | Truck | Refrigerated | 3,610 kg | 19.4 m³ | 600 L | Trip 1 Fresh chilled, Badulla |
| VEH042 | Truck | Refrigerated | 6,180 kg | 29.9 m³ | 480 L | Trip 1 Fresh chilled, Matale (VEH039's usual run). Trip 2 Fresh chilled, Kandy district rear-dock stores (its own usual run) |
| VEH043 | Truck | Refrigerated | 5,510 kg | 26.4 m³ | 450 L | Trip 1 Fresh chilled, Nuwara Eliya |
| VEH057 | Van | Refrigerated | 1,040 kg | 7.0 m³ | 450 L | Trip 1 Fresh chilled, Kandy van-only stores. Trip 2 Fresh chilled, Kegalle (VEH039's usual run, 2 of its 3 orders) |
| VEH058 | Van | Refrigerated | 1,040 kg | 7.0 m³ | 550 L | In the workshop (booked service) |
| VEH045 | Truck | Ambient (dry-box) | 4,200 kg | 24.0 m³ | 530 L | Trip 1 Fresh dry, Kegalle (Kasun) |
| VEH060 | Van | Ambient | 1,200 kg | 9.0 m³ | 520 L | Standby, free until 8 AM; becomes the backup for Kasun's stop 4 |

**Board counts (DSP-02 filters, Kandy hub):** all vehicles 22: 12 running, 1 standby, 2 in the workshop, 7 not needed. Refrigerated: 5 running, 2 in the workshop. Ambient: 7 running, 1 standby, 7 not needed. 18 trips: 7 refrigerated, 11 ambient.

## Standard case types (used on the order form)

One case is one unit in the order data. Each case type sits inside the data's range per Fresh unit.

| Case type | Temperature | Weight | Volume |
|---|---|---|---|
| Rice and dhal case | Ambient (dry) | 10.0 kg | 0.040 m³ |
| Packet foods case | Ambient (dry) | 5.2 kg | 0.036 m³ |
| Tea and biscuit case | Ambient (dry) | 4.4 kg | 0.034 m³ |
| Dairy crate | Chilled | 8.4 kg | 0.038 m³ |
| Produce crate | Chilled | 5.6 kg | 0.042 m³ |
| Meat and fish box | Chilled | 7.2 kg | 0.030 m³ |

## Dilani's two orders for Wednesday

OUT117 orders dry every operating day and chilled every Wednesday, Thursday, Friday and Saturday (its fixed pattern in the data). Her last chilled delivery was on Saturday 4 April.

| Order | Type | Contents | Size | What happens |
|---|---|---|---|---|
| ORD0098595 | Dry | 36 rice and dhal cases, 44 packet foods cases, 22 tea and biscuit cases | 102 cases, 685.6 kg, 3.772 m³ | On **VEH045 trip 1, stop 3** (Kasun). Window 4:00 to 7:45 AM. Planned 5:30 AM; expected around 6:35 AM (stop 4, around 7:15 AM, until the 9:12 PM change). Arrives 6 rice and dhal cases short |
| ORD0098596 | Chilled | 40 dairy crates, 32 produce crates, 20 meat and fish boxes | 92 cases, 659.2 kg, 3.464 m³ | **Moved to Thursday 9 April, 4:00 to 7:45 AM.** Reason: refrigerated capacity short (see "Why one chilled order waits") |

Dilani placed the chilled order at 2:10 PM on Tuesday and the dry order at 2:14 PM. Order numbers are reserved per store for each delivery day, dry before chilled, as in the data, so the dry order has the lower number although she placed it second. Only the chilled order moves; her dry order comes the same morning. In the order history every one of the 2,018 chilled orders that missed their day had the same store's dry order delivered that day.

## Why one chilled order waits

This is the text behind the DSP-03 drawer. It says what was unavoidable, what was Relay's choice, and what the choice costs.

**The rules Relay plans with.** The organizers' published standard for trip time (270 Fresh minutes and 480 daytime minutes per vehicle, at most two trips, one district and one brand per trip, weight and volume caps, van-only stores on vans), plus a clock: every planned arrival inside the store's window at free flow, first trips leaving no earlier than 2:00 AM, and a second trip leaving at least 10 minutes after the first is back at the hub (free-flow drive back).

**Unavoidable on a real clock: one chilled order has to wait.** With VEH039 and VEH058 in the workshop, no plan for the five refrigerated vehicles left gets all 23 chilled orders to their stores inside their windows on a clock where a vehicle is in one place at a time. Relay searched every plan: at most 22 of 23, even with no reload time at the dock. With either VEH039 or VEH058 back, all 23 fit. Wednesday is the week's busiest chilled day (23 stores): on that clock even an ordinary Wednesday needs 6 refrigerated vehicles, and five serve at most 22. The route history did serve all 23 with five refrigerated vehicles on 17 Wednesdays, but only by planning a second trip to leave 98 to 174 minutes before the first trip could be back (Numbers for the story boards, 15). Only "one chilled order waits" is unavoidable; which one waits, and that it is a Kegalle order, is Relay's choice.

**Relay's choice: which order waits.** Relay applies three rules, in order:
1. **Keep every other vehicle on its usual run, and give the missing vehicle's runs, whole, to vehicles with time left.** VEH039's runs are Matale and Kegalle. VEH042 runs Matale before its usual Kandy run. VEH057's second trip is then the only refrigerated trip planned to reach Kegalle before the windows close, and it carries 1,040 kg of the 1,460.8 kg (and 7.0 of the 7.676 m³). Back from its first trip at 6:02, it also cannot leave in time to reach all three stores inside their windows. So one Kegalle order waits.
2. **Never make a store wait twice in a row without an override.** OUT119 Waypoint Fresh Kegalle had its Monday chilled order wait a day, so OUT119 rides.
3. **Keep the most goods moving.** With OUT119 on the van, OUT116 fits beside it (801.6 kg together); OUT117 and OUT119 together would be 1,125.6 kg. So Dilani's order waits.

**The pool.** 15 of the 23 chilled orders could each have been the one to wait in some plan: Badulla OUT110, OUT111, OUT112, OUT113; Nuwara Eliya OUT104, OUT105, OUT106, OUT107; Matale OUT097, OUT099, OUT100, OUT101; Kegalle OUT116, OUT117, OUT119. Only two of them keep all five vehicles on their usual runs: OUT117 and OUT119. Rule 2 picks OUT117.

**What the choice costs.**
- 659.2 kg of chilled goods waits a day. Hemmathagama's chilled shelf goes from its Saturday 4 April delivery to Thursday 9 April.
- The lightest order in the pool is OUT111 Waypoint Fresh Hali-Ela (159.8 kg). Leaving it would keep 499.4 kg more moving, but every such plan moves at least one other vehicle off its usual run (for example, VEH040 would deliver the chilled order for OUT119 Waypoint Fresh Kegalle at 3:00 AM and then run a shorter Badulla trip, 68 + 201 = 269 minutes, while VEH057 takes Aranayake and Hemmathagama). Rule 1 comes before rule 3: Relay does not move other vehicles off their usual runs so that a smaller order waits instead, and the drawer says so.
- Without rule 2, OUT119's order (466.4 kg) would wait instead: 192.8 kg less, but its second chilled order in a row.
- The protected order still arrives late. On VEH057's second trip Relay expects OUT119 at 8:32 AM, 32 minutes after its 8:00 close, the same morning; Aranayake's chilled order on the same trip is expected at 7:43 AM (window closes 7:30).

**On paper (what the organizers' checker would say).** `check_allocation.py` adds up standard minutes only. It does not check store windows, departure times or the drive back to the hub. Relay checks all three, so this is where it is stricter, and Relay never says Dilani's order breaks the published standard. By the standard alone all 23 fit, and the checker would pass a plan such as: VEH042 runs Matale then all three Kegalle stores (129 + 124 = 253 minutes), VEH057's second trip takes Bogambara and Kandy Town (120 + 52 = 172), and VEH040 takes Mulgampola as a second trip after Badulla (239 + 31 = 270). VEH040 cannot take Dilani's order even on paper: a Kegalle trip after Badulla is 239 + 68 = 307 minutes. On the clock the paper plan fails: VEH040 is back from Badulla at 9:05 AM and would reach Mulgampola at 9:31, after it closes at 8:00. VEH042, back from Matale at 6:16, would reach its third Kegalle store at 8:15 at the earliest, after every Kegalle store has closed. (The route history plans the same way the checker counts: 73.8% of Kandy second Fresh trips are planned to leave before the first trip's last planned arrival.)

**The next run can carry it.** Relay checks Thursday before it confirms the deferral. VEH039 is back from the workshop, and its usual Thursday is two trips, Kegalle and then Matale (it ran Kegalle and Matale on 101 of the 113 Thursdays it ran in the route history). Its Kegalle trip carries Dilani's Wednesday order ORD0098596 plus Thursday's chilled orders from Hemmathagama (ORD0098748), Mawanella (ORD0098750) and Kegalle (ORD0098752): 2,921.6 of 6,180 kg and 15.641 of 29.9 m³, 153 of 270 standard minutes. The standard counts each order as a stop, so Hemmathagama counts twice; the route history does the same (on 10 April 2025, route R015108 carried two orders each for OUT084 and OUT087, the ones that had waited and the new ones). Leaving at 2:55 AM, it is planned at Kegalle 3:48, Mawanella 4:16 and Hemmathagama 4:45 (two orders, planned as two stops, the second at 5:13), every one inside its window, and back at 6:21. Its usual Matale trip still follows, every planned arrival inside its window, 256 of 270 standard minutes for the day; leaving Kegalle at 3:00 or later, the Matale trip no longer fits. With VEH039, VEH058 and Dilani's order added, Thursday needs 5 of the 7 refrigerated vehicles, so the standby stays free.

**Monday, for the record (why OUT119 is protected).** VEH039 was loaded for its first Monday run, Matale, when its unit failed the check at 2:50 AM. Relay's rule 1 moved the Matale load whole to VEH042, which is idle on Mondays (it ran on 14 of 116 Mondays in the data). VEH042 had to be cooled down before loading and left at 4:20 AM. Back from Matale at 7:03, it would have reached Kegalle at 8:06 at the earliest, after every Kegalle store closes. Every other refrigerated vehicle was on its usual run, so VEH039's second run, Kegalle (1,421.9 kg), went to VEH057's second trip. The van took OUT116 and OUT118 (967.9 kg), the pair that fits and moves the most goods; OUT119 (454.0 kg) waited for Tuesday. On Tuesday it rode the usual Tuesday Kegalle run with OUT116's Tuesday order, and all 21 Tuesday chilled orders were served.

## The shortfall

VEH045 is loaded in reverse stop order, and within a stop the heaviest case type goes in first. Loading starts at about 2:20 AM with stop 4, Aranayake (86 cases). At 2:47 AM, loading stop 3's rice and dhal line, Rizwan finds only 30 of the 36 cases for ORD0098595 on the shelf. He flags **6 rice and dhal cases missing**. At 2:52 AM Nuwan decides **send short, add to Thursday**: the 6 cases are added to Dilani's own Thursday dry order **ORD0098747**, marked "from Wednesday". That order grows from 127 cases (45 rice and dhal, 55 packet foods, 27 tea and biscuit; 854.8 kg, 4.698 m³) to 133 cases (51, 55, 27; 914.8 kg, 4.938 m³), inside OUT117's recorded range (37 to 158 cases, 297.1 to 1,101.1 kg, 1.758 to 5.986 m³). It rides Thursday's Kegalle dry run, 4:00 to 7:45 AM. Dilani is told at once. Kasun's stop 3 now shows 96 cases: 625.6 kg, 3.532 m³.

## VEH045 trip 1 (Kasun), Wednesday

Planned to leave the Kandy hub at 3:40 AM; left at 3:44. Fresh dry, Kegalle district, 4 stops, 153 of 270 standard minutes. Planned 383 cases, 2,530.8 kg and 14.104 m³ (60.3% of 4,200 kg); loaded 377 cases, 2,470.8 kg and 13.864 m³ (6 cases short).

**Route:** the A1 west to Kegalle town, back east on the A1 to Mawanella, then the hill roads south to Hemmathagama and Aranayake, then back to Kandy.

**Why Kegalle town first, past Mawanella** (one line on the run sheet): Kegalle is this week's protected store (its Monday chilled order waited a day), so the plan puts its dry goods on the shelf first. Mawanella is the slowest stop of the run to unload (a curb stop, median 44 minutes in monsoon months), so taking it first would hold every other store back by that long unload. The cost is driving the stretch of the A1 between Kegalle and Mawanella twice. The data has no map inside a district (every pair of Kegalle stores is the same 13 minutes apart at free flow), so neither the published standard nor Relay's clock counts that cost; the run sheet names the order so Kasun is not surprised.

**Two named times.** *Planned* is the published standard at free flow, the clock the plan is checked on. *Expected* is Relay's model: each leg at free flow times 100/speed index (district, hour, monsoon) times 100/road index (district, date), plus each store's usual unloading time (its median in monsoon months in the route history). Driver and store screens round Expected to 5 minutes; the dispatcher's publish check shows it to the minute.

**The 9:12 PM change.** Until 9:12 PM on Tuesday, Aranayake was stop 3 and Hemmathagama stop 4. On that order's planned times Kasun would take the Aranayake hill road, the worst stretch in the rain, before first light (about 5:40 AM in Kandy in early April; story knowledge, not in the data). At 9:12 PM Nuwan swaps them, so that even a run on the plan's times reaches the hill road after first light: on the plan he now leaves Hemmathagama for Aranayake at 5:45 AM, instead of leaving Mawanella for it at 5:17 AM. On Relay's Expected clock Kasun reaches the hill road after first light in either order, and Relay shows Nuwan the cost before he confirms, to the minute as on every dispatcher screen: Aranayake's expected arrival moves from 6:36 to 7:13, and its margin before the 7:30 close drops from 54 to 17 minutes. Nuwan accepts it. Dilani is reached earlier: her dry order was expected around 7:15 AM and is now expected around 6:35 AM, and Relay tells her so. Both orders keep every planned and expected arrival inside its window. The loading order at the dock changes with it (reverse stop order: Aranayake is now loaded first), which is what the loader's "Plan changed 9:12 PM" banner shows.

| Stop | Store | Access | Window | Before 9:12 PM | Planned | Expected | Actual | What happens |
|---|---|---|---|---|---|---|---|---|
| 1 | OUT119 Waypoint Fresh Kegalle | Rear dock | 3:00 to 8:00 | stop 1: 4:33 / 4:50 | 4:33 | 4:50 | 4:52 to 5:11 | Delivered 5:11 |
| 2 | OUT118 Waypoint Fresh Mawanella | Curb | 4:00 to 7:45 | stop 2: 5:01 / 5:30 | 5:01 | 5:30 | 5:30 to 5:59 | Arrival sent. Signal lost at 5:41 during this stop. Delivered offline at 5:59 |
| 3 | OUT117 Waypoint Fresh Hemmathagama | Rear dock | 4:00 to 7:45 | stop 4: 5:58 / 7:15 | 5:30 | 6:35 | 6:21 to 6:36 | Arrived offline 6:21, delivered 6:36: 30 rice and dhal, 44 packet foods, 22 tea and biscuit cases. Received by W. Rathnayake. The store confirms receipt at 6:42 |
| 4 | OUT116 Waypoint Fresh Aranayake | Rear dock | 5:00 to 7:30 | stop 3: 5:30 / 6:35 | 5:58 | 7:15 | 6:56 to 7:18 | **Conflict.** At 6:15 Nuwan moved this stop to VEH060, Nimal's ambient van, because Kasun had been silent for 34 minutes. Kasun, still offline, recorded Arrived at 6:56 and delivered at 7:09, then loaded the store's returns at the dock |

"Before 9:12 PM" gives the stop number, then Planned / Expected, in the order before Nuwan's swap. "Actual" runs from arrival to leaving the store. At publish, Relay expected him back at the hub around 9:20 AM (planned 7:06).

Signal returns at **7:14 AM** as the storm passes, while Kasun is still at Aranayake's dock. The phone sends 7 waiting records. It asks Kasun one question about stop 4, and at 7:15, standing at the truck, he answers **Yes, I delivered it**. VEH060's copy of stop 4 is cancelled at 7:15, and at 7:16 Nuwan's view marks the conflict resolved. At 7:17 Kasun taps Finish trip at the dock and leaves at 7:18. Relay now expects him at the hub around 9:05 AM.

**Behind plan (replaces DRV-02 / Early).** At 4:52 AM Kasun arrives at Kegalle, 19 minutes behind the plan's 4:33. Relay expected 4:48 for a 3:40 start (shown to Kasun as around 4:50); he left 4 minutes late, so he arrived on Relay's time. DRV-02 / Behind plan shows "Arrived 4:52 AM. 19 min behind plan" with "Expected around 4:50" beside it, in neutral tones. His first leg took 1.28 times free flow; in monsoon months the first leg of a Kegalle run takes a median 1.48 times its planned travel time. In monsoon months 98.9% of first Kegalle stops in the route history arrived after their planned time, a median 34 minutes behind (10th to 90th percentile 13 to 72). Behind plan is normal in monsoon months; only a stop that will miss its window is a problem.

**Estimates while Kasun is silent (one rule).** The estimate is the last stop event Relay has for Kasun, plus the usual unloading time at that store if the event is an arrival, plus each leg by the Expected model, plus the usual unloading time at stores in between, rounded to 5 minutes. A store's confirmed receipt counts as a stop event: Relay then treats Kasun as having delivered there by the receipt time. The estimate moves only when a stop event arrives. The likely range is the estimate minus and plus (15 minutes + half the minutes since Kasun's phone last reached Relay), rounded out to 5 minutes; the low end is never earlier than the time shown, rounded up to 5 minutes. Once an estimate passes with no word, Relay does not push it later. The dispatcher and the store read the same estimate.

| Snapshot | Stop | Estimate | Likely range | Silence | Actual arrival |
|---|---|---|---|---|---|
| 6:05 AM | 3 Hemmathagama | around 6:35 AM | 6:05 to 7:05 AM | 24 min | 6:21 AM |
| 6:05 AM | 4 Aranayake | around 7:15 AM | 6:45 to 7:45 AM | 24 min | 6:56 AM |
| 6:15 AM | 3 Hemmathagama | around 6:35 AM | 6:15 to 7:10 AM | 34 min | 6:21 AM |
| 6:15 AM | 4 Aranayake | around 7:15 AM | 6:40 to 7:50 AM | 34 min | 6:56 AM |
| 6:40 AM | 3 Hemmathagama | estimate passed (6:35 AM) | | 59 min | 6:21 AM |
| 6:40 AM | 4 Aranayake | around 7:15 AM | 6:40 to 8:00 AM | 59 min | 6:56 AM |
| 6:42 AM | 4 Aranayake | around 7:05 AM | 6:45 to 7:55 AM | 61 min | 6:56 AM |

The 6:42 row follows Hemmathagama's confirmed receipt: 6:42 plus the leg to Aranayake by the Expected model.

What others see while he is offline:
- **Nuwan (DEG-03, the DSP-04 screen at 6:05):** "No contact from Kasun since 5:41 AM". "Last record: stop 2, arrived 5:30 AM. Times after that are estimates." Stop 4's range already runs past Aranayake's 7:30 close. Relay cannot tell a lost signal from a flat battery, so it names neither.
- **Dilani (DEG-04, the STM-04 screen at 6:05):** "Arriving around 6:35 AM". "Likely between 6:05 and 7:05 AM." "Kasun's phone last reached us at 5:41 AM, after he arrived at Mawanella. Hill roads often lose signal, so these times are our estimate." Her phone uses the store's Wi-Fi and stays connected. Driver phones do not join store Wi-Fi (Waypoint policy), so Kasun's phone stays offline during his 15 minutes at Hemmathagama.
- **Dilani (STM-04 / past estimate, 6:40):** "The estimate has passed (around 6:35 AM). No word from Kasun since 5:41 AM." and "Goods already at your store? Confirm receipt". In the story the goods arrived at 6:36 while Kasun was offline, so at 6:42 AM she confirms receipt from the store: "Everything arrived", 96 cases.
- **Nuwan (DEG-03 / receipt in, 6:42):** the feed shows "Hemmathagama confirmed receipt 6:42 AM. Kasun has delivered there. Aranayake now around 7:05 AM, likely 6:45 to 7:55 AM. VEH060 is on its way." with **Keep backup** and **Cancel backup**. The range still runs past Aranayake's 7:30 close and Kasun is still out of contact on the hill road, so at 6:44 Nuwan taps Keep backup: "Kasun still offline on the hill road. If his truck is stuck, Aranayake gets nothing until Thursday."

**The standby and the move at 6:15 AM.** Each depot keeps one vehicle and driver free until 8 AM for problems. At the Kandy hub that is normally the refrigerated van VEH058 (it ran on only 4 of 115 Wednesdays in the data); this week VEH058 is in the workshop, so the standby is VEH060, Nimal's ambient van. At 6:15, after 34 minutes of silence, Nuwan moves stop 4 to VEH060 ("No contact from Kasun for 34 minutes. Backup in case he is stuck."). VEH060 takes a new pick of ORD0098593 (86 dry cases) at the Kandy dock, leaves at 6:36 and is expected at Aranayake around 8:05 AM, after its 7:30 close. The move drawer says so, and says why it is still worth sending: if Kasun is stuck, Aranayake otherwise gets no dry goods until Thursday, and a late delivery still stocks the shelves the same morning. The drawer shows VEH060 with weight 572.0 of 1,200 kg, volume 3.168 of 9.0 m³, fuel 0.0 of 520 L this week (this trip about 7.4 L) and Fresh time 68 of 270 minutes. VEH057 is shown as not suitable: it is refrigerated and on a chilled run, and Relay keeps Fresh dry off refrigerated trips (Waypoint practice, as in the data; the booklet allows it). Its second trip would also carry 1,373.6 of 1,040 kg. Nimal, the dock and OUT116 are told at once ("Your delivery may be late today. We have sent a second vehicle as a backup, expected around 8:05 AM. We'll update you."). Kasun's copy waits until his phone reconnects.

## The dispatcher's Tuesday (DSP screens)

- **Order queue at 3:12 PM (DSP-01):** 125 orders received for Wednesday (74 Fresh dry, 46 Fresh chilled, 3 Style, 2 Tech; Peliyagoda 73, Kandy hub 52). 6 Fresh outlets haven't ordered yet.
- **At 4:00 PM:** 136 orders (79 Fresh dry, 50 Fresh chilled, 4 Style, 3 Tech). Peliyagoda 79, Kandy hub 57. 2 orders arrived after the cutoff and moved to Thursday's run: OUT032 Waypoint Fresh Kadawatha, dry at 4:01 PM (ORD0098496) and chilled at 4:02 PM (ORD0098497).
- **Plan board (DSP-02):** the board is filtered to the refrigerated vehicles at the Kandy hub, with the filter counts "Refrigerated: 5 running, 2 in the workshop" (other filters: "All: 12 running, 1 standby, 2 in the workshop, 7 not needed", "Ambient: 7 running, 1 standby, 7 not needed"). The banner reads "Kandy hub: 57 orders, 56 on 18 trips, 1 waits". The right panel shows **VEH057 trip 2** (Fresh chilled, Kegalle: OUT116 Aranayake planned 7:05, OUT119 Kegalle planned 7:33; 801.6 of 1,040 kg, 4.212 of 7.0 m³; 96 standard minutes, 216 of 270 with trip 1; back 8:41). Nuwan drags ORD0098596 (Dilani's chilled order) onto it and gets the broken-rule warning: the trip would carry 1,460.8 kg (limit 1,040 kg) and 7.676 m³ (limit 7.0 m³), and its third stop would arrive at 8:01, after every Kegalle window. He undoes it.
- **Deferral drawer (DSP-03):** 1 chilled order waits: ORD0098596, OUT117 Waypoint Fresh Hemmathagama, 659.2 kg and 3.464 m³. Reason: refrigerated capacity short, VEH039 and VEH058 in the workshop. Protected: OUT119 Waypoint Fresh Kegalle, whose Monday chilled order waited a day. The drawer text is the section above: unavoidable, Relay's choice by rule, the pool, the cost, the paper alternative, and the next-run check.
- **Publish check (DSP-02 / publish check, 6:39 PM):** no planned arrival is after its window closes (early arrivals wait for the store to open). Relay expects 5 of the 53 Fresh stops to arrive after their window, and says why it keeps each one where it is:

| Trip | Store | Window closes | Planned | Expected | Why Relay keeps it |
|---|---|---|---|---|---|
| VEH042 trip 2 | OUT087 Waypoint Fresh Mulgampola | 8:00 | 7:03 | 8:25 | VEH042 runs Matale first (VEH039's run; Matale's stores close at 7:30 and 8:00, and the road index there is 72), then its own Kandy run. VEH057, back at 6:02, is needed for Kegalle (rule 1); VEH040, VEH041 and VEH043 are back after 8:40 AM |
| VEH042 trip 2 | OUT085 Waypoint Fresh Kandy Town | 7:30 | 7:24 | 8:59 | Same trip. Kandy Town would miss its 7:30 close in any stop order, so Relay puts it last and keeps Bogambara inside its window instead |
| VEH044 trip 1 | OUT107 Waypoint Fresh Maskeliya | 8:00 | 7:20 | 8:17 | The last store on the Nuwara Eliya road; VEH044 leaves at 2:35 so it reaches Nuwara Eliya at its 5:00 opening. An idle truck could take Maskeliya alone (expected about 4:21 AM), but that is a second truck and driver for about 4 hours at free flow and about 23 L of fuel for one store. Relay's choice is not to send a truck for one store; Maskeliya is told its expected time |
| VEH057 trip 2 | OUT116 Waypoint Fresh Aranayake | 7:30 | 7:05 | 7:43 | VEH057's second trip is the only refrigerated trip planned to reach Kegalle (rule 1). It leaves 10 minutes after its first trip is back; that trip cannot end earlier because Watapuluwa opens at 5:30 |
| VEH057 trip 2 | OUT119 Waypoint Fresh Kegalle | 8:00 | 7:33 | 8:32 | Same trip. This is the protected order: late by Relay's estimate, but the same morning instead of Thursday |

  That is 5 of 53 (9.4%) expected after the window. In the route history 27.1% of 15,910 Kandy Fresh stops in monsoon months actually arrived after the window; that is an actual figure against an expected one, so not like for like. Every other Fresh stop is expected inside its window.

- **Peliyagoda depot:** 79 orders; Nuwan publishes it at 6:31 PM. No Peliyagoda vehicle detail is shown in the story.
- **Other flags in the queue (DSP-01):** OUT081 Waypoint Fresh Hantana (van only). OUT120 Waypoint Style Kegalle (77 cases, 1,109.9 kg, 17.730 m³: light and bulky, needs a large truck). OUT115 Waypoint Tech Passara (10 units, 2,136.2 kg, 7.070 m³, its median units, weight and volume in the data; a heavy order that needs a truck). On the plan board (DSP-02) the Style order fills 80.6% of VEH056's volume and 29.2% of its weight.

## Timeline and screen snapshot times

| Time | Event | Screen snapshot |
|---|---|---|
| Mon 2:50 AM | VEH039's refrigeration unit fails the temperature check at the dock, loaded for Matale |  |
| Tue 2:10 PM | Dilani places the chilled order | STM-02 |
| Tue 2:14 PM | Dilani sends the dry order; both orders show Received by Waypoint | STM-02 / dry, STM-01 / before cutoff |
| Tue 3:12 PM | 125 orders in, 6 Fresh outlets still to order | DSP-01, before cutoff |
| Tue 4:02 PM | The queue closed at 4:00 with 136 orders; 2 late orders (4:01 and 4:02 PM) moved to Thursday | DSP-01, after cutoff |
| Tue 4:35 PM | Relay proposes the Kandy plan. Nuwan drags ORD0098596 (Dilani's chilled order) onto VEH057 trip 2 and gets the broken-rule warning: 1,460.8 kg against the van's 1,040 kg | DSP-02 |
| Tue 4:50 PM | Deferral drawer for Kandy: 1 chilled order, 659.2 kg and 3.464 m³ | DSP-03 |
| Tue 4:51 PM | Nuwan opens the override on OUT119 and cancels it | DSP-03 / override |
| Tue 4:52 PM | Deferral confirmed, the Kandy plan is ready | DSP-03 / ready |
| Tue 6:31 PM | Nuwan publishes Peliyagoda |  |
| Tue 6:39 PM | Kandy publish check: 5 of 53 Fresh stops expected after their window | DSP-02 / publish check, DSP-02 Publish dialog |
| Tue 6:40 PM | Plan published. Loading lists, run sheets and store statuses update, and the deferral notice goes out | DSP-02 / published |
| Tue 6:41 PM | Dilani gets the deferral notice for her chilled order | STM-03 |
| Tue 6:45 PM | Capacity outlook | DSP-05 |
| Tue 7:30 PM | Dilani checks her orders: dry expected around 7:15 AM, chilled moved to Thursday | STM-01 |
| Tue 9:12 PM | Nuwan swaps stops 3 and 4 on VEH045: Hemmathagama is now stop 3. Dilani is told her dry order is now expected around 6:35 AM. The loading order changes | STM-01 / moved earlier, LDR-01 banner |
| Wed 2:18 AM | Rizwan signs in on the dock tablet |  |
| Wed 2:20 AM | Rizwan starts loading VEH045, stop 4 (Aranayake) first |  |
| Wed 2:36 AM | Anjali signs in on the tablet to mark VEH042 complete |  |
| Wed 2:40 AM | Rizwan switches back with his PIN and opens the list of tonight's loads at the Kandy hub | LDR-01 / PIN switch, LDR-01 |
| Wed 2:47 AM | Rizwan flags 6 rice and dhal cases missing on VEH045, stop 3 | LDR-02, LDR-03 |
| Wed 2:48 AM | Nuwan opens the flag on his phone | DSP-04 / shortfall decision, LDR-02 / flag sent |
| Wed 2:52 AM | Nuwan decides: send short, add the cases to Thursday's order ORD0098747. Dilani is told | LDR-02 / answer in, LDR-03 / decision |
| Wed 3:30 AM | Every line on VEH045 is loaded or decided | LDR-02 / all checked |
| Wed 3:31 AM | Handover ready | LDR-04 / ready |
| Wed 3:32 AM | Load complete. Kasun accepts the load on his phone | LDR-04, DRV-01 / Accept load |
| Wed 3:44 AM | VEH045 leaves the Kandy hub (planned 3:40) |  |
| Wed 4:28 AM | Sampath reports Delayed, 45 min at Palapathwela; Nuwan marks it handled at 4:35 |  |
| Wed 4:52 AM | Kasun arrives at Kegalle, 19 minutes behind plan and on Relay's time (he left 4 minutes late) | DRV-02 / Behind plan |
| Wed 5:05 AM | Dilani opens the short-delivery notice | STM-03 / short delivery |
| Wed 5:20 AM | Kasun is on the way to stop 2. All synced | DRV-01, DSP-04, STM-04 |
| Wed 5:30 AM | Kasun arrives at stop 2, Mawanella. The arrival is sent | DRV-02 |
| Wed 5:41 AM | The storm takes Kasun's network down near Mawanella. Signal lost |  |
| Wed 6:05 AM | Kasun offline. Nuwan's view shows no contact since 5:41, and Dilani sees the estimate | DEG-01, DEG-03, DEG-04 |
| Wed 6:15 AM | Nuwan moves stop 4 (Aranayake) to VEH060, the standby | DEG-03 / move stop 4, DEG-03 / stop 4 moved |
| Wed 6:21 AM | Kasun arrives at stop 3, Hemmathagama, offline | DRV-02 / Stop 3 offline |
| Wed 6:36 AM | Kasun completes stop 3 offline. VEH060 leaves the hub | DRV-03 |
| Wed 6:40 AM | Dilani's estimate has passed with no word from Kasun; the screen offers Confirm receipt | STM-04 / past estimate |
| Wed 6:42 AM | Dilani confirms receipt from the store: Everything arrived. Nuwan's feed shows the receipt, Aranayake's new estimate and Keep backup / Cancel backup | STM-05 / before driver proof, DEG-03 / receipt in |
| Wed 6:44 AM | Nuwan keeps the backup: Kasun is still out of contact on the hill road |  |
| Wed 6:56 AM | Kasun arrives at stop 4, Aranayake, offline |  |
| Wed 7:09 AM | Kasun delivers stop 4, offline, and loads the store's returns at the dock |  |
| Wed 7:10 AM | Trip summary with 3 stops to send | DRV-05 / Still waiting |
| Wed 7:14 AM | The storm passes; signal back while Kasun is at Aranayake's dock. 7 records sent, one question about stop 4 | DEG-02 / sending, DEG-02, DEG-05 / waiting for answer |
| Wed 7:15 AM | Kasun, at the dock, answers Yes, I delivered it. VEH060's copy of stop 4 is cancelled | DEG-02 / answered yes |
| Wed 7:16 AM | Nuwan sees the conflict resolved and VEH060's stop cancelled | DEG-05 |
| Wed 7:17 AM | Kasun taps Finish trip at Aranayake's dock; Relay expects him at the hub around 9:05 | DRV-05 |
| Wed 7:18 AM | Kasun leaves Aranayake |  |
| Wed 7:22 AM | Dilani opens her receipt with Kasun's proof attached | STM-05 |

## Capacity outlook (DSP-05)

ISO weeks 15 to 20 at the Kandy hub (6 April to 17 May 2026), as seen on Tuesday 7 April at 6:45 PM. The forecast was last updated on Monday 6 April. Method: an ordinary week for each group and weekday (2026 weeks 1 to 13) times the festival lift for that festival and ramp day times the payday lift, times growth, counted over open days. In April to June 2025 (2025 weeks 14 to 23) this method missed Kandy Fresh by 2.7% a week on average, against 11.1% for "same week last year times growth". "Needed" is the fewest refrigerated vehicles that carry every chilled order that day, found by exact search under the same rules as the plan (published standard, windows at free flow, 2:00 AM earliest, 10 minutes to reload, a vehicle in one place at a time). 8 April uses the order book; every other day uses the forecast.

**Headline:** "Wednesday 29 April is the heaviest of the 5 Wednesdays ahead, and like each of them it needs 6 of the 7 refrigerated vehicles. The seventh is the standby and nothing is spare: keep all 7 in service that day." 29 April is not a harder day than the other Wednesdays on the vehicle count; it leads because it carries the most chilled goods of them and falls in the Vesak and payday week. On Relay's clock, where a vehicle is in one place at a time, every Wednesday ahead needs 6 of 7 (23 chilled stores, the week's busiest day), and five refrigerated vehicles serve only 22 of 23 on each of them. So one refrigerated vehicle out on any Wednesday means no standby, and two out means a chilled order waits, as on 8 April. 29 April is the heaviest Wednesday ahead, not the heaviest day: the Vesak ramp (0.8) in the week of the Thursday 30 April payday gives it 7,510.9 kg of chilled orders against 5,958.8 to 6,015.1 kg on the other Wednesdays ahead. Heavier days ahead (up to 10,857.6 kg on Saturday 11 April) need 5 or fewer: kilograms are not the limit; the number of stores and their windows before 8 AM are.

**Context, not the headline:** week 15 carries the New Year ramp. Its chilled forecast is 267.3 m³, 1.41 times an ordinary 2026 week (189.0 m³); the week before New Year 2025 (2025 week 15) was Kandy's highest chilled week on record at 260.2 m³. Space is not the limit: week 15's chilled volume is 34.9% of one load per refrigerated vehicle per open day. Time before 8 AM is.

| ISO week 2026 | 15 | 16 | 17 | 18 | 19 | 20 |
|---|---|---|---|---|---|---|
| Dates | 6 Apr to 12 Apr | 13 Apr to 19 Apr | 20 Apr to 26 Apr | 27 Apr to 3 May | 4 May to 10 May | 11 May to 17 May |
| Operating days | 6 | 4 | 6 | 5 | 6 | 6 |
| Calendar | New Year ramp | New Year holidays 13 and 14 Apr (closed) | Vesak ramp from 22 Apr; payday Sat 25 Apr | Payday Thu 30 Apr; Vesak Fri 1 May (closed) |  |  |
| Fresh chilled, m³ | 267.3 | 133.2 | 200.1 | 188.6 | 188.1 | 188.3 |
| Fresh dry, m³ | 477.3 | 230.4 | 357.4 | 333.5 | 337.3 | 337.7 |
| Style, m³ | 118.0 | 52.2 | 78.2 | 80.4 | 75.2 | 75.2 |
| Tech, m³ | 22.4 | 21.3 | 22.4 | 18.2 | 22.4 | 22.4 |
| All brands, m³ | 885.0 | 437.1 | 658.1 | 620.7 | 623.0 | 623.6 |
| Refrigerated vehicle-days available | 36 | 28 | 42 | 35 | 42 | 42 |
| One load per refrigerated vehicle per open day, m³ | 765.3 | 584.0 | 876.0 | 730.0 | 876.0 | 876.0 |
| Busiest day from 8 April: refrigerated vehicles needed / available | 6 / 5 (Wed 8 Apr) | 6 / 7 (Wed 15 Apr) | 6 / 7 (Wed 22 Apr) | 6 / 7 (Wed 29 Apr) | 6 / 7 (Wed 6 May) | 6 / 7 (Wed 13 May) |

Every open day is in the appendix (relay:outlook_days): Wednesdays need 6, Mondays and Thursdays 5, most other days 4 (the New Year and payday Saturdays, 11 and 25 April, need 5).

Key figures on the frame: "6 of 7" / "refrigerated vehicles needed, Wed 29 Apr, as on every Wednesday ahead"; "22 of 23" / "chilled orders five refrigerated vehicles can serve on a Wednesday". Supporting line under the headline: "The heaviest Wednesday ahead: 7,510.9 kg chilled (Vesak ramp, payday week)". Meter rows: chilled m³ against one load per refrigerated vehicle per open day, and refrigerated vehicles needed on each week's busiest day (week 15 over: 6 needed, 5 available; weeks 16 to 20 at the limit: 6 of 7, the seventh being the standby). Arrange card: "Book refrigerated servicing away from Wednesdays: on Relay's clock every Wednesday needs 6 of 7", "Keep all 7 in service on Wednesday 29 April (Vesak ramp, payday week)", "Tell stores early when a refrigerated vehicle is out". Tech is shown as a band (a single Kandy Tech order can be 15 m³).

## Numbers for the story boards

Each number is scoped to exactly what was counted. "Order history" is `deliveries_train.csv` plus `task1_test_inputs.csv`, 1 January 2024 to 28 March 2026. "Route history" is `route_legs_train.csv` (the legs with actual times), 1 January 2024 to 14 February 2026, unless the line says it also uses `route_legs_test.csv`.

1. **Deferrals by depot** (order history): the Kandy hub deferred 31 orders on 6 days (23 chilled, 8 dry) out of 37,575 orders; Peliyagoda deferred 1,602 on 295 days, all chilled, out of 59,746. Orders marked not run: Kandy 20 (5 Fresh dry, 7 Style, 8 Tech), Peliyagoda 393 (all Fresh chilled).
2. **Kandy deferral days** (order history): all 6 fell in monsoon months; on 5 of them the deferred orders were chilled (on Saturday 15 June 2024, 8 Fresh dry orders waited).
3. **Only the chilled order moves:** of the 2,018 chilled orders that missed their day (deferred or not run), 2,018 had the same store's Fresh dry order delivered that day (order history).
4. **Late in monsoon months:** 27.1% of 15,910 Kandy-depot Fresh stops in monsoon months arrived after the store's window (route history, actual arrivals). By district, Fresh only: Kandy 11.5%, Matale 22.5%, Kegalle 28.7%, Nuwara Eliya 47.0%, Badulla 54.3%. Relay's plan for 8 April expects 5 of 53 (9.4%): an expected figure, not an actual one, so not like for like.
5. **Behind plan is normal in monsoon months:** 98.9% of 616 first stops of Kegalle Fresh runs in monsoon months arrived after their planned time, a median 34 minutes behind (10th to 90th percentile 13 to 72); across all 2,056 Kegalle Fresh stops in monsoon months, 99.6% (route history).
6. **The standby:** VEH058 ran on 4 of 115 Kandy Wednesdays (idle on 111); VEH060 ran on 14 (route history with `route_legs_test.csv`, to 28 March 2026).
7. **Kasun's usual run:** VEH045 ran Kegalle Fresh dry on 94 of 115 Wednesdays (route history with `route_legs_test.csv`).
8. **A usual Wednesday:** the median Kandy Wednesday ran 17 trips on 12 vehicles (route history with `route_legs_test.csv`).
9. **Chilled and dry never share a trip:** 0 of 26,579 trips in the order history mix chilled and dry, and 0 of 21,532 delivered Kandy Fresh dry orders rode a refrigerated vehicle.
10. **The history plans without the drive back:** 73.8% of 2,107 Kandy second Fresh trips were planned to leave before the first trip's last planned arrival (route history with `route_legs_test.csv`). Relay adds the drive back.
11. **The New Year peak:** Kandy's highest chilled week on record was 2025 week 15, 260.2 m³, the week before New Year; 2026 weeks 1 to 13 averaged 189.0 m³ (order history). The forecast for 2026 week 15 is 267.3 m³.
12. **A slow curb stop:** Mawanella (OUT118) takes a median 44 minutes to unload in monsoon months, against the published 16 minute allowance for a Fresh curb stop (route history).
13. **Departures:** Kandy runs leave a median 6 minutes after their planned time, and the earliest planned departure is 2:00 AM (route history).
14. **Precedents:** on Monday 22 April 2024 VEH039 and VEH040 did not run and all three Kegalle chilled orders waited a day. On Wednesday 9 April 2025, the same New Year ramp day as this story, three Kandy chilled orders waited; the next day route R015108 carried OUT084 and OUT087 twice each, the waited order and the new one as separate stops.
15. **Five refrigerated vehicles in the history:** 19 Kandy Wednesdays ran only five refrigerated vehicles. On 17 of them all 23 chilled orders were attempted and none waited, with 0 of 391 planned refrigerated arrivals after the window. Every one of those 17 days planned the Matale or Kegalle truck's second trip to leave 98 to 174 minutes before its first trip could be back at free flow: on 17 April 2024 VEH039 was unloading at Aranayake (OUT116) from 4:47 to 5:17 AM and at Rattota (OUT099) from 4:40 to 5:09 AM, the same minutes (route history with `route_legs_test.csv`; the unloading times are actual, from `route_legs_train.csv`). On a clock where a vehicle is in one place at a time, five serve at most 22 of 23.
16. **Matale departures:** the earliest planned departure of any Matale Fresh trip in the route history is 3:33 AM for dry runs and 2:55 AM for chilled runs (medians 4:27 and 4:29 for the day's first trips; route history with `route_legs_test.csv`). Relay's plan leaves at 2:30 and 2:44.
17. **The fleet and the network** (`vehicles.csv` and `outlets.csv`, as booklet page 7 states): 60 vehicles, 16 of them refrigerated (7 at the Kandy hub), shared by the three brands; 120 outlets served from two depots.

## Additional facts

### Orders and outlets

1. **Wednesday orders by depot** (fixed by each store's schedule in the data): Kandy hub 57 (31 Fresh dry, 23 Fresh chilled, 1 Style, 2 Tech); Peliyagoda 81. Network 138. Every Fresh outlet orders dry every operating day; chilled is on 4 fixed weekdays; Style is 1 fixed weekday; Tech outlets order on about half of their weekdays. This Wednesday the Tech orders come from OUT049, OUT095 and OUT115.
2. **Fresh outlets not ordered at 3:12 PM:** OUT012 Waypoint Fresh Borella, OUT032 Kadawatha, OUT041 Panadura, OUT053 Hikkaduwa (Peliyagoda); OUT087 Mulgampola and OUT098 Aluvihare (Kandy hub). Between 3:12 and 4:00 PM, 11 orders arrive: dry and chilled from OUT012, OUT041, OUT053 and OUT087, dry from OUT098 (it orders no chilled on Wednesdays), OUT120 Style Kegalle and OUT115 Tech Passara. Kadawatha's two orders arrive after the cutoff; Kadawatha is told the minute each arrives, and they ride Thursday's run.
3. **Order numbers** continue the data's numbering: the last order in the data is ORD0097345 (Saturday 28 March). Numbers are reserved per store for each delivery day, sorted by store and dry before chilled, one block per operating day. Wednesday 8 April runs from ORD0098463 to ORD0098600; Thursday 9 April from ORD0098601 to ORD0098752 (its Tech orders are OUT094 and OUT095).
4. **Store names** (all real towns or city areas inside the outlet's district). Kandy district (the Fresh stores are Kandy city areas within about 4 km of Kandy Town by road, because the data puts Kandy stores 8 km from the hub and 3 km apart; the towns of Peradeniya and Kundasale lie too far out, on opposite sides of the city): OUT076 Katugastota, OUT077 Mahaiyawa, OUT078 Asgiriya, OUT079 Bahirawakanda, OUT080 Watapuluwa, OUT081 Hantana, OUT082 Ampitiya, OUT083 Suduhumpola (these 8 are van only, curb), OUT084 Bogambara, OUT085 Kandy Town, OUT086 Lewella, OUT087 Mulgampola (rear dock), OUT095 Waypoint Tech Tennekumbura. Matale (named so both Matale runs follow the road: north from Matale Town on the A9, back, east to Rattota, then home through Elkaduwa and Ukuwela): OUT096 Ukuwela, OUT097 Matale Town, OUT098 Aluvihare, OUT099 Rattota, OUT100 Palapathwela, OUT101 Elkaduwa. Nuwara Eliya, in road order from the hub: OUT105 Nuwara Eliya, OUT108 Nanu Oya, OUT104 Talawakele, OUT106 Hatton, OUT107 Maskeliya. Badulla: OUT110 Badulla Town, OUT111 Hali-Ela, OUT112 Bandarawela, OUT113 Welimada, OUT115 Waypoint Tech Passara. Kegalle: OUT116 Aranayake, OUT117 Hemmathagama, OUT118 Mawanella, OUT119 Kegalle, OUT120 Waypoint Style Kegalle. Peliyagoda: OUT012 Borella (Colombo), OUT032 Kadawatha (Gampaha), OUT041 Panadura (Kalutara), OUT053 Hikkaduwa (Galle).
5. **The four Kegalle Fresh stores** (`outlets.csv`): OUT116 Aranayake, rear dock, 5:00 to 7:30; OUT117 Hemmathagama, rear dock, 4:00 to 7:45; OUT118 Mawanella, street (curb), 4:00 to 7:45; OUT119 Kegalle, rear dock, 3:00 to 8:00. All four order dry every day. Chilled: OUT116 Monday, Tuesday, Wednesday, Friday; OUT117 Wednesday to Saturday; OUT118 Monday, Thursday, Friday, Saturday (none on Wednesday); OUT119 Monday, Wednesday, Thursday, Friday.
6. **Order rows on DSP-01 and DSP-02** (cases or units, kg, m³): ORD0098595 OUT117 dry 102, 685.6, 3.772; ORD0098596 OUT117 chilled 92, 659.2, 3.464; ORD0098593 OUT116 dry 86, 572.0, 3.168; ORD0098594 OUT116 chilled 47, 335.2, 1.774 (20 dairy, 17 produce, 10 meat and fish); ORD0098597 OUT118 dry 138, 877.6, 5.048; ORD0098598 OUT119 dry 57, 395.6, 2.116; ORD0098599 OUT119 chilled 65, 466.4, 2.438 (28 dairy, 22 produce, 15 meat and fish); ORD0098552 OUT081 chilled 29, 210.7, 1.112; ORD0098600 OUT120 Style 77, 1,109.9, 17.730; ORD0098592 OUT115 Tech 10, 2,136.2, 7.070; ORD0098564 OUT095 Tech 4, 890.0, 2.987. Dry case mixes: OUT116 30 rice and dhal, 32 packet foods, 24 tea and biscuit; OUT118 40, 58, 40; OUT119 23, 20, 14. Every Kandy order is in the appendix (relay:orders).
7. **Kandy hub totals for Wednesday:** Fresh dry 31 orders, 1,898 cases, 12,754.0 kg, 68.993 m³; Fresh chilled 23 orders, 1,180 cases, 8,144.5 kg, 43.630 m³. The chilled total is higher than on 113 of the 115 Kandy Wednesdays in the data.
8. **An order counts as received when it reaches Relay,** and Relay's receive time decides its run. Orders for Thursday close on Wednesday at 4:00 PM. The store's countdown appears only in the last 4 hours before a cutoff.

### The Kandy plan for Wednesday

9. **Every trip as published at 6:40 PM, with the 9:12 PM change on VEH045** (the publish check counted VEH045 in its earlier stop order; both orders have every stop expected inside its window). Planned times are the published standard at free flow; "Back at hub" adds the free-flow drive back. A planned arrival before a store opens waits for it (for example the Nuwara Eliya runs reach Nuwara Eliya at 4:26 and wait for its 5:00 opening: Relay sets their departure from Expected times, so at the data's monsoon-month speeds they are expected there around 4:56).

| Vehicle | Trip | Type | Load | Departs (planned) | Stops, planned arrival at free flow | Load kg / m³ (share of cap) | Standard min | Back at hub |
|---|---|---|---|---|---|---|---|---|
| VEH040 | 1 | truck reefer | Fresh chilled, Badulla | 02:00 | OUT110 05:06, OUT111 05:44 | 409.7 kg / 2.247 m³ (7.4% / 8.5%) | 239 | 09:05 |
| VEH041 | 1 | truck reefer | Fresh chilled, Badulla | 02:00 | OUT112 05:06, OUT113 05:44 | 835.6 kg / 4.447 m³ (23.1% / 22.9%) | 239 | 09:05 |
| VEH042 | 1 | truck reefer | Fresh chilled, Matale | 02:44 | OUT097 03:19, OUT100 03:46, OUT099 04:12, OUT101 05:26 | 2,185.3 kg / 12.009 m³ (35.4% / 40.2%) | 129 | 06:16 |
| VEH042 | 2 | truck reefer | Fresh chilled, Kandy | 06:26 | OUT084 06:42, OUT087 07:03, OUT085 07:24 | 1,171.0 kg / 6.080 m³ (18.9% / 20.3%) | 73 | 07:55 |
| VEH043 | 1 | truck reefer | Fresh chilled, Nuwara Eliya | 02:35 | OUT105 04:26, OUT104 05:35, OUT106 06:10, OUT107 06:45 | 1,277.6 kg / 6.917 m³ (23.2% / 26.2%) | 231 | 08:51 |
| VEH044 | 1 | truck ambient | Fresh dry, Nuwara Eliya | 02:35 | OUT105 04:26, OUT108 05:35, OUT104 06:10, OUT106 06:45, OUT107 07:20 | 2,266.2 kg / 12.169 m³ (54.0% / 50.7%) | 266 | 09:26 |
| VEH044 | 2 | truck ambient | Tech, Kandy | 09:38 | OUT095 09:54 | 890.0 kg / 2.987 m³ (21.2% / 12.4%) | 59 | 10:53 |
| VEH045 | 1 | truck ambient | Fresh dry, Kegalle | 03:40 | OUT119 04:33, OUT118 05:01, OUT117 05:30, OUT116 05:58 | 2,530.8 kg / 14.104 m³ (60.3% / 58.8%) | 153 | 07:06 |
| VEH046 | 1 | truck ambient | Fresh dry, Badulla | 02:00 | OUT110 05:06, OUT111 05:44 | 583.7 kg / 3.226 m³ (15.4% / 14.7%) | 239 | 09:05 |
| VEH046 | 2 | truck ambient | Tech, Badulla | 09:15 | OUT115 12:21 | 2,136.2 kg / 7.070 m³ (56.2% / 32.1%) | 241 | 16:22 |
| VEH048 | 1 | truck ambient | Fresh dry, Matale | 02:30 | OUT097 03:05, OUT098 03:32, OUT100 03:58, OUT099 04:24, OUT101 05:26, OUT096 05:52 | 2,991.5 kg / 16.179 m³ (71.2% / 67.4%) | 181 | 06:42 |
| VEH049 | 1 | truck ambient | Fresh dry, Kandy | 04:48 | OUT086 05:04, OUT085 05:25, OUT084 05:46, OUT087 06:07 | 1,665.3 kg / 8.754 m³ (39.6% / 36.5%) | 94 | 06:38 |
| VEH056 | 1 | truck ambient | Fresh dry, Badulla | 02:00 | OUT112 05:06, OUT113 05:44 | 1,311.0 kg / 7.017 m³ (34.5% / 31.9%) | 239 | 09:05 |
| VEH056 | 2 | truck ambient | Style, Kegalle | 09:15 | OUT120 10:08 | 1,109.9 kg / 17.730 m³ (29.2% / 80.6%) | 91 | 11:39 |
| VEH057 | 1 | van reefer | Fresh chilled, Kandy | 03:40 | OUT076 03:56, OUT081 04:18, OUT082 04:40, OUT083 05:02, OUT080 05:24 | 804.5 kg / 4.254 m³ (77.4% / 60.8%) | 120 | 06:02 |
| VEH057 | 2 | van reefer | Fresh chilled, Kegalle | 06:12 | OUT116 07:05, OUT119 07:33 | 801.6 kg / 4.212 m³ (77.1% / 60.2%) | 96 | 08:41 |
| VEH059 | 1 | van ambient | Fresh dry, Kandy | 03:00 | OUT076 03:16, OUT078 03:38, OUT081 04:00, OUT082 04:22, OUT083 04:44 | 927.3 kg / 4.997 m³ (77.3% / 55.5%) | 120 | 05:16 |
| VEH059 | 2 | van ambient | Fresh dry, Kandy | 05:26 | OUT079 05:42, OUT077 06:04, OUT080 06:26 | 478.2 kg / 2.547 m³ (39.8% / 28.3%) | 76 | 06:58 |

Every trip serves one district and one brand, and carries only chilled or only dry. Chilled rides only refrigerated vehicles and Fresh dry only ambient ones. Van-only stores get vans. No planned arrival is after its window closes; early arrivals wait for the store to open. Every departure is the one with the fewest stops Relay expects after their window, for that trip's stop order.

10. **Per vehicle, budgets and fuel this week** (Fresh minutes against 270, daytime minutes against 480; fuel is Monday plus Tuesday, each at the vehicle's average for that weekday in 2026 weeks 1 to 13 with VEH039's runs moved as the story says, plus Wednesday's plan, all counting the drive back at `district_travel.csv` distances):

| Vehicle | Fresh minutes | Daytime minutes | Fuel this week (litres) |
|---|---|---|---|
| VEH039 | 0 of 270 | 0 of 480 | Mon 0.0 + Tue 0.0 + Wed 0.0 = 0.0 of 370 L (0.0%) |
| VEH040 | 239 of 270 | 0 of 480 | Mon 55.1 + Tue 46.1 + Wed 58.7 = 159.9 of 380 L (42.1%) |
| VEH041 | 239 of 270 | 0 of 480 | Mon 42.9 + Tue 40.6 + Wed 43.1 = 126.6 of 600 L (21.1%) |
| VEH042 | 202 of 270 | 0 of 480 | Mon 19.6 + Tue 5.1 + Wed 19.6 = 44.3 of 480 L (9.2%) |
| VEH043 | 231 of 270 | 0 of 480 | Mon 42.5 + Tue 31.2 + Wed 42.1 = 115.8 of 450 L (25.7%) |
| VEH044 | 266 of 270 | 59 of 480 | Mon 37.1 + Tue 31.7 + Wed 33.5 = 102.3 of 340 L (30.1%) |
| VEH045 | 153 of 270 | 0 of 480 | Mon 25.6 + Tue 20.9 + Wed 16.2 = 62.7 of 530 L (11.8%) |
| VEH046 | 239 of 270 | 241 of 480 | Mon 64.1 + Tue 37.8 + Wed 75.5 = 177.4 of 350 L (50.7%) |
| VEH048 | 181 of 270 | 0 of 480 | Mon 15.4 + Tue 14.1 + Wed 13.5 = 43.0 of 570 L (7.5%) |
| VEH049 | 94 of 270 | 0 of 480 | Mon 5.6 + Tue 1.0 + Wed 3.7 = 10.3 of 390 L (2.6%) |
| VEH056 | 239 of 270 | 91 of 480 | Mon 41.9 + Tue 35.8 + Wed 50.1 = 127.8 of 610 L (21.0%) |
| VEH057 | 216 of 270 | 0 of 480 | Mon 11.2 + Tue 2.5 + Wed 11.5 = 25.2 of 450 L (5.6%) |
| VEH058 | 0 of 270 | 0 of 480 | Mon 0.0 + Tue 0.0 + Wed 0.0 = 0.0 of 550 L (0.0%) |
| VEH059 | 196 of 270 | 0 of 480 | Mon 4.0 + Tue 3.5 + Wed 4.6 = 12.1 of 610 L (2.0%) |
| VEH060 | 0 of 270 | 0 of 480 | Mon 0.0 + Tue 0.0 + Wed 0.0 = 0.0 of 520 L (0.0%) |

VEH042's Monday includes VEH039's Matale run and its Tuesday VEH039's Kandy run; VEH057's Monday includes the Kegalle second trip. VEH039 and VEH058 used nothing this week. The fullest vehicle is VEH046 at 50.7% of its weekly quota.
11. **Board size:** 18 trips on 12 vehicles (the median Kandy Wednesday in the data runs 17 trips on 12 vehicles). Utilisation is honest: the refrigerated trucks carry 7.4% to 35.4% of their weight capacity, while the vans run fullest (VEH057 at 77.4% and 77.1% of 1,040 kg). The binding limit is time before 8 AM, not space.
12. **Why VEH049 runs the Kandy rear-dock dry run:** in the data VEH045 ran a Kandy Fresh trip as well as its Kegalle trip on 93 of 115 Wednesdays (the history plans without the drive back). On Relay's clock VEH045 is back from Kegalle at 7:06 and would reach Kandy Town after its 7:30 close, so VEH049 (idle this morning) takes it.
13. **Style and Tech (daytime):** VEH056 trip 2 Style to OUT120 Kegalle; VEH044 trip 2 Tech to OUT095 Tennekumbura; VEH046 trip 2 Tech to OUT115 Passara. Each leaves after its first trip is back.
14. **Deferral reasons list:** Refrigerated capacity short, Dry-box capacity short, Fresh window full, Vehicle in the workshop, Van-only access, Store asked to move it, Other (with a note).
15. **Plan times on Tuesday:** Relay proposed the Kandy plan at 4:35 PM; Nuwan tried ORD0098596 on VEH057 trip 2 and undid it at 4:35 PM; deferral drawer at 4:50 PM; Nuwan opens the override on OUT119 and cancels it at 4:51 PM; deferral confirmed and the Kandy plan ready at 4:52 PM; Nuwan planned Peliyagoda and published it at 6:31 PM; Kandy publish check and dialog at 6:39 PM; published at 6:40 PM.
16. **If Nuwan overrides the protection:** OUT119's order would wait (its second in a row) and Dilani's would ride VEH057 with OUT116 (994.4 kg).
17. **Thursday catch-up:** VEH039 and VEH058 are back. Dilani's chilled order rides VEH039's Kegalle run with Thursday's Kegalle chilled orders; her Thursday dry order ORD0098747, with the 6 cases from Wednesday, rides Thursday's Kegalle dry run (3,151.9 kg and 16.776 m³ with the other three Kegalle dry orders, inside VEH045's 4,200 kg and 24.0 m³).

### Tuesday evening and the night at the dock

18. **Dilani's notices:** at 6:41 PM she taps "Got it" on the deferral notice, and the dispatcher's record shows "Seen 6:41 PM". The notice says the chilled order moves to Thursday 9 April, 4:00 to 7:45 AM, because two refrigerated vehicles are in the workshop this week and the one refrigerated van that can still go to her area this morning has no room for her order, and that her dry order comes on Wednesday as planned, expected around 7:15 AM. At 7:30 PM her dry card reads "Expected around 7:15 AM" and her chilled card "Moved to Thursday". She also opens Place an order at 7:30 PM and sends nothing. At 9:12 PM Relay tells her the dry order is now expected earlier, around 6:35 AM (STM-01 / moved earlier).
19. **Quiet hours:** store notices sent between 10:00 PM and 5:00 AM arrive silently. The 2:52 AM short-delivery notice waits, and Dilani opens it and taps "Got it" at 5:05 AM ("Seen 5:05 AM" on the dispatcher's record). It reads: "6 rice and dhal cases are short in today's dry order. We have added them to your Thursday dry order (ORD0098747), marked from Wednesday."
20. **The shared dock tablet:** Rizwan signs in at 2:18 AM with a 4-digit PIN and starts VEH045 at 2:20. Anjali Wickramasinghe signs in at 2:36 AM to mark VEH042 complete, so at 2:40 AM she is the one signed in, and Rizwan switches back with his PIN (LDR-01 / PIN switch). The tablet locks on Switch, on Lock, or after 15 minutes without a tap. Each loader's language comes back when they sign in. Drivers also have a Relay PIN for the dock tablet. The Kandy hub dock has depot Wi-Fi.
21. **Tonight's loads at 2:40 AM (LDR-01):** already left: the four Badulla runs (2:00), VEH048 Matale dry (2:30), VEH043 and VEH044 Nuwara Eliya (2:35). Ready: VEH042 (324 cases, Anjali Wickramasinghe, complete at 2:36, leaves 2:44); VEH059 (136 cases, complete at 2:31, Suresh Kumar, leaves 3:00). Loading: VEH057, 40 of 118 cases (Suresh Kumar, leaves 3:40); VEH045, 86 of 383 cases (Mohamed Rizwan, started 2:20, leaves 3:40). Later: VEH049 (242 cases, leaves 4:48), and three second trips, picked before each vehicle is back: VEH059 trip 2 (71 cases, leaves 5:26), VEH057 trip 2 (112 cases, leaves 6:12) and VEH042 trip 2 (166 cases, leaves 6:26). Banner: "Plan changed 9:12 PM: VEH045 stops 3 and 4 swapped. Aranayake now loads first (done)."
22. **Loading VEH045:** reverse stop order (stop 4 first, stop 1 last), and within a stop the heaviest case type first (rice and dhal, packet foods, tea and biscuit). 86 of 383 cases at 2:40 AM (stop 4 done), 116 at 2:47 AM (stop 4's 86 and 30 rice and dhal cases for stop 3), 122 at 2:48 AM, 146 at 2:52 AM, every line loaded or decided by 3:30 AM (377 cases), handover ready at 3:31 AM, Load complete and Kasun's acceptance both at 3:32 AM. That is about 6 cases a minute at most.
23. **Ambient store restock:** the Kandy hub's rice and dhal supplier drop arrives at 5:00 AM, after the night loads leave. At 2:47 AM there was no spare; at 6:15 AM there is stock for a new pick of ORD0098593.
24. **Nuwan's night:** Rizwan's 2:47 AM flag reached Nuwan's phone; he opened it at 2:48 AM and decided at 2:52 AM.

### Wednesday morning on the road

25. **Kasun's legs against the data** (Kegalle, monsoon months, route history, same leg type and hour): depot to Kegalle 68 minutes (1.28 times free flow; history 10th to 90th percentile 1.06 to 1.98); between stops 19, 22 and 20 minutes (1.46, 1.69 and 1.54 times; history 1.21 to 1.93, 1.21 to 1.93 and 1.38 to 2.38). Time at the store 19 minutes at Kegalle, 29 at Mawanella, 15 at Hemmathagama and 22 at Aranayake (delivered after 13, then loading the store's returns), each inside that store's 10th to 90th percentile in monsoon months (Mawanella is a slow curb stop: median 44 minutes against a 16 minute allowance).
26. **Check-ins:** while Relay is open, Kasun's phone sends a check-in once a minute with no location. The last one reaches the office at 5:41 AM. "Last synced" (dispatcher) and "Last heard from Kasun" (store) both mean the last time the phone reached Relay. Driver phones do not join store Wi-Fi (Waypoint policy).
27. **Proof at each offline stop:** stop 2 (Mawanella, curb) delivered at 5:59 with a signature from N. Wijesinghe, no photo. Stop 3 arrived 6:21, delivered 6:36, received by W. Rathnayake, with a photo of 96 cases at the rear dock (about 180 KB). S. Herath is also on OUT117's receiving staff, so Relay suggests both names. Stop 4 (Aranayake) arrived 6:56, delivered 7:09, received by K. Herath, with a photo of the cases at the rear dock. Every stop was inside its window.
28. **Location stamps:** stop 2 delivered 12 m from OUT118; stop 3 arrived 9 m and delivered 11 m from OUT117; stop 4 arrived 18 m and delivered 22 m from OUT116. At 7:14 Kasun's phone clock was within 3 seconds of Relay's.
29. **What counts as a record:** a stop event is one record, a photo is its own record sent after its stop, and a signature travels inside its delivery record. Records waiting on the phone: 1 at 5:59, 2 at 6:21, 4 at 6:36, 5 at 6:56, 7 at 7:09. Kasun's pill counts the same moments as stops: "1 stop to send", "2 stops to send", "3 stops to send". At 7:14 the 7 records are 5 stop records and 2 photos; the pill reads "Sending 3 stops", then "All synced".
30. **End of trip:** after stop 4, Kasun's phone shows the trip summary at 7:10 AM with 3 stops to send, while he is still at Aranayake's dock. VEH045 runs no second trip. Kasun taps Finish trip at 7:17 AM at the dock and leaves at 7:18; Relay expects him at the hub around 9:05 (at publish it expected 9:20).
31. **Sampath's delay:** VEH042 left at 2:50 (planned 2:44; the median Kandy departure is 6 minutes after plan), and at the Matale road index of 72 his stops run 30, 42 and 54 minutes behind the free-flow plan (13 at the fourth: the plan had him waiting 48 minutes at Rattota for its 5:00 opening). He reaches stop 2 (Palapathwela) at 4:28 AM, 42 minutes behind plan, and reports "Delayed, 45 min" ("Slow on the Matale road, one lane open."). New expected times go to OUT099 Rattota, OUT101 Elkaduwa and the three Kandy stores of his second trip; Nuwan marks it handled at 4:35 AM from his phone. Sampath's phone keeps its signal all morning.
32. **Stops delivered, as Relay knows them** (all 53 Fresh stops this morning; the other runs at Relay's expected times after the median 6 minute departure delay): 18 of 53 at 5:20, 25 at 6:05, 26 at 6:15, 34 at 6:42 (Hemmathagama counted from the store's receipt), 40 at 7:14 (Kasun's stop 4 held until settled), 41 at 7:16.
33. **Dispatch contact:** the driver app holds one dispatch number, shown as "Call Nuwan at dispatch", for emergencies. Each outlet record holds a receiving phone number that "Call the store" dials; `outlets.csv` has no phone column, so Waypoint adds it. No frame prints a number. No call buttons for drivers on the dispatcher's screens: drivers act only when stopped, and the driver app holds a question while the phone senses the vehicle moving.

### Signal lost on the Kandy corridor

34. **Coverage (story assumption):** an inter-monsoon thunderstorm takes Kasun's mobile network down around Mawanella and the hill roads to Hemmathagama and Aranayake from 5:41 to 7:14 AM, 93 minutes. The data has no coverage file. Dilani's phone uses the store's Wi-Fi, so it stays connected. Sampath, in Matale, keeps his signal.
35. **Settling the clash:** a driver's "Yes, I delivered it", backed by a delivery record, a photo and location stamps, settles it on its own; the dispatcher can settle it at any time, and whichever answer comes first wins. A "No", or no answer in 10 minutes, moves it to the top of the dispatcher's feed. The store's status for the stop is held until it is settled.
36. **The ending:** Kasun answers at 7:15. Relay cancels VEH060's copy at 7:15, and Nimal's phone plays the change aloud, the one kind of message that does. He turns back 39 minutes out and reaches the hub around 8:05 AM with the 86 cases for the ambient store. The cancelled trip used about 3 L. OUT116 is told "Delivered 7:09 AM, proof attached. The backup is cancelled."

### Receipt

37. **Dilani's receipt:** at 6:42 AM, from STM-04 / past estimate, she confirms receipt from the store with "Everything arrived" for her dry order (96 cases; the 6 short cases are already on ORD0098747). The receipt shows "Driver's proof: waiting for Kasun's phone". At 7:14 Kasun's proof arrives (the 6:36 photo, W. Rathnayake's name and a location stamp at OUT117) and attaches to her receipt; at 7:22 AM she opens it and sees it (STM-05). A store can report a problem with a delivery until 4:00 PM on the delivery day. Prototype branches, not part of the story: STM-05's flag frames show 1 packet foods case marked damaged, and DRV-04 / Delayed shows "20 min" picked as an example.

## Appendix: machine-readable tables

Checked by `tools/data-check/validate_scenario.py`. Times are 24-hour HH:MM. "dry" is Fresh ambient; Style and Tech are "ambient". Edit the text and these blocks together, then run the validator.

```csv relay:dates
date,dow,iso_week,festival_ramp,monsoon,is_payday,is_holiday,is_operating,festival,role
2024-04-22,Mon,17,0.0,1,0,0,1,,Precedent: Kegalle chilled waited
2025-04-09,Wed,15,0.5,1,0,0,1,,Precedent: 3 Kandy chilled orders waited
2025-04-10,Thu,15,0.6,1,0,0,1,,Route R015108 carries the waited orders
2026-03-27,Fri,13,0.0,1,0,0,1,,Matale road index below 90 from here
2026-03-28,Sat,13,0.0,1,0,0,1,,Last order in the data (ORD0097345)
2026-04-04,Sat,14,0.1,1,0,0,1,,Hemmathagama's last chilled delivery
2026-04-06,Mon,15,0.3,1,0,0,1,,Monday: VEH039 fails at 2:50 AM
2026-04-07,Tue,15,0.4,1,0,0,1,,Planning day
2026-04-08,Wed,15,0.5,1,0,0,1,,Delivery day
2026-04-09,Thu,15,0.6,1,0,0,1,,Thursday: the next run
2026-04-12,Sun,15,0.9,1,0,0,0,,"Sunday, closed"
2026-04-13,Mon,16,1.0,1,0,1,0,new_year,"New Year holiday, closed (the data flags the festival on this day)"
2026-04-14,Tue,16,0.0,1,0,1,0,,"New Year holiday, closed"
2026-04-22,Wed,17,0.1,1,0,0,1,,Vesak ramp starts
2026-04-25,Sat,17,0.4,1,1,0,1,,Payday
2026-04-29,Wed,18,0.8,1,0,0,1,,DSP-05 headline day
2026-04-30,Thu,18,0.9,1,1,0,1,,Payday
2026-05-01,Fri,18,1.0,1,0,1,0,vesak,"Vesak, closed"
```

```csv relay:vehicles
vehicle_id,type,temp,weight_cap_kg,volume_cap_m3,km_per_l,weekly_fuel_quota_l,depot,driver,wednesday
VEH039,truck,reefer,6180,29.9,5.0,370,Kandy,,workshop
VEH040,truck,reefer,5510,26.4,4.7,380,Kandy,,running
VEH041,truck,reefer,3610,19.4,6.4,600,Kandy,,running
VEH042,truck,reefer,6180,29.9,5.0,480,Kandy,Sampath Lakmal,running
VEH043,truck,reefer,5510,26.4,4.7,450,Kandy,,running
VEH044,truck,ambient,4200,24.0,6.8,340,Kandy,,running
VEH045,truck,ambient,4200,24.0,6.8,530,Kandy,Kasun Bandara,running
VEH046,truck,ambient,3800,22.0,7.1,350,Kandy,,running
VEH047,truck,ambient,5800,30.0,5.2,510,Kandy,,not needed
VEH048,truck,ambient,4200,24.0,6.8,570,Kandy,,running
VEH049,truck,ambient,4200,24.0,6.8,390,Kandy,,running
VEH050,truck,ambient,6500,34.0,5.6,560,Kandy,,not needed
VEH051,truck,ambient,7200,38.0,4.9,400,Kandy,,not needed
VEH052,truck,ambient,4200,24.0,6.8,570,Kandy,,not needed
VEH053,truck,ambient,6500,34.0,5.6,370,Kandy,,not needed
VEH054,truck,ambient,7200,38.0,4.9,520,Kandy,,not needed
VEH055,truck,ambient,4200,24.0,6.8,530,Kandy,,not needed
VEH056,truck,ambient,3800,22.0,7.1,610,Kandy,,running
VEH057,van,reefer,1040,7.0,10.3,450,Kandy,Priyantha Silva,running
VEH058,van,reefer,1040,7.0,10.3,550,Kandy,,workshop
VEH059,van,ambient,1200,9.0,10.8,610,Kandy,,running
VEH060,van,ambient,1200,9.0,10.8,520,Kandy,Nimal Fernando,standby
```

```csv relay:outlets
outlet_id,store_name,brand,district,depot,dock_type,parking_constraint,window_open,window_close
OUT012,Waypoint Fresh Borella,Fresh,Colombo,Peliyagoda,rear_dock,normal,05:30,08:00
OUT032,Waypoint Fresh Kadawatha,Fresh,Gampaha,Peliyagoda,rear_dock,normal,04:00,07:45
OUT041,Waypoint Fresh Panadura,Fresh,Kalutara,Peliyagoda,rear_dock,normal,05:00,07:30
OUT053,Waypoint Fresh Hikkaduwa,Fresh,Galle,Peliyagoda,street,normal,03:00,08:00
OUT076,Waypoint Fresh Katugastota,Fresh,Kandy,Kandy,street,van_only,03:00,08:00
OUT077,Waypoint Fresh Mahaiyawa,Fresh,Kandy,Kandy,street,van_only,05:00,07:30
OUT078,Waypoint Fresh Asgiriya,Fresh,Kandy,Kandy,street,van_only,03:00,08:00
OUT079,Waypoint Fresh Bahirawakanda,Fresh,Kandy,Kandy,street,van_only,04:00,07:45
OUT080,Waypoint Fresh Watapuluwa,Fresh,Kandy,Kandy,street,van_only,05:30,08:00
OUT081,Waypoint Fresh Hantana,Fresh,Kandy,Kandy,street,van_only,03:00,08:00
OUT082,Waypoint Fresh Ampitiya,Fresh,Kandy,Kandy,street,van_only,03:00,08:00
OUT083,Waypoint Fresh Suduhumpola,Fresh,Kandy,Kandy,street,van_only,04:00,07:45
OUT084,Waypoint Fresh Bogambara,Fresh,Kandy,Kandy,rear_dock,normal,05:30,08:00
OUT085,Waypoint Fresh Kandy Town,Fresh,Kandy,Kandy,rear_dock,normal,05:00,07:30
OUT086,Waypoint Fresh Lewella,Fresh,Kandy,Kandy,rear_dock,normal,03:00,08:00
OUT087,Waypoint Fresh Mulgampola,Fresh,Kandy,Kandy,rear_dock,normal,03:00,08:00
OUT095,Waypoint Tech Tennekumbura,Tech,Kandy,Kandy,rear_dock,normal,09:00,17:00
OUT096,Waypoint Fresh Ukuwela,Fresh,Matale,Kandy,rear_dock,normal,05:30,08:00
OUT097,Waypoint Fresh Matale Town,Fresh,Matale,Kandy,street,normal,03:00,08:00
OUT098,Waypoint Fresh Aluvihare,Fresh,Matale,Kandy,rear_dock,normal,03:00,08:00
OUT099,Waypoint Fresh Rattota,Fresh,Matale,Kandy,rear_dock,normal,05:00,07:30
OUT100,Waypoint Fresh Palapathwela,Fresh,Matale,Kandy,rear_dock,normal,03:00,08:00
OUT101,Waypoint Fresh Elkaduwa,Fresh,Matale,Kandy,rear_dock,normal,05:00,07:30
OUT104,Waypoint Fresh Talawakele,Fresh,Nuwara Eliya,Kandy,rear_dock,normal,03:00,08:00
OUT105,Waypoint Fresh Nuwara Eliya,Fresh,Nuwara Eliya,Kandy,rear_dock,normal,05:00,07:30
OUT106,Waypoint Fresh Hatton,Fresh,Nuwara Eliya,Kandy,rear_dock,normal,05:30,08:00
OUT107,Waypoint Fresh Maskeliya,Fresh,Nuwara Eliya,Kandy,rear_dock,normal,03:00,08:00
OUT108,Waypoint Fresh Nanu Oya,Fresh,Nuwara Eliya,Kandy,rear_dock,normal,04:00,07:45
OUT110,Waypoint Fresh Badulla Town,Fresh,Badulla,Kandy,rear_dock,normal,03:00,08:00
OUT111,Waypoint Fresh Hali-Ela,Fresh,Badulla,Kandy,rear_dock,normal,03:00,08:00
OUT112,Waypoint Fresh Bandarawela,Fresh,Badulla,Kandy,rear_dock,normal,04:00,07:45
OUT113,Waypoint Fresh Welimada,Fresh,Badulla,Kandy,rear_dock,normal,05:30,08:00
OUT115,Waypoint Tech Passara,Tech,Badulla,Kandy,street,normal,09:00,17:00
OUT116,Waypoint Fresh Aranayake,Fresh,Kegalle,Kandy,rear_dock,normal,05:00,07:30
OUT117,Waypoint Fresh Hemmathagama,Fresh,Kegalle,Kandy,rear_dock,normal,04:00,07:45
OUT118,Waypoint Fresh Mawanella,Fresh,Kegalle,Kandy,street,normal,04:00,07:45
OUT119,Waypoint Fresh Kegalle,Fresh,Kegalle,Kandy,rear_dock,normal,03:00,08:00
OUT120,Waypoint Style Kegalle,Style,Kegalle,Kandy,rear_dock,normal,09:00,17:00
```

```csv relay:cases
case_type,temp,kg,m3
Rice and dhal case,dry,10.0,0.040
Packet foods case,dry,5.2,0.036
Tea and biscuit case,dry,4.4,0.034
Dairy crate,chilled,8.4,0.038
Produce crate,chilled,5.6,0.042
Meat and fish box,chilled,7.2,0.030
```

```csv relay:orders
order_id,delivery_date,outlet_id,store_name,temp,brand,units,kg,m3,cases,status,vehicle_id,trip,stop
ORD0098544,2026-04-08,OUT076,Waypoint Fresh Katugastota,dry,Fresh,34,227.3,1.264,,served,VEH059,1,1
ORD0098545,2026-04-08,OUT076,Waypoint Fresh Katugastota,chilled,Fresh,25,174.8,0.930,,served,VEH057,1,1
ORD0098546,2026-04-08,OUT077,Waypoint Fresh Mahaiyawa,dry,Fresh,20,132.7,0.725,,served,VEH059,2,2
ORD0098547,2026-04-08,OUT078,Waypoint Fresh Asgiriya,dry,Fresh,28,199.2,1.050,,served,VEH059,1,2
ORD0098548,2026-04-08,OUT079,Waypoint Fresh Bahirawakanda,dry,Fresh,26,171.7,0.903,,served,VEH059,2,1
ORD0098549,2026-04-08,OUT080,Waypoint Fresh Watapuluwa,dry,Fresh,25,173.8,0.919,,served,VEH059,2,3
ORD0098550,2026-04-08,OUT080,Waypoint Fresh Watapuluwa,chilled,Fresh,23,150.3,0.799,,served,VEH057,1,5
ORD0098551,2026-04-08,OUT081,Waypoint Fresh Hantana,dry,Fresh,28,187.8,1.010,,served,VEH059,1,3
ORD0098552,2026-04-08,OUT081,Waypoint Fresh Hantana,chilled,Fresh,29,210.7,1.112,,served,VEH057,1,2
ORD0098553,2026-04-08,OUT082,Waypoint Fresh Ampitiya,dry,Fresh,29,193.3,1.037,,served,VEH059,1,4
ORD0098554,2026-04-08,OUT082,Waypoint Fresh Ampitiya,chilled,Fresh,17,114.6,0.602,,served,VEH057,1,3
ORD0098555,2026-04-08,OUT083,Waypoint Fresh Suduhumpola,dry,Fresh,17,119.7,0.636,,served,VEH059,1,5
ORD0098556,2026-04-08,OUT083,Waypoint Fresh Suduhumpola,chilled,Fresh,24,154.1,0.811,,served,VEH057,1,4
ORD0098557,2026-04-08,OUT084,Waypoint Fresh Bogambara,dry,Fresh,49,319.9,1.740,,served,VEH049,1,3
ORD0098558,2026-04-08,OUT084,Waypoint Fresh Bogambara,chilled,Fresh,46,340.4,1.730,,served,VEH042,2,1
ORD0098559,2026-04-08,OUT085,Waypoint Fresh Kandy Town,dry,Fresh,76,490.7,2.573,,served,VEH049,1,2
ORD0098560,2026-04-08,OUT085,Waypoint Fresh Kandy Town,chilled,Fresh,77,559.5,2.931,,served,VEH042,2,3
ORD0098561,2026-04-08,OUT086,Waypoint Fresh Lewella,dry,Fresh,51,379.8,1.967,,served,VEH049,1,1
ORD0098562,2026-04-08,OUT087,Waypoint Fresh Mulgampola,dry,Fresh,66,474.9,2.474,,served,VEH049,1,4
ORD0098563,2026-04-08,OUT087,Waypoint Fresh Mulgampola,chilled,Fresh,43,271.1,1.419,,served,VEH042,2,2
ORD0098564,2026-04-08,OUT095,Waypoint Tech Tennekumbura,ambient,Tech,4,890.0,2.987,,served,VEH044,2,1
ORD0098565,2026-04-08,OUT096,Waypoint Fresh Ukuwela,dry,Fresh,39,254.4,1.386,,served,VEH048,1,6
ORD0098566,2026-04-08,OUT097,Waypoint Fresh Matale Town,dry,Fresh,84,550.7,2.999,,served,VEH048,1,1
ORD0098567,2026-04-08,OUT097,Waypoint Fresh Matale Town,chilled,Fresh,82,579.9,3.225,,served,VEH042,1,1
ORD0098568,2026-04-08,OUT098,Waypoint Fresh Aluvihare,dry,Fresh,90,532.1,2.888,,served,VEH048,1,2
ORD0098569,2026-04-08,OUT099,Waypoint Fresh Rattota,dry,Fresh,75,518.0,2.797,,served,VEH048,1,4
ORD0098570,2026-04-08,OUT099,Waypoint Fresh Rattota,chilled,Fresh,49,355.6,1.892,,served,VEH042,1,3
ORD0098571,2026-04-08,OUT100,Waypoint Fresh Palapathwela,dry,Fresh,113,680.0,3.722,,served,VEH048,1,3
ORD0098572,2026-04-08,OUT100,Waypoint Fresh Palapathwela,chilled,Fresh,116,734.8,4.081,,served,VEH042,1,2
ORD0098573,2026-04-08,OUT101,Waypoint Fresh Elkaduwa,dry,Fresh,63,456.3,2.387,,served,VEH048,1,5
ORD0098574,2026-04-08,OUT101,Waypoint Fresh Elkaduwa,chilled,Fresh,77,515.0,2.811,,served,VEH042,1,4
ORD0098575,2026-04-08,OUT104,Waypoint Fresh Talawakele,dry,Fresh,59,414.2,2.227,,served,VEH044,1,3
ORD0098576,2026-04-08,OUT104,Waypoint Fresh Talawakele,chilled,Fresh,46,309.0,1.695,,served,VEH043,1,2
ORD0098577,2026-04-08,OUT105,Waypoint Fresh Nuwara Eliya,dry,Fresh,54,397.3,2.045,,served,VEH044,1,1
ORD0098578,2026-04-08,OUT105,Waypoint Fresh Nuwara Eliya,chilled,Fresh,37,274.8,1.469,,served,VEH043,1,1
ORD0098579,2026-04-08,OUT106,Waypoint Fresh Hatton,dry,Fresh,70,472.3,2.509,,served,VEH044,1,4
ORD0098580,2026-04-08,OUT106,Waypoint Fresh Hatton,chilled,Fresh,47,318.6,1.709,,served,VEH043,1,3
ORD0098581,2026-04-08,OUT107,Waypoint Fresh Maskeliya,dry,Fresh,75,500.4,2.723,,served,VEH044,1,5
ORD0098582,2026-04-08,OUT107,Waypoint Fresh Maskeliya,chilled,Fresh,53,375.2,2.044,,served,VEH043,1,4
ORD0098583,2026-04-08,OUT108,Waypoint Fresh Nanu Oya,dry,Fresh,71,482.0,2.665,,served,VEH044,1,2
ORD0098584,2026-04-08,OUT110,Waypoint Fresh Badulla Town,dry,Fresh,49,358.5,1.943,,served,VEH046,1,1
ORD0098585,2026-04-08,OUT110,Waypoint Fresh Badulla Town,chilled,Fresh,40,249.9,1.384,,served,VEH040,1,1
ORD0098586,2026-04-08,OUT111,Waypoint Fresh Hali-Ela,dry,Fresh,35,225.2,1.283,,served,VEH046,1,2
ORD0098587,2026-04-08,OUT111,Waypoint Fresh Hali-Ela,chilled,Fresh,26,159.8,0.863,,served,VEH040,1,2
ORD0098588,2026-04-08,OUT112,Waypoint Fresh Bandarawela,dry,Fresh,87,583.2,3.233,,served,VEH056,1,1
ORD0098589,2026-04-08,OUT112,Waypoint Fresh Bandarawela,chilled,Fresh,60,417.4,2.207,,served,VEH041,1,1
ORD0098590,2026-04-08,OUT113,Waypoint Fresh Welimada,dry,Fresh,102,727.8,3.784,,served,VEH056,1,2
ORD0098591,2026-04-08,OUT113,Waypoint Fresh Welimada,chilled,Fresh,59,418.2,2.240,,served,VEH041,1,2
ORD0098592,2026-04-08,OUT115,Waypoint Tech Passara,ambient,Tech,10,2136.2,7.070,,served,VEH046,2,1
ORD0098593,2026-04-08,OUT116,Waypoint Fresh Aranayake,dry,Fresh,86,572.0,3.168,30 32 24,served,VEH045,1,4
ORD0098594,2026-04-08,OUT116,Waypoint Fresh Aranayake,chilled,Fresh,47,335.2,1.774,20 17 10,served,VEH057,2,1
ORD0098595,2026-04-08,OUT117,Waypoint Fresh Hemmathagama,dry,Fresh,102,685.6,3.772,36 44 22,served,VEH045,1,3
ORD0098596,2026-04-08,OUT117,Waypoint Fresh Hemmathagama,chilled,Fresh,92,659.2,3.464,40 32 20,deferred,,,
ORD0098597,2026-04-08,OUT118,Waypoint Fresh Mawanella,dry,Fresh,138,877.6,5.048,40 58 40,served,VEH045,1,2
ORD0098598,2026-04-08,OUT119,Waypoint Fresh Kegalle,dry,Fresh,57,395.6,2.116,23 20 14,served,VEH045,1,1
ORD0098599,2026-04-08,OUT119,Waypoint Fresh Kegalle,chilled,Fresh,65,466.4,2.438,28 22 15,served,VEH057,2,2
ORD0098600,2026-04-08,OUT120,Waypoint Style Kegalle,ambient,Style,77,1109.9,17.730,,served,VEH056,2,1
ORD0098496,2026-04-08,OUT032,Waypoint Fresh Kadawatha,dry,Fresh,140,932.4,5.118,,"late, moved to Thursday",,,
ORD0098497,2026-04-08,OUT032,Waypoint Fresh Kadawatha,chilled,Fresh,129,985.4,5.299,,"late, moved to Thursday",,,
ORD0098747,2026-04-09,OUT117,Waypoint Fresh Hemmathagama,dry,Fresh,133,914.8,4.938,51 55 27,"Thursday, 6 rice and dhal cases from Wednesday",,,
ORD0098748,2026-04-09,OUT117,Waypoint Fresh Hemmathagama,chilled,Fresh,116,775.4,4.170,,Thursday Kegalle chilled run,,,
ORD0098750,2026-04-09,OUT118,Waypoint Fresh Mawanella,chilled,Fresh,139,902.7,4.824,,Thursday Kegalle chilled run,,,
ORD0098752,2026-04-09,OUT119,Waypoint Fresh Kegalle,chilled,Fresh,91,584.3,3.183,,Thursday Kegalle chilled run,,,
```

```csv relay:trips
vehicle_id,trip,load,district,depart,stops,planned_arrivals,units,kg,m3,std_min,back_at_hub
VEH040,1,Fresh chilled,Badulla,02:00,OUT110 OUT111,05:06 05:44,66,409.7,2.247,239,09:05
VEH041,1,Fresh chilled,Badulla,02:00,OUT112 OUT113,05:06 05:44,119,835.6,4.447,239,09:05
VEH042,1,Fresh chilled,Matale,02:44,OUT097 OUT100 OUT099 OUT101,03:19 03:46 04:12 05:26,324,2185.3,12.009,129,06:16
VEH042,2,Fresh chilled,Kandy,06:26,OUT084 OUT087 OUT085,06:42 07:03 07:24,166,1171.0,6.080,73,07:55
VEH043,1,Fresh chilled,Nuwara Eliya,02:35,OUT105 OUT104 OUT106 OUT107,04:26 05:35 06:10 06:45,183,1277.6,6.917,231,08:51
VEH044,1,Fresh dry,Nuwara Eliya,02:35,OUT105 OUT108 OUT104 OUT106 OUT107,04:26 05:35 06:10 06:45 07:20,329,2266.2,12.169,266,09:26
VEH044,2,Tech,Kandy,09:38,OUT095,09:54,4,890.0,2.987,59,10:53
VEH045,1,Fresh dry,Kegalle,03:40,OUT119 OUT118 OUT117 OUT116,04:33 05:01 05:30 05:58,383,2530.8,14.104,153,07:06
VEH046,1,Fresh dry,Badulla,02:00,OUT110 OUT111,05:06 05:44,84,583.7,3.226,239,09:05
VEH046,2,Tech,Badulla,09:15,OUT115,12:21,10,2136.2,7.070,241,16:22
VEH048,1,Fresh dry,Matale,02:30,OUT097 OUT098 OUT100 OUT099 OUT101 OUT096,03:05 03:32 03:58 04:24 05:26 05:52,464,2991.5,16.179,181,06:42
VEH049,1,Fresh dry,Kandy,04:48,OUT086 OUT085 OUT084 OUT087,05:04 05:25 05:46 06:07,242,1665.3,8.754,94,06:38
VEH056,1,Fresh dry,Badulla,02:00,OUT112 OUT113,05:06 05:44,189,1311.0,7.017,239,09:05
VEH056,2,Style,Kegalle,09:15,OUT120,10:08,77,1109.9,17.730,91,11:39
VEH057,1,Fresh chilled,Kandy,03:40,OUT076 OUT081 OUT082 OUT083 OUT080,03:56 04:18 04:40 05:02 05:24,118,804.5,4.254,120,06:02
VEH057,2,Fresh chilled,Kegalle,06:12,OUT116 OUT119,07:05 07:33,112,801.6,4.212,96,08:41
VEH059,1,Fresh dry,Kandy,03:00,OUT076 OUT078 OUT081 OUT082 OUT083,03:16 03:38 04:00 04:22 04:44,136,927.3,4.997,120,05:16
VEH059,2,Fresh dry,Kandy,05:26,OUT079 OUT077 OUT080,05:42 06:04 06:26,71,478.2,2.547,76,06:58
```

```csv relay:expected
vehicle_id,trip,outlet_id,planned,expected,window_close,after_window
VEH040,1,OUT110,05:06,06:11,08:00,0
VEH040,1,OUT111,05:44,07:10,08:00,0
VEH041,1,OUT112,05:06,06:11,07:45,0
VEH041,1,OUT113,05:44,07:17,08:00,0
VEH042,1,OUT097,03:19,03:43,08:00,0
VEH042,1,OUT100,03:46,04:22,08:00,0
VEH042,1,OUT099,04:12,05:00,07:30,0
VEH042,1,OUT101,05:26,05:33,07:30,0
VEH042,2,OUT084,06:42,07:51,08:00,0
VEH042,2,OUT087,07:03,08:25,08:00,1
VEH042,2,OUT085,07:24,08:59,07:30,1
VEH043,1,OUT105,04:26,04:56,07:30,0
VEH043,1,OUT104,05:35,05:41,08:00,0
VEH043,1,OUT106,06:10,06:36,08:00,0
VEH043,1,OUT107,06:45,07:23,08:00,0
VEH044,1,OUT105,04:26,04:56,07:30,0
VEH044,1,OUT108,05:35,05:41,07:45,0
VEH044,1,OUT104,06:10,06:28,08:00,0
VEH044,1,OUT106,06:45,07:22,08:00,0
VEH044,1,OUT107,07:20,08:17,08:00,1
VEH045,1,OUT119,04:33,04:48,08:00,0
VEH045,1,OUT118,05:01,05:31,07:45,0
VEH045,1,OUT117,05:30,06:36,07:45,0
VEH045,1,OUT116,05:58,07:13,07:30,0
VEH046,1,OUT110,05:06,06:11,08:00,0
VEH046,1,OUT111,05:44,07:10,08:00,0
VEH048,1,OUT097,03:05,03:29,08:00,0
VEH048,1,OUT098,03:32,04:07,08:00,0
VEH048,1,OUT100,03:58,04:49,08:00,0
VEH048,1,OUT099,04:24,05:28,07:30,0
VEH048,1,OUT101,05:26,06:02,07:30,0
VEH048,1,OUT096,05:52,06:41,08:00,0
VEH049,1,OUT086,05:04,05:11,08:00,0
VEH049,1,OUT085,05:25,05:31,07:30,0
VEH049,1,OUT084,05:46,06:07,08:00,0
VEH049,1,OUT087,06:07,06:33,08:00,0
VEH056,1,OUT112,05:06,06:11,07:45,0
VEH056,1,OUT113,05:44,07:17,08:00,0
VEH057,1,OUT076,03:56,04:01,08:00,0
VEH057,1,OUT081,04:18,04:23,08:00,0
VEH057,1,OUT082,04:40,04:41,08:00,0
VEH057,1,OUT083,05:02,05:02,07:45,0
VEH057,1,OUT080,05:24,05:22,08:00,0
VEH057,2,OUT116,07:05,07:43,07:30,1
VEH057,2,OUT119,07:33,08:32,08:00,1
VEH059,1,OUT076,03:16,03:21,08:00,0
VEH059,1,OUT078,03:38,03:42,08:00,0
VEH059,1,OUT081,04:00,04:01,08:00,0
VEH059,1,OUT082,04:22,04:20,08:00,0
VEH059,1,OUT083,04:44,04:40,07:45,0
VEH059,2,OUT079,05:42,05:51,07:45,0
VEH059,2,OUT077,06:04,06:09,07:30,0
VEH059,2,OUT080,06:26,06:32,08:00,0
```

```csv relay:fuel
vehicle_id,fresh_min,daytime_min,mon_l,tue_l,wed_l,week_l,quota_l
VEH039,0,0,0.0,0.0,0.0,0.0,370
VEH040,239,0,55.1,46.1,58.7,159.9,380
VEH041,239,0,42.9,40.6,43.1,126.6,600
VEH042,202,0,19.6,5.1,19.6,44.3,480
VEH043,231,0,42.5,31.2,42.1,115.8,450
VEH044,266,59,37.1,31.7,33.5,102.3,340
VEH045,153,0,25.6,20.9,16.2,62.7,530
VEH046,239,241,64.1,37.8,75.5,177.4,350
VEH048,181,0,15.4,14.1,13.5,43.0,570
VEH049,94,0,5.6,1.0,3.7,10.3,390
VEH056,239,91,41.9,35.8,50.1,127.8,610
VEH057,216,0,11.2,2.5,11.5,25.2,450
VEH058,0,0,0.0,0.0,0.0,0.0,550
VEH059,196,0,4.0,3.5,4.6,12.1,610
VEH060,0,0,0.0,0.0,0.0,0.0,520
```

```csv relay:kasun
stop,outlet_id,store_name,window,stop_before_912,planned_before_912,expected_before_912,planned,expected,arrived,delivered,left
1,OUT119,Waypoint Fresh Kegalle,03:00 to 08:00,1,04:33,04:50,04:33,04:50,04:52,05:11,05:11
2,OUT118,Waypoint Fresh Mawanella,04:00 to 07:45,2,05:01,05:30,05:01,05:30,05:30,05:59,05:59
3,OUT117,Waypoint Fresh Hemmathagama,04:00 to 07:45,4,05:58,07:15,05:30,06:35,06:21,06:36,06:36
4,OUT116,Waypoint Fresh Aranayake,05:00 to 07:30,3,05:30,06:35,05:58,07:15,06:56,07:09,07:18
```

```csv relay:kasun_events
event,time
planned_departure,03:40
departed,03:44
signal_lost,05:41
store_receipt,06:42
backup_kept,06:44
signal_back,07:14
answered,07:15
resolved,07:16
summary,07:10
finish,07:17
left_last_stop,07:18
backup_moved,06:15
backup_leaves,06:36
backup_cancelled,07:15
```

```csv relay:estimates
at,stop,outlet_id,estimate,low,high,silence_min,actual_arrival,passed
06:05,3,OUT117,06:35,06:05,07:05,24,06:21,0
06:05,4,OUT116,07:15,06:45,07:45,24,06:56,0
06:15,3,OUT117,06:35,06:15,07:10,34,06:21,0
06:15,4,OUT116,07:15,06:40,07:50,34,06:56,0
06:40,3,OUT117,06:35,,,59,06:21,1
06:40,4,OUT116,07:15,06:40,08:00,59,06:56,0
06:42,4,OUT116,07:05,06:45,07:55,61,06:56,0
```

```csv relay:loading
time,loaded_cases,note
02:20,0,"Loading starts (stop 4, Aranayake, first)"
02:40,86,Stop 4 loaded (86 cases)
02:47,116,"Stop 3 rice and dhal: 30 on the shelf, 6 missing"
02:48,122,
02:52,146,Nuwan's answer reaches the dock
03:30,377,Every line loaded or decided
03:31,377,Handover ready
03:32,377,"Load complete, Kasun accepts"
```

```csv relay:outlook
iso_week,dates,operating_days,chilled_m3,dry_m3,style_m3,tech_m3,all_m3,busiest_day_from_8_april,needed,available
15,2026-04-06 to 2026-04-12,6,267.3,477.3,118.0,22.4,885.0,2026-04-08,6,5
16,2026-04-13 to 2026-04-19,4,133.2,230.4,52.2,21.3,437.1,2026-04-15,6,7
17,2026-04-20 to 2026-04-26,6,200.1,357.4,78.2,22.4,658.1,2026-04-22,6,7
18,2026-04-27 to 2026-05-03,5,188.6,333.5,80.4,18.2,620.7,2026-04-29,6,7
19,2026-05-04 to 2026-05-10,6,188.1,337.3,75.2,22.4,623.0,2026-05-06,6,7
20,2026-05-11 to 2026-05-17,6,188.3,337.7,75.2,22.4,623.6,2026-05-13,6,7
```

```csv relay:outlook_days
date,chilled_orders,chilled_kg,chilled_m3,needed,available
2026-04-06,19,5850.4,31.8,5,5
2026-04-07,20,6702.5,36.3,4,5
2026-04-08,23,8144.5,43.6,6,5
2026-04-09,22,9091.3,48.5,5,7
2026-04-10,19,9585.7,51.9,4,7
2026-04-11,22,10857.6,58.3,5,7
2026-04-15,23,5958.8,32.0,6,7
2026-04-16,21,5857.1,31.3,5,7
2026-04-17,19,6148.6,33.3,4,7
2026-04-18,22,6837.8,36.7,4,7
2026-04-20,19,4856.1,26.4,5,7
2026-04-21,20,5094.8,27.6,4,7
2026-04-22,23,6015.1,32.3,6,7
2026-04-23,21,6077.5,32.5,5,7
2026-04-24,19,6549.9,35.5,4,7
2026-04-25,22,8516.4,45.8,5,7
2026-04-27,19,5654.4,30.8,5,7
2026-04-28,20,6224.9,33.7,4,7
2026-04-29,23,7510.9,40.3,6,7
2026-04-30,21,8750.4,46.8,5,7
2026-05-02,22,6854.4,36.8,4,7
2026-05-04,19,4867.9,26.5,5,7
2026-05-05,20,5106.9,27.7,4,7
2026-05-06,23,5980.5,32.1,6,7
2026-05-07,21,5878.1,31.4,5,7
2026-05-08,19,6170.7,33.4,4,7
2026-05-09,22,6862.7,36.9,4,7
2026-05-11,19,4873.7,26.5,5,7
2026-05-12,20,5113.3,27.7,4,7
2026-05-13,23,5987.5,32.1,6,7
2026-05-14,21,5885.3,31.5,5,7
2026-05-15,19,6178.4,33.5,4,7
2026-05-16,22,6870.7,36.9,4,7
```

```csv relay:timeline
day,time,event,frames
Mon,02:50,"VEH039's refrigeration unit fails the temperature check at the dock, loaded for Matale",
Tue,14:10,Dilani places the chilled order,STM-02
Tue,14:14,Dilani sends the dry order; both orders show Received by Waypoint,"STM-02 / dry, STM-01 / before cutoff"
Tue,15:12,"125 orders in, 6 Fresh outlets still to order","DSP-01, before cutoff"
Tue,16:02,The queue closed at 4:00 with 136 orders; 2 late orders (4:01 and 4:02 PM) moved to Thursday,"DSP-01, after cutoff"
Tue,16:35,"Relay proposes the Kandy plan. Nuwan drags ORD0098596 (Dilani's chilled order) onto VEH057 trip 2 and gets the broken-rule warning: 1,460.8 kg against the van's 1,040 kg",DSP-02
Tue,16:50,"Deferral drawer for Kandy: 1 chilled order, 659.2 kg and 3.464 m³",DSP-03
Tue,16:51,Nuwan opens the override on OUT119 and cancels it,DSP-03 / override
Tue,16:52,"Deferral confirmed, the Kandy plan is ready",DSP-03 / ready
Tue,18:31,Nuwan publishes Peliyagoda,
Tue,18:39,Kandy publish check: 5 of 53 Fresh stops expected after their window,"DSP-02 / publish check, DSP-02 Publish dialog"
Tue,18:40,"Plan published. Loading lists, run sheets and store statuses update, and the deferral notice goes out",DSP-02 / published
Tue,18:41,Dilani gets the deferral notice for her chilled order,STM-03
Tue,18:45,Capacity outlook,DSP-05
Tue,19:30,"Dilani checks her orders: dry expected around 7:15 AM, chilled moved to Thursday",STM-01
Tue,21:12,Nuwan swaps stops 3 and 4 on VEH045: Hemmathagama is now stop 3. Dilani is told her dry order is now expected around 6:35 AM. The loading order changes,"STM-01 / moved earlier, LDR-01 banner"
Wed,02:18,Rizwan signs in on the dock tablet,
Wed,02:20,"Rizwan starts loading VEH045, stop 4 (Aranayake) first",
Wed,02:36,Anjali signs in on the tablet to mark VEH042 complete,
Wed,02:40,Rizwan switches back with his PIN and opens the list of tonight's loads at the Kandy hub,"LDR-01 / PIN switch, LDR-01"
Wed,02:47,"Rizwan flags 6 rice and dhal cases missing on VEH045, stop 3","LDR-02, LDR-03"
Wed,02:48,Nuwan opens the flag on his phone,"DSP-04 / shortfall decision, LDR-02 / flag sent"
Wed,02:52,"Nuwan decides: send short, add the cases to Thursday's order ORD0098747. Dilani is told","LDR-02 / answer in, LDR-03 / decision"
Wed,03:30,Every line on VEH045 is loaded or decided,LDR-02 / all checked
Wed,03:31,Handover ready,LDR-04 / ready
Wed,03:32,Load complete. Kasun accepts the load on his phone,"LDR-04, DRV-01 / Accept load"
Wed,03:44,VEH045 leaves the Kandy hub (planned 3:40),
Wed,04:28,"Sampath reports Delayed, 45 min at Palapathwela; Nuwan marks it handled at 4:35",
Wed,04:52,"Kasun arrives at Kegalle, 19 minutes behind plan and on Relay's time (he left 4 minutes late)",DRV-02 / Behind plan
Wed,05:05,Dilani opens the short-delivery notice,STM-03 / short delivery
Wed,05:20,Kasun is on the way to stop 2. All synced,"DRV-01, DSP-04, STM-04"
Wed,05:30,"Kasun arrives at stop 2, Mawanella. The arrival is sent",DRV-02
Wed,05:41,The storm takes Kasun's network down near Mawanella. Signal lost,
Wed,06:05,"Kasun offline. Nuwan's view shows no contact since 5:41, and Dilani sees the estimate","DEG-01, DEG-03, DEG-04"
Wed,06:15,"Nuwan moves stop 4 (Aranayake) to VEH060, the standby","DEG-03 / move stop 4, DEG-03 / stop 4 moved"
Wed,06:21,"Kasun arrives at stop 3, Hemmathagama, offline",DRV-02 / Stop 3 offline
Wed,06:36,Kasun completes stop 3 offline. VEH060 leaves the hub,DRV-03
Wed,06:40,Dilani's estimate has passed with no word from Kasun; the screen offers Confirm receipt,STM-04 / past estimate
Wed,06:42,"Dilani confirms receipt from the store: Everything arrived. Nuwan's feed shows the receipt, Aranayake's new estimate and Keep backup / Cancel backup","STM-05 / before driver proof, DEG-03 / receipt in"
Wed,06:44,Nuwan keeps the backup: Kasun is still out of contact on the hill road,
Wed,06:56,"Kasun arrives at stop 4, Aranayake, offline",
Wed,07:09,"Kasun delivers stop 4, offline, and loads the store's returns at the dock",
Wed,07:10,Trip summary with 3 stops to send,DRV-05 / Still waiting
Wed,07:14,"The storm passes; signal back while Kasun is at Aranayake's dock. 7 records sent, one question about stop 4","DEG-02 / sending, DEG-02, DEG-05 / waiting for answer"
Wed,07:15,"Kasun, at the dock, answers Yes, I delivered it. VEH060's copy of stop 4 is cancelled",DEG-02 / answered yes
Wed,07:16,Nuwan sees the conflict resolved and VEH060's stop cancelled,DEG-05
Wed,07:17,Kasun taps Finish trip at Aranayake's dock; Relay expects him at the hub around 9:05,DRV-05
Wed,07:18,Kasun leaves Aranayake,
Wed,07:22,Dilani opens her receipt with Kasun's proof attached,STM-05
```

```json relay:facts
{
 "deferral": {
  "served_max_5": 22,
  "served_max_5_no_reload": 22,
  "served_paper_5": 23,
  "served_max_7": 23,
  "served_max_6_with_VEH058": 23,
  "served_max_6_with_VEH039": 23,
  "needed_of_7": 6,
  "ordinary_wednesday_served_5": 22,
  "usual_runs": {
   "VEH040": ["OUT110", "OUT111"],
   "VEH041": ["OUT112", "OUT113"],
   "VEH042": ["OUT084", "OUT085", "OUT087"],
   "VEH043": ["OUT104", "OUT105", "OUT106", "OUT107"],
   "VEH057": ["OUT076", "OUT080", "OUT081", "OUT082", "OUT083"]
  },
  "pool": [
    "OUT097",
    "OUT099",
    "OUT100",
    "OUT101",
    "OUT104",
    "OUT105",
    "OUT106",
    "OUT107",
    "OUT110",
    "OUT111",
    "OUT112",
    "OUT113",
    "OUT116",
    "OUT117",
    "OUT119"
   ],
  "pool_keeping_usual_runs": ["OUT117", "OUT119"],
  "lightest": ["OUT111", 159.8],
  "kegalle_kg": 1460.8,
  "kegalle_m3": 7.676,
  "paper_plan": [
    ["VEH040", 1, ["OUT110", "OUT111"]],
    ["VEH040", 2, ["OUT087"]],
    ["VEH041", 1, ["OUT112", "OUT113"]],
    ["VEH042", 1, ["OUT097", "OUT100", "OUT099", "OUT101"]],
    ["VEH042", 2, ["OUT116", "OUT117", "OUT119"]],
    ["VEH043", 1, ["OUT105", "OUT104", "OUT106", "OUT107"]],
    ["VEH057", 1, ["OUT076", "OUT081", "OUT082", "OUT083", "OUT080"]],
    ["VEH057", 2, ["OUT085", "OUT084"]]
   ],
  "paper_minutes": {
   "VEH040": 270,
   "VEH041": 239,
   "VEH042": 253,
   "VEH043": 231,
   "VEH057": 172
  },
  "paper_veh040": ["09:05", "09:31"],
  "paper_veh042_third_stop": "08:15",
  "protected_expected": "08:32",
  "veh040_kegalle_paper": 307,
  "lightest_example": {
   "VEH040": [["OUT119"], ["OUT110"]],
   "VEH057_trip_2": ["OUT116", "OUT117"],
   "veh040_minutes": [68, 201]
  }
 },
 "monday": {
  "kegalle_kg": 1421.9,
  "matale_kg": 1404.5,
  "out119_kg": 454.0,
  "van_kg": 967.9,
  "veh042_ready": "04:20",
  "veh042_back": "07:03",
  "veh042_kegalle_earliest": "08:06",
  "veh057_first_trip_back": "05:34",
  "veh042_mondays": 14,
  "mondays": 116
 },
 "tuesday": {
  "served": 21
 },
 "thursday": {
  "tech_outlets": ["OUT094", "OUT095"],
  "block": ["ORD0098601", "ORD0098752"],
  "short_cases": 6,
  "own_cases": [45, 55, 27],
  "needed_of_7": 5,
  "kegalle_kg": 2921.6,
  "kegalle_m3": 15.641,
  "kegalle_std": 153,
  "kegalle_sequence": ["OUT119", "OUT118", "OUT117", "OUT117"],
  "kegalle_depart": "02:55",
  "kegalle_planned": ["03:48", "04:16", "04:45", "05:13"],
  "dry_run_kg": 3151.9,
  "dry_run_m3": 16.776,
  "kegalle_back": "06:21",
  "matale_outlets": ["OUT096", "OUT097", "OUT100"],
  "day_std": 256,
  "too_late_depart": "03:00",
  "veh039_thursdays": 113,
  "veh039_kegalle_matale": 101
 },
 "publish": {
  "expected_after_window": 5,
  "matale_departures": {
   "VEH048": {
    "depart": "04:27",
    "late": 3,
    "late_now": 0
   },
   "VEH042": {
    "depart": "02:55",
    "trip2_late": 3,
    "trip2_late_now": 2
   }
  },
  "out107_alone": {
   "depart": "02:00",
   "planned": "03:51",
   "expected": "04:21",
   "std": 126,
   "truck": "VEH052",
   "litres": 23,
   "hours": 4
  }
 },
 "backup": {
  "eta": "08:05",
  "home": "08:05",
  "out_min": 39,
  "km": 36,
  "litres": 3,
  "std": 68,
  "trip_litres": 7.4,
  "veh057_with": 1373.6
 },
 "counts": {
  "05:20": 18,
  "06:05": 25,
  "06:15": 26,
  "06:42": 34,
  "07:14": 40,
  "07:16": 41
 },
 "sampath": {
  "departed": "02:50",
  "stop2_arrival": "04:28",
  "behind_plan": [30, 42, 54, 13],
  "reported": 45
 },
 "queue": {
  "at_312": {
   "total": 125,
   "dry": 74,
   "chilled": 46,
   "style": 3,
   "tech": 2,
   "kandy": 52,
   "peliyagoda": 73
  },
  "at_400": {
   "total": 136,
   "dry": 79,
   "chilled": 50,
   "style": 4,
   "tech": 3,
   "kandy": 57,
   "peliyagoda": 79
  },
  "late_ids": ["ORD0098496", "ORD0098497"],
  "not_ordered_312": ["OUT012", "OUT032", "OUT041", "OUT053", "OUT087", "OUT098"],
  "style_tech_after_312": ["OUT120", "OUT115"]
 },
 "outlook": {
  "backtest": [2.7, 11.1],
  "headline_day": "2026-04-29",
  "headline_kg": 7510.9,
  "six_days": ["2026-04-15", "2026-04-22", "2026-04-29", "2026-05-06", "2026-05-13"],
  "week15_ratio": 1.41,
  "vehicle_days": {
   "15": 36,
   "16": 28,
   "17": 42,
   "18": 35,
   "19": 42,
   "20": 42
  },
  "one_load_m3": {
   "15": 765.3,
   "16": 584.0,
   "17": 876.0,
   "18": 730.0,
   "19": 876.0,
   "20": 876.0
  },
  "five_serve_wednesdays": 22
 },
 "plan": {
  "wednesdays_below": 113,
  "fresh_dry": [31, 1898, 12754.0, 68.993],
  "fresh_chilled": [23, 1180, 8144.5, 43.63]
 },
 "story": {
  "orders_first": "2024-01-01",
  "orders_last": "2026-03-28",
  "Kandy_deferred_orders": 31,
  "Kandy_deferral_days": 6,
  "Kandy_deferred_chilled": 23,
  "Kandy_deferred_dry": 8,
  "Kandy_not_run": 20,
  "Kandy_orders": 37575,
  "Peliyagoda_deferred_orders": 1602,
  "Peliyagoda_deferral_days": 295,
  "Peliyagoda_deferred_chilled": 1602,
  "Peliyagoda_deferred_dry": 0,
  "Peliyagoda_not_run": 393,
  "Peliyagoda_orders": 59746,
  "Kandy_deferral_days_monsoon": 6,
  "Kandy_deferral_days_chilled": 5,
  "missed_chilled": 2018,
  "missed_chilled_with_dry": 2018,
  "legs_first": "2024-01-01",
  "legs_last": "2026-02-14",
  "keg_first_stops": 616,
  "keg_first_after_planned_pct": 98.9,
  "keg_first_behind_median": 34,
  "keg_first_behind_p10": 13,
  "keg_first_behind_p90": 72,
  "keg_first_ratio_median": 1.48,
  "keg_stops": 2056,
  "keg_stops_after_planned_pct": 99.6,
  "kandy_wednesdays": 115,
  "veh058_wednesdays_run": 4,
  "veh060_wednesdays_run": 14,
  "veh045_kegalle_dry_wednesdays": 94,
  "wed_median_trips": 17,
  "wed_median_vehicles": 12,
  "trips_in_orders": 26579,
  "trips_mixing_temps": 0,
  "kandy_fresh_dry_attempted": 21532,
  "kandy_fresh_dry_on_reefer": 0,
  "kandy_second_fresh_trips": 2107,
  "second_trip_before_first_ends_pct": 73.8,
  "kandy_top_chilled_week": 202515,
  "kandy_top_chilled_m3": 260.2,
  "kandy_2026_w1_13_chilled_mean": 189.0,
  "out118_monsoon_unload_median": 44,
  "street_allowance": 16,
  "kandy_departure_delay_median": 6,
  "kandy_earliest_departure": "02:00",
  "kandy_fresh_monsoon_stops": 15910,
  "kandy_fresh_monsoon_late_pct": 27.1,
  "late_pct_fresh_Kandy": 11.5,
  "late_pct_fresh_Matale": 22.5,
  "late_pct_fresh_Kegalle": 28.7,
  "late_pct_fresh_Nuwara Eliya": 47.0,
  "late_pct_fresh_Badulla": 54.3,
  "Kandy_not_run_fresh_dry": 5,
  "Kandy_not_run_style": 7,
  "Kandy_not_run_tech": 8,
  "Peliyagoda_not_run_fresh_chilled": 393,
  "Kandy_dry_deferral_day": "2024-06-15",
  "Kandy_dry_deferral_orders": 8,
  "five_reefer_wednesdays": 19,
  "five_reefer_all_served": 17,
  "five_reefer_planned_stops": 391,
  "five_reefer_planned_late": 0,
  "five_reefer_early_min": 98,
  "five_reefer_early_max": 174,
  "five_reefer_days_with_early_truck": 17,
  "matale_first_dep_min_dry": "03:33",
  "matale_first_dep_min_chilled": "02:55",
  "matale_first_dep_median_dry": "04:27",
  "matale_first_dep_median_chilled": "04:29"
 },
 "kasun": {
  "margin_before_912": 54,
  "margin_after_912": 17,
  "expected_first_stop_3_40": "04:48",
  "home_at_publish": "09:20",
  "home_after_finish": "09:05"
 }
}
```
