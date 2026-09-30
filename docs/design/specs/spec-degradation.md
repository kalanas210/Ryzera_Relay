# Degradation Screens: Frame Spec (Relay, Team Ryzera)

> **v0.4 data alignment.** Every value on these frames now comes from `05-scenario-data.md` v0.4 (data aligned), which `tools/data-check/validate_scenario.py` checks against the competition CSVs. What changed from v0.3:
> - **Day and cause.** Wednesday 8 April 2026, not 14 October. The silence has a named cause: an inter-monsoon thunderstorm takes Kasun's mobile network down around Mawanella and the hill roads to Hemmathagama and Aranayake from 5:41 to 7:14 AM (93 minutes). Nuwan's screens say "No contact from Kasun since 5:41 AM" and never name a place or a cause: Relay cannot tell a lost signal from a flat battery.
> - **Run and stops.** VEH045, ambient (dry-box) truck, Fresh dry, Kegalle district, 4 stops: 1 Kegalle, 2 Mawanella (curb), 3 Hemmathagama (Dilani, rear dock), 4 Aranayake (rear dock). The last contact is during stop 2 (was stop 3, Ulapane). Dilani is stop 3 (was 4). The stop moved to the backup is stop 4, Aranayake (was 5, Kotmale Road).
> - **Backup.** VEH060, Nimal's ambient van, the hub's standby this week (was VEH058, which is in the workshop with VEH039). Stop 4 moves at 6:15 AM; the drawer shows the backup arrives around 8:05, after Aranayake's 7:30 close, and says why it is still worth sending.
> - **Estimates.** One rule, from the scenario's table: 6:05 stop 3 around 6:35 (6:05 to 7:05), stop 4 around 7:15 (6:45 to 7:45); 6:15 ranges 6:15 to 7:10 and 6:40 to 7:50; 6:42 stop 4 around 7:05 (6:45 to 7:55).
> - **New state `DEG-03 Live runs during the silence / receipt in` (6:42 AM)** and a new grid column, "6:42 AM · Store confirms". Frames renamed: `/ move stop 5` is now `/ move stop 4`, `/ stop 5 moved` is now `/ stop 4 moved`.
> - **Reconnection.** At 7:14 Kasun is at Aranayake's dock, not driving. 7 records (5 stop records, 2 photos). He answers at 7:15 at the dock; Nuwan sees the conflict resolved at 7:16.
> - **Review fixes (this pass).** The outage is placed as the scenario places it: around Mawanella and the hill roads to Hemmathagama and Aranayake, 5:41 to 7:14 AM (not "the Kegalle run of the A1 corridor", and not "before dawn": first light is about 5:40). The scenario card's paragraph now carries the route-history figure (98.9% of 616 first Kegalle stops arrived after their planned time). `DEG-04 Arrival tracker in low signal` is renamed **`DEG-04 Arrival tracker during the silence`**, since store screens make no low-signal claim, and its shared cards now use STM-04's words: "Planned 5:30 AM", "Driver, VEH045 dry-box truck", "6 rice and dhal cases follow on Thursday", "Times update when Kasun's phone next reaches us." The section header names the flows as Figma lists them ("Degradation: Signal lost" ...). Times on the notices never break from their AM (no-break spaces), the DEG-03 tracks label the recorded Kegalle time "Delivered 5:11", and the shortfall item on DEG-03 reads "short" (already decided), as on DSP-04.
> - **Removed.** The "no coverage for 60 to 90 minutes" line and the 7:30 escalation rule (the scenario has no coverage data), the chilled cases, VEH047, VEH049, VEH052, VEH053 and VEH058 rows, and the v0.2 review notes and v0.3 consistency list, which described the old story.

Frame-by-frame spec for the Degradation section of the design file: the section header, the scenario card and frames DEG-01 to DEG-05 with their states. It is written for the Figma build (`tools/figma-builder/steps/degradation`) and for the Hackathon front end, and it describes the frames as built. Shared components are defined once in `components.md`; the driver, dispatcher and store frames here reuse the shells of `spec-driver.md`, `spec-dispatcher.md` and `spec-store-manager.md`.

## Screen set

One event, followed through every role that feels it. At 5:41 AM, while Kasun is unloading at Mawanella, the storm takes his mobile network down; it comes back at 7:14 as the storm passes, while he is at Aranayake's dock. In between he keeps delivering (DEG-01). Nuwan watches a silent run, sends the standby van as a backup for stop 4 and keeps it when the store's receipt arrives (DEG-03 and its states). Dilani plans her staff around an honest estimate (DEG-04). When the signal returns, the phone sends everything by itself and asks Kasun to confirm one record (DEG-02). Nuwan then sees the clash settled with evidence (DEG-05).

13 frames: the scenario card, 5 base frames and 7 states. 6 phone frames at 390 wide (they run full length on the canvas under a fixed header), 6 desktop frames at 1440 x 900, and the card at 1440 x 900. The driver frames are driver spec frames with the offline parts added, so nothing Kasun sees changes shape when the signal drops.

| Frame | Role | Size | Snapshot, Wed 8 April 2026 | Priority |
|---|---|---|---|---|
| Degradation / Scenario card | All | 1440 x 900 | | Must |
| DEG-01 Working offline | Driver | Phone | 6:05 AM | Must |
| DEG-03 Live runs during the silence | Dispatcher | Desktop | 6:05 AM | Must |
| DEG-03 Live runs during the silence / move stop 4 | Dispatcher | Desktop | 6:15 AM | Must |
| DEG-03 Live runs during the silence / stop 4 moved | Dispatcher | Desktop | 6:15 AM | Should |
| DEG-03 Live runs during the silence / receipt in | Dispatcher | Desktop | 6:42 AM | Must |
| DEG-04 Arrival tracker during the silence | Store manager | Phone | 6:05 AM | Must |
| DEG-02 Back in coverage / sending | Driver | Phone | 7:14 AM | Should |
| DEG-02 Back in coverage | Driver | Phone | 7:14 AM | Must |
| DEG-02 Back in coverage / Sinhala | Driver | Phone | 7:14 AM | Should |
| DEG-02 Back in coverage / answered yes | Driver | Phone | 7:15 AM | Must |
| DEG-05 Conflict resolved / waiting for answer | Dispatcher | Desktop | 7:14 AM | Should |
| DEG-05 Conflict resolved | Dispatcher | Desktop | 7:16 AM | Must |

Frames from sibling sections that the story passes through, named in the grid notes: DRV-02 Stop / Stop 3 offline and DRV-03 (Driver, 6:21 to 6:36), STM-04 Arrival tracker / past estimate (Store Manager, 6:40) and STM-05 Confirm receipt / before driver proof (Store Manager, 6:42).

### How the Degradation section is laid out

- Section header at (80, 80): "Degradation" in Doc heading; the lead (role, persona, device, moment), the flow line and the devices and prototype line in Doc lead and Doc body, 1440 wide.
  - Lead: "Driver Kasun Bandara on his phone, dispatcher Nuwan Perera at his desktop and store manager Dilani Jayawardena on her phone, on Wednesday 8 April 2026, while an inter-monsoon thunderstorm takes Kasun's mobile network down around Mawanella and the hill roads to Hemmathagama and Aranayake from 5:41 to 7:14 AM."
  - Flow: "Flow: the scenario card, then one grid with a lane per role and a column per moment (6:05 Silence, 6:15 Nuwan acts, 6:42 Store confirms, 7:14 Signal back, 7:16 Settled). DEG-01 Working offline, DEG-03 Live runs during the silence, DEG-04 Arrival tracker during the silence, DEG-02 Back in coverage and DEG-05 Conflict resolved, with their seven states, each captioned with its moment."
  - Devices and prototype: "Devices: phone 390 x 844 for Kasun and Dilani, running full length under a fixed header; desktop 1440 x 900 for Nuwan. Prototype flows: Degradation: Signal lost, Degradation: Signal back, Degradation: Silence for the dispatcher, Degradation: Silence for the store, Degradation: Settled for the dispatcher." No-break spaces keep each flow name on one line.
- The scenario card 80 below the header, its rationale card 40 below it.
- Below them, 200 lower, one grid: three lanes and five time columns, so the same minute shows on every role's screen at once.
  - Column labels, Heading 2 `asphalt-900`: "6:05 AM · Silence", "6:15 AM · Nuwan acts", "6:42 AM · Store confirms", "7:14 AM · Signal back", "7:16 AM · Settled". Columns are 1440 wide, 160 apart, starting at x 480.
  - Lane labels, Heading 2 `asphalt-900`, at x 80: "Driver · Kasun Bandara", "Dispatcher · Nuwan Perera", "Store manager · Dilani Jayawardena". 200 px between lanes, with a 1 px `asphalt-200` rule between them.
  - Driver lane: DEG-01 at 6:05. A note in the 6:42 column: "6:21 to 6:36 AM. Kasun arrives at Hemmathagama and delivers it offline (DRV-02 Stop / Stop 3 offline and DRV-03, in the Driver section). His phone does not join the store's Wi-Fi, so the records wait on it." DEG-02 / sending, DEG-02 and DEG-02 / Sinhala side by side (80 apart) at 7:14. DEG-02 / answered yes at 7:16, captioned 7:15.
  - Dispatcher lane: DEG-03 at 6:05; / move stop 4 at 6:15 with / stop 4 moved below it; / receipt in at 6:42; DEG-05 / waiting for answer at 7:14; DEG-05 at 7:16.
  - Store manager lane: DEG-04 at 6:05. A note in the 6:42 column: "6:40 AM. Dilani's estimate has passed with no word from Kasun, so STM-04 Arrival tracker / past estimate offers Confirm receipt. At 6:42 she confirms that everything arrived, 96 cases (STM-05 Confirm receipt / before driver proof). Both are drawn in the Store Manager section."
- Each state carries a caption above it in Label `asphalt-700`, starting with its minute, clear of the 22 px where Figma draws frame names. Each main screen carries its rationale card (same width, 40 below).
- Flow connectors (`asphalt-300` arrows) only along real paths: DEG-03 to / move stop 4, / move stop 4 down to / stop 4 moved, / stop 4 moved to / receipt in (an elbow through the gutter), / receipt in to DEG-05 / waiting for answer, DEG-05 / waiting for answer to DEG-05, DEG-02 / sending to DEG-02, DEG-02 to / answered yes.
- Section size as built: 8,400 x 8,118.

