# Problem Framing: Relay, Waypoint Delivery Planning (Team Ryzera)

> **v0.4 data alignment.** This framing now matches `05-scenario-data.md` v0.4 and story boards 02 to 05 and 14 as built.
> - The problem statement, the seven problems and the success measures quote Waypoint's own records ("Numbers for the story boards" in the scenario), each with the scope it was counted over (section 1).
> - Scope names the real clock beside the published standard, Planned and Expected times, and a store's receipt before the driver's proof arrives (section 4).
> - A sixth principle, "Planned and Expected, always named"; the deferral principle now separates what was unavoidable from what was Relay's choice (section 5).
> - Two new assumptions: chilled and Fresh dry never share a trip, and each depot keeps a standby until 8 AM. There is no rule that lets refrigerated runs take small dry orders (section 6).
> - After review: the Kandy hub's 31 deferred orders are scoped as counted (23 chilled, 8 dry), the fleet and outlet counts cite the vehicle and outlet lists, and the chilled and dry assumption carries both of its figures (section 1, sections 6 and 7).
> - A sixth success measure for Planned and Expected times (section 7), and the allocation decision now lists Relay's three deferral rules (section 8).
>
> The final text should be in the team's own words. Sources are booklet pages 3 to 7, 9 and 21, and the scenario for every data figure.

## 1. The problem in one paragraph

Waypoint's three brands, Fresh, Style and Tech, share one fleet of 60 vehicles (16 of them refrigerated), two depots and 120 outlets, and when demand runs past the fleet, orders wait. The plan lives in one dispatcher's spreadsheet and memory. Instructions travel by phone calls and printed run sheets. Once vehicles leave, nobody has a shared view: problems surface only after a driver reaches an outlet. Deferral decisions live in handwritten notes, so the same outlet can be skipped on consecutive runs. Store managers get no confirmation that an order was received, no arrival time, and no notice that it was deferred. Field connectivity drops in the hill country, the Kandy corridor and rural districts, so any digital fix has to keep working offline.

### What Waypoint's own records show

"Order history" is Waypoint's orders from 1 January 2024 to 28 March 2026. "Route history" is the route legs with actual times from 1 January 2024 to 14 February 2026, or to 28 March 2026 where the line says so. These are the figures the story boards quote; each keeps its scope.

| Figure | Scope | Board |
|---|---|---|
| 60 vehicles, 16 of them refrigerated, shared by three brands; 120 outlets served from two depots | The competition's vehicle and outlet lists (booklet page 7) | 02 |
| Peliyagoda deferred 1,602 orders on 295 days, all chilled; the Kandy hub deferred 31 orders on 6 days, 23 chilled and 8 dry | Order history | 02, 14 |
| 27.1% of 15,910 Kandy hub Fresh stops in monsoon months arrived after the store's window | Route history, actual arrivals | 02, 14 |
| All 6 Kandy hub deferral days fell in monsoon months; on 5 of them the orders that waited were chilled | Order history | 03 |
| Kandy's highest chilled week on record was 2025 week 15, the week before New Year, at 260.2 m³; 2026 weeks 1 to 13 averaged 189.0 m³ | Order history | 03 |
| Mawanella (OUT118) takes a median 44 minutes to unload in monsoon months, against the published 16 minute allowance for a Fresh curb stop | Route history | 03 |
| 98.9% of 616 first stops of Kegalle Fresh runs in monsoon months arrived after their planned time | Route history | 12 |
| 0 of 26,579 trips mix chilled and dry, and 0 of 21,532 delivered Kandy Fresh dry orders rode a refrigerated vehicle | Order history | 05 |
| 73.8% of 2,107 Kandy second Fresh trips were planned to leave before the first trip's last planned arrival | Route history to 28 March 2026 | 13 |
| VEH045 ran the Kegalle Fresh dry run on 94 of 115 Wednesdays | Route history to 28 March 2026 | 08 |

Relay's plan for 8 April expects 5 of its 53 Fresh stops after their window. That is an expected figure and the 27.1% is an actual one, so the two are never compared as like for like.

## 2. Our framing

Waypoint's core problem is not a lack of tools. **The information loop between roles is broken.** Every handoff (store to dispatcher, dispatcher to loader, loader to driver, driver back to store) happens by voice or on paper. Decisions therefore can't be checked, explained, or learned from.

Our system closes that loop with **one shared record per order, from placement to receipt**. Each role sees and updates that same record, through the device and in the conditions it actually works in. The stages, as board 02 draws them:

| Stage | Role | The other outcome |
|---|---|---|
| Placed, before the 4 PM cutoff | Store Manager | |
| Confirmed; the store sees it at once | Relay | |
| Queued, locked at the 4 PM cutoff | Dispatcher | |
| Allocated to a vehicle and trip | Dispatcher | Deferred, with a reason and a new date |
| Loaded, checked in stop order | Loader | Short, flagged before departure |
| Out for delivery, with Planned and Expected times from stop events | Driver | |
| Delivered, with proof of delivery | Driver | Failed, with a reason |
| Received, confirmed by the store, with the driver's proof | Store Manager | Issue reported, with a photo |

