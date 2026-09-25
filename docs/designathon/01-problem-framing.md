# Problem Framing: Relay, Waypoint Delivery Planning (Team Ryzera)

> **DRAFT v0.1, for team review.** This is a starting point for discussion. The team makes the final prioritization and scope decisions, and the final text should be in our own words. Sources are booklet pages 3–7 and 9.

## 1. The problem in one paragraph

Waypoint's three brands share one fleet of 60 vehicles and two depots, and on most days that fleet cannot serve every order. The plan lives in one dispatcher's spreadsheet and memory. Instructions travel by phone calls and printed run sheets. Once vehicles leave, nobody has a shared view: problems surface only after a driver reaches an outlet. Deferrals leave no trace, so the same outlet can be skipped on consecutive runs. Store managers never get confirmation that an order was received, an arrival time, or notice that it was deferred. Field connectivity drops in the hill country, the Kandy corridor, and rural districts, so any digital fix has to keep working offline.

## 2. Our framing

Waypoint's core problem is not a lack of tools. **The information loop between roles is broken.** Every handoff (store to dispatcher, dispatcher to loader, loader to driver, driver back to store) happens by voice or on paper. Decisions therefore can't be checked, explained, or learned from.

Our system closes that loop with **one shared record per order, from placement to receipt**. Each role sees and updates that same record, through the device and in the conditions it actually works in:

`Placed → Confirmed → Queued → Allocated (vehicle + trip) or Deferred (reason) → Loaded or Short → Out for delivery → Delivered (POD) or Failed → Received or Issue reported`

## 3. Prioritization of the seven problems

Impact is our assessment. P1 means core: designed in full and built in the Hackathon. P2 means designed lightly and powered by the Datathon models.

| # | Problem (booklet p.4) | Who feels it | Impact | Priority | How we address it |
|---|---|---|---|---|---|
| 1 | Planning is fragmented: orders re-keyed into a spreadsheet, plan depends on one person | Dispatcher, Store Manager | High, every day across all 120 outlets | **P1** | One order queue with the 4 PM cutoff. A planning board that validates every constraint while the dispatcher allocates |
| 2 | Delivery progress is hard to track | Dispatcher, Store Manager | High | **P1** | Progress built from driver stop events (arrived, delivered, failed, delayed), each with a time and location stamp. No continuous live tracking |
| 3 | Deferrals lack a clear record | Dispatcher, Store Manager | High. Repeat skips cost Fresh its morning sales | **P1** | A deferral requires a reason. Outlets deferred on the previous run, or unserved for several days, are flagged and ranked higher. The store manager is notified with the new delivery date |
| 4 | No feedback loop: no proof of delivery, no way to flag a loading shortfall | Loader, Driver, Store Manager | High. Disputes rely on memory, and wrong loads are found at the outlet | **P1** | The loader checks the load in stop order and flags missing or damaged items before departure. The driver captures proof of delivery. The store manager confirms receipt or reports an issue |
| 5 | Demand is hard to anticipate | Dispatcher, management | Medium. It is a weekly and seasonal problem, not a daily one | P2 | One capacity-planning view comparing forecast demand (Datathon Task 2A) with fleet and refrigerated capacity for the coming weeks |
| 6 | Service time and lateness are not predicted | Dispatcher, Store Manager | Medium | P2 | A late-risk indicator on each planned stop, and a predicted arrival time for store managers (Datathon Task 1; a simple baseline until the model is ready) |
| 7 | Field connectivity is unreliable | Driver | High. Without it, everything above breaks in the field | **P1** (design constraint) | The driver app is offline-first. Records save on the phone, sync status is always visible, and records reconcile on reconnect |

## 4. Scope

### In scope

- **Store Manager:** place and confirm an order before the cutoff; see its status and expected arrival; receive a deferral notice with the reason and the new date; confirm receipt or report an issue.
- **Dispatcher:** a single order queue after the cutoff; an allocation board that checks weight and volume, refrigeration, `van_only` access, home depot, delivery and mall windows, the two-trips-per-day limit, and fuel quota; deferral with a reason; a live progress view; a capacity-planning view (P2).
- **Loader:** a loading list ordered for unloading (last stop loaded first); item check-off; shortfall and damage flags that reach the dispatcher before departure.
- **Driver:** a run sheet; stop-by-stop recording with proof of delivery (receiver name, photo or signature, time, and a location stamp); offline work with sync.

### Out of scope (deliberate restraint)

| Left out | Why |
|---|---|
| Turn-by-turn navigation | Drivers already use map apps, and navigation is not the bottleneck |
| Continuous live location tracking (phone-based, or GPS hardware fitted to vehicles) | Drivers use personal phones. Background tracking drains the battery and follows people outside work, and a web app can't track in the background anyway. Vehicle hardware is a purchase, not a software fix. Stop events with a location stamp give the dispatcher what they need |
| Fully automatic route optimization | We keep the dispatcher in control with assisted allocation plus validation. Explainable decisions matter more than a perfect optimum |
| Driver scheduling / HR | The booklet says driver availability is not a separate constraint |
| Billing, invoicing, inventory | Outside the delivery workflow |
| Voice ordering channel | A possible future extension; not in this release |

## 5. Design principles (from each role's working conditions)

1. **One order record, many views.** Every role reads and writes the same order lifecycle, and nothing is re-keyed.
2. **Constraints are checked, not remembered.** The system validates capacity, temperature, access, windows, and fuel while the dispatcher plans.
3. **Every deferral has a reason and a next step.** There are no silent skips, and outlets that were skipped before rise to the top.
4. **Designed for the device and the moment:**
   - Dispatcher: a dense large-screen view.
   - Loader: big touch targets and short tasks on a shared tablet.
   - Driver: glanceable one-thumb screens, used only when safely stopped.
   - Store Manager: a simple view that works on a desktop or a phone.
5. **Offline is a normal state.** The driver never loses work, and sync status is always visible.

## 6. Assumptions to state in the demo video

- Store managers have a smartphone or a desktop browser at the outlet.
- Drivers' personal phones have a camera, which we use for photo proof of delivery.
- Proof of delivery is the receiver's name plus a photo or signature, with a timestamp and a location stamp. The phone's GPS works without mobile data, so the stamp is saved offline and syncs later.
- The Peliyagoda office and both depots have stable connectivity; the field does not.
- The dispatcher plans the next day after the 4 PM cutoff; deliveries run Monday to Saturday.
- Each vehicle is loaded at its home depot.

## 7. What "better" looks like (success measures)

- No order is re-keyed from a phone call or message into a spreadsheet.
- Every deferral is recorded with a reason and reaches the store before the run.
- No outlet is deferred on two consecutive runs without an explicit dispatcher override.
- Loading shortfalls are flagged before departure, not discovered at the outlet.
- Every delivered stop has proof of delivery, and every receipt is confirmed or disputed by the store.

## 8. Open decisions for the team

1. **Allocation approach:** automatic, assisted, or manual with validation? Suggested: **assisted**, where the system proposes, the dispatcher adjusts, and the system validates.
2. **Degradation scenario to design in full:** candidates are driver offline in the Kandy corridor with sync conflicts on reconnect; demand exceeding capacity on a pre-festival day; a loading shortfall found at the dock; a refrigerated truck breaking down mid-route.
3. **Capacity-planning view (P2):** include one screen now, or leave it for later?