### Captions

| Frame | Caption |
|---|---|
| DEG-01 | 6:05 AM. No signal since 5:41. Stop 2 is saved on the phone and Hemmathagama is next. |
| DEG-03 | 6:05 AM. No contact from Kasun for 24 minutes. Aranayake's likely range already runs past its 7:30 close. |
| DEG-04 | 6:05 AM. Dilani plans her staff around an honest estimate. |
| / move stop 4 | 6:15 AM. Nuwan clicks Move on stop 4. The drawer puts Kasun's estimate beside the standby van and shows it lands after the close. |
| / stop 4 moved | 6:15 AM. Stop 4 is also on VEH060. The backup shows as a late risk and Kasun's item folds under it. |
| / receipt in | 6:42 AM. Hemmathagama confirms receipt, so Relay moves Aranayake's estimate and asks about the backup. Nuwan keeps it at 6:44. |
| DEG-02 / sending | 7:14 AM, a second before DEG-02. Signal is back and stops 2, 3 and 4 are sending. |
| DEG-02 | 7:14 AM, at Aranayake's dock. Everything is sent. Relay asks Kasun about stop 4 only. |
| DEG-02 / Sinhala | 7:14 AM. The same question in Sinhala. Both answers stay above the fold. |
| DEG-05 / waiting for answer | 7:14 AM. The records have arrived and Relay is waiting for Kasun's answer. Stop 4 has two copies. |
| DEG-02 / answered yes | 7:15 AM, still at the dock. Kasun answered yes. The settled notice shows and Finish trip returns. |
| DEG-05 | 7:16 AM. Kasun confirmed at 7:15 and VEH060's copy is cancelled. |

### Prototype flows (Figma flow starting points)