## 3. Prioritization of the seven problems

Impact is our assessment. P1 means core: designed in full and built in the Hackathon. P2 means designed lightly and powered by the Datathon models. The evidence column is what board 03 prints under the impact.

| # | Problem (booklet p.4) | Who feels it | Impact | Evidence from the data | Priority | How we address it |
|---|---|---|---|---|---|---|
| 1 | Planning is fragmented: orders re-keyed into a spreadsheet, plan depends on one person | Dispatcher, Store Manager | High, every day across all 120 outlets | | **P1** | One order queue with the 4 PM cutoff. A planning board that checks the published standard and a real clock while the dispatcher allocates |
| 2 | Delivery progress is hard to track | Dispatcher, Store Manager | High | | **P1** | Progress built from driver stop events (arrived, delivered, failed, delayed), each with a time and location stamp, and the time the phone last reached Relay. No continuous live tracking |
| 3 | Deferrals lack a clear record | Dispatcher, Store Manager | High. Repeat skips cost Fresh its morning sales | Kandy hub: all 6 deferral days fell in monsoon months, and chilled orders waited on 5 of them (order history) | **P1** | A deferral needs a reason, and Relay separates what was unavoidable from what was its choice. No store waits twice in a row without an override. The store hears the new date the evening before |
| 4 | No feedback loop: no proof of delivery, no way to flag a loading shortfall | Loader, Driver, Store Manager | High. Disputes rely on memory, and wrong loads are found at the outlet | | **P1** | The loader checks the load in stop order and flags missing or damaged items before departure. The driver captures proof of delivery. The store manager confirms receipt or reports an issue |
| 5 | Demand is hard to anticipate | Dispatcher, management | Medium. Seasonal, not daily | Kandy's highest chilled week on record: 260.2 m³, the week before New Year 2025. 2026 weeks 1 to 13 averaged 189.0 m³ (order history) | P2 | A capacity outlook for the next six weeks: forecast demand (Datathon Task 2A) and the refrigerated vehicles each week's busiest day needs |
| 6 | Service time and lateness are not predicted | Dispatcher, Store Manager | Medium | Mawanella takes a median 44 minutes to unload in monsoon months, against a published 16 minute curb allowance (route history) | P2 | Two named times on every stop: Planned, on the published standard, and Expected, from Relay's model of the hour, the road and each store's usual unloading time. The Datathon Task 1 model will replace the usual times |
| 7 | Field connectivity is unreliable | Driver | High. Without it, everything above breaks in the field | | **P1** (design constraint) | The driver app is offline-first. Records save on the phone, sync status is always visible, and records reconcile on reconnect |

## 4. Scope

### In scope

- **Store Manager:** place and confirm an order before the cutoff; see its status and expected time; receive a deferral notice with the reason and the new date; confirm receipt or report an issue, even before the driver's proof arrives.
- **Dispatcher:** a single order queue after the cutoff; a planning board that checks weight and volume, refrigeration, `van_only` access, home depot, one district and one brand per trip, two trips a day, Fresh minutes and fuel quota, plus store and mall windows on a real clock (a vehicle is in one place at a time, and a second trip leaves only after the first is back); deferral with a reason; a live progress view; a capacity outlook (P2).
- **Loader:** a loading list ordered for unloading (last stop loaded first) that follows every plan change; item check-off; shortfall and damage flags that reach the dispatcher before departure.
- **Driver:** a run sheet with Planned and Expected times; stop-by-stop recording with proof of delivery (receiver name, photo or signature, time, and a location stamp); offline work with sync.

### Out of scope (deliberate restraint)

| Left out | Why |
|---|---|
| Turn-by-turn navigation | Drivers already use map apps, and navigation is not the bottleneck |
| Continuous live location tracking (phone-based, or GPS hardware fitted to vehicles) | Drivers use personal phones. Background tracking drains the battery and follows people outside work, and a web app can't track in the background anyway. GPS hardware in vehicles is a purchase, not a software fix. Stop events with a location stamp, and a check-in once a minute with no location, give the dispatcher what they need |
| Fully automatic route optimization | We keep the dispatcher in control with assisted allocation plus validation. Explainable decisions matter more than a perfect optimum |
| Driver scheduling and HR | The booklet says driver availability is not a separate constraint |
| Billing, invoicing, inventory | Outside the delivery workflow |
| Voice ordering channel | A possible future extension; not in this release |

## 5. Design principles (from each role's working conditions)

