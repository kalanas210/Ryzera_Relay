# Screens and Flows: Relay (Team Ryzera)

> **v0.4 data alignment.** The screen inventory, flows and per-screen rationale now follow `05-scenario-data.md` v0.4, which is built on the competition data. What changed from the v0.1 draft:
> - **Dates:** planning is Tuesday 7 April 2026 and delivery Wednesday 8 April 2026, the week before the Sinhala and Tamil New Year holidays. The next run is Thursday 9 April.
> - **People and vehicles:** Dilani runs OUT117 Waypoint Fresh Hemmathagama (Kegalle district). Kasun drives VEH045, an ambient (dry-box) truck, on the Kegalle Fresh dry run: 4 stops, Dilani is stop 3. Two refrigerated vehicles are in the workshop (VEH039 and VEH058), and the Kandy hub's standby this week is VEH060, Nimal's ambient van.
> - **The deferral:** one **chilled** order waits (Dilani's ORD0098596), chosen by three numbered rules, not "dry before chilled". Her dry order ORD0098595 rides Kasun's run.
> - **The shortfall:** 6 rice and dhal cases are missing for stop 3. They are added to Dilani's own Thursday dry order ORD0098747, marked "from Wednesday".
> - **The silence:** Kasun's last contact is at 5:41 AM, during stop 2 at Mawanella, when a thunderstorm takes his mobile network down until 7:14 AM. Nuwan moves stop 4, Aranayake, to VEH060 at 6:15. Kasun finishes his trip at Aranayake's dock at 7:17 AM.
> - **Frames:** DRV-02 Stop / Behind plan (4:52 AM) replaces DRV-02 Stop / Early. New states: DEG-03 / receipt in (6:42 AM), STM-05 / before driver proof (6:42 AM) and STM-01 / moved earlier (9:12 PM). Renamed: DEG-03 / move stop 5 and / stop 5 moved become / move stop 4 and / stop 4 moved; DRV-02 Stop / Stop 4 offline becomes / Stop 3 offline; DRV-02 Stop / Early / Night becomes / Behind plan / Night. Dropped: STM-01 / delivered, because Dilani now confirms receipt from the arrival tracker at 6:42 AM, so STM-05 / confirmed moves to 6:42 AM.
> - **Review fixes:** DEG-04 is renamed **DEG-04 Arrival tracker during the silence** (store screens make no low-signal claim) and shows STM-04's Planned time. Stop 3's proof is the receiver's name, a photo and a location stamp (no signature; stop 2 was signed). The Driver flow now passes DRV-02 Stop / Behind plan at 4:52 AM between the handover and 5:20. The protected store's flag on DSP-01 is **Waited Monday**.
> - **Every role shows two named times:** *Planned* (the organizers' published standard at free flow) and *Expected* (Relay's model). Driver and store screens round Expected to 5 minutes; the dispatcher sees it to the minute.
>
> Every ID, count, time and weight below is copied from the scenario. Change a number there first, run `tools/data-check/validate_scenario.py`, then change it here.

## How we sized the design

Four rules kept the set small:

1. Every screen maps to a stage in the booklet's workflow (p.7).
2. Every screen has one job.
3. We only designed a separate screen when a role's device or moment changes. Otherwise it is a state of an existing screen.
4. We designed the states people actually hit on the story's day: a cutoff passing, a plan changing at 9:12 PM, a line short at the dock, a run behind plan, a phone out of contact, a clash on sync. We did not design every edge case.

The result is 24 screens: 5 for the dispatcher, 4 for the loader, 5 for the driver, 5 for the store manager, and 5 for the degradation scenario. Each has its states, listed with the time of day they show.

| Role | Device we design for | Frame size |
|---|---|---|
| Dispatcher | Two large monitors in the Peliyagoda office, and his phone on Fresh nights | Desktop 1440 × 900, plus one phone frame |
| Loader | Shared tablet at the Kandy hub dock. Judges review it on a phone, so it is phone-first and stretches to the tablet | Phone 390 × 844, plus one tablet frame |
| Driver | His own Android phone, used only when stopped | Phone 390 × 844 |
| Store Manager | Phone on the shop floor, desktop in the back office | Phone 390 × 844, plus one desktop frame |

---

## The end-to-end flow

These are the seven stages from the booklet. Each stage points to the screen that carries it.

| Stage | Role | Screen | What crosses to the next role |
|---|---|---|---|
| Place order | Store Manager | STM-02 Place order | The order appears in the dispatcher's queue, and the store sees "Received by Waypoint" |
| Close orders | Dispatcher | DSP-01 Order queue | At 4:00 PM the queue locks. Late orders move to the next run by themselves, and the store is told |
| Plan and allocate | Dispatcher | DSP-02 Plan board, DSP-03 Deferrals | Publishing the plan updates loading lists, drivers' run sheets, and each store's status and expected time |
| Load | Loader | LDR-02 Load vehicle, LDR-03 Flag a shortfall | A shortfall reaches the dispatcher before departure. The handover tells the driver the load is ready |
| Deliver | Driver | DRV-02 Stop, DRV-03 Proof of delivery | Each stop event updates the dispatcher's live view and the store's expected time |
| Confirm receipt | Store Manager | STM-05 Confirm receipt | A dispute reaches the dispatcher with the driver's proof attached |
| Plan future capacity | Dispatcher | DSP-05 Capacity outlook | Days where the refrigerated fleet runs out are visible weeks ahead |

---

## Dispatcher (Nuwan) · desktop, and his phone at night

### DSP-01 Order queue
Every order for Wednesday in one list, as it arrives. Rows show order ID, outlet, brand, depot, type, size in kg and m³, and the delivery window. Flags sit on the row without being loud: **Chilled**, **Van only** (OUT081 Waypoint Fresh Hantana), **Waited Monday** (OUT119 Waypoint Fresh Kegalle, a store whose last chilled order waited a day), and a plain note on orders that need a large truck (OUT120 Waypoint Style Kegalle, light and bulky; OUT115 Waypoint Tech Passara, heavy). At 3:12 PM on Tuesday, 125 orders are in (74 Fresh dry, 46 Fresh chilled, 3 Style, 2 Tech; Peliyagoda 73, Kandy hub 52), and 6 Fresh outlets haven't ordered yet, so Nuwan chases them before 4:00 PM instead of finding the gaps at 5 PM.

**Rationale.** This screen replaces the retyping that fills Nuwan's afternoon today. The priority is completeness: he needs to trust that nothing is sitting in a chat or a missed call. The flags are the facts he used to carry in his head, and putting them on the row is what makes the plan transferable to another dispatcher. The cutoff is a rule the system keeps, so a late order is moved and its store told without anyone arguing about it.

**States:** DSP-01 Order queue (Tue 3:12 PM, before the cutoff, with the stores still to order) · / after cutoff (4:02 PM: locked at 136 orders, 79 Fresh dry, 50 Fresh chilled, 4 Style, 3 Tech; Peliyagoda 79, Kandy hub 57. OUT032 Waypoint Fresh Kadawatha's dry order at 4:01 PM, ORD0098496, and chilled order at 4:02 PM, ORD0098497, moved to Thursday's run).

### DSP-02 Plan board
The core of the product. Orders sit on the left, vehicles with their two trip slots in the middle, and the selected trip's detail on the right. **Propose plan** fills the trips with an allocation that keeps the organizers' published trip-time standard (270 Fresh minutes and 480 daytime minutes per vehicle, two trips, one district and one brand per trip, weight and volume, van-only stores on vans) and a real clock (every planned arrival inside its window, first trips from 2:00 AM, a second trip at least 10 minutes after the first is back at the hub). Each trip card carries meters for weight, volume, Fresh time and the vehicle's weekly fuel. At 4:35 PM the board is filtered to the refrigerated vehicles at the Kandy hub ("Refrigerated: 5 running, 2 in the workshop") with the banner "Kandy hub: 57 orders, 56 on 18 trips, 1 waits". The right panel shows VEH057 trip 2: Fresh chilled to Kegalle, OUT116 Aranayake planned 7:05 and OUT119 Kegalle planned 7:33, 801.6 of 1,040 kg and 4.212 of 7.0 m³, back at 8:41. **Publish plan** sends everything downstream.

**Rationale.** We chose assisted planning over full automation because Nuwan is accountable for the result and knows things the data doesn't. Relay does the arithmetic he does from memory today: two capacity limits, temperature, access, windows, two trips a day and fuel. He keeps the judgment calls. He can drag any order anywhere and Relay never blocks the move; it names the rule the move breaks, in plain words, with undo beside it. Meters instead of error lists let him see how close a trip is to full before he breaks it.

**States:** DSP-02 Plan board (Tue 4:35 PM, Relay's proposal) · / dragging (4:35 PM: Nuwan drags Dilani's chilled order ORD0098596 onto VEH057 trip 2) · / broken rule (4:35 PM: the trip would carry 1,460.8 kg against the van's 1,040 kg and 7.676 m³ against 7.0 m³, and its third stop would arrive at 8:01, after every Kegalle window; he undoes it) · / publish check (6:39 PM: no planned arrival is after its window; Relay expects 5 of the 53 Fresh stops after their window and says, for each one, "Why Relay keeps it") · DSP-02 Publish dialog (6:39 PM) · / published (6:40 PM: straight after Publish plan the plan bar turns to the done tone, "Published 6:40 PM", with "Sent to the dock, the drivers of all 12 vehicles and every store on these trips."; the Deferred column says Hemmathagama was told at 6:40 PM).

### DSP-03 Deferrals (drawer on the plan board)
The drawer opens when the plan cannot carry everything. At 4:50 PM it says 1 chilled order waits: ORD0098596, OUT117 Waypoint Fresh Hemmathagama, 659.2 kg and 3.464 m³, because refrigerated capacity is short with VEH039 and VEH058 in the workshop. It separates what was unavoidable from what was Relay's choice. **Unavoidable:** on a clock where a vehicle is in one place at a time, the five refrigerated vehicles left serve at most 22 of Wednesday's 23 chilled orders. **Relay's choice,** by three numbered rules: 1 keep every other vehicle on its usual run, 2 never make a store wait twice in a row without an override, 3 keep the most goods moving. OUT119 Waypoint Fresh Kegalle is protected, because its Monday chilled order waited a day. The drawer also shows the pool (15 of the 23 orders could have been the one to wait), the cost (Hemmathagama's chilled shelf goes from its Saturday 4 April delivery to Thursday 9 April), the paper alternative (VEH040 cannot take Dilani's order even on paper: 239 + 68 = 307 of 270 minutes), and the next-run check (VEH039 is back on Thursday, and its Kegalle trip carries her order with Thursday's Kegalle chilled orders, every planned arrival inside its window). Every deferral needs a reason before the plan can be published, and a preview shows the exact notice the store will read.

**Rationale.** The booklet asks the dispatcher to decide what to defer and to explain the consequences. Today that decision is silent and leaves no trace. The drawer makes it a recorded one Nuwan can defend the next morning: it is honest that only "one chilled order waits" was forced, shows which order Relay picked and by which rule, and what the pick costs. The store hears about it the evening before, not at 8 AM when the truck doesn't come.

**States:** DSP-03 Deferrals (Tue 4:50 PM) · / override (4:51 PM: Nuwan opens the override on OUT119 and cancels it; if he overrode, OUT119's order would wait for the second time in a row and Dilani's would ride VEH057 with OUT116, 994.4 kg) · / ready (4:52 PM: deferral confirmed, the Kandy plan is ready).

### DSP-04 Live runs
After departure this screen shows every vehicle as a row of stops, each marked delivered, arrived, next, at risk or failed, built from the drivers' stop records. Each row shows **Last synced**, the last time the driver's phone reached Relay, so silence reads as a fact with a time, not as progress or as trouble. On the right, one feed collects shortfalls flagged at the dock, delays reported by drivers, failed stops and receipt disputes, each with what changed and who was told. At 5:20 AM on Wednesday, 18 of 53 Fresh stops are delivered, Kasun is on the way to stop 2 with everything synced, and Sampath's report from 4:28 AM (VEH042, "Delayed, 45 min" at Palapathwela on the Matale road) is already marked handled at 4:35.

**Rationale.** Once the trucks leave, Nuwan is blind today until a store rings. We build progress from stop events rather than live GPS: it respects drivers' personal phones, and it still works when the signal drops. The same feed reaches his phone at home on Fresh nights, so the dock gets a decision before a truck leaves.

**States:** DSP-04 Live runs / shortfall decision (phone, Wed 2:48 AM: Rizwan's flag, 6 rice and dhal cases missing for VEH045 stop 3; at 2:52 Nuwan taps "Send short, add to Thursday") · DSP-04 Live runs (5:20 AM).

### DSP-05 Capacity outlook
Six weeks ahead at the Kandy hub (ISO weeks 15 to 20, 6 April to 17 May 2026), seen on Tuesday at 6:45 PM. For each week it sets forecast demand against what the fleet can carry, with refrigerated vehicles on their own row, and marks the New Year and Vesak holidays and the paydays from the calendar. The headline: "Wednesday 29 April is the heaviest of the 5 Wednesdays ahead, and like each of them it needs 6 of the 7 refrigerated vehicles. The seventh is the standby and nothing is spare: keep all 7 in service that day." Key figures "6 of 7" and "22 of 23", and an arrange card: book refrigerated servicing away from Wednesdays, keep all 7 in service on Wednesday 29 April, tell stores early when a refrigerated vehicle is out.

**Rationale.** This is the booklet's "Plan future capacity" stage, and deliberately one light screen: the forecasting belongs to the Datathon. It answers one question, will the Kandy hub have enough refrigerated vehicles, and it answers in vehicles, not cubic metres, because the data shows the limit is the number of stores and their windows before 8 AM, not space. Wednesday 8 April is the warning: two vehicles out on the week's busiest chilled day meant a chilled order waited.

---

## Loader (Rizwan) · phone first, shared dock tablet

### LDR-01 Tonight's loads
A fast sign-in on the shared tablet: pick your name, enter a 4-digit PIN. Below it, tonight's loads at the Kandy hub by departure: already left, ready, loading, later, and the three second trips picked before each vehicle is back. At 2:40 AM, VEH045 is loading, 86 of 383 cases, and VEH057 is at 40 of 118. When the plan changed after the list was sent, a banner says what changed and when: "Plan changed 9:12 PM: VEH045 stops 3 and 4 swapped. Aranayake now loads first (done)."

**Rationale.** A shared device at a busy dock needs a fast switch between people, not accounts and passwords, and each loader's language comes back when they sign in. The change banner answers the biggest failure of printed lists: nobody tells the dock when the plan moves at 9 PM.

**States:** LDR-01 Tonight's loads / PIN switch (Wed 2:40 AM: Anjali signed in at 2:36 to mark VEH042 complete; Rizwan switches back with his PIN) · LDR-01 Tonight's loads (2:40 AM).

### LDR-02 Load vehicle
One vehicle and trip, VEH045 trip 1, with its lines grouped by stop **in reverse order**: stop 4 Aranayake goes in first, at the cab end, and stop 1 Kegalle last, by the doors. Within a stop the heaviest case type goes first: rice and dhal, then packet foods, then tea and biscuit. Each line is a large tap target that works with gloves, and a progress bar shows how much of the load is on. If the plan changes mid-load, only the affected lines are marked.

**Rationale.** Loading order is unloading order backwards, and the printed list doesn't show stops at all. Big targets, high contrast and almost no typing reflect the real dock: gloves, noise, poor light, and a 3:40 AM departure.

**States:** LDR-02 Load vehicle (Wed 2:47 AM: stop 4 loaded, 86 cases; stop 3's rice and dhal line has 30 of 36 on the shelf) · / Language · / Tamil (the same moment in Tamil; place names stay in Latin letters to match the case labels) · / flag sent (2:48 AM: 30 on, the line waits for Nuwan while loading goes on) · / answer in (2:52 AM: Nuwan's answer arrives in the bottom bar) · / all checked (3:30 AM: every line loaded or decided, 377 cases) · / tablet (the dock tablet layout, with a load map of the truck body).

### LDR-03 Flag a shortfall (sheet)
From any line, flag it **Missing** or **Damaged**, set the count and optionally add a photo. The flag reaches the dispatcher at once. The decision comes back to the same sheet.

**Rationale.** The booklet's feedback problem is about finding shortfalls before departure, not at the outlet. Two taps and a number is the most the dock will do under pressure. Closing the loop on the same sheet means the loader never chases anyone.

**States:** LDR-03 Flag a shortfall (Wed 2:47 AM: 6 rice and dhal cases missing for stop 3, ORD0098595) · / decision (2:52 AM: send short, the 6 cases are added to Dilani's Thursday dry order ORD0098747, and she has been told).

### LDR-04 Handover
Planned against loaded, stop by stop, the shortfall and its decision, and one **Load complete** action. The driver sees the handover on his phone and accepts the load.

**Rationale.** A handover both sides confirm replaces "I told him at the gate". It is also the record that settles later disputes about what left the depot.

**States:** LDR-04 Handover / ready (Wed 3:31 AM: 377 of 383 cases, stop 3 short 6) · / waiting for driver (3:32 AM) · LDR-04 Handover (3:32 AM: Kasun accepted the load).

---

## Driver (Kasun) · phone, used when stopped

### DRV-01 Today's run
The run in order, VEH045 trip 1, Fresh dry, Kegalle district, 4 stops: 1 OUT119 Kegalle, 2 OUT118 Mawanella (curb), 3 OUT117 Hemmathagama, 4 OUT116 Aranayake. Each stop shows its window and access, and the next stop is the biggest thing on the screen. The run sheet says in one line why it goes to Kegalle town first, past Mawanella: Kegalle is this week's protected store, and Mawanella is the slowest stop to unload. The sync pill at the top is always visible: *All synced*, or a count of stops still to send.

**Rationale.** This replaces the paper run sheet. Kasun looks at it only when he has pulled over, often for a few seconds. So the screen gives him one clear next action, readable at arm's length, and a sync state he never has to wonder about. Naming the reason for an odd stop order means he is not surprised by it at 4 AM.

**States:** DRV-01 Today's run / Accept load (Wed 3:32 AM at the dock: 377 of 383 cases, stop 3 short 6, Accept load, which leads on to DRV-02 Stop / Behind plan at 4:52 AM in the Driver flow) · DRV-01 Today's run (5:20 AM: stop 1 delivered, on the way to stop 2, all synced) · / Language · / Sinhala (the same moment in Sinhala; place names in Sinhala script, because drivers match road signs).

### DRV-02 Stop
The store, its window and access, what to drop off, and one large **Arrived** button. Arrival takes a location stamp. The screen shows Planned and Expected side by side, and reads "behind plan" in neutral tones: behind plan is normal in monsoon months, and only a stop that will miss its window is a problem.

**Rationale.** One screen per stop keeps his attention on one store. The location stamp is taken at this moment only, which gives the dispatcher and the store a reliable arrival record without tracking him all day. In the route history, 98.9% of first Kegalle stops in monsoon months arrived after their planned time, so a warning color for "behind plan" would cry wolf at every stop.

**States:** DRV-02 Stop / Behind plan (Wed 4:52 AM at Kegalle: "Arrived 4:52 AM. 19 min behind plan", with "Expected around 4:50" beside it; he left 4 minutes late and arrived on Relay's time; in the Driver flow, "Record delivery" goes on to DRV-01 at 5:20) · / Behind plan / Night (the same moment in the Night colors, before first light, a reference state) · DRV-02 Stop (5:30 AM at Mawanella, a curb stop, before Arrived) · / Arrived (5:30 AM, arrival sent) · / Stop 3 offline (6:21 AM at Hemmathagama, out of contact, arrival saved on the phone).

### DRV-03 Proof of delivery
Confirm what was dropped: **All delivered**, or change a line. Then the receiver's name and a photo or a signature. **Complete stop** saves it on the phone first, so the stop is done whether or not there is signal. At 6:36 AM at Hemmathagama: 30 rice and dhal, 44 packet foods and 22 tea and biscuit cases, received by W. Rathnayake, with a photo of the 96 cases at the rear dock.

**Rationale.** Proof of delivery ends "my word against theirs". Saving to the phone first is the principle that makes the whole driver app work in the hills. Photos are compressed because Kasun pays for his own data.

**States:** DRV-03 Proof of delivery / Before proof · DRV-03 Proof of delivery (Wed 6:36 AM, filled in, out of contact) · / Change a line · / Signature · / Saved (6:36 AM: stop 3 saved on the phone, 2 stops to send).

### DRV-04 Report a problem
Six large reasons: delayed, outlet closed, access blocked, goods refused, damaged in transit, vehicle problem, with an optional note. The report reaches the dispatcher, and a delay updates the store's expected time.

**Rationale.** Today a delay means a phone call while driving. A two-tap report, made when stopped, reaches the dispatcher faster and leaves a record, and it moves the store's expected time so the store manager doesn't have to call either.

**States:** DRV-04 Report a problem (Wed 5:20 AM) · / Delayed (a prototype branch with "20 min" picked as an example; not sent in the story).

### DRV-05 Trip summary
Delivered, failed and pending stops, plus anything still waiting to send, at the end of the trip or before a second trip.

**Rationale.** It gives the driver a clean close and gives the depot a check that nothing is left unsent before the vehicle reloads.

**States:** DRV-05 Trip summary / Still waiting (Wed 7:10 AM at Aranayake's dock: all 4 stops done, 3 stops still to send) · DRV-05 Trip summary (7:17 AM: everything sent, stop 4 settled) · / Finished (7:17 AM: Kasun taps Finish trip at the dock; Relay expects him at the hub around 9:05).

**Story cards (prototype only):** DRV-S1 Signal drops (5:41 AM) · DRV-S2 Last stop offline (6:56 to 7:09 AM).

---

## Store Manager (Dilani) · phone, plus desktop

### STM-01 My orders
Tomorrow's orders with plain status words: *Received by Waypoint*, *Expected around 7:15 AM*, *On the way*, *Delivered*, or *Moved to Thursday*. Before 4:00 PM a cutoff line with a countdown sits at the top. Dry and chilled orders for the same morning are two cards, because they ride different vehicles: in the data, chilled and dry never share a trip.

**Rationale.** Dilani's core worry is not knowing. The screen leads with the answer to "is it coming, and when?" Two cards reflect how Fresh actually orders, and prevent the false comfort of one green tick when half of her delivery has been moved.

**States:** STM-01 My orders / before cutoff (Tue 2:14 PM: both orders received) · STM-01 My orders (7:30 PM: dry expected around 7:15 AM, chilled moved to Thursday) · / moved earlier (9:12 PM: her dry order is now expected around 6:35 AM) · / on the way (Wed 5:20 AM: the dry order around 6:35 AM) · / receipt confirmed (7:22 AM: she confirmed at 6:42 AM, and Kasun's proof arrived at 7:14).

### STM-02 Place order
Choose **Dry** or **Chilled**, then enter quantities of standard case types: rice and dhal, packet foods, tea and biscuit (dry); dairy crates, produce crates, meat and fish boxes (chilled). Weight and volume are worked out for her. Sending before 4:00 PM confirms the order at once. After 4:00 PM the screen says plainly which run it will go on. A desktop version exists for the back office.

**Rationale.** Standard case types give the planner real weight and volume without asking a store manager to estimate cubic metres. The instant confirmation is the one thing she has never had. Honest cutoff behavior avoids the worst outcome: an order she thinks is coming that isn't.

**States:** STM-02 Place order (Tue 2:10 PM: the chilled order, 40 dairy crates, 32 produce crates, 20 meat and fish boxes; 92 cases, 659.2 kg, 3.464 m³) · / received (2:10 PM, ORD0098596) · / desktop (the same order from the back office) · / dry (2:14 PM: 36 rice and dhal, 44 packet foods, 22 tea and biscuit cases; 102 cases, 685.6 kg, 3.772 m³) · / not sent (a branch: the order could not be sent and her counts are kept) · / after cutoff (7:30 PM: a new order now goes on Thursday's run).

### STM-03 Deferral notice
If an order is moved, she hears the evening before, with the new date and window and the reason in plain language. At 6:41 PM: her chilled order moves to Thursday 9 April, 4:00 to 7:45 AM, because two refrigerated vehicles are in the workshop this week and the one refrigerated van that can still go to her area this morning has no room for her order. Her dry order still comes on Wednesday, expected around 7:15 AM. She acknowledges with one tap.

**Rationale.** The booklet asks for clear notice when an order is deferred. Knowing the evening before lets her roster staff and plan the chilled shelf. The reason matters: it turns a broken promise into a decision she can understand.

**States:** STM-03 Deferral notice (Tue 6:41 PM) · / acknowledged ("Got it", seen 6:41 PM) · / short delivery (Wed 5:05 AM, sent at 2:52 AM and held in quiet hours: "6 rice and dhal cases are short in today's dry order. We have added them to your Thursday dry order (ORD0098747), marked from Wednesday.").

### STM-04 Arrival tracker
Where her delivery is, in human terms: how many stops before hers and when it is expected, with the driver's name and the last time Relay heard from his phone. When his phone goes quiet it shows an estimate and a likely range instead of going silent, and once the estimate passes it says so and offers to confirm receipt from the store.

**Rationale.** She needs an expected time to have someone at the rear dock. Honest uncertainty is better than a confident wrong time, and a store that already has its goods should not have to wait for the driver's phone to say so.

**States:** STM-04 Arrival tracker (Wed 5:20 AM: 1 stop before you, around 6:35 AM) · / past estimate (6:40 AM: "The estimate has passed (around 6:35 AM). No word from Kasun since 5:41 AM." with "Goods already at your store? Confirm receipt").

### STM-05 Confirm receipt
The line check first, then the driver's proof of delivery (photo, receiver, time, location) with **Everything arrived**, or flag a line as missing, damaged or not cold on arrival, with a photo. A store can report a problem until 4:00 PM on the delivery day. A dispute goes to the dispatcher with both sides' evidence.

**Rationale.** Confirming receipt closes the loop the booklet asks for. Pairing the driver's proof with her own record means disputes are settled on evidence, not memory. Letting the store confirm before the driver's proof arrives keeps the record true when the driver's phone is the thing that failed.

**States:** STM-05 Confirm receipt / before driver proof (Wed 6:42 AM: from the past estimate, she checks the 96 cases at her dock before Kasun's record arrives) · / confirmed (6:42 AM: "Everything arrived"; "Driver's proof: waiting for Kasun's phone") · STM-05 Confirm receipt (7:22 AM: Kasun's proof attached, the 6:36 photo, W. Rathnayake's name and a location stamp) · / flag a line, / issue added, / sent with issue (a branch at 7:22 AM: 1 packet foods case marked damaged).

---

## Degradation scenario · "Signal Lost on the Kandy Corridor"

**Why it matters to Waypoint.** Kandy hub drivers deliver Fresh orders through hill country where the booklet says coverage drops, in the hours before stores close their windows at 7:30 to 8:00 AM. In the story an inter-monsoon thunderstorm takes Kasun's mobile network down from 5:41 to 7:14 AM, 93 minutes, around Mawanella and the hill roads to Hemmathagama and Aranayake. If the driver's records depend on a live connection, three things fail at once: deliveries go unrecorded, the dispatcher loses sight of the run, and stores lose their expected time exactly when they roster staff. Proof of delivery goes missing too, and the disputes Relay was built to prevent come straight back.

A **Degradation / Scenario card** opens the section: the storm, the times, and what each role sees.

### DEG-01 Working offline (driver)
DRV-01 at 6:05 AM. The run carries on normally. A calm gray notice says the phone is out of contact and every stop saves on the phone and sends by itself later. Stop 2, delivered at 5:59 on the phone, carries a *waiting to send* mark, and the sync pill reads "1 stop to send". Nothing is blocked and nothing asks for a retry.

### DEG-02 Back in coverage (driver)
At 7:14 AM, still at Aranayake's dock, the signal returns and the phone sends its 7 waiting records by itself. The plan changed while he was out of contact, so he sees one clear question: Nuwan moved stop 4 to VEH060 at 6:15 AM, and Kasun recorded Arrived at 6:56 and delivered at 7:09 there. Is his record right? The answers are **Yes, I delivered it** and **No, something is wrong**. His answer, original timestamps and location stamps go to the dispatcher. The phone holds the question while it senses the truck moving.

**States:** DEG-02 Back in coverage / sending (7:14 AM: "Sending 3 stops") · DEG-02 Back in coverage (7:14 AM) · / answered yes (7:15 AM: VEH060's copy is cancelled) · / Sinhala (the same question in Sinhala).

### DEG-03 Live runs during the silence (dispatcher)
DSP-04 at 6:05 AM. Kasun's row reads "No contact from Kasun since 5:41 AM" and "Last record: stop 2, arrived 5:30 AM. Times after that are estimates." Relay cannot tell a lost signal from a flat battery, so it names neither. Stops 3 and 4 are drawn dashed with an estimate and a range: stop 3 around 6:35 AM (6:05 to 7:05), stop 4 around 7:15 AM (6:45 to 7:45), which already runs past Aranayake's 7:30 close.

**States:** DEG-03 Live runs during the silence (6:05 AM) · / move stop 4 (6:15 AM: after 34 minutes of silence, the drawer puts VEH060, Nimal's ambient van and this week's standby, beside Kasun's own estimate. VEH060 is expected at Aranayake around 8:05 AM, after its close, and the drawer says why it is still worth sending: if Kasun is stuck, Aranayake gets no dry goods until Thursday. It shows weight 572.0 of 1,200 kg, volume 3.168 of 9.0 m³, fuel 0.0 of 520 L this week and Fresh time 68 of 270 minutes, and marks VEH057 not suitable) · / stop 4 moved (6:15 AM: Nimal, the dock and OUT116 are told; Kasun's copy waits for his phone) · / receipt in (6:42 AM: "Hemmathagama confirmed receipt 6:42 AM. Kasun has delivered there. Aranayake now around 7:05 AM, likely 6:45 to 7:55 AM. VEH060 is on its way." with **Keep backup** and **Cancel backup**; at 6:44 Nuwan keeps it, because Kasun is still out of contact on the hill road).

### DEG-04 Arrival tracker during the silence (store manager)
STM-04 at 6:05 AM: "Arriving around 6:35 AM", "Your window is 4:00 to 7:45 AM", "Planned 5:30 AM", "Likely between 6:05 and 7:05 AM", and "Kasun's phone last reached us at 5:41 AM, after he arrived at Mawanella. Hill roads often lose signal, so these times are our estimate." Dilani's phone uses the store's Wi-Fi and stays connected; driver phones do not join store Wi-Fi.

### DEG-05 Conflict resolved (dispatcher)
DSP-04 at 7:16 AM. Kasun's 7 records have arrived with their original times and location stamps. His answer settled the clash over stop 4, VEH060's copy was cancelled at 7:15, and Nimal, the dock and the store were told ("Delivered 7:09 AM, proof attached. The backup is cancelled."). Nimal turns back 39 minutes out.

**States:** DEG-05 Conflict resolved / waiting for answer (7:14 AM) · DEG-05 Conflict resolved (7:16 AM).

**The same moment on other screens (6:05 AM):**
- **DSP-04 Live runs:** "No contact from Kasun since 5:41 AM. Last record: stop 2, arrived 5:30 AM."
- **STM-04 Arrival tracker:** "Arriving around 6:35 AM. Likely between 6:05 and 7:05 AM."
- **Kasun's phone:** carries on, with "1 stop to send".

**Rationale.** Offline is treated as normal, not as an error. The driver's job never stops because of the network, and sending is automatic. The only question we ask him is the one Relay can't answer alone. The estimate follows one stated rule and moves only when a stop event arrives, and a store's confirmed receipt counts as one, so Hemmathagama's receipt at 6:42 tightens Aranayake's estimate for Nuwan. Each role gets an honest picture of the same event, which is what separates graceful degradation from a spinner.

---

## Handoffs we show in the prototype

1. **Order to plan.** Dilani places her chilled order at 2:10 PM and her dry order at 2:14 PM on Tuesday. Both appear in Nuwan's queue, and she sees "Received by Waypoint".
2. **Plan to dock and store.** Nuwan publishes the Kandy plan at 6:40 PM. Rizwan's list, Kasun's run sheet and Dilani's order statuses update.
3. **Deferral to store.** With VEH039 and VEH058 in the workshop, one chilled order has to wait. Relay's rules pick Dilani's ORD0098596, which moves to Thursday 9 April. She reads why at 6:41 PM, and her dry order still comes on Wednesday.
4. **Plan change to dock and store.** At 9:12 PM Nuwan swaps stops 3 and 4 on VEH045, and Relay shows him the cost first: Aranayake's margin before its 7:30 close drops from 54 to 17 minutes. The dock's list shows the change, and Dilani is told her dry order is now expected around 6:35 AM.
5. **Dock to dispatcher to store.** At 2:47 AM Rizwan flags 6 rice and dhal cases missing for stop 3. Nuwan decides at 2:52 AM on his phone: send short, add them to Thursday's order ORD0098747. Dilani is told, and Kasun's stop 3 shows 96 cases.
6. **Road to dispatcher.** Kasun goes out of contact at 5:41 AM. Nuwan sees the silence with a time on it, moves stop 4 to the standby at 6:15, and keeps the backup at 6:44 after Dilani's receipt.
7. **Store to dispatcher, and road back.** Dilani confirms receipt from the store at 6:42 AM. At 7:14 Kasun's phone reconnects, his records and proof arrive, he answers one question at 7:15, and the backup is turned back. Dilani sees his proof on her receipt at 7:22.

## Prototype flows (starting points in the file)

Screens page, in canvas order: Dispatcher flow, Dispatcher: Broken rule, Dispatcher: Deferrals to publish, Dispatcher: Shortfall at night, Dispatcher: Next weeks, Loader flow, Driver flow, Store Manager flow, Store Manager: Order not sent, Store Manager: Evening notice, Store Manager: Delivery morning, Store Manager: After delivery, Store Manager: Report an issue, Degradation: Signal lost, Degradation: Signal back, Degradation: Silence for the dispatcher, Degradation: Silence for the store, Degradation: Settled for the dispatcher. The Story page has its own flow, Story, through the 16 story boards.