| Flow name | Starts at | Path |
|---|---|---|
| Degradation: Signal lost | DEG-01 Working offline | "Open stop 3" or stop row 3, to DRV-02 Stop / Stop 3 offline (Driver section) |
| Degradation: Silence for the dispatcher | DEG-03 Live runs during the silence | "Move" on stop 4, then "Move stop 4 to VEH060" to / stop 4 moved; after 3 s (the store's receipt arriving) to / receipt in; "Keep backup" to DEG-05 / waiting for answer; after 2.5 s to DEG-05 |
| Degradation: Silence for the store | DEG-04 Arrival tracker during the silence | Back to STM-01 My orders / on the way (Store Manager section) |
| Degradation: Signal back | DEG-02 Back in coverage / sending | After 1.5 s to DEG-02, then "Yes, I delivered it" to / answered yes, then "Finish trip" to DRV-05 Trip summary / Finished (Driver section) |
| Degradation: Settled for the dispatcher | DEG-05 Conflict resolved / waiting for answer | After 2.5 s to DEG-05 |

The degradation step sets these names itself, so the section header matches Figma's flow list; `prototype/30-flow-starts.js` still renames the spec names of older builds ("Signal lost: driver" and so on). The driver's main story reaches DEG-01 from DRV-S1 Signal drops and DEG-02 / sending from DRV-05 Trip summary / Still waiting (`prototype/10-driver-to-degradation.js`).

### Shared rules for these frames

- **Recorded versus estimated.** Anything a phone or a store recorded is drawn solid. Anything Relay estimated carries the word "around" and the Estimate mark: a circle, `white` fill, 1.5 px dashed `asphalt-500` ring (16 px beside text, 20 px in picker rows, 24 or 28 px on a stop track). An estimate is never drawn in the same style as a record, on any role's screen.
- **Say what is known, not why.** Relay cannot tell a lost signal from a flat battery. Nuwan's screens say "No contact from Kasun since 5:41 AM" and name no place and no cause. Kasun's own phone knows it has no network, so DEG-01 may say "No signal". Dilani's screen says only that hill roads often lose signal. After 7:14 the records show the phone worked offline, so DEG-05 may say "Offline 5:41 to 7:14".
- **One estimate rule.** The estimate is the last stop event Relay has for Kasun, plus that store's usual unloading time if the event is an arrival, plus each leg by the Expected model, plus the usual unloading time at stores in between, rounded to 5 minutes. A store's confirmed receipt counts as a stop event. The likely range is the estimate minus and plus (15 minutes + half the minutes since the phone last reached Relay), rounded out to 5 minutes, and never starts before the time shown. The estimate moves only when a stop event arrives; once it passes with no word, Relay does not push it later. Nuwan and Dilani read the same estimate.
- **Offline is Waiting, not Problem.** Silence uses the Waiting tones and `cloud-off`. Problem red appears only where something is at risk: the backup's arrival after Aranayake's close. Attention (`clock`, `attention-strong`) marks what needs a decision and the part of a range that runs past a close.
- **Text and icons on Waiting soft** are `asphalt-700` on every role (Waiting strong on Waiting soft is 4.22:1, below AA for 13 px text). `waiting-strong` is only for icons and bars on `white`.
- **Tokens** follow the style guide: `chilled-strong` #0A6EBD, `chilled-soft` #E4F1FB, `done-strong` #1F7A4D, `done-soft` #E3F3EA, `attention-strong` #A15C00, `attention-soft` #FCEFD9, `problem-strong` #B3261E, `problem-soft` #FBE9E7, `waiting-strong` #69727F, `waiting-soft` #ECEFF3. `petrol-700` appears only on the one primary action, active navigation and selected choices.
- **Parity.** DEG-01 is DRV-01 Today's run at 6:05 and DEG-02 and its states are DRV-05 Trip summary at 7:14 and 7:15 (`spec-driver.md`). DEG-03 and DEG-05 reuse the DSP-04 Live runs shell (`spec-dispatcher.md`). DEG-04 is STM-04 Arrival tracker at 6:05 (`spec-store-manager.md`). Where a sibling spec and this one disagree on a shell, the sibling wins.
- **No call buttons for drivers** on the dispatcher's screens: a driver acts only when stopped (DSP-04 rule).
- **Sinhala and Tamil** follow DRV-01 / Sinhala: Yaldevi and Noto Sans Tamil at the same sizes with taller line heights. Place names are in the reader's script; IDs, "Fresh", "Relay" and people's names stay in Atkinson as stored. Where a string also appears in DRV-01 / Sinhala, it is copied from there.

---

## Scenario card: Signal Lost on the Kandy Corridor

- **Frame:** `Degradation / Scenario card`, 1440 x 900, background `asphalt-50`. It covers 3:44 to 7:22 AM on Wednesday 8 April 2026.
- **Purpose:** name the failure scenario and its cause, say why it matters to Waypoint, and put the event in order before the judge reaches the frames.
- **Layout:** card 1360 x 820 at 40, 40, `white`, 1 px `asphalt-200`, radius 12, padding 40, vertical, the three blocks spread over the height. Top block, horizontal, gap 40: left column 620 (eyebrow in Label `petrol-700`, name in Display, subtitle in Body `asphalt-700`, 12 px space, section title in Heading 2, paragraph in Body, 600 wide); right column 620 (section title, then 14 timeline rows: a 4 px `petrol-700` bar on the five column moments, time in Label SemiBold 64 wide, event in Body dense, frame tag in Caption `asphalt-500`, 104 wide, right aligned; row spacing set so both columns end on one line). Role block: three columns 416 wide, `asphalt-50`, radius 12, padding 20 (icon 20 and Heading 3, Body dense, Caption IDs). Rules row: three lines 416 wide, `check` 20 `petrol-700` and Body dense.
- **Content:**
  - Eyebrow: "Degradation scenario"
  - Name: "Signal Lost on the Kandy Corridor"
  - Subtitle: "An inter-monsoon thunderstorm takes Kasun's mobile network down around Mawanella and the hill roads to Hemmathagama and Aranayake for 93 minutes, from 5:41 to 7:14 AM on Wednesday 8 April 2026."
  - "Why it matters to Waypoint": "Waypoint's Kandy hub sends Fresh runs into hill country before dawn, where mobile coverage can drop for long stretches, most of all in a monsoon storm. Being behind plan is normal there: in monsoon months 98.9% of 616 first stops of Kegalle Fresh runs arrived after their planned time (route history). If Relay needed a live connection, three things would fail at once: the driver's proof of delivery, the dispatcher's view of the run and the store's arrival time. Nuwan would be back to guessing, Dilani back to waiting at the rear door, and disputes back to one person's word against another's. A guess made in the dark can send a second vehicle after goods that were already delivered, and here it does. So Kasun's phone keeps working without signal, every other screen says what it knows and what it is estimating, and when the signal returns, Relay settles the clash by asking the person who was there."
  - "What happens":

    | Time | Event | Tag |
    |---|---|---|
    | 3:44 AM | VEH045 leaves the Kandy hub with 4 Fresh dry stops. | |
    | 5:30 AM | Kasun records Arrived at stop 2, Mawanella. | |
    | 5:41 AM | The storm takes his network down. Last contact with Relay. | |
    | 5:59 AM | Stop 2 delivered and saved on the phone. | |
    | 6:05 AM | Nuwan sees the silence. Dilani sees around 6:35. | DEG-01, 03, 04 |
    | 6:15 AM | Nuwan moves stop 4, Aranayake, to the standby VEH060. | DEG-03 |
    | 6:36 AM | Stop 3 delivered offline. VEH060 leaves the hub. | DRV-03 |
    | 6:40 AM | Dilani's estimate passes with no word from Kasun. | STM-04 |
    | 6:42 AM | Dilani confirms receipt. Nuwan keeps the backup at 6:44. | STM-05, DEG-03 |
    | 7:09 AM | Stop 4 delivered at Aranayake, offline. | |
    | 7:14 AM | Signal back. 7 records sent. One question about stop 4. | DEG-02, 05 |
    | 7:15 AM | Kasun confirms at the dock. VEH060's copy is cancelled. | DEG-02 |
    | 7:16 AM | Nuwan sees the conflict resolved. | DEG-05 |
    | 7:22 AM | Dilani opens her receipt with Kasun's photo attached. | STM-05 |

  - Role columns: `truck` "Driver · Kasun" / "Keeps working. Every stop saves on his phone. When the signal returns, he confirms one record." / "DEG-01, DEG-02". `users` "Dispatcher · Nuwan" / "Sees silence as silence: the last record, the last contact and an estimate. Keeps the backup while the facts come in, then sees the clash settled with Kasun's evidence." / "DEG-03, DEG-05". `store` "Store manager · Dilani" / "Gets an honest arrival estimate she can roster staff around, and confirms receipt herself when the goods arrive before Kasun's records do." / "DEG-04, STM-04 / past estimate, STM-05".
  - Rules: "Never block the driver. The network is not his job." / "Say what is recorded and what is estimated, and draw them differently." / "Before Relay undoes someone's decision, it asks the person who was there."
- **Prototype:** none.
- **Rationale:** This card is the page's argument. It names the scenario and its cause, says why it matters to Waypoint in one paragraph, and puts the event in order, so a judge reading any frame knows which minute of the story it shows. The three role columns make the point that a failure in the field is also a failure in the office and at the store, and that each role needs a different honest answer. The rules at the bottom are the tests we held every degradation frame to, and they are the same rules the Hackathon build will follow.

---

## DEG-01 Working offline

- **Frame:** `DEG-01 Working offline`, phone 390 wide, full length (about 1,480) under the fixed status bar and header, background `asphalt-50`. Wednesday 8 April, 6:05 AM. Kasun's phone has had no network since 5:41. He delivered stop 2, Mawanella, offline at 5:59 and is on his way to stop 3, Hemmathagama (he arrives at 6:21). This is DRV-01 Today's run 45 minutes on, with one notice added.
- **Purpose:** show that Kasun's run carries on unchanged without signal, and that he can see exactly what is saved and waiting to send.
- **Layout:** DRV-01's regions from `spec-driver.md`, with one new region (3b).
  1. System status bar. `signal` 16 in `asphalt-300` (no network), no carrier text.
  2. Top bar / phone header (root), 64 high: title in Heading 1, Sync pill / offline with count at the right (`waiting-soft`, 1 px `asphalt-300`, `cloud-off` 16 and Label `asphalt-700`). Status only.
  3. Trip strip: date, trip line in Heading 3, progress label and Step progress (4 segments: 2 `done-strong`, 1 `signal-400`, 1 `asphalt-200`), meta line.
  3b. New: Notice / waiting, margin 8 16 0, `waiting-soft`, 1 px `asphalt-300`, radius 12, padding 12 16, gap 12: `cloud-off` 24 `asphalt-700`, title in Heading 3, body in Body. No button, no close. The offline notice appears here, on the run list, and on no other driver screen.
  4. Next stop card / full, as DRV-01 v0.4: marker 40, "Next stop" and the count, Status chip / Dry; name in Display and outlet line; window status line in Body strong `done-strong` with `circle-check` 20; detail grid in three rows (Window and Unload at; Planned arrival and Expected arrival; Drop off); Button / primary / field 56 with `chevron-right`; Button / quiet / field 48 "Report a problem".
  5. "All stops" in Heading 2.
  6. Stop list card: four Stop rows / field with 32 px markers and chevrons, dividers inset 60. The next and pending rows carry an extra line with Planned and Expected in Label `asphalt-500`. A chip wider than its line wraps inside the chip, as on DRV-01.
  7. Language row. 24 bottom padding, then the home indicator.
- **Content:**
  - Status bar "6:05". Header "Today's run". Pill "1 stop to send".
  - Trip strip: "Wednesday 8 April" / "VEH045 · Trip 1 · Fresh dry, Kegalle district" / "2 of 4 stops done" / "Load accepted 3:32 AM · Left Kandy hub 3:44 AM"
  - Notice: "No signal since 5:41 AM" / "Carry on with your run. Every stop saves on this phone and sends by itself when you're back in coverage. Nothing is deleted until Relay has it."
  - Next stop card: "3" / "Next stop" / "Stop 3 of 4" / chip "Dry"; "Hemmathagama" / "Waypoint Fresh Hemmathagama · OUT117"; "Window open, 1 h 40 min left".

    | Icon | Label | Value |
    |---|---|---|
    | `clock` | Window | 4:00 to 7:45 AM |
    | `warehouse` | Unload at | Rear dock |
    | `calendar-clock` | Planned arrival | 5:30 AM |
    | `timer` | Expected arrival | around 6:35 AM |
    | `package` | Drop off | 96 cases |

    The Expected time is the last one the phone received before 5:41, the same 6:35 Relay still shows the office and the store. Buttons "Open stop 3" / "Report a problem".
  - Stop list:

    | Stop | Marker | Name | Meta | Extra line | Chip |
    |---|---|---|---|---|---|
    | 1 | delivered | Kegalle | `check` "Delivered 5:11 AM" in Body strong `done-strong` | | |
    | 2 | delivered | Mawanella | `check` "Delivered 5:59 AM" | | Waiting to send |
    | 3 | next, "3" | Hemmathagama | "Next · 4:00 to 7:45 AM · Rear dock" in Body strong | "Planned 5:30 AM" / "Expected around 6:35 AM" (two lines, as on DRV-01) | Short: "6 rice and dhal cases short, store told" ("store told" kept together) |
    | 4 | pending, "4" | Aranayake | "5:00 to 7:30 AM · Rear dock" | "Planned 5:58 AM" / "Expected around 7:15 AM" | |

  - "Language: English"
  - Accessible labels: row 2 reads "Stop 2, Mawanella, delivered 5:59 AM, waiting to send". The pill reads "Offline, 1 stop to send".
  - Left out on purpose: no retry button, no red, no modal, no "you are offline" page, no sync details sheet.
  - Behaviour, for the build: every record is written to the phone's storage (IndexedDB) before the screen confirms it, and removed only when Relay confirms it has it. The pill counts unacknowledged records as stops (the driver spec's rule), so stop 2's delivery record reads "1 stop to send". Sending retries by itself (Background Sync on Android Chrome, plus a retry when the app comes to the front or the browser's online event fires). Location stamps come from GPS, which works without mobile data.
  - Strings for the build that differ from DRV-01 / Sinhala (every other string is copied from there). Tamil is for the build only. Both need a native reader's check.

    | Where | English | Sinhala (Yaldevi) | Tamil (Noto Sans Tamil) |
    |---|---|---|---|
    | Sync pill | 1 stop to send | යැවීමට නැවතුම් 1ක් | அனுப்ப 1 நிறுத்தம் |
    | Notice, title | No signal since 5:41 AM | පෙ.ව. 5:41 සිට සිග්නල් නැහැ | காலை 5:41 முதல் சிக்னல் இல்லை |
    | Notice, body | Carry on with your run. Every stop saves on this phone and sends by itself when you're back in coverage. Nothing is deleted until Relay has it. | ගමන දිගටම කරගෙන යන්න. සෑම නැවතුමක්ම මේ ෆෝන් එකේ සුරැකෙනවා, සිග්නල් ලැබුණු විගස ඉබේම යැවෙනවා. Relay එකට ලැබෙන තුරු කිසිවක් මැකෙන්නේ නැහැ. | உங்கள் பயணத்தைத் தொடருங்கள். ஒவ்வொரு நிறுத்தமும் இந்த போனில் சேமிக்கப்பட்டு, சிக்னல் கிடைத்ததும் தானாகவே அனுப்பப்படும். Relay பெறும் வரை எதுவும் அழிக்கப்படாது. |
    | Progress | 2 of 4 stops done | නැවතුම් 4න් 2ක් අවසන් | 4 இல் 2 நிறுத்தங்கள் முடிந்தன |
    | Next stop, count | Stop 3 of 4 | 4න් 3 වැනි නැවතුම | 4 இல் நிறுத்தம் 3 |
    | Name | Hemmathagama | හෙම්මාතගම | ஹெம்மாத்தகம |
    | Outlet line | Waypoint Fresh Hemmathagama · OUT117 | Waypoint Fresh හෙම්මාතගම · OUT117 | Waypoint Fresh ஹெம்மாத்தகம · OUT117 |
    | Window status | Window open, 1 h 40 min left | දැන් භාරගන්නවා, තව පැය 1යි මිනිත්තු 40යි | நேரம் திறந்துள்ளது, இன்னும் 1 மணி 40 நிமிடம் |
    | Window value | 4:00 to 7:45 AM | පෙ.ව. 4:00 සිට 7:45 දක්වා | காலை 4:00 முதல் 7:45 வரை |
    | Planned arrival value | 5:30 AM | පෙ.ව. 5:30 | காலை 5:30 |
    | Expected arrival value | around 6:35 AM | පෙ.ව. 6:35ට පමණ | காலை சுமார் 6:35 |
    | Drop off value | 96 cases | පෙට්ටි 96 | 96 பெட்டிகள் |
    | Button | Open stop 3 | නැවතුම 3 විවෘත කරන්න | நிறுத்தம் 3 ஐத் திறக்கவும் |
    | Row 2 meta | Delivered 5:59 AM | භාර දුන්නා, පෙ.ව. 5:59 | ஒப்படைக்கப்பட்டது, காலை 5:59 |
    | Row 3 meta | Next · 4:00 to 7:45 AM · Rear dock | ඊළඟට · පෙ.ව. 4:00 සිට 7:45 දක්වා · පිටුපස ඩොක් එක | அடுத்தது · காலை 4:00 முதல் 7:45 வரை · பின்புற டாக் |
    | Row 3 extra | Planned 5:30 AM / Expected around 6:35 AM | නියමිත පෙ.ව. 5:30 / බලාපොරොත්තු පෙ.ව. 6:35 පමණ | திட்டம் காலை 5:30 / எதிர்பார்ப்பு காலை சுமார் 6:35 |
    | Row 3 chip | 6 rice and dhal cases short, store told | හාල් සහ පරිප්පු පෙට්ටි 6ක් අඩුයි, කඩයට දන්වා ඇත | அரிசி, பருப்பு 6 பெட்டிகள் குறைவு, கடைக்குத் தெரிவிக்கப்பட்டது |
    | Row 4 extra | Planned 5:58 AM / Expected around 7:15 AM | නියමිත පෙ.ව. 5:58 / බලාපොරොත්තු පෙ.ව. 7:15 පමණ | திட்டம் காலை 5:58 / எதிர்பார்ப்பு காலை சுமார் 7:15 |
    | Chip | Waiting to send | යැවීමට ඇත | அனுப்பக் காத்திருக்கிறது |