1. **One order record, many views.** Every role reads and writes the same order lifecycle, and nothing is re-keyed.
2. **Constraints are checked, not remembered.** Relay checks the published standard and a real clock, where a vehicle is in one place at a time, while the dispatcher plans.
3. **Every deferral has a reason and a next step.** Relay says what was unavoidable and what was its choice, and no store waits twice in a row without an override.
4. **Planned and Expected, always named.** Planned is the published standard at free flow. Expected is Relay's model of the hour, the road and the store. Behind plan is normal; a missed window is the problem.
5. **Designed for the device and the moment:**
   - Dispatcher: a dense view across two large screens.
   - Loader: big touch targets and short tasks on a shared tablet.
   - Driver: glanceable, one thumb, used only when stopped.
   - Store Manager: a simple view on a desktop or a phone.
6. **Offline is a normal state.** The driver never loses work, sync status is always visible, and every other view says when it last heard from the driver.

## 6. Assumptions to state in the demo video

- Store managers have a smartphone or a desktop browser at the outlet.
- Drivers' personal phones have a camera, which we use for photo proof of delivery.
- Proof of delivery is the receiver's name plus a photo or signature, with a timestamp and a location stamp. The phone's GPS works without mobile data, so the stamp is saved offline and syncs later.
- The Peliyagoda office, both depots and the stores have stable connections; the roads do not. Driver phones do not join store Wi-Fi (Waypoint policy).
- Planning for both depots happens centrally at the Peliyagoda office.
- The dispatcher plans the next day after the 4 PM cutoff; deliveries run Monday to Saturday.
- Each vehicle is loaded at its home depot.
- Chilled rides only refrigerated vehicles and Fresh dry only ambient ones, and the two never share a trip: 0 of 26,579 trips in the order history mix them, and 0 of 21,532 delivered Kandy Fresh dry orders rode a refrigerated vehicle. The booklet allows refrigerated vehicles to carry ambient goods; Waypoint's practice does not, and Relay follows it.
- Each depot keeps one vehicle and driver free until 8 AM for problems: the standby. At the Kandy hub that is normally the refrigerated van VEH058; in the story week it is in the workshop, so the standby is VEH060.

## 7. What "better" looks like (success measures)

| Measure | Problem it closes | Where you see it | Starting point from the data |
|---|---|---|---|
| No order is re-keyed from a phone call or message into a spreadsheet | Planning is fragmented | STM-02, DSP-01 | |
| Every deferral names its reason and the rule that chose it, and reaches the store before the run | Deferrals lack a clear record | DSP-03, STM-03 | Peliyagoda deferred 1,602 chilled orders on 295 days, the Kandy hub 31 orders (23 chilled, 8 dry) on 6 days (order history) |
| No store waits on two consecutive runs without an explicit dispatcher override | Deferrals lack a clear record | DSP-01, DSP-03 | |
| Loading shortfalls are flagged before departure, not discovered at the outlet | No feedback loop | LDR-02, LDR-03 | |
| Every delivered stop has proof of delivery, and every receipt is confirmed or disputed by the store | No feedback loop; field connectivity is unreliable | DRV-03, STM-05 | |
| Every stop has a Planned and an Expected time, and a stop expected after its window is named before the plan goes out | Service time and lateness are not predicted | DSP-02, STM-04 | 27.1% of 15,910 Kandy hub Fresh stops in monsoon months arrived after the window (route history, actual arrivals). Relay's plan for 8 April expects 5 of 53 after their window: an expected figure, so not like for like |

## 8. Decisions

1. **Allocation approach: assisted.**
   - Relay proposes an allocation that satisfies every constraint of the published standard and its own clock.
   - When refrigerated or dry-box capacity runs short, Relay separates what is unavoidable (on 8 April, one chilled order has to wait: five refrigerated vehicles serve at most 22 of 23 stores on a real clock) from what is its choice (which one waits), and chooses by three rules, in order: keep every other vehicle on its usual run; never make a store wait twice in a row without an override; keep the most goods moving.
   - The dispatcher can adjust the proposal, and every change is re-validated. Each deferral carries a reason, and Relay checks that the next run can carry the order before it confirms.
2. **Degradation scenario, fully designed: "Signal Lost on the Kandy Corridor."**
   - On Wednesday 8 April 2026 an inter-monsoon thunderstorm takes Kasun's mobile network down from 5:41 to 7:14 AM, 93 minutes, during the Kegalle Fresh dry run. Stop records wait on the phone and sync when the signal returns.
   - The dispatcher sees "No contact from Kasun since 5:41 AM" with estimates, moves stop 4 (Aranayake) to the standby VEH060 at 6:15, and keeps the backup after the store's receipt at 6:42. On reconnect Relay asks Kasun one question and settles the clash with his proof.
   - Why it matters: the brief names these coverage drops explicitly. The driver is the only role working away from stable connectivity, and a lost record means no proof of delivery and a blind dispatcher.
3. **Capacity-planning view: included** as one light Dispatcher screen. It covers the "Plan future capacity" workflow stage (p.7).
4. **Language: Sinhala, Tamil, or English** on the Driver and Loader screens only, for the two field roles. The Dispatcher and Store Manager screens stay in English.