- **States:** none. Stop 3 itself, at 6:21 with no signal, is the driver spec's DRV-02 Stop / Stop 3 offline.
- **Prototype:** "Open stop 3" and stop row 3 go to DRV-02 Stop / Stop 3 offline. "Report a problem" goes to DRV-04 Report a problem. The language row, the pill and the other rows: no target.
- **Rationale:** Kasun's network goes down at 5:41 while he is unloading at Mawanella, and nothing about his run changes. This is the same run screen he saw at 5:20, with one gray notice added above the next stop. He finishes the stop, the phone keeps the record, and Hemmathagama stays the biggest thing on the screen, with the same Planned and Expected times he had before the storm. The notice is gray, not red, because losing signal in hill country is normal, not a fault. Each saved stop carries a waiting to send mark and the pill counts what is held, so he never wonders whether a delivery counted. There is no retry button, because retrying is the phone's job.

---

## DEG-02 Back in coverage

- **Frame:** `DEG-02 Back in coverage`, phone 390 wide, full length (about 1,400) under the fixed status bar and header, background `asphalt-50`. 7:14 AM. Kasun delivered stop 4, Aranayake, at 7:09 and is still at its rear dock, loading the store's returns. Since 7:10 his phone has shown DRV-05 Trip summary / Still waiting. The storm has passed, the signal is back, all 7 waiting records have been sent, and Relay found one clash: stop 4 was also given to VEH060 at 6:15 while he was out of reach. This is DRV-05 Trip summary at 7:14 with the Sync question card at the top.
- **Purpose:** tell Kasun his offline work has arrived, and ask him to confirm the one record that clashes with a decision made while he was out of reach.
- **Layout:** DRV-05's regions from `spec-driver.md`, with one new region (2b).
  1. System status bar, `signal` 16 in `asphalt-900`.
  2. Top bar / phone header (back), 64 high, Sync pill / all synced.
  2b. New: Sync question card, margin 16 16 0, `white`, 2 px `attention-strong` border, radius 12, padding 16, gap 12. Accessible name "Question about stop 4". Header row: `clock` 24 `attention-strong` and title in Heading 2 (two lines). Body in Body. Record box (`asphalt-50`, radius 8, padding 12, gap 4): Label `asphalt-500`, Heading 3, two lines of Body, then `camera` 16 and Label `asphalt-700`. Question in Heading 3 and helper in Body `asphalt-700`. Button / primary / field "Yes" with `check`, then Button / secondary / field "No" with `x`, full width.
  3. Hero block: Heading 1, trip line in Body `asphalt-700`, times in Label `asphalt-500`.
  4. Notice / done.
  5. Notice / info "Stop 4 is settled", only in / answered yes.
  6. Windows row: `circle-check` 20 `done-strong` and Body.
  7. "Stops" in Heading 2 and the Stop list (summary rows, no chevrons). Row 4 carries Status chip / needs answer (`attention-soft`, `clock` 16, Label `attention-strong`).
  8. The bottom action bar is hidden while the question is open, so the answer is the only primary action. It returns in / answered yes. The home indicator stays.
- **Content:**
  - Status bar "7:14". Header "Trip summary". Pill "All synced".
  - Card: "Stop 4 was also given to Nimal" / "Nuwan moved stop 4 to VEH060 at 6:15 AM, while you had no signal. Nimal is driving a second copy to Aranayake now."
  - Record box: "Your record" / "Aranayake · OUT116" / "Arrived 6:56 AM · Delivered 7:09 AM" / "86 cases · Received by K. Herath" / "Photo saved"
  - "Is your record right?" / "Your answer lets Nimal turn back." / "Yes, I delivered it" / "No, something is wrong"
  - Hero: "All 4 stops done" / "VEH045 · Trip 1 · Fresh dry, Kegalle district" / "Left Kandy hub 3:44 AM · Last delivery 7:09 AM"
  - Notice / done: "Everything is sent" / "Stops 2, 3 and 4 reached the office at 7:14 AM, with 2 photos." (a no-break space keeps "7:14 AM" on one line)
  - Windows row: "All 4 deliveries were inside their windows."
  - Stops:

    | Stop | Name | Status | Extra lines | Chip |
    |---|---|---|---|---|
    | 1 | Kegalle | Delivered 5:11 AM | | |
    | 2 | Mawanella | Delivered 5:59 AM | Saved offline, sent 7:14 AM | |
    | 3 | Hemmathagama | Delivered 6:36 AM | 96 cases, 6 rice and dhal cases short. / Saved offline, sent 7:14 AM | |
    | 4 | Aranayake | Delivered 7:09 AM | Saved offline, sent 7:14 AM | Needs your answer |

  - The 7 records, in the order they were saved: stop 2 delivered with N. Wijesinghe's signature (5:59), stop 3 arrived (6:21), stop 3 delivered (6:36), stop 3 photo (6:36), stop 4 arrived (6:56), stop 4 delivered (7:09), stop 4 photo (7:09). The pill counted the same moments as stops: 1 at 5:59, 2 at 6:21, 3 from 6:56.
  - Behaviour, for the build:
    - The question card sits at the top of the screen Kasun is on (the trip summary here, the run list if stops were still to come). It never pops up and makes no sound, because coverage often returns while a driver is moving; the phone holds a question while it senses the vehicle moving. Here he is at the dock and sees it at once.
    - Relay asks only when a record from the phone clashes with a change made on the server while the phone was offline. Every other record is accepted as it is. His answer is saved on the phone first, like any record.
    - The card appears as soon as stop 4's delivered record is accepted, without waiting for photos. On a weak signal the photos (about 180 KB each) can take minutes: the pill reads "Sending 2 photos", the record box "Photo sending", and DEG-05 shows a "Photo on its way" tile. The story frames show the fast case.
    - "No, something is wrong": nothing is cancelled. The clash goes to the top of Nuwan's feed, Nimal carries on, and the card reads: "Nuwan has been told and will call you. Aranayake is open until 7:30 AM, so stay at the dock for now." Not drawn.
    - If Nuwan settles the clash first from DEG-05 / waiting for answer, the card turns into the settled notice without Kasun answering.
- **States:**
  - **`DEG-02 Back in coverage / sending`** (Should). 7:14 AM, a second before DEG-02; DRV-05 Trip summary / Still waiting at 7:14 with these differences: pill Sync pill / sending "Sending 3 stops" (waiting tones, `refresh-cw`); region 4 becomes Notice / info with `refresh-cw` 24 `asphalt-700`: "Signal is back" / "Sending stops 2, 3 and 4, with 2 photos."; rows 2, 3 and 4 carry Status chip / sending ("Sending", waiting tones, `refresh-cw` 16); the bottom action bar stays as on / Still waiting: `cloud-off` "3 stops still to send. Finishing saves on this phone too." and "Finish trip". No question card yet.
  - **`DEG-02 Back in coverage / answered yes`** (Must). 7:15 AM, still at the dock, straight after "Yes, I delivered it"; DRV-05 Trip summary at 7:15: the question card is gone; region 5 appears, Notice / info: "Stop 4 is settled" / "Nuwan moved stop 4 to VEH060 at 6:15 AM while you had no signal. You said you delivered it, so VEH060's visit was cancelled at 7:15 AM." (the same string as DRV-05; no-break spaces keep "6:15 AM" and "7:15 AM" whole); row 4 loses its chip; the bottom action bar returns: `truck` "No second trip today. Head back to the Kandy hub." and "Finish trip" with `circle-check`. He taps it at 7:17 at the dock (DRV-05) and leaves at 7:18.
  - **`DEG-02 Back in coverage / Sinhala`** (Should). 7:14 AM, same moment and layout, every interface string in Sinhala. The frame is 844 high: the card ends at about y 660 and the hero follows, so both answers stay above the fold.

    | Where | English | Sinhala (Yaldevi) | Tamil (Noto Sans Tamil), build only |
    |---|---|---|---|
    | Header title | Trip summary | ගමනේ සාරාංශය | பயணச் சுருக்கம் |
    | Sync pill | All synced | සියල්ල යැවුණා | அனைத்தும் அனுப்பப்பட்டது |
    | Card, title | Stop 4 was also given to Nimal | නැවතුම 4 Nimal ටත් දීලා තියෙනවා | நிறுத்தம் 4 Nimal க்கும் கொடுக்கப்பட்டுள்ளது |
    | Card, body | Nuwan moved stop 4 to VEH060 at 6:15 AM, while you had no signal. Nimal is driving a second copy to Aranayake now. | ඔබට සිග්නල් නැති වෙලාවේ, පෙ.ව. 6:15ට Nuwan නැවතුම 4 VEH060 එකට මාරු කළා. Nimal දැන් ඒ ඇණවුමම අරනායකට ගෙන යනවා. | உங்களுக்கு சிக்னல் இல்லாதபோது, காலை 6:15க்கு Nuwan நிறுத்தம் 4 ஐ VEH060 க்கு மாற்றினார். Nimal இப்போது அதே ஆர்டரை அரநாயக்கவுக்கு கொண்டு செல்கிறார். |
    | Record, label | Your record | ඔබේ වාර්තාව | உங்கள் பதிவு |
    | Record, stop | Aranayake · OUT116 | අරනායක · OUT116 | அரநாயக்க · OUT116 |
    | Record, times | Arrived 6:56 AM · Delivered 7:09 AM | පැමිණියා, පෙ.ව. 6:56 · භාර දුන්නා, පෙ.ව. 7:09 | வந்தது, காலை 6:56 · ஒப்படைத்தது, காலை 7:09 |
    | Record, goods | 86 cases · Received by K. Herath | පෙට්ටි 86 · භාර ගත්තේ K. Herath | 86 பெட்டிகள் · பெற்றவர் K. Herath |
    | Record, photo | Photo saved | ඡායාරූපය සුරැකී ඇත | புகைப்படம் சேமிக்கப்பட்டது |
    | Question | Is your record right? | ඔබේ වාර්තාව නිවැරදිද? | உங்கள் பதிவு சரியா? |
    | Helper | Your answer lets Nimal turn back. | ඔබේ පිළිතුරෙන් Nimal ට ආපසු හැරෙන්න පුළුවන්. | உங்கள் பதில் கிடைத்தால் Nimal திரும்பலாம். |
    | Button, yes | Yes, I delivered it | ඔව්, මම භාර දුන්නා | ஆம், நான் ஒப்படைத்தேன் |
    | Button, no | No, something is wrong | නැහැ, යමක් වැරදියි | இல்லை, ஏதோ தவறு |
    | Hero, title | All 4 stops done | නැවතුම් 4ම අවසන් | 4 நிறுத்தங்களும் முடிந்தன |
    | Hero, trip line | VEH045 · Trip 1 · Fresh dry, Kegalle district | VEH045 · ගමන 1 · Fresh වියළි, කෑගලු දිස්ත්‍රික්කය | VEH045 · பயணம் 1 · Fresh உலர், கேகாலை மாவட்டம் |
    | Hero, times | Left Kandy hub 3:44 AM · Last delivery 7:09 AM | මහනුවර මධ්‍යස්ථානයෙන් පිටත් වුණේ පෙ.ව. 3:44 · අවසන් භාරදීම පෙ.ව. 7:09 | கண்டி மையத்திலிருந்து புறப்பட்டது காலை 3:44 · கடைசி ஒப்படைப்பு காலை 7:09 |
    | Row 4 chip (below the fold) | Needs your answer | ඔබේ පිළිතුර අවශ්‍යයි | உங்கள் பதில் தேவை |
    | / sending, pill (build) | Sending 3 stops | නැවතුම් 3ක් යවමින් | 3 நிறுத்தங்களை அனுப்புகிறது |
    | / sending, notice (build) | Signal is back / Sending stops 2, 3 and 4, with 2 photos. | සිග්නල් ආවා / නැවතුම් 2, 3 සහ 4 ඡායාරූප 2ක් එක්ක යවමින්. | சிக்னல் திரும்பியது / நிறுத்தங்கள் 2, 3, 4 மற்றும் 2 புகைப்படங்கள் அனுப்பப்படுகின்றன. |
    | / sending, chip (build) | Sending | යවමින් | அனுப்புகிறது |

- **Prototype:** / sending goes to DEG-02 after 1,500 ms (dissolve, 200 ms). "Yes, I delivered it" (English and Sinhala) goes to / answered yes. "No, something is wrong": no target. On / answered yes, "Finish trip" goes to DRV-05 Trip summary / Finished (7:17, at the dock). Back and stop rows: no target.
- **Rationale:** When the signal returns, Relay sends everything without asking. Kasun saved seven records offline and all seven go on their own, with nothing asked about the stops that went straight through. The one question is about stop 4, because Nuwan gave it to Nimal while Kasun was out of reach, and Relay will not undo a dispatcher's decision by itself. We show Kasun his own record and ask only whether it is right, so he confirms rather than remembers, and we say why it matters now: Nimal is driving a second copy toward Aranayake. The card sits at the top of his trip summary and never pops up, and he answers it standing at Aranayake's dock.

---

## DEG-03 Live runs during the silence

- **Frame:** `DEG-03 Live runs during the silence`, desktop 1440 x 900, background `asphalt-50`. Wednesday 8 April, 6:05 AM, Kandy hub, Fresh runs. This is DSP-04 Live runs 45 minutes after its 5:20 snapshot. Kasun's phone last reached Relay 24 minutes ago.
- **Purpose:** show Nuwan what Relay knows about a silent run, what it is only estimating, what it can send, and what the risk is.
- **Layout:** the DSP-04 Live runs shell (`spec-dispatcher.md`).
  1. Nav rail (Live active, key hints). 
  2. Page header, 80 high: "Live runs" in Display and the meta line in Body dense `asphalt-700`; at the right the clock (`calendar-clock` 20 and Label), the depot switch (All, Peliyagoda, Kandy hub selected), Button / secondary "Fresh" with `filter`, and Search.
  3. Key figure tiles, four in a row, 56 high: icon 20, number in Heading 2, label in Label `asphalt-700`.
  4. Main area: runs panel (fills, rows scroll) and exceptions panel 400 wide (header fixed, body scrolls; a fixed footer only when the expanded item has actions).
     - Runs panel: header "Kandy hub · Fresh runs" with the Recorded and Estimated legend and "Needs attention first"; column header (Vehicle and driver 200, Stops 472, Last synced 128, menu 32).
     - Run row / no contact, selected: `petrol-50`, 3 px `petrol-700` bar. Stops: a 28 px Stop track with place and status labels; connectors solid up to the last record, dashed after it; estimated stops drawn with the dashed Estimate ring and their number. Under the track, a caption. Last synced: `cloud-off` and "No contact" in Label SemiBold, the time since, the minutes in Caption.
     - Compact run rows (24 px markers), the standby row (a hub marker only), the group row "more vehicles running", and two out-of-service rows (`asphalt-50`, Label `asphalt-500`).
     - A footnote at the foot of the panel, in Caption `asphalt-500`.
     - Exceptions panel: group "Now" with Exception item / waiting / expanded (`white`, 1 px `asphalt-300`, 4 px `waiting-strong` bar, radius 12, padding 16, gap 12); group "Earlier today" with collapsed items (below the fold).
- **Content:**
  - Clock "Wed 8 Apr · 6:05 AM". Meta "Wednesday 8 April · Fresh window 3:30 to 8:00 AM". Search placeholder "Search vehicle, driver or outlet".
  - Tiles: `truck` "12" "vehicles running"; `package-check` `done-strong` "25 of 53" "stops delivered"; `cloud-off` `asphalt-500` "1" "driver out of contact"; `van` `asphalt-700` "1" "standby vehicle free".
  - Row VEH045 (selected): "VEH045" / "Kasun Bandara" / `truck` "Ambient truck · Trip 1" / "Fresh dry, Kegalle district".
    - Track: 1 delivered "Kegalle" / "Delivered 5:11"; 2 arrived "Mawanella" / "Arrived 5:30"; 3 estimated "Hemmathagama" / "around 6:35"; 4 estimated "Aranayake" / "around 7:15". No estimated vehicle marker yet: Relay's estimate has him still unloading at Mawanella (a curb stop that usually takes about 44 minutes).
    - Caption: "Last record: stop 2, arrived 5:30 AM. Times after that are estimates."
    - Last synced: "No contact" / "since 5:41 AM" / "24 min".
  - Row VEH060: "VEH060" / "Nimal Fernando" / `van` "Ambient van · Standby" / "Free until 8 AM". Track: hub marker "At the Kandy hub". "Synced 6:05 AM".
  - Row VEH042: "VEH042" / "Sampath Lakmal" / `snowflake` "Refrigerated truck · Trip 1" / "Fresh chilled, Matale". Track: four delivered markers "Matale Town", "Palapathwela", "Rattota", "Elkaduwa", then hub "To the hub". "Synced 6:05 AM".
  - Group row: `chevron-right` "10 more vehicles running" / "All in contact, nothing to act on".
  - Out of service: "VEH039 · Refrigerated truck · In the workshop (refrigeration fault)" and "VEH058 · Refrigerated van · In the workshop (booked service)".
  - Footnote: "Progress comes from each driver's stop records, not from tracking. When a phone stops reaching Relay, its row keeps the last record and the time of last contact, and every time after that is an estimate."
  - Exceptions header "Exceptions" / "Kandy hub · today". Group "Now". Expanded item:
    - Title (two lines) "No contact from Kasun since 5:41 AM", minutes "24 min".
    - Meta "VEH045 · Fresh dry, Kegalle district · 2 stops to go".
    - "Last record": "Stop 2, Waypoint Fresh Mawanella (OUT118). Arrived 5:30 AM." / Caption "Not marked delivered before 5:41. Mawanella is a curb stop that usually takes about 44 minutes to unload."
    - "Estimated, not tracked": Estimate mark and "Probably still unloading at Mawanella."
    - Estimate rows (24 px estimated marker, place in Body dense SemiBold, window in Caption, time in Body dense SemiBold, range in Caption, Button / quiet "Move"):

      | Stop | Window | Estimate | Likely range |
      |---|---|---|---|
      | 3 · Hemmathagama | Window 4:00 to 7:45 | around 6:35 | likely 6:05 to 7:05 |
      | 4 · Aranayake | Window 5:00 to 7:30 | around 7:15 | likely 6:45 to 7:45, in `attention-strong` |

    - Caption: "From his last record, each store's usual unloading time and the expected time for each leg. The range widens while there is no contact."
    - Risk line: `clock` 16 `attention-strong` "Aranayake's likely range already runs past its 7:30 close."
    - Caption: "Relay can't tell a lost signal from a flat battery, so it shows only what it last heard and estimates from there."
    - Store line: `store` 16 "Dilani sees: Arriving around 6:35 AM. Last heard from Kasun 5:41 AM."
  - Group "Earlier today": `clock` `done-strong` "VEH042 running about 45 min late" / "Reported 4:28 AM. Marked as handled 4:35 AM."; `package-x` `done-strong` "Shortfall on VEH045, stop 3" / "6 rice and dhal cases short. Decided 2:52 AM: send short, add to Thursday."
  - No call button: a driver's item never carries one.
  - Behaviour, for the build: "Last synced" is the last time the phone reached Relay (connected phones check in once a minute with no location), the same meaning as the store's "Last heard from Kasun". The estimate follows the shared rule above; the dispatcher and the store read the same one. The run is marked at risk only when an estimate crosses a window; here the estimate for Aranayake is inside it and only its range runs past, which the item says in attention tone.
- **States:**
  - **`DEG-03 Live runs during the silence / move stop 4`** (Must). 6:15 AM, 34 minutes after the last contact. Nuwan has clicked "Move" on stop 4. The page behind is the 6:15 version: clock "Wed 8 Apr · 6:15 AM"; "26 of 53" stops delivered; VEH045 "34 min", and its track now shows the dashed Estimated vehicle marker between Mawanella and Hemmathagama (Mawanella's usual unloading time has run out); VEH060 and VEH042 "Synced 6:15 AM". Under the drawer, Kasun's item carries the 6:15 figures: "Probably on the road to Hemmathagama.", stop 3 "likely 6:15 to 7:10", stop 4 "likely 6:40 to 7:50".
    - Sheet / side drawer, 480 x 900 at x 960, `white`, 1 px `asphalt-200` left border, radius 16 0 0 16, floating shadow, no scrim, so Kasun's row stays readable. Header 76 (Heading 2, Label `asphalt-500`, close 40 x 40), body scrolls (padding 16 24, gap 12), fixed footer (caption in Label `asphalt-700`, Button / quiet and Button / primary, right aligned).
    - Content:
      - Header: "Move stop 4 to another vehicle" / "VEH045 · Kasun Bandara · no contact since 5:41 AM"
      - Order summary (`asphalt-50`, radius 8, padding 12): "Stop 4 · Waypoint Fresh Aranayake (OUT116)" / "ORD0098593 · Dry · 86 cases · 572.0 kg · 3.168 m³" / "30 rice and dhal, 32 packet foods, 24 tea and biscuit cases" / "Rear dock · Window 5:00 to 7:30"
      - "Move to", Vehicle picker rows (48 high, radius 8):

        | State | ID and driver | Line | Right |
        |---|---|---|---|
        | Current (Estimate mark, not selectable) | VEH045 · Kasun Bandara | Ambient truck · no contact since 5:41 · estimate | Around 7:15 |
        | Selected (`petrol-50`, 1.5 px `petrol-700`) | VEH060 · Nimal Fernando | Ambient van · standby, free until 8 AM | Arrives around 8:05 |
        | Blocked (`asphalt-50`, `triangle-alert` `problem-strong`) | VEH057 · Priyantha Silva | Refrigerated van on a chilled run. With this order, trip 2 would carry 1,373.6 of 1,040 kg | Not suitable |

      - "Checks for VEH060, trip 1":
        - Rule check / problem (`problem-soft`): "Arrives around 8:05 AM, after Aranayake's 7:30 close and about 50 minutes after Kasun's estimate."
        - Rule check / info (`asphalt-50`, `info`): "Still worth sending as a backup: if Kasun is stuck, Aranayake gets no dry goods until Thursday, and a late delivery still stocks its shelves this morning."
        - Pass lines (`check` `done-strong`): "Dry order, ambient van", "Kandy hub vehicle and outlet", "Rear dock, any vehicle can unload there", "The hub's standby, kept free for problems like this".
        - Capacity meters, 2 x 2: "Weight" "572.0 of 1,200 kg"; "Volume" "3.168 of 9.0 m³"; "Fuel this week" "0.0 of 520 L" (no fill); "Fresh time" "68 of 270 min". All normal.
        - Caption: "This trip uses about 7.4 L of VEH060's weekly fuel."
        - Rule check / info: "The goods are on VEH045, so VEH060 takes a new pick of ORD0098593 at the Kandy dock. The dock flags any shortfall before it leaves."
      - Notice / attention (below the fold): "Kasun won't see this until his phone reconnects." / "If he delivers stop 4 first, Relay asks him to confirm and cancels VEH060's copy."
      - Reason (required), below the fold: "No contact from Kasun for 34 minutes. Backup in case he is stuck."
      - Footer: "Nimal, the Kandy hub dock and Waypoint Fresh Aranayake are told now. Kasun sees the change when his phone reconnects." / "Cancel" / "Move stop 4 to VEH060".
      - Messages sent on confirm (for the build, not drawn): to Nimal "New trip: 1 stop, Waypoint Fresh Aranayake (OUT116). Collect 86 dry cases for ORD0098593 at the Kandy hub dock."; to the dock, a new load on LDR-01 "VEH060 trip 1. ORD0098593 for OUT116: 30 rice and dhal, 32 packet foods, 24 tea and biscuit cases."; to Waypoint Fresh Aranayake "Your delivery may be late today. We have sent a second vehicle as a backup, expected around 8:05 AM. We'll update you."; to Kasun, held until his phone reconnects, "Stop 4 moved to VEH060 at 6:15 AM."
      - Behaviour, for the build: hard rules block (temperature, van only, home depot, weight, volume, two trips a day); time rules show as problem lines and need the reason (outlet window, Fresh window, store opening). Relay keeps Fresh dry off refrigerated trips (Waypoint practice, as in the data). The Fresh time meter counts standard minutes against the 270 budget, as on DSP-02. Relay does not track dock stock, so stock is an info line, not a check. The primary button stays disabled until the reason has text.
  - **`DEG-03 Live runs during the silence / stop 4 moved`** (Should). 6:15 AM, just after "Move stop 4 to VEH060". The drawer has closed.
    - Tiles: "13" vehicles running (VEH060 joins), "26 of 53", "1" driver out of contact, "0" "standby vehicles free" (`van` in `asphalt-500`).
    - VEH045 track: stop 4 becomes Stop marker / moved (`attention-soft`, 1.5 px `attention-strong` ring, number in `attention-strong`), "Aranayake" / "Also on VEH060" in `attention-strong`. Caption "Last record: stop 2, arrived 5:30 AM. Stop 4 also given to VEH060 at 6:15."
    - VEH060 row: `van` "Ambient van · Backup" / "Kegalle, 1 stop". Track: hub "Loading at the dock", then Stop marker / next "1", "Aranayake" / "around 8:05", with Status chip / late risk "Late risk" under it. "Synced 6:15 AM".
    - Exceptions, "Now": Exception item / attention / expanded (4 px `attention-strong` bar, `clock`): "Stop 4 moved to VEH060" / "6:15 AM" / meta "VEH045 stop 4 · OUT116 · ORD0098593 · by you" / "Kasun hasn't seen this yet. His phone gets it when it reconnects." / "If he delivers stop 4 first, Relay asks him to confirm and cancels VEH060's copy." / Caption "VEH060 arrives around 8:05, after Aranayake's 7:30 close." No actions, no footer. Under it, collapsed: `cloud-off` "No contact from Kasun" / "Since 5:41 AM · stops 3 and 4 estimated" / "34 min".
    - Toast, 680 wide at the foot of the runs panel, `asphalt-900`, radius 8: `check` "Stop 4 moved to VEH060. Nimal, the Kandy hub dock and the store have been told." It fades after 6 seconds; the panel's footnote steps aside while it shows.
  - **`DEG-03 Live runs during the silence / receipt in`** (Must, new in v0.4). 6:42 AM. At 6:42 Dilani confirms receipt from the store (STM-05 Confirm receipt / before driver proof): everything arrived, 96 cases. A store's confirmed receipt counts as a stop event, so Relay treats Kasun as having delivered at Hemmathagama by 6:42 and moves his estimate for Aranayake. Kasun is still out of contact.
    - Clock "Wed 8 Apr · 6:42 AM". Tiles "13", "34 of 53", "1", "0".
    - VEH045 track: 1 "Kegalle" / "Delivered 5:11"; 2 arrived "Mawanella" / "Arrived 5:30"; 3 delivered "Hemmathagama" / "Store receipt 6:42"; the Estimated vehicle marker between stops 3 and 4; 4 moved "Aranayake" / "around 7:05" in `attention-strong`. Caption "Last record: stop 2, arrived 5:30 AM. Stop 3 counted from the store's receipt." (one line) Last synced "No contact" / "since 5:41 AM" / "61 min".
    - VEH060: hub "Left 6:36", then "Aranayake" / "around 8:05" with "Late risk". "Synced 6:42 AM". VEH042 "Synced 6:42 AM". The footnote is back.
    - Exceptions, "Now": Exception item / attention / expanded, `clock`:
      - Title "Hemmathagama confirmed receipt"; meta "6:42 AM · VEH045 stop 3 · OUT117 · ORD0098595".
      - "Dilani confirmed everything arrived, so Kasun has delivered there. Relay has moved his estimate for Aranayake from this receipt."
      - Estimate row: marker 4, "Aranayake, now" / "Window 5:00 to 7:30" / "around 7:05" / "likely 6:45 to 7:55" in `attention-strong`.
      - `van` "VEH060 is on its way, around 8:05."
      - `clock` `attention-strong` "The range still runs past Aranayake's 7:30 close, and there is still no contact from Kasun."
      - "Keep the backup on its way?" in Body dense SemiBold.
      - Collapsed under it: `clock` `attention-strong` "Stop 4 moved to VEH060" / "6:15 AM, by you. VEH060 left the hub at 6:36."; `cloud-off` "No contact from Kasun" / "Since 5:41 AM · stop 4 estimated" / "61 min". "Earlier today" as on DEG-03.
      - Panel footer (fixed, 64): Button / secondary "Cancel backup", Button / primary "Keep backup".
    - At 6:44 Nuwan taps Keep backup and types his note: "Kasun still offline on the hill road. If his truck is stuck, Aranayake gets nothing until Thursday." The item then folds into "Earlier today" as "Hemmathagama confirmed receipt" / "6:42 AM. You kept the backup at 6:44." Not drawn.
    - Behaviour, for the build: a store's receipt is shown to the dispatcher as its own item and never settles the driver's records by itself; it moves the estimate for the stops after it and asks about any backup still on the road. "Cancel backup" would turn Nimal back with the same voice message as DEG-05.
- **Prototype:** "Move" on stop 4 opens / move stop 4 (move in from the right, 240 ms, ease out). On / move stop 4, "Move stop 4 to VEH060" goes to / stop 4 moved; "Cancel" and close return to DEG-03. / stop 4 moved goes to / receipt in after 3 s (the store's receipt arriving). On / receipt in, "Keep backup" goes to DEG-05 / waiting for answer (dissolve, 200 ms): the next thing Nuwan sees is the records arriving at 7:14. "Move" on stop 3, "Cancel backup", other picker rows, run rows, collapsed items and the nav: no target, so the story's clock never jumps sideways.
- **Rationale:** Twenty-four minutes without contact used to mean a phone call and a guess. Here Nuwan sees what Relay actually knows: Kasun's last record, the last time his phone reached us, and an estimate for each stop, drawn dashed so it never looks like a fact. Relay cannot tell a lost signal from a flat battery, so it names neither. Every estimate follows one rule, from the last stop event with each store's usual unloading time, and the range widens with every minute of silence. Aranayake's range already runs past its 7:30 close and the standby tile shows what he can send, so the decision is his, with the cost in view: the drawer shows the backup lands after the close and says why it is still worth sending. When the store's receipt arrives at 6:42, Relay moves the estimate and asks him again.

---

## DEG-04 Arrival tracker during the silence

- **Frame:** `DEG-04 Arrival tracker during the silence` (named `DEG-04 Arrival tracker in low signal` before this pass; the step removes the old name too), phone 390 wide, full length (1,285) under the fixed status bar and header, background `asphalt-50`. 6:05 AM, signed in as Dilani Jayawardena, Waypoint Fresh Hemmathagama (OUT117). Her phone uses the store's Wi-Fi and stays connected; driver phones do not join store Wi-Fi (Waypoint policy). This is STM-04 Arrival tracker 45 minutes after its 5:20 snapshot.
- **Purpose:** give Dilani an arrival time she can roster staff against, and be honest that it is an estimate and why.
- **Layout:** the STM-04 shell and cards (`spec-store-manager.md`).
  1. System status bar. 2. Top bar / phone header / back, 64 high. 3. Content, padding 16, gap 16:
  - Arrival card (`white`, 1 px `asphalt-200`, radius 12, padding 20, gap 8): chip row (28 px Status chips); order ID in Label `asphalt-500`; "Arriving around" in Label; the time in Display; window line in Body `asphalt-700`; "Planned 5:30 AM" in Label `asphalt-500`, as on STM-04; estimate line (16 px Estimate mark) in Body `asphalt-700`; divider; staff row (`users` 20, Body strong); position row (Estimate mark, Heading 3); last heard row (`cloud-off` 16, Label); Notice / waiting, compact inline (`waiting-soft`, radius 8, padding 12, `cloud-off` 20, Body then Body `asphalt-700`).
  - Run card: title, Stop progress list (store view), three rows of 56 with a rail, caption.
  - Driver card (Person row, no call button). On board card.
- **Content:**
  - Status bar "6:05". Header "Your delivery".
  - Chips: "Dry"; "No word since 5:41" (waiting tones, `cloud-off`). The chip says what Relay knows, not why.
  - "ORD0098595" / "Arriving around" / "6:35 AM" / "Your window is 4:00 to 7:45 AM" / "Planned 5:30 AM" / Estimate mark "Likely between 6:05 and 7:05 AM."
  - Staff row: "Have someone at the rear dock from now." (the early end of the range, which never starts before the time shown).
  - Position row: "Your store is probably his next stop"
  - Last heard row: "Last heard from Kasun 5:41 AM"
  - Notice: "Kasun's phone last reached us at 5:41 AM, after he arrived at Mawanella. Hill roads often lose signal, so these times are our estimate." / "They update as soon as his phone reconnects." (a no-break space keeps "5:41 AM" whole)
  - Run card: "Kasun's run this morning"

    | Marker | Stop | Status |
    |---|---|---|
    | `circle-check` `done-strong` | Stop 1, Kegalle | Delivered 5:11 AM |
    | `signal-400` dot | Stop 2, Mawanella | Arrived 5:30 AM. Last heard 5:41 AM |
    | `map-pin` `asphalt-900` on `asphalt-100` | Stop 3, your store | 16 px dashed Estimate mark, then Around 6:35 AM (Label SemiBold `asphalt-900`), as on STM-04 |

    Caption: "Times update when Kasun's phone next reaches us." (as on STM-04 / past estimate)
  - Driver card: "Kasun Bandara" / "Driver, VEH045 dry-box truck" / "Left the Kandy hub at 3:44 AM"
  - On board: "Coming to you" / "30 rice and dhal, 44 packet foods, 22 tea and biscuit cases" / `clock` `attention-strong` "6 rice and dhal cases follow on Thursday" / `warehouse` "Unloading at your rear dock"
  - Behaviour, for the build: the time, range and "Last heard" come from the same estimate the dispatcher sees on DEG-03. Once the estimate passes with no word, STM-04 / past estimate takes over (6:40, "Goods already at your store? Confirm receipt"). When the phone reconnects, Dilani gets one notification: delivered with the proof, or a new time.
- **States:** none. STM-04 / past estimate (6:40) and STM-05 / before driver proof (6:42) are in the Store Manager section and named in the grid note.
- **Prototype:** Back goes to STM-01 My orders / on the way. Nothing else is tappable.
- **Rationale:** Dilani needs one thing at 6:05: when to have someone at the rear dock. So the screen leads with a time, but an honest one. It says around 6:35 with a likely range, says plainly that it is an estimate and why, and shows when Relay last heard from Kasun. It does not claim to know where he is or why he is quiet, only that hill roads often lose signal. Going quiet would be worse than being approximate, because she would either keep staff waiting or phone the depot. The staff line turns the range into an instruction she can act on, and Nuwan reads the same estimate on his screen.

---

## DEG-05 Conflict resolved

- **Frame:** `DEG-05 Conflict resolved`, desktop 1440 x 900, background `asphalt-50`. 7:16 AM, Kandy hub, Fresh runs. Kasun's phone reconnected at 7:14 at Aranayake's dock and sent 7 records. At 7:15 he confirmed his stop 4 record and Relay cancelled VEH060's copy. Nimal's phone played the cancellation aloud and he turned back.
- **Purpose:** show Nuwan that the offline records arrived intact, and how the clash over stop 4 was settled, with the evidence and the follow-through in one place.
- **Layout:** the same shell as DEG-03, with a fixed footer on the exceptions panel.
  - Run row / back in coverage, expanded, selected (`petrol-50`, 3 px `petrol-700` bar): the top part as DEG-03, all four markers delivered, stops 2 to 4 with the Recorded offline badge (a 14 px `white` circle with `history` 10 at the marker's lower right), a hub marker, and Status chip / conflict resolved under stop 4. Below it the Records table (`white`, 1 px `asphalt-200`, radius 8): title bar (Heading 3 and Caption), column header 32 (`asphalt-50`, Caption), seven rows at least 32 high, padding 6 12 (52 when Details wraps), Body dense; columns Stop 136, Record 92 (icon 16: `circle-check` Delivered, `map-pin` Arrived, `camera` Photo), Time on phone 96, Location stamp 128, Details fill.
  - VEH060 row, then the group row and the out-of-service rows below the fold. A row that would show less than half above the fold is pushed just below it.
  - Exceptions: Exception item / done / expanded (4 px `done-strong` bar, `circle-check`): outcome in Body dense SemiBold; "What happened" Event timeline (time in Label SemiBold 56 wide, an 8 px dot on a 2 px `asphalt-200` rail, the last dot `done-strong`, text in Body dense; the 7:09 row carries the 56 x 56 Photo thumbnail); "Who has been told" Recipient rows (32 high, name in Body dense SemiBold, status in Caption, `chevron-down` 16); cost line (`fuel` 16, Caption). "Earlier today" below the fold. Fixed footer with Button / primary.
- **Content:**
  - Clock "Wed 8 Apr · 7:16 AM". Tiles: `truck` "13" "vehicles running"; `package-check` "41 of 53" "stops delivered"; `cloud-off` `asphalt-500` "0" "drivers out of contact"; `van` `asphalt-500` "0" "standby vehicles free".
  - VEH045: "VEH045" / "Kasun Bandara" / "Ambient truck · Trip 1" / "Fresh dry, Kegalle district". Track: "Kegalle" "5:11"; "Mawanella" "5:59"; "Hemmathagama" "6:36"; "Aranayake" "7:09" with "Conflict resolved"; hub "Hub next". Last synced: "Synced 7:14 AM" / "7 records received" / "Offline 5:41 to 7:14".
  - Records table: "Records from Kasun's phone" / "Received 7:14 AM. Times are from his phone, whose clock was within 3 seconds of Relay's."

    | Stop | Record | Time on phone | Location stamp | Details |
    |---|---|---|---|---|
    | 2 · Mawanella | Delivered | 5:59 AM | 12 m from OUT118 | Signed by N. Wijesinghe · 138 cases |
    | 3 · Hemmathagama | Arrived | 6:21 AM | 9 m from OUT117 | Arrival stamp only |
    | 3 · Hemmathagama | Delivered | 6:36 AM | 11 m from OUT117 | Received by W. Rathnayake · 96 cases, 6 short, added to Thursday |
    | 3 · Hemmathagama | Photo | 6:36 AM | 11 m from OUT117 | 96 cases at the rear dock |
    | 4 · Aranayake | Arrived | 6:56 AM | 18 m from OUT116 | Arrival stamp only |
    | 4 · Aranayake | Delivered | 7:09 AM | 22 m from OUT116 | Received by K. Herath · 86 cases |
    | 4 · Aranayake | Photo | 7:09 AM | 22 m from OUT116 | Cases at the rear dock |

  - VEH060: "VEH060" / "Nimal Fernando" / "Ambient van · Backup" / "Kegalle, 1 stop". Track: hub "Left 6:36"; Stop marker / cancelled (`asphalt-100`, `x`) "Aranayake" / "Cancelled 7:15"; hub "Back around 8:05". Caption "Turned back 39 minutes out, with the 86 cases for the hub's ambient store." "Synced 7:16 AM".
  - Group row "11 more vehicles running" / "All in contact, nothing to act on"; the two workshop rows.
  - Expanded item: "Stop 4 conflict resolved" / "7:15 AM"; meta "VEH045 stop 4 · OUT116 · ORD0098593"; outcome "Kasun delivered it at 7:09 AM. VEH060's copy is cancelled."
    - "What happened":

      | Time | Text |
      |---|---|
      | 6:15 AM | You moved stop 4 to VEH060: no contact for 34 minutes. |
      | 6:44 AM | You kept the backup after Hemmathagama's receipt. |
      | 7:09 AM | Kasun delivered 86 cases, received by K. Herath, 22 m from the outlet. (Photo thumbnail, accessible label "Kasun's photo, 7:09 AM, 22 m from OUT116".) |
      | 7:15 AM | Kasun confirmed. VEH060's copy was cancelled and Nimal turned back. |

    - "Who has been told":

      | Name | Status | Message, on expand |
      |---|---|---|
      | Nimal Fernando, VEH060 | Played aloud 7:15 AM | Aranayake is cancelled. Go back to the Kandy hub with the 86 cases. |
      | Kandy hub dock | Sent 7:15 AM | Expect VEH060 back around 8:05 AM with 86 dry cases for the ambient store. |
      | Waypoint Fresh Aranayake | Sent 7:15 AM | Delivered 7:09 AM, proof attached. The backup is cancelled. |

    - Cost line: "The cancelled trip used about 36 km and 3 L of fuel."
  - "Earlier today": `circle-check` "Kasun Bandara back in contact" / "7:14 AM · offline 93 min · 7 records received"; `circle-check` "Hemmathagama confirmed receipt" / "6:42 AM. You kept the backup at 6:44."; `clock` "VEH042 running about 45 min late" / "Reported 4:28 AM. Marked as handled 4:35 AM."; `package-x` "Shortfall on VEH045, stop 3" / "Decided 2:52 AM: send short, add to Thursday."
  - Panel footer: "Mark reviewed". No call button: Nimal is driving.
  - Behaviour, for the build:
    - Records keep the phone's own time and location stamp; the server's receipt time is kept separately. Records that clash with nothing are accepted at once (stops 2 and 3 went straight through). The store's status for stop 4 is held until the clash is settled, so Aranayake is never told "delivered" by mistake, and the stop counts as delivered only once settled (40 of 53 at 7:14, 41 at 7:16).
    - A driver's "Yes, I delivered it", backed by a delivery record, a photo and location stamps, settles the clash on its own. The dispatcher can settle it at any time with "Cancel VEH060's copy" on / waiting for answer; whichever answer comes first wins. A "No", or no answer within 10 minutes, moves the item to the top of the feed.
    - A change to the trip a driver is driving right now is the one message that plays aloud: a short recorded clip in his language ("Your next stop is cancelled. Go back to the hub.") and a full-screen card that names the stop and needs no tap. Every other message is silent.
    - "Mark reviewed" moves the item to "Earlier today" as "Stop 4 conflict resolved" / "Reviewed" with the time. Not drawn.
- **States:**
  - **`DEG-05 Conflict resolved / waiting for answer`** (Should). 7:14 AM. The records have arrived and Relay has asked Kasun. Differences from DEG-05:
    - Clock "Wed 8 Apr · 7:14 AM". Tiles "13", "40 of 53" (stop 4 held until settled), "0", "0".
    - VEH045: stop 4 becomes Stop marker / conflict (`attention-soft`, 1.5 px `attention-strong` ring, `clock` 16) "Aranayake" / "Delivered 7:09" with Status chip / two copies (`attention-soft`, `clock`, Label `attention-strong`) "Two copies". Last synced and the records table as DEG-05.
    - VEH060: hub "Left 6:36", then Stop marker / next "Aranayake" / "around 8:05" with "Late risk"; caption "A new pick of ORD0098593, 86 dry cases."; "Synced 7:14 AM".
    - Exceptions, "Now": Exception item / attention / expanded, `clock`, gap 16: "Stop 4 has two copies" / "7:14 AM"; meta "VEH045 stop 4 · OUT116 · ORD0098593"; "Kasun's phone says he delivered stop 4 at 7:09 AM. You moved it to VEH060 at 6:15 AM, while there was no contact from him."; "Kasun's records": "Arrived 6:56 AM · 18 m from OUT116" / "Delivered 7:09 AM · received by K. Herath · 22 m from OUT116" with the 56 px photo thumbnail; "Nimal is on his way to Aranayake, around 8:05."; Caption "Kasun has been asked too. Whichever answer comes first settles it."
    - Panel footer: Button / primary "Cancel VEH060's copy".
    - "Earlier today": back in contact, the receipt, the VEH042 delay and the shortfall, collapsed.
- **Prototype:** / waiting for answer goes to DEG-05 after 2,500 ms (dissolve, 200 ms), standing in for Kasun's answer. "Cancel VEH060's copy": no target (the story settles through Kasun's answer, and DEG-05's copy names him). "Mark reviewed", the thumbnail, recipient rows, run rows, collapsed items and the nav: no target.
- **Rationale:** This is the moment the offline design pays off or falls apart. Kasun's seven records arrive with the times and location stamps his phone captured, not the time they reached the server, so the record of the morning is intact. The clash over stop 4 was settled by the person who was there, and his photo and stamps sit beside his answer and beside Nuwan's two decisions, the move at 6:15 and the backup kept at 6:44. Relay then does the follow-through a dispatcher would otherwise do by phone: it cancels VEH060's copy, turns Nimal back with a voice line he can hear while driving, updates the store and shows what the extra trip cost. Nuwan reviews a finished decision instead of starting a new one.

---

## Components needed

Used as they are from the style guide and sibling specs: Button (primary, secondary, quiet; desktop and field), Status chip (Dry, Short, late risk, waiting to send, the store's waiting chip), Sync pill (all synced, offline with count), Capacity meter, Sheet (side drawer), Notice (attention; the driver spec's done, info and waiting variants), Input (text), the dispatcher shell (nav rail, page header, depot switch, Key figure / tile, Marker legend), the driver spec's phone header (root and back), the store spec's phone header, Next stop card / full, Step progress, Stop marker (phone), Stop row / field and its summary variant, Bottom action bar (field), Stop progress list (store view), Person row, Photo thumbnail, System status bar, Home indicator. New, or new variants (the merged list is `components.md`, which wins where the two differ):

| Component | Variants | Used in |
|---|---|---|
| Sync pill, new variant | sending ("Sending {n} stops" or "Sending {n} photos", waiting tones, `refresh-cw`) | DEG-02 / sending |
| Status chip, new variants | Sending (waiting tones); Needs your answer and Two copies (attention, `clock`); Conflict resolved (done, `circle-check`); a label wider than its line wraps inside the chip | DEG-01, DEG-02 all, DEG-05 all |
| Notice, new variant | waiting, compact inline inside a card (store) | DEG-04 |
| Estimate mark | 16, 20, 24 and 28 px circle with a 1.5 px dashed `asphalt-500` ring | DEG-03 all, DEG-04 |
| Sync question card (phone) | open (the answered state is DRV-05's "Stop 4 is settled" notice) | DEG-02, / Sinhala |
| Run row (the DSP-04 component) | no contact (selected, with caption); back in coverage, expanded with records table; standby (hub marker only); backup (hub, stop, hub); group row "more vehicles running"; out of service | DEG-03 all, DEG-05 all |
| Stop marker (desktop) | delivered with recorded offline badge, estimated (dashed), moved, conflict, cancelled, hub; 24 and 28 px | DEG-03 all, DEG-05 all |
| Estimated vehicle marker (desktop) | dashed truck marker on the connector, labeled "Estimated" | DEG-03 states |
| Key figure / tile (the DSP-04 component) | icon tone per state: normal, waiting count, standby count | DEG-03 all, DEG-05 all |
| Exception item (the DSP-04 component) | tones waiting and done-expanded; title that wraps beside its time; panel footer that holds the expanded item's actions | DEG-03 all, DEG-05 all |
| Estimate row (desktop) | with Move button; range in `attention-strong` when it runs past the close | DEG-03, / receipt in |
| Vehicle picker row (desktop) | current (estimate, not selectable), selected, available, blocked with reason | DEG-03 / move stop 4 |
| Rule check (the DSP-02 component) | line variants pass, info, problem | DEG-03 / move stop 4 |
| Event timeline (desktop) | rows with time, rail dot and text; optional thumbnail; last row in `done-strong` | DEG-05 |
| Records table (desktop) | title bar with caption, header, rows with record-type icon | DEG-05 all |
| Recipient row (desktop) | collapsed (name and status), expanded (message) | DEG-05 |
| Toast (desktop) | confirmation, `asphalt-900` fill | DEG-03 / stop 4 moved |

---

## Facts used on these frames

Every value is copied from `05-scenario-data.md` v0.4: the day, the weather and the cause; Kasun's run table (stops, windows, access, Planned, Expected and Actual times); the estimates table (6:05, 6:15, 6:40 and 6:42 rows); "What others see while he is offline"; "The standby and the move at 6:15 AM"; the timeline; and facts 25 to 37 (legs, check-ins, proof at each stop, location stamps, what counts as a record, end of trip, Sampath's delay, stops delivered as Relay knows them, settling the clash, the ending, the receipt). The following are derived from it, and are the only figures on these frames that the scenario does not print in the same words:

1. **"Window open, 1 h 40 min left"** on DEG-01: Hemmathagama's 7:45 close minus 6:05.
2. **"about 50 minutes after Kasun's estimate"** in the move drawer: VEH060's 8:05 minus Kasun's 7:15 estimate at 6:15.
3. **Tiles.** "12 vehicles running" is the board's Kandy hub count (12 running, 1 standby); after the move VEH060 is running too, so 13, and the standby count drops from 1 to 0. "25, 26, 34, 40 and 41 of 53 stops delivered" are the scenario's counts at 6:05, 6:15, 6:42, 7:14 and 7:16.
4. **Group rows.** "10 more vehicles running" on the DEG-03 frames is the 12 running vehicles less VEH045 and VEH042; "11 more" on DEG-05, which does not show VEH042's row.
5. **"Synced" times** on connected rows read the snapshot's own minute, because a connected phone checks in once a minute (fact 26).
6. **VEH042's row** shows its four Matale stores delivered and Sampath heading back to the hub at 6:05 to 6:42: the scenario's own count model (the other runs at Relay's Expected times after the median 6 minute departure delay, which gives Sampath's 30, 42, 54 and 13 minutes behind plan) has him leaving Elkaduwa at 5:55 and back at the hub around 7:00. The row prints place names only, no times.
7. **Relay's position estimate** "Probably still unloading at Mawanella" at 6:05 and "on the road to Hemmathagama" at 6:15: the estimate rule with Mawanella's usual 44 minute unload after the 5:30 arrival (about 6:14), which is also why the estimate for Hemmathagama is 6:35.
8. **"36 km"** for the cancelled trip is the scenario's appendix figure (backup, km 36); the text prints "about 3 L".
9. **"2 stops to go"** on Kasun's item: stops 3 and 4.

## Open questions

1. **Sending in the background.** A web app can send queued records while closed only through Background Sync, which works in Chrome on Android (Kasun's phone) but not in Safari. This spec assumes Kasun keeps Relay open on the dashboard mount, which also lets Nimal's phone play the voice line. The team should confirm that for the demo.
2. **Language checks.** Every Sinhala and Tamil string in the DEG-01 and DEG-02 / Sinhala tables needs a native reader's check, with a Sinhala-speaking and a Tamil-speaking driver, before the prototype is recorded.
3. **Parity with the v0.4 sibling frames.** DEG-01 copies DRV-01 v0.4's detail grid (Planned and Expected side by side) and its wrapping Short chip; DEG-03 and DEG-05 use the tiles "vehicles running", "stops delivered", "driver out of contact" and "standby vehicle free", and the STM-04 chip reads "No word since 5:41". When DSP-04, DRV-01 and STM-04 settle their v0.4 strings, these should match them.
