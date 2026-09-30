# Driver Screens: Frame Spec (Relay, Team Ryzera)

> **v0.4 data alignment.** Every value in this spec now comes from `05-scenario-data.md` v0.4, which is built on the competition data, and matches the frames as built by `tools/figma-builder/steps/driver`. What changed from v0.3:
> - **Day and run.** Wednesday 14 October becomes **Wednesday 8 April 2026**. Kasun drives **VEH045, an ambient (dry-box) truck, Fresh dry, Kegalle district, 4 stops** (was VEH047, refrigerated, Fresh chilled, Kandy district, 5 stops). Stops: 1 OUT119 Kegalle (rear dock), 2 OUT118 Mawanella (curb), 3 OUT117 Hemmathagama (Dilani, rear dock), 4 OUT116 Aranayake (rear dock). Planned to leave the Kandy hub at 3:40 AM, left at 3:44.
> - **Load.** 383 cases planned and 377 loaded (was 108 and 106). Stop 3 is **6 rice and dhal cases short** (was stop 4, 2 dairy crates). Weight 2,470.8 kg of 2,530.8 kg planned. Case types are the dry ones: rice and dhal case, packet foods case, tea and biscuit case, with a neutral `box` icon and the **Dry** chip instead of `snowflake` and Chilled. Order IDs: ORD0098598, ORD0098597, ORD0098595, ORD0098593.
> - **Two named times.** Wherever a time for a stop to come appears, the driver sees **Planned** (the published standard at free flow) and **Expected** (Relay's model, rounded to 5 minutes). DRV-01's detail grid now holds Window, Unload at, Planned arrival and Expected arrival; the drop-off count moved under "Next stop". After Arrived, the arrival strip compares with the plan in neutral words and names the Expected time.
> - **Frames.** DRV-02 Stop / Early (3:52 AM at Peradeniya) is replaced by **DRV-02 Stop / Behind plan** (4:52 AM at Kegalle, 19 min behind plan, on Relay's expected time), and its Night copy is renamed **DRV-02 Stop / Behind plan / Night**. DRV-02 Stop / Stop 4 offline is renamed **DRV-02 Stop / Stop 3 offline** (6:21 AM at Hemmathagama). DRV-02 is now Mawanella at 5:30 AM, a curb stop. Proof of delivery is at Hemmathagama at 6:36 AM (96 cases, W. Rathnayake). DRV-03 / Before proof moves from 6:34 to 6:36 AM, because the scenario gives no earlier minute.
> - **Ending.** The trip summary appears at 7:10 AM with 3 stops to send while Kasun is still at Aranayake's dock; the signal returns there at 7:14, he answers the stop 4 question at 7:15 and taps **Finish trip at 7:17 AM at the dock** (was 7:40 on the road back). The backup is **VEH060**, Nimal's ambient van (was VEH058). Relay expects him at the hub around 9:05 AM.
> - **Review fixes (this pass).** DRV-02 Stop / Behind plan is now on the Driver flow, where the demo narrates it: "Accept load" goes to it, and its "Record delivery" goes on to DRV-01 Today's run at 5:20 (the proof screens are drawn for stop 3). DRV-03 / Change a line uses the loader's short case names beside the steppers ("Rice and dhal", "Packet foods", "Tea and biscuit"), so each name stays on one line.
> - **Signal.** The last contact is at 5:41 AM during stop 2, Mawanella, when an inter-monsoon thunderstorm takes his mobile network down until 7:14 AM (was "near Ulapane" during stop 3).
> - **Removed:** every v0.2 and v0.3 story value (VEH047, VEH058 as backup, Peradeniya, Gampola, Ulapane, Nawalapitiya, Kotmale Road, dairy crates and frozen boxes), the "New facts introduced" list (the scenario now holds those facts) and the v0.2 review notes. Decisions from those rounds that still hold are part of the sections below.

Frame-by-frame spec for the Driver role, written for the Figma build and for the Hackathon front end. Persona: Kasun Bandara, dry-box truck driver at the Kandy hub, on VEH045 trip 1 (Fresh dry, Kegalle district) on Wednesday 8 April 2026. Shared components are defined once in `components.md`. DEG-01 (working offline) and DEG-02 (back in coverage) belong to the degradation spec. This spec only links to them, and its sync pill and waiting-to-send marks follow the shared rules below so both specs show the same thing.

## Screen set

Kasun uses Relay on his own Android phone, mounted on the dashboard, and only when he has stopped. His day starts at the Kandy hub dock, where he checks and accepts the load on his phone (DRV-01 / Accept load). Then five screens follow one trip: the run (DRV-01), one stop at a time (DRV-02), proof of delivery (DRV-03), a problem report (DRV-04) and the trip summary (DRV-05). Each screen has one primary action at 56 px, and the sync pill sits in the header of every frame.

19 app frames at phone 390 x 844, plus 2 prototype-only story cards. On the canvas, frames whose content is taller than 844 run full length (the header, status bar and action bar are fixed in the prototype).

| Frame | Snapshot (Wed 8 Apr) | What it shows |
|---|---|---|
| DRV-01 Today's run / Accept load | 3:32 AM | At the Kandy hub dock: 377 of 383 cases, stop 3 short 6, Accept load |
| DRV-01 Today's run | 5:20 AM | Stop 1 delivered, on the way to stop 2, all synced |
| DRV-01 Today's run / Language | 5:20 AM | Language sheet open over the run |
| DRV-01 Today's run / Sinhala | 5:20 AM | The same moment in Sinhala |
| DRV-02 Stop | 5:30 AM | At the curb in Mawanella, before tapping Arrived |
| DRV-02 Stop / Arrived | 5:30 AM | Arrival saved and sent, on Relay's expected time |
| DRV-02 Stop / Behind plan | 4:52 AM | At Kegalle, 19 min behind plan and on Relay's expected time |
| DRV-02 Stop / Behind plan / Night | 4:52 AM | The same moment in Night colors, before first light |
| DRV-02 Stop / Stop 3 offline | 6:21 AM | At Hemmathagama with no signal, arrival saved on the phone |
| DRV-03 Proof of delivery | 6:36 AM | Hemmathagama, filled in, no signal |
| DRV-03 Proof of delivery / Before proof | 6:36 AM | Unloaded, nothing entered yet |
| DRV-03 Proof of delivery / Change a line | 6:36 AM | Steppers shown on each line |
| DRV-03 Proof of delivery / Signature | 6:36 AM | Signature sheet open |
| DRV-03 Proof of delivery / Saved | 6:36 AM | Stop 3 saved on the phone, 2 stops to send |
| DRV-04 Report a problem | 5:20 AM | Six reasons |
| DRV-04 Report a problem / Delayed | 5:20 AM | Delay details (prototype branch, not sent in the story) |
| DRV-05 Trip summary / Still waiting | 7:10 AM | At Aranayake's dock, all 4 stops done, 3 stops still on the phone |
| DRV-05 Trip summary | 7:17 AM | Everything sent, stop 4 settled, just before Finish trip |
| DRV-05 Trip summary / Finished | 7:17 AM | Trip closed at Aranayake's dock |
| DRV-S1 Signal drops | 5:41 AM | Prototype-only story card |
| DRV-S2 Last stop offline | 6:56 to 7:09 AM | Prototype-only story card |
| DRV-S3 Signal back | 7:14 to 7:15 AM | Prototype-only story card (06 Driver in the 13-page file) |

### Story path through the prototype

1. DRV-01 Today's run / Accept load (3:32)
2. DRV-02 Stop / Behind plan (4:52, at stop 1, Kegalle)
3. DRV-01 Today's run (5:20)
4. DRV-02 Stop (5:30)
5. DRV-02 Stop / Arrived (5:30)
6. DRV-S1 Signal drops (5:41)
7. DEG-01 Working offline (6:05, degradation spec)
8. DRV-02 Stop / Stop 3 offline (6:21)
9. DRV-03 Proof of delivery / Before proof (6:36)
10. DRV-03 Proof of delivery (6:36)
11. DRV-03 Proof of delivery / Saved (6:36)
12. DRV-S2 Last stop offline (6:56 to 7:09)
13. DRV-05 Trip summary / Still waiting (7:10)
14. DEG-02 Back in coverage / sending (7:14, degradation spec)
15. DEG-02 Back in coverage (7:14, degradation spec)
16. DEG-02 Back in coverage / answered yes (7:15, degradation spec)
17. DRV-05 Trip summary / Finished (7:17)

DRV-05 Trip summary (7:17) is a reference frame for the same screen just before Kasun taps Finish trip at the dock.

Side branches: Language and Sinhala from DRV-01; Report a problem and Delayed from DRV-01 or DRV-02; Change a line and Signature from DRV-03. DRV-02 Stop / Behind plan is on the story path, between the handover and 5:20; DRV-02 Stop / Behind plan / Night, the same moment in the Night colors, is a reference state opened from the frame list.

### Shared conventions for every driver frame

- **Frame fill:** `asphalt-50`. Cards are `white` with a 1 px `asphalt-200` border and radius 12. No shadows except on bottom sheets (0 8 24, #14181F at 12%). No gradients, no transparency effects. Sheet scrim uses the `scrim` token (see Night mode).
- **Type:** Atkinson Hyperlegible Next. Style guide styles: Display 32/40 Bold, Heading 1 24/32 Bold, Heading 2 20/28 SemiBold, Heading 3 16/24 SemiBold, Body 15/22 Regular, Label 13/18 Medium, Caption 12/16 Medium, Field button 18/24 SemiBold, and **Field title 18/24 SemiBold** for stop names, line names and values Kasun reads at arm's length. Times, quantities and IDs use tabular figures and never a monospace face. Anything Kasun must read to act is 15 px or larger; 13 px is only for chips, labels and meta lines.
- **Density:** Driver column of the style guide. Primary buttons 56 high, secondary and quiet buttons 48, list rows at least 64, tap targets at least 48 x 48 and spaced 8 apart. Side padding 16, section gap 24.
- **Icons:** Lucide at 1.75 stroke. 24 px in the header, in buttons and in fact rows; 20 px in cells and captions; 16 px in chips, pills and meta lines.
- **Color:** `petrol-700` only on the one primary button per screen (pressed `petrol-800`) and on selected choices (`petrol-50` fill). `signal-400` only on the next-stop marker and the trip progress segment, always with `signal-ink` on top. Status color is always paired with an icon and a word.
- **Access icons:** `warehouse` for Rear dock, `store` for Curb, `building-2` for Mall bay, `van` for Van only. Kasun's run has rear docks (Kegalle, Hemmathagama, Aranayake) and one curb stop (Mawanella).
- **Goods:** Kasun's run is Fresh dry. Drop-off lines use `box` 24 in `asphalt-700` and the header chip is Status chip / Dry (`box` 16, neutral). A chilled run would use `snowflake` in `chilled-strong` and Status chip / Chilled; no driver frame shows one.
- **Two named times.** *Planned* is the published standard at free flow, the clock the plan is checked on. *Expected* is Relay's model for the rain and the roads, the time the store sees, rounded to 5 minutes and always written "around 6:35 AM". Every stop still to come shows both, labelled. After Arrived, the arrival is compared with Planned in neutral words ("19 min behind plan"), never in attention color, because in the monsoon months almost every Kegalle stop arrives after its free-flow time (98.9% of first Kegalle stops in the route history); only a missed window is a problem.
- **Time copy:** "5:20 AM"; ranges "5:00 to 7:30 AM"; durations "19 min", "2 h 25 min".
- **Region 1, System status bar** (frame dressing, not built): 390 x 44, fill `white`, horizontal, padding 0 24, space between. Left: snapshot time in Label SemiBold `asphalt-900`, for example "5:20". Right: `signal` 16, `asphalt-900` when online; with no signal the carrier dots are hidden and `signal` is `asphalt-300`. Same as the store manager frames.
- **Region 2, Top bar / phone header with sync pill / field:** 390 x 64, the same height as the loader app bar and the store manager's back header. Fill `white`, bottom border 1 px `asphalt-200`, horizontal, centered vertically, gap 8.
  - Root (DRV-01 only): padding 8 16. Title in Heading 1 `asphalt-900` on the left, Sync pill on the right. No mark and no language button in the header; language lives in a row at the foot of DRV-01.
  - Back: padding 8 16 8 4. Button / quiet / icon only 48 x 48 with `arrow-left` 24, gap 8, title in Heading 2 `asphalt-900`, Sync pill.
  - Close: as Back, with `x` 24 instead of `arrow-left`. On DRV-04 the close header has no title, because the question on the screen names it.
  - Plain (DRV-03 / Saved): no back button, title in Heading 2, pill. The stop is saved, so there is nothing to go back to.
  - Width rule: the Sync pill never truncates and its copy keeps it under 180 wide. The title fills what is left, stays on one line and truncates with an ellipsis. As built, the widest pill is "3 stops to send" at 132 (DRV-05 / Still waiting), which leaves the back-header title 173; the Sinhala "සියල්ල යැවුණා" pill is 118.
- **Sync pill:** 32 high, radius 6 (the chip radius, not a pill button), horizontal, padding 0 10, gap 6, 16 px icon, Label text. Status only; it is not tappable on driver frames. It counts stops, the way Kasun thinks about his run, never records.
  - All synced: fill `done-soft`, `circle-check` and text in `done-strong`. Copy "All synced".
  - Offline: fill `waiting-soft`, 1 px `asphalt-300` border, `cloud-off` and text in `asphalt-700`. Copy "Offline" when nothing is waiting; "1 stop to send" or "{n} stops to send" while any part of a stop is on the phone; "1 photo to send" or "{n} photos to send" when only photos are left. Text is `asphalt-700` rather than `waiting-strong` because #69727F on #ECEFF3 is only 4.2:1, too low for arm's length; `asphalt-700` gives 8.8:1.
  - Sending: fill `waiting-soft`, 1 px `asphalt-300`, `refresh-cw` 16 and text in `asphalt-700`. Copy "Sending {n} stops", or "Sending {n} photos" when only photos are left. Shown for the seconds it takes to send (DEG-02 Back in coverage / sending).
- **What the pill counts in the story** (scenario, "Additional facts" 26 and 29). The phone stores records (see Build notes) and the dispatcher side counts records. Every driver surface counts stops:

  | Time | Added on the phone | Records waiting (build and dispatcher only) | Sync pill |
  |---|---|---|---|
  | 5:30 | Stop 2 arrived, sent at once | 0 | "All synced" |
  | 5:41 | Last check-in reaches the office, then the network drops. Nothing waiting | 0 | "Offline" |
  | 5:59 | Stop 2 delivered, with N. Wijesinghe's signature | 1 | "1 stop to send" |
  | 6:21 | Stop 3 arrived | 2 | "2 stops to send" |
  | 6:36 | Stop 3 delivered, plus its photo | 4 | "2 stops to send" |
  | 6:56 | Stop 4 arrived | 5 | "3 stops to send" |
  | 7:09 | Stop 4 delivered, plus its photo | 7 | "3 stops to send" |
  | 7:14 | Signal back: 5 stop records send, then 2 photos | 7, then 0 | "Sending 3 stops", then "All synced" (DEG-02) |

- **Waiting to send mark:** Status chip / waiting to send, 28 high, radius 6, fill `waiting-soft`, 1 px `asphalt-300`, `cloud-off` 16 and Label in `asphalt-700`, copy "Waiting to send". It appears on stop rows, on the arrival strip and on the saved summary. The offline banner belongs to DEG-01 and sits on the run list only; task screens (DRV-02, DRV-03, DRV-05) show the pill plus one helper line beside the main button, so the banner never pushes the task down.
- **Bottom action bar:** fixed, fill `white`, top border 1 px `asphalt-200`, vertical, padding 12 16, gap 8, then the 34 px home-indicator area with a 134 x 5 `asphalt-900` bar, radius 3 (frame dressing). Field variants: primary plus quiet (170 high), helper plus primary (140 high), notice only.
- **Disabled buttons:** one style for both field roles, the same as the loader's "disabled with reason": fill `asphalt-100`, no border, Field button text in `asphalt-700`, and the label says what is left (for example "Add a name and a photo"). There is no plain gray disabled variant on driver frames.
- **Status chips:** 28 high, radius 6, padding 5 8, gap 4, Label text, 16 px icon, the same as the store manager frames. Short uses `package-x` on `attention-soft` with `attention-strong` (the shared Status chip / Short). Dry uses `box` on `asphalt-100` with `asphalt-700`.
- **Shortfall wording**, the same everywhere on driver frames: Nuwan decided and the store was told, so nobody "agreed". Chip on the run list: "6 rice and dhal cases short, store told". Chip on a stop line: "6 short, store told". Chip inline on a proof line or in the handover table, where space is tight: "6 short". Explanation line: "Ordered 36. The other 6 come Thursday." Summaries: "6 rice and dhal cases short, store told."
- **Stop marker:** a circle with the stop number in Heading 3 (Heading 2 at 40 px), the same next-stop marker as STM-04. Next: fill `signal-400`, 1.5 px `signal-ink` ring, number `signal-ink`. Pending: fill `white`, 1.5 px `asphalt-300` ring, number `asphalt-700`. Short (handover table only): fill `attention-soft`, 1.5 px `attention-strong` ring, number `attention-strong`. Delivered: fill `done-strong`, `check` in `white`. Failed: fill `problem-strong`, `x` in `white`.
- **Window status line** (shared by the Window panel on DRV-02 and the Next stop card on DRV-01): 20 px icon, gap 6. The minutes left count to the window's close and update each minute.

  | State | Icon and color | DRV-02 copy (under "Receiving window") | DRV-01 copy |
  |---|---|---|---|
  | Opens soon | `timer`, `asphalt-900` | "Opens in {n} min" (Heading 2) | "Window opens in {n} min" |
  | Open | `circle-check`, `done-strong` | "Open now, 2 h 15 min left" (Mawanella at 5:30) | "Window open, 2 h 25 min left" (Mawanella at 5:20) |
  | Closing soon, under 30 min left | `clock`, `attention-strong` | "Closes in {n} min" | "Window closes in {n} min" |
  | Closed | `triangle-alert`, `problem-strong` | "Closed at {time}, {n} min ago" | "Window closed at {time}, {n} min ago" |

  Text is Body strong in the icon's color, except Opens soon, which is Heading 2 on DRV-02. When closed, DRV-02 adds Body `asphalt-700` under the line: "You can still deliver. Nuwan and the store will see it as late." Arrived stays enabled, because a late arrival is still delivered. Only Open is drawn: every stop on Kasun's run is inside its window.

- **Night mode.** First light in Kandy in early April is about 5:40 AM (story knowledge, not in the data), so the handover, stop 1 and the arrival at stop 2 all happen in the dark, and a white screen at full brightness dazzles Kasun in the cab. The driver route follows the phone's dark setting. Figma: the color variables would get a second mode, "Night", with the same token names, so components and layouts do not change. The Starter plan allows one variable mode, so the file keeps the Night values in the **Night token table** on the Design System page and draws **DRV-02 Stop / Behind plan / Night** with them (every token paint replaced by its Night value). Build: the same names as CSS custom properties, overridden under `prefers-color-scheme: dark` on the driver route. Every other frame in this spec is drawn in Light so it compares side by side with the other roles.

  | Token | Light | Night |
  |---|---|---|
  | `asphalt-900` | #14181F | #EEF1F5 |
  | `asphalt-700` | #3A424E | #C4CBD4 |
  | `asphalt-500` | #69727F | #9AA3AF |
  | `asphalt-300` | #B8BFC9 | #46505C |
  | `asphalt-200` | #D8DDE4 | #2F3741 |
  | `asphalt-100` | #ECEFF3 | #232A33 |
  | `asphalt-50` | #F5F7F9 | #0F1318 |
  | `white` | #FFFFFF | #181D24 |
  | `petrol-700` | #0F5563 | #7CC4D2 |
  | `petrol-800` | #0A4450 | #63AEBD |
  | `petrol-50` | #E5F1F3 | #153840 |
  | `signal-400` | #F2B705 | #F2B705 |
  | Chilled strong / soft | #0A6EBD / #E4F1FB | #72B8F0 / #11283B |
  | Done strong / soft | #1F7A4D / #E3F3EA | #6CCB96 / #14301F |
  | Attention strong / soft | #A15C00 / #FCEFD9 | #EDAE55 / #38280F |
  | Problem strong / soft | #B3261E / #FBE9E7 | #F2958B / #3B1815 |
  | Waiting strong / soft | #69727F / #ECEFF3 | #9AA3AF / #232A33 |
  | `signal-ink` (new) | #14181F | #14181F |
  | `scrim` (new) | #14181F at 40% | #000000 at 60% |

  Two new tokens keep the same value in both modes where flipping would break a pairing: `signal-ink` keeps dark text on the yellow marker, and `scrim` keeps sheet scrims dark. Contrast in Night: `asphalt-900` on `white` 15.0:1, `asphalt-500` on `white` 6.6:1, `white` label on `petrol-700` 8.6:1, `signal-ink` on `signal-400` 9.8:1, each status strong on its soft 7.1 to 7.3:1, `asphalt-700` on `asphalt-100` (disabled with reason) 8.9:1.

### Build notes for the Hackathon

- The driver view is a phone-first route in the same responsive web app, installable to the home screen.
- Every action writes to IndexedDB first. A send queue posts records in order when online, stop records before photos, and retries on the browser's online event (and Background Sync where the browser supports it). A record is one stop event (Arrived, Delivered, Load accepted, a problem report, Trip finished) or one photo, which always sends after its stop record so the stop reaches Nuwan first on a weak signal. A signature is small and travels inside its delivery record. So the story holds 1 record at 5:59, 2 at 6:21, 4 at 6:36, 5 at 6:56 and 7 at 7:09. The dispatcher frames and the queue count records; the driver's pill and notices count stops.
- While the app is open, the phone sends a small check-in once a minute with no location in it. The last one reaches the office at 5:41 AM, so Nuwan sees "No contact from Kasun since 5:41 AM". While a trip is running the app holds a screen wake lock, so check-ins keep going with the phone in its mount. Driver phones do not join store Wi-Fi (Waypoint policy), so Kasun's phone stays offline during his 15 minutes at Hemmathagama.
- Location comes from `navigator.geolocation`, read once at Arrived, Complete stop and Send report. Nothing is read in between. The time saves at once and never waits for a fix; the location is tried in the background for up to 15 s. In the story the stamps at stops 2 to 4 land 9 to 22 m from the store. With no fix, the arrival strip reads "Arrived 6:21 AM" / "Location not found. Time saved." with no retry prompt. If location permission is off, DRV-01 shows a one-time Notice / info: "Location is off. Stops still save with the time."
- Photos use a file input with `capture="environment"`, then a canvas resize to 1280 px on the long edge as JPEG, about 180 KB. The DRV-03 draft (counts, reasons, name, signature, photo) saves to IndexedDB on every change, so the form is still filled if Android unloads the page while the camera is open.
- Expected times on the phone are the ones Relay last sent; with no signal the phone keeps them and does not push them later. The dispatcher and the store read Relay's estimate rule (scenario, "Estimates while Kasun is silent").
- Strings live in en, si and ta files. The layout is the same in every language; only fonts and line heights change.
- Night mode: CSS custom properties with the token names above, overridden under `@media (prefers-color-scheme: dark)` on the driver route only.

---

## DRV-01 Today's run

- **Frame:** "DRV-01 Today's run", phone 390 x 844 (1,297 high on the canvas), background `asphalt-50`. Snapshot: Wednesday 8 April 2026, 5:20 AM. VEH045 trip 1 left the Kandy hub at 3:44 AM (planned 3:40). Stop 1, Kegalle, was delivered at 5:11; stop 2, Mawanella, is next; all synced. Kasun has pulled over on the way to stop 2.
- **Purpose:** Replace the paper run sheet with one glance that says where to go next, when he is expected, and whether the office has everything so far.
- **Layout:** vertical, content scrolls under the fixed status bar and header. The whole Next stop card, both buttons included, is on the first screen.
  1. System status bar, 390 x 44.
  2. Top bar / phone header with sync pill / field / root, 390 x 64. Sync pill / all synced.
  3. Trip strip, no fill, vertical, padding 16 16 8, gap 8.
     - 3a. Date in Body `asphalt-700`.
     - 3b. Trip line in Heading 3 `asphalt-900`.
     - 3c. Progress row, vertical, gap 6: count in Label `asphalt-700`, then Step progress 358 x 8, four segments with gap 4 and square ends. Segment 1 `done-strong`, segment 2 `signal-400`, segments 3 and 4 `asphalt-200`.
     - 3d. Meta line in Label `asphalt-500`.
  4. Next stop card / full, 358 x 450, margin 8 16 0, fill `white`, 1 px `asphalt-300` border (one step stronger than other cards), radius 12, vertical, padding 20, gap 16. This is the largest element on the screen.
     - 4a. Head row, horizontal, gap 12, centered: Stop marker / next 40 with "2". Text stack: "Next stop" in Heading 3 `asphalt-900`, then the stop and its drop-off count in Label `asphalt-500`. Status chip / Dry on the right.
     - 4b. Name block, vertical, gap 12: outlet short name in Display `asphalt-900` and the full outlet name and ID in Body `asphalt-700` (gap 4), then the Window status line / open (`circle-check` 20, Body strong `done-strong`).
     - 4c. Detail grid, 2 columns x 2 rows, column gap 12, row gap 16. Row 1 says where and how: the window and where to unload. Row 2 holds the two named times side by side. Each cell is Detail row / stacked / field: icon 20 in `asphalt-500` and label in Label `asphalt-500` on one line (gap 6), value in Field title `asphalt-900` below (gap 2). Cells may grow to two lines of value.
     - 4d. Button / primary / field, 318 x 56, radius 8, `petrol-700` fill, Field button text in `white`, `chevron-right` 24 trailing.
     - 4e. Button / quiet / field, 318 x 48, 8 below 4d, `triangle-alert` 24 leading, Field button text in `asphalt-900`. The same primary and quiet pair as the DRV-02 action bar.
  5. Section title row, padding 24 16 8: Heading 2 `asphalt-900`.
  6. Stop list card, 358 wide, fill `white`, 1 px `asphalt-200`, radius 12, 1 px `asphalt-200` dividers inset 60 from the left. Four Stop rows / field, horizontal, at least 64 high, padding 10 16, gap 12: Stop marker 32, text stack (name in Field title `asphalt-900`; meta in Body; for each stop still to come after the next one, "Planned" and "Expected" on their own lines in Label `asphalt-500`, because the pair does not fit one line of the 250 text column; optional chip line, 6 above), `chevron-right` 20 in `asphalt-500` trailing. The next stop's times are on the card above, so its row carries only the window and access. The stop 3 chip wraps inside itself rather than truncating.
  7. Language row, padding 16 16 0: Button / quiet / field, 358 x 48, left-aligned, `languages` 24 leading, Field button text in `asphalt-900`.
  8. Bottom padding 24, then the 34 px home-indicator area.
- **Content:**
  - Status bar: "5:20"
  - Header: "Today's run". Pill: "All synced"
  - 3a: "Wednesday 8 April"
  - 3b: "VEH045 · Trip 1 · Fresh dry, Kegalle district"
  - 3c: "1 of 4 stops done"
  - 3d: "Load accepted 3:32 AM · Left Kandy hub 3:44 AM"
  - 4a: "2" / "Next stop" / "Stop 2 of 4 · 138 cases" / chip "Dry"
  - 4b: "Mawanella" / "Waypoint Fresh Mawanella · OUT118" / "Window open, 2 h 25 min left"
  - 4c:

    | Icon | Label | Value |
    |---|---|---|
    | `clock` | "Window" | "4:00 to 7:45 AM" |
    | `store` | "Unload at" | "Curb" |
    | `calendar-clock` | "Planned arrival" | "5:01 AM" |
    | `timer` | "Expected arrival" | "around 5:30 AM" |

  - 4d: "Open stop 2"
  - 4e: "Report a problem"
  - 5: "All stops"
  - 6:

    | Stop | Marker | Name | Meta line | Planned and Expected lines | Chip line |
    |---|---|---|---|---|---|
    | 1 | Delivered | "Kegalle" | `check` 16 plus "Delivered 5:11 AM" in Body strong `done-strong` | none | none |
    | 2 | Next, "2" | "Mawanella" | "Next · 4:00 to 7:45 AM · Curb" in Body strong `asphalt-900` | none (on the card above) | none |
    | 3 | Pending, "3" | "Hemmathagama" | "4:00 to 7:45 AM · Rear dock" in Body `asphalt-700` | "Planned 5:30 AM" / "Expected around 6:35 AM" | Status chip / Short: "6 rice and dhal cases short, store told" |
    | 4 | Pending, "4" | "Aranayake" | "5:00 to 7:30 AM · Rear dock" in Body `asphalt-700` | "Planned 5:58 AM" / "Expected around 7:15 AM" | none |

  - 7: "Language: English"
  - Accessible labels: each row reads, for example, "Stop 3, Hemmathagama, window 4:00 to 7:45 AM, rear dock, planned 5:30 AM, expected around 6:35 AM, 6 rice and dhal cases short, store told".
- **States:**
  - **DRV-01 Today's run / Language.** 5:20 AM. DRV-01 sits underneath with the `scrim`. Sheet / bottom sheet, 390 wide including the home indicator, fill `white`, top corners radius 16, shadow, vertical, padding 8 16 16, gap 12.
    - Grabber 36 x 4, `asphalt-300`, centered. Title row: "Language" in Heading 2, Button / quiet / icon only 48 x 48 with `x` 24 (accessible label "Close").
    - Body `asphalt-700`: "Changes the words on this phone only."
    - Three Choice row / field / option, 358 x 64, 1 px `asphalt-200`, radius 12, padding 0 16, gap 12: name in its own script and font, caption in Label `asphalt-500`, trailing `check` 24 in `petrol-700` on the selected row, which also gets `petrol-50` fill and a 2 px `petrol-700` border.
      - "සිංහල" (Yaldevi SemiBold) / "Sinhala"
      - "தமிழ்" (Noto Sans Tamil SemiBold) / "Tamil"
      - "English" / no caption, selected
  - **DRV-01 Today's run / Accept load.** Specified in full in its own section below.
  - **DRV-01 Today's run / Sinhala.** Specified in full in its own section below.
  - Not drawn, for the build:
    - When Nuwan changes the run while the phone is online, a Notice / attention appears above the Next stop card with what changed and when (for example "Nuwan moved stop 4 to VEH060 at 6:15 AM"). In the story the only change arrives while Kasun is offline, so it is handled by DEG-02.
    - When location permission is off, a one-time Notice / info sits above the Next stop card: "Location is off. Stops still save with the time."
    - The status line in 4b follows the Window status line table (opens soon, open, closing soon, closed).
- **Prototype:**
  - "Open stop 2" goes to "DRV-02 Stop". The stop 2 row also goes to "DRV-02 Stop". Rows 1, 3 and 4 have no target in the prototype (the build opens that stop).
  - "Report a problem" goes to "DRV-04 Report a problem".
  - "Language: English" goes to "DRV-01 Today's run / Language".
  - DRV-01 Today's run / Language: "සිංහල" goes to "DRV-01 Today's run / Sinhala". "English", the `x` and the scrim go back to "DRV-01 Today's run". "தமிழ்" has no target.
- **Rationale:** Today's run replaces the paper run sheet Kasun carries out of the Kandy hub. He looks at it only after pulling over, often for a few seconds, so the next stop is the largest thing on the screen: the outlet, whether its window is open, where to unload, and two named times. Planned is the published standard at free flow; Expected is Relay's estimate for the rain and the roads, the time the store sees, so being behind plan does not read as late. Every stop sits in a list below, and the note on stop 3 tells him the six missing cases were settled by Nuwan before he left the hub, so nobody argues about it at the back door.

---

## DRV-01 Today's run / Accept load

- **Frame:** "DRV-01 Today's run / Accept load", phone 390 x 844 (1,134 high on the canvas), background `asphalt-50`. Snapshot: Wednesday 8 April 2026, 3:32 AM. Kasun is at the Kandy hub dock beside VEH045. Rizwan has just tapped Load complete on LDR-04, and the handover has reached Kasun's phone. All synced. VEH045 is planned to leave at 3:40 AM.
- **Purpose:** Let Kasun check what is on the truck against the plan, see the one shortfall and who decided it, and accept the load before he leaves.
- **Layout:** vertical; the notice, the route note and the first table rows are on the first screen, and the rest scrolls under the fixed action bar.
  1. System status bar, 390 x 44.
  2. Top bar / phone header with sync pill / field / root, 390 x 64. Sync pill / all synced.
  3. Trip strip, as DRV-01 region 3. Progress: segment 1 `signal-400`, segments 2 to 4 `asphalt-200`.
  4. Notice / attention, 358 wide, margin 8 16 0, fill `attention-soft`, radius 12, horizontal, padding 12 16, gap 12: `package-x` 24 `attention-strong`; text stack, gap 2: title in Heading 3 `asphalt-900`, body in Body `asphalt-900`.
  5. Section header, margin 24 16 0, vertical, gap 2: title in Heading 2 `asphalt-900`, caption in Caption `asphalt-500`.
  6. Route note, margin 8 16 0: `route` 16 `asphalt-700` and Label `asphalt-700`, gap 8. It names the stop order from the run sheet, so driving the stretch of the A1 between Kegalle and Mawanella twice is no surprise.
  7. Handover table (shared with LDR-04, same component and numbers), 358 wide, margin 8 16 0, fill `white`, 1 px `asphalt-200`, radius 12. Columns, with 16 padding each side: Stop 160 (left), Planned 88 (right), Loaded 78 (a 52 number slot, right-aligned, then a 20 slot for the check), so the Loaded numbers keep one right edge.
     - Header row, 40 high, fill `asphalt-50`, text in Caption `asphalt-500`.
     - Four stop rows in stop order, 64 high, 1 px `asphalt-200` between rows. Stop cell: Stop marker 32 (Pending, because nothing is delivered yet), gap 8, place in Body strong `asphalt-900`. Planned and Loaded in Body `asphalt-900`, tabular. Loaded is followed by `check` 20 `done-strong`. The short row has fill `attention-soft`, Stop marker / short, and Status chip / Short under the place name (Hemmathagama is the longest name on the run, so the chip sits under it rather than in the Loaded column). The loader's LDR-04 uses the same rows with Stop marker / done, numbered, because there the stops are loaded.
     - Total row, 52 high, fill `asphalt-50`: the three cells in Heading 3 `asphalt-900`, tabular; under it, across the row, the weight in Caption `asphalt-700` (padding 0 16 12).
  8. Sign-off line, margin 12 16 0, horizontal, gap 8: `user` 20 `asphalt-700` and two lines of Label `asphalt-700`.
  9. Bottom spacer 24.
  10. Bottom action bar / primary plus quiet, 390 x 170: Button / primary / field 358 x 56 with `package-check` 24 leading; Button / quiet / field 358 x 48 with `circle-alert` 24 leading, text `asphalt-900`.
- **Content:**
  - Status bar: "3:32"
  - Header: "Today's run". Pill: "All synced"
  - 3: "Wednesday 8 April" / "VEH045 · Trip 1 · Fresh dry, Kegalle district" / "0 of 4 stops done" / "Planned to leave Kandy hub 3:40 AM"
  - 4: "Stop 3 is 6 rice and dhal cases short" / "Nuwan Perera decided at 2:52 AM: send short, add to Thursday. The store was told at 2:52 AM."
  - 5: "Planned and loaded" / "In stop order, the way you unload"
  - 6: "Kegalle first, then back along the A1 to Mawanella: Kegalle's shelves come first this week, and Mawanella is the slowest unload."
  - 7: header "Stop", "Planned", "Loaded"

    | Stop | Planned | Loaded |
    |---|---|---|
    | "1" "Kegalle" | "57" | "57" with check |
    | "2" "Mawanella" | "138" | "138" with check |
    | "3" "Hemmathagama" with chip "6 short" (row fill `attention-soft`) | "102" | "96" |
    | "4" "Aranayake" | "86" | "86" with check |
    | "Total cases" | "383" | "377" |

    Total row caption: "Weight 2,470.8 kg of 2,530.8 kg planned" (the same as LDR-04).

  - 8: "Loaded by Mohamed Rizwan" / "Marked complete 3:32 AM"
  - 10: "Accept load" / "Something doesn't match"
- **States:** none drawn. After "Accept load" the phone shows DRV-01 Today's run with 3d reading "Load accepted 3:32 AM", and LDR-04 switches to "Kasun accepted the load". Not drawn, for the build: "Something doesn't match" opens a bottom sheet with Input / text / multiline / field ("What doesn't match?") and Button / primary / field "Send to Rizwan". The note saves on the phone first, appears on LDR-04 as Notice / problem (as the loader spec describes) and in the exceptions feed on DSP-04. Accept load stays available after a note is sent.
- **Prototype:** "Accept load" goes to "DRV-02 Stop / Behind plan" (4:52 AM, the first stop), whose "Record delivery" goes on to "DRV-01 Today's run" (5:20). "Something doesn't match" has no target. The flow "Driver flow" starts on this frame.
- **Rationale:** The handover is where Kasun's day starts, and it is the moment the booklet cares about: a problem found at the dock reaches the driver before he leaves, not at the store's back door. He sees the same planned and loaded table Rizwan sees on LDR-04, in the order he will unload, with the one difference, six rice and dhal cases for Hemmathagama, at the top with who decided and when. One line says why Kegalle comes before Mawanella, so driving that stretch of the A1 twice is no surprise. Accepting on his own phone gives both of them a timed record of what left the Kandy hub, and if something doesn't match, he says so while Rizwan is still at the dock.

---

## DRV-01 Today's run / Sinhala

- **Frame:** "DRV-01 Today's run / Sinhala", phone 390 x 844 (1,487 high on the canvas), background `asphalt-50`. Snapshot: Wednesday 8 April 2026, 5:20 AM, the same moment as DRV-01.
- **Purpose:** Show the run in the language Kasun reads most easily, with no change to layout or behavior.
- **Layout:** identical to DRV-01, region for region. Differences:
  - Sinhala runs are set in Yaldevi, matched in size and weight, with taller line heights so vowel signs above and below the letters never clip: Display 32/48 Bold, header title 24/36, Heading 2 20/30 SemiBold, Heading 3 16/26 SemiBold (the trip line and "Next stop"), Field title and Field button 18/28 SemiBold, Body 15/24 Regular, Label and chips 13/20 Medium.
  - Latin runs stay in Atkinson Hyperlegible Next: IDs (VEH045, OUT118) and the brand names "Waypoint Fresh" and "Fresh". Digits are Western digits in both scripts.
  - No-break spaces keep a phrase on one line: "පිටුපස ඩොක් එක" (rear dock), the departure clause of 3d and "කඩයට දන්වා ඇත" (store told). Yaldevi has no glyph for the no-break space, so each one is set in Atkinson at the same style.
  - What wraps: 3d (two lines, breaking after the dot), the window value in the detail grid, row 2's meta, rows 3 and 4's meta (the access on its own line) and the stop 3 chip. The Short chip grows in height rather than truncating. The card is about 50 px taller than in English (502 against 450) and still ends on the first screen.
- **Content:** Sinhala strings, with the English source for reference. The team should proofread these with a Sinhala-speaking driver before the prototype is recorded.

  | Region | English (DRV-01) | Sinhala (this frame) |
  |---|---|---|
  | Status bar | 5:20 | 5:20 |
  | Header title | Today's run | අද ගමන |
  | Sync pill | All synced | සියල්ල යැවුණා |
  | 3a | Wednesday 8 April | බදාදා, අප්‍රේල් 8 |
  | 3b | VEH045 · Trip 1 · Fresh dry, Kegalle district | VEH045 · ගමන 1 · Fresh වියළි, කෑගලු දිස්ත්‍රික්කය |
  | 3c | 1 of 4 stops done | නැවතුම් 4න් 1ක් අවසන් |
  | 3d | Load accepted 3:32 AM · Left Kandy hub 3:44 AM | බඩු භාරගත්තේ පෙ.ව. 3:32 · මහනුවර මධ්‍යස්ථානයෙන් පිටත් වුණේ පෙ.ව. 3:44 |
  | 4a title | Next stop | ඊළඟ නැවතුම |
  | 4a sub | Stop 2 of 4 · 138 cases | 4න් 2 වැනි නැවතුම · පෙට්ටි 138 |
  | 4a chip | Dry | වියළි |
  | 4b name | Mawanella | මාවනැල්ල |
  | 4b outlet line | Waypoint Fresh Mawanella · OUT118 | Waypoint Fresh මාවනැල්ල · OUT118 |
  | 4b status | Window open, 2 h 25 min left | දැන් භාරගන්නවා, තව පැය 2යි මිනිත්තු 25යි |
  | 4c label | Window | භාරගන්නා වේලාව |
  | 4c value | 4:00 to 7:45 AM | පෙ.ව. 4:00 සිට 7:45 දක්වා |
  | 4c label | Unload at | බාන තැන |
  | 4c value | Curb | පාර අයිනේ |
  | 4c label | Planned arrival | නියමිත පැමිණීම |
  | 4c value | 5:01 AM | පෙ.ව. 5:01 |
  | 4c label | Expected arrival | බලාපොරොත්තු පැමිණීම |
  | 4c value | around 5:30 AM | පෙ.ව. 5:30 පමණ |
  | 4d button | Open stop 2 | නැවතුම 2 විවෘත කරන්න |
  | 4e button | Report a problem | ගැටලුවක් දන්වන්න |
  | 5 | All stops | සියලු නැවතුම් |
  | Row 1 name | Kegalle | කෑගල්ල |
  | Row 1 meta | Delivered 5:11 AM | භාර දුන්නා, පෙ.ව. 5:11 |
  | Row 2 name | Mawanella | මාවනැල්ල |
  | Row 2 meta | Next · 4:00 to 7:45 AM · Curb | ඊළඟට · පෙ.ව. 4:00 සිට 7:45 දක්වා · පාර අයිනේ |
  | Row 3 name | Hemmathagama | හෙම්මාතගම |
  | Row 3 meta | 4:00 to 7:45 AM · Rear dock | පෙ.ව. 4:00 සිට 7:45 දක්වා · පිටුපස ඩොක් එක |
  | Row 3 times | Planned 5:30 AM / Expected around 6:35 AM | නියමිත පෙ.ව. 5:30 / බලාපොරොත්තු පෙ.ව. 6:35 පමණ |
  | Row 3 chip | 6 rice and dhal cases short, store told | හාල් සහ පරිප්පු පෙට්ටි 6ක් අඩුයි, කඩයට දන්වා ඇත |
  | Row 4 name | Aranayake | අරනායක |
  | Row 4 meta | 5:00 to 7:30 AM · Rear dock | පෙ.ව. 5:00 සිට 7:30 දක්වා · පිටුපස ඩොක් එක |
  | Row 4 times | Planned 5:58 AM / Expected around 7:15 AM | නියමිත පෙ.ව. 5:58 / බලාපොරොත්තු පෙ.ව. 7:15 පමණ |
  | 7 | Language: English | භාෂාව: සිංහල |
  | Sync pill, offline forms (not drawn, for the build) | Offline / 1 stop to send / 3 stops to send / 2 photos to send | සිග්නල් නැත / යැවීමට නැවතුම් 1ක් / යැවීමට නැවතුම් 3ක් / යැවීමට ඡායාරූප 2ක් |

  Word choices to check with a driver: "පිටුපස ඩොක් එක" (rear dock) is the spoken form; the formal alternative is "පිටුපස බාන තොටුපළ". "පාර අයිනේ" means at the roadside. "පෙ.ව." is the standard short form for AM. "කෑගලු දිස්ත්‍රික්කය" is the official form of "Kegalle district" and matches DEG-02 / Sinhala; the town stays "කෑගල්ල". "මහනුවර මධ්‍යස්ථානය" (the Kandy centre) stands for the Kandy hub, as on DEG-02 / Sinhala; drivers may simply say "ඩිපෝ එක" (the depot). "සිග්නල් නැත" uses the spoken loanword; the formal "සංඥා නැත" is the alternative.
- **States:** none. Tamil uses the same layout with Noto Sans Tamil and is not drawn.
- **Prototype:** "භාෂාව: සිංහල" goes to "DRV-01 Today's run" (back to English, so the rest of the prototype stays in one language). "නැවතුම 2 විවෘත කරන්න" and the stop 2 row go to "DRV-02 Stop".
- **Rationale:** Kasun reads Sinhala faster than English, and a run sheet he has to translate in his head is slow at arm's length. This is the same screen in Sinhala, set in Yaldevi at the same sizes with taller lines, so vowel signs never clip. Outlet codes, vehicle numbers and the Waypoint brand stay in Latin letters, as on cases, gates and the truck door. The layout is the same in every language, so switching never moves a button.

---

## DRV-02 Stop

- **Frame:** "DRV-02 Stop", phone 390 x 844 (860 high on the canvas), background `asphalt-50`. Snapshot: Wednesday 8 April 2026, 5:30 AM. Kasun has pulled in at the curb outside OUT118 Waypoint Fresh Mawanella, on Relay's expected time, and has not yet tapped Arrived. All synced.
- **Purpose:** Give Kasun everything he needs at one outlet and a single Arrived action that stamps the time and place.
- **Layout:** vertical. All three drop-off lines sit above the action bar; only the 16 px bottom padding scrolls.
  1. System status bar, 390 x 44.
  2. Top bar / phone header with sync pill / field / back, 390 x 64 (accessible label on the back button "Back to today's run"). Sync pill / all synced.
  3. Outlet block, horizontal, padding 16 16 0 (as the DRV-03 Title block and the DRV-05 Hero, so the marker and the Display name clear the header), gap 12, top aligned: Stop marker / next 40. Text stack, gap 2: short name in Display `asphalt-900`, full outlet name and ID in Body `asphalt-700`, and, before Arrived only, the two named times in Label `asphalt-500`.
  4. Window panel / open, 358 wide, margin 8 16 0, fill `white`, 1 px `asphalt-200`, radius 12, vertical, padding 16 16 4, gap 4.
     - Label in Label `asphalt-500`.
     - Window in Heading 1 `asphalt-900`, tabular.
     - Window status line / open.
     - 8 below, a 1 px `asphalt-200` divider, then Detail row / inline / field, 326 x 56: access icon 24 `asphalt-700`, label in Body `asphalt-700`, value right-aligned in Field title `asphalt-900`.
     - 1 px `asphalt-200` divider, then Button / quiet / field, 326 x 48, left-aligned, `phone` 24 leading, Field button text in `asphalt-900` (build: a `tel:` link to the outlet's stored number).
  5. Drop off section, margin 20 16 0, vertical, gap 8.
     - Title row, space between: Heading 2 `asphalt-900`, Status chip / Dry.
     - Order meta in Body `asphalt-700`, tabular.
     - Lines card, 358 wide, fill `white`, 1 px `asphalt-200`, radius 12. Three Load line / drop-off, padding 0 16, at least 56 high, divider between (inset 16): `box` 24 `asphalt-700`, gap 12, line name in Field title `asphalt-900`, count right-aligned in Heading 1 `asphalt-900`, tabular.
  6. Bottom padding 16.
  7. Bottom action bar / primary plus quiet, 390 x 170: Button / primary / field 358 x 56 with `map-pin` 24 leading; Button / quiet / field 358 x 48 with `triangle-alert` 24 leading, text `asphalt-900`.
- **Content:**
  - Status bar: "5:30"
  - Header: "Stop 2 of 4". Pill: "All synced"
  - 3: marker "2" / "Mawanella" / "Waypoint Fresh Mawanella · OUT118" / "Planned 5:01 AM · Expected around 5:30 AM"
  - 4: "Receiving window" / "4:00 to 7:45 AM" / "Open now, 2 h 15 min left" / `store` "Unload at" / "Curb" / "Call the store" (accessible label "Call Waypoint Fresh Mawanella")
  - 5: "Drop off" / chip "Dry" / "ORD0098597 · 138 cases"

    | Line | Count |
    |---|---|
    | "Rice and dhal case" | "40" |
    | "Packet foods case" | "58" |
    | "Tea and biscuit case" | "40" |

  - 7: "Arrived" (accessible hint "Saves the time and your location") / "Report a problem"
- **States:**
  - **DRV-02 Stop / Arrived.** 5:30 AM, straight after tapping Arrived. The arrival record sent at once, so the pill stays "All synced". 962 high on the canvas.
    - The times line leaves the outlet block; region 3b, the arrival strip, sits under it: Notice / done, 358 wide, margin 12 16 0, fill `done-soft`, radius 12, horizontal, padding 12 16, gap 12: `circle-check` 24 `done-strong`; text stack, gap 2: the arrival and how it compares with the plan in Heading 3 `asphalt-900`, Relay's Expected time in Body `asphalt-900`, then "Location saved. No tracking between stops." in Label `asphalt-700`. The words are neutral: the green belongs to the saved arrival, not to the comparison.
    - Content: "Arrived 5:30 AM. 29 min behind plan" / "Expected around 5:30 AM" / "Location saved. No tracking between stops."
    - Action bar: primary "Record delivery" with `package-check` 24; quiet "Report a problem".
    - Everything else as DRV-02. The strip pushes the content down, so the last line scrolls; Kasun has already read the lines before arriving.
  - **DRV-02 Stop / Behind plan** (replaces DRV-02 Stop / Early). 4:52 AM at stop 1, OUT119 Waypoint Fresh Kegalle, after tapping Arrived. Kasun left the hub 4 minutes late and arrived 19 minutes behind the plan's 4:33, on Relay's expected time (around 4:50). The strip says so in neutral words: in monsoon months 98.9% of first Kegalle stops in the route history arrived after their planned time, a median 34 minutes behind. Pill "All synced". 962 high on the canvas.
    - Status bar "4:52". Header "Stop 1 of 4".
    - 3: marker "1" (next) / "Kegalle" / "Waypoint Fresh Kegalle · OUT119"
    - 3b arrival strip: "Arrived 4:52 AM. 19 min behind plan" / "Expected around 4:50 AM" / "Location saved. No tracking between stops."
    - 4: "Receiving window" / "3:00 to 8:00 AM" / "Open now, 3 h 8 min left" / `warehouse` "Unload at" / "Rear dock" / "Call the store"
    - 5: "Drop off" / chip "Dry" / "ORD0098598 · 57 cases". Lines: "Rice and dhal case" "23", "Packet foods case" "20", "Tea and biscuit case" "14".
    - Action bar: primary "Record delivery"; quiet "Report a problem".
  - **DRV-02 Stop / Behind plan / Night.** Frame "DRV-02 Stop / Behind plan / Night", 962 high on the canvas, background `asphalt-50` in Night (#0F1318). Snapshot 4:52 AM, in the dark at Kegalle, before first light. Identical to DRV-02 Stop / Behind plan in layout and copy; every token paint takes its Night value from the table above. The status bar, header, cards and action bar use the Night `white` (#181D24), the next-stop marker keeps `signal-400` with `signal-ink`, and the primary button is Night `petrol-700` (#7CC4D2) with its label in Night `white`.
  - **DRV-02 Stop / Stop 3 offline** (was Stop 4 offline). 6:21 AM at stop 3, OUT117 Waypoint Fresh Hemmathagama, straight after tapping Arrived with no signal. Pill "2 stops to send" (stop 2's delivery from 5:59 and this arrival). 1,062 high on the canvas.
    - Status bar "6:21", `signal` in `asphalt-300`. Header "Stop 3 of 4".
    - 3: marker "3" (next) / "Hemmathagama" / "Waypoint Fresh Hemmathagama · OUT117"
    - 3b arrival strip: "Arrived 6:21 AM. 51 min behind plan" / "Expected around 6:35 AM" / "Location saved. No tracking between stops.", then Status chip / waiting to send "Waiting to send" on its own line (8 above).
    - 4: "Receiving window" / "4:00 to 7:45 AM" / "Open now, 1 h 24 min left" / `warehouse` "Unload at" / "Rear dock" / "Call the store"
    - 5: "Drop off" / chip "Dry" / "ORD0098595 · 96 cases". The rice and dhal line has a sub-row under the name, indented 36, vertical, gap 4, padding bottom 12: Status chip / Short "6 short, store told", then Label `asphalt-700` "Ordered 36. The other 6 come Thursday."

      | Line | Count | Sub-row |
      |---|---|---|
      | "Rice and dhal case" | "30" | chip "6 short, store told" / "Ordered 36. The other 6 come Thursday." |
      | "Packet foods case" | "44" | none |
      | "Tea and biscuit case" | "22" | none |

    - Action bar: primary "Record delivery"; quiet "Report a problem".
    - No offline banner on this screen (see shared conventions).
  - Not drawn, for the build:
    - **Opens soon** (arrived before the window): the panel's status line reads "Opens in {n} min" in Heading 2 with `timer`, and the primary is disabled with reason, "Record delivery from {time}". Kasun's run never needs it: Kegalle opens at 3:00 AM, and he arrives at 4:52.
    - **Closing soon** (under 30 min left): the status line reads "Closes in {n} min" with `clock` 20 `attention-strong`.
    - **Closed** (late arrival): the status line reads "Closed at {time}, {n} min ago" with `triangle-alert` 20 `problem-strong`, and Body `asphalt-700` under it: "You can still deliver. Nuwan and the store will see it as late." Arrived stays enabled.
    - **No location fix**: the arrival strip reads "Arrived 6:21 AM" / "Location not found. Time saved." with no retry prompt.
- **Prototype:**
  - DRV-02 Stop: back goes to "DRV-01 Today's run". "Arrived" goes to "DRV-02 Stop / Arrived". "Report a problem" goes to "DRV-04 Report a problem". "Call the store" has no target (the build dials).
  - DRV-02 Stop / Arrived: "Record delivery" goes to "DRV-S1 Signal drops". Back goes to "DRV-01 Today's run". "Report a problem" goes to "DRV-04 Report a problem".
  - DRV-02 Stop / Behind plan: reached from "Accept load" on DRV-01 Today's run / Accept load. "Record delivery" goes to "DRV-01 Today's run" (5:20: stop 1 is delivered; the proof screens are drawn for stop 3). Back goes to "DRV-01 Today's run". "Report a problem" goes to "DRV-04 Report a problem", whose close goes back.
  - DRV-02 Stop / Behind plan / Night: reference state, no inbound link. Back goes to "DRV-01 Today's run". "Record delivery" has no target.
  - DRV-02 Stop / Stop 3 offline: reached from "DEG-01 Working offline" (the stop 3 row or its "Open stop 3" button; the degradation steps wire this). "Record delivery" goes to "DRV-03 Proof of delivery / Before proof". Back goes to "DEG-01 Working offline" (`prototype/10-driver-to-degradation.js`) when both sections share a page. It has no in-page fallback: "DRV-01 Today's run" is the 5:20 moment with all synced and would take the story back in time, so on 06 Driver the button has no target. "Report a problem" has no target here either: DRV-04 is drawn for stop 2 at 5:20 with all synced, not for an offline stop 3.
- **Rationale:** One screen per stop keeps Kasun's attention on a single outlet. It answers his questions in the order he has them at the gate: is the store receiving yet, where does he unload, and what comes off the truck. If the store is shut, it is one call away, and a call needs no data. Arrived is the only primary action. It saves the time at once and his location if the phone can find it, without tracking him between stops. The arrival is compared with the plan in neutral words, beside Relay's expected time, because almost every Kegalle run in the monsoon months is behind the free-flow plan; only a missed window is a problem.

---

## DRV-03 Proof of delivery

- **Frame:** "DRV-03 Proof of delivery", phone 390 x 844 (1,286 high on the canvas), background `asphalt-50`. Snapshot: Wednesday 8 April 2026, 6:36 AM, at OUT117 Waypoint Fresh Hemmathagama (stop 3, ORD0098595). No contact since 5:41. Kasun arrived at 6:21, has unloaded, has typed the receiver's name and taken the photo. The pill shows 2 stops to send: stop 2's delivery and stop 3's arrival.
- **Purpose:** Record what came off the truck, who took it and a photo, then save it on the phone so the stop counts with or without signal.
- **Layout:** vertical. The first screen shows regions 3 and 4 and the Receiver's name field.
  1. System status bar, 390 x 44, `signal` in `asphalt-300`.
  2. Top bar / phone header with sync pill / field / back, 390 x 64. Sync pill / offline.
  3. Title block, vertical, padding 16 16 0, gap 4: Heading 1 `asphalt-900`, outlet line in Body `asphalt-700`, meta in Label `asphalt-500`.
  4. What came off section, margin 24 16 0, vertical, gap 12.
     - Heading 2 `asphalt-900`.
     - Input / segmented control / field: two separate segments, 48 high, 8 apart. Selected: fill `petrol-50`, 1.5 px `petrol-700` border, `check` 20 and Field button text in `petrol-700`. Unselected: fill `white`, 1 px `asphalt-300`, text `asphalt-900`.
     - Lines card, 358 wide, fill `white`, 1 px `asphalt-200`, radius 12, vertical. Load line / drop-off rows (as in DRV-02), each 56: the rice and dhal line carries Status chip / Short inline, 8 before its count; then packet foods; then tea and biscuit. Total row, 48 high, full-bleed fill `asphalt-50`, top border: label in Body `asphalt-700`, value in Heading 3 `asphalt-900`, right-aligned.
  5. Received by section, margin 24 16 0, vertical, gap 8.
     - Heading 2 `asphalt-900`.
     - Input / text / field: label in Label `asphalt-700` above, field 358 x 56, radius 6, 1 px `asphalt-300` (focus 2 px `petrol-700`), padding 0 16, value in Field title `asphalt-900`.
     - Helper in Label `asphalt-500`.
     - Chip row, horizontal, gap 8, wraps: Choice chip / 48, radius 8, padding 0 16. Selected: fill `petrol-50`, 2 px `petrol-700`, `check` 20 and Body strong `petrol-700`. Default: fill `white`, 1 px `asphalt-300`, Body strong `asphalt-900`.
  6. Photo section, margin 24 16 0, vertical, gap 8.
     - Title row, space between, 48 high: Heading 2 `asphalt-900`; Button / quiet / field, 48 high, `camera` 24 leading, text `asphalt-900`.
     - Photo capture tile / captured, 358 x 200, radius 12, 1 px `asphalt-200`. The figure stands in for the photo: Hemmathagama's 96 cases stacked in three piles (rice and dhal, packet foods, tea and biscuit, each a cardboard tone with tape and a label) in front of the roll-up rear dock door, on a concrete dock floor, no people. Time chip 12 px in from the bottom left: fill `asphalt-900`, radius 6, padding 4 8, Label `white`.
     - Button / quiet / field, 48 high, left-aligned, `pen-line` 24 leading, text `asphalt-900`.
  7. Bottom spacer 24.
  8. Bottom action bar / helper plus primary, 390 x 140: helper row, gap 8, `cloud-off` 16 and Label `asphalt-700`; Button / primary / field 358 x 56 with `check` 24 leading.
- **Content:**
  - Status bar: "6:36"
  - Header: "Stop 3 of 4". Pill: "2 stops to send"
  - 3: "Proof of delivery" / "Hemmathagama · OUT117" / "Arrived 6:21 AM · ORD0098595"
  - 4: "What came off the truck". Segments: "All delivered" (selected), "Change a line"

    | Line | Inline chip | Count |
    |---|---|---|
    | "Rice and dhal case" | "6 short" | "30" |
    | "Packet foods case" | none | "44" |
    | "Tea and biscuit case" | none | "22" |
    | "Total" | none | "96 cases" |

    Accessible label on the rice and dhal line: "Rice and dhal case, 30 delivered, 6 short, the store was told, the other 6 come Thursday."
  - 5: "Received by". Field label "Receiver's name", value "W. Rathnayake". Helper "Took goods here before". Chips: "W. Rathnayake" (selected), "S. Herath" (both are on OUT117's receiving staff)
  - 6: "Photo" / "Retake". Photo accessible label "Delivery photo of 96 cases at the rear dock, 6:36 AM". Time chip "6:36 AM". Button "Use a signature instead"
  - 8: helper "No signal. Saves on this phone and sends by itself." (one line in the 334 wide helper row) Button "Complete stop"
- **States:**
  - **DRV-03 Proof of delivery / Before proof.** 6:36 AM, when Kasun opens the screen after unloading (the scenario gives the arrival at 6:21 and the delivery at 6:36; the frame uses the delivery minute rather than an invented one). Pill "2 stops to send". Status bar "6:36". 1,228 high on the canvas.
    - 4: as DRV-03, "All delivered" selected.
    - 5: field empty with placeholder "Type a name or pick one below" in Field title `asphalt-500`. Chips "W. Rathnayake" and "S. Herath", both default.
    - 6: title "Photo" with no Retake button. Photo capture tile / empty, 358 x 160, fill `white`, 1.5 px dashed `asphalt-300`, radius 12, vertical, centered, gap 8: `camera` 32 `asphalt-700`, "Take a photo" in Field title `asphalt-900`, "Show the goods at the dock" in Label `asphalt-500`. "Use a signature instead" as before.
    - 8: helper `info` 16 and "Time and location are added when you complete." Button / primary / field, disabled with reason: "Add a name and a photo". The label shortens to "Add a photo" or "Add a name" as each is done.
  - **DRV-03 Proof of delivery / Change a line.** 6:36 AM, the main frame with "Change a line" selected. Name and photo as in DRV-03. 1,374 high on the canvas.
    - Helper under the segmented control, Label `asphalt-700`: "Change a number, then say why. The store sees the same numbers."
    - Each count becomes Input / number stepper / field, 152 x 48: minus 48 x 48 on `white`, value in Heading 1 centered, plus 48 x 48. Values "30", "44", "22". Plus is disabled at the loaded amount (fill `asphalt-100`, icon `asphalt-500`), because Kasun cannot deliver more than he carried; minus is at full strength.
    - Beside the stepper the lines use the short case names the loader uses: "Rice and dhal", "Packet foods", "Tea and biscuit", each on one line. The `box` icon and its 12 gap are hidden on these three rows, so the name column is about 162 wide next to the 152 stepper. The "6 short" chip moves under "Rice and dhal", and that line gets 12 px above and below; the other two get 8.
    - Build rule (not drawn, since nothing changes in the story): when a count goes down, a reason row appears under that line with Choice chip / 48: "Damaged", "Refused", "Not on the truck". "Complete stop" shows "Pick a reason" (disabled with reason) until one is chosen, and the Total row updates.
  - **DRV-03 Proof of delivery / Signature.** 6:36 AM. DRV-03 sits underneath with the `scrim`. Sheet / bottom sheet, 390 wide including the home indicator, fill `white`, top corners radius 16, shadow, vertical, padding 8 16 16, gap 16.
    - Grabber 36 x 4 `asphalt-300`. Title row: "Ask W. Rathnayake to sign" in Heading 2; Button / quiet / icon only 48 x 48 with `x` 24 (accessible label "Close").
    - Signature pad / empty, 358 x 240, fill `white`, 1 px `asphalt-300`, radius 12. Baseline 1 px `asphalt-200`, 60 from the bottom, with `pen-line` 16 and "Sign here" in Label `asphalt-500` above its left end.
    - Button / primary / field 358 x 56, disabled with reason until the pad has ink: "Sign in the box first". With ink it reads "Use this signature". Button / quiet / field 358 x 48: "Clear".
  - **DRV-03 Proof of delivery / Saved.** 6:36 AM, straight after "Complete stop". Pill "2 stops to send" (stops 2 and 3; in records, the delivery and its photo join the 2 already waiting). Header / plain, no back button: the stop is saved. 928 high on the canvas.
    - Confirmation panel (shared with the store manager spec), margin 16 16 0, fill `white`, 1 px `asphalt-200`, radius 12, padding 24, vertical, centered, gap 8: 64 x 64 circle in `done-soft` with `circle-check` 32 `done-strong`; title in Heading 1; body in Body `asphalt-700`.
    - Summary card, margin 16 16 0, padding 16, vertical, gap 8: outlet in Heading 3; three lines in Body `asphalt-900`; then Status chip / waiting to send.
    - Next stop section, margin 24 16 0, gap 8: Heading 2, then Next stop card / compact, fill `white`, 1 px `asphalt-300`, radius 12, padding 16, horizontal, gap 12: Stop marker / next 40; text stack, gap 2: name in Heading 2 `asphalt-900`, window and access in Body `asphalt-700`, the two named times in Label `asphalt-500`.
    - Bottom action bar / primary plus quiet: primary with `chevron-right` 24 trailing; quiet.
    - Content: header "Stop 3 of 4"; panel "Stop 3 saved on this phone" / "The delivery and 1 photo will send by themselves when you have signal. You don't need to do anything."; summary "Hemmathagama · OUT117" / "96 cases delivered. 6 rice and dhal cases short, store told." / "Received by W. Rathnayake" / "6:36 AM · Location saved" / chip "Waiting to send"; section "Next stop"; card "4" / "Aranayake" / "5:00 to 7:30 AM · Rear dock" / "Planned 5:58 AM · Expected around 7:15 AM"; buttons "Open stop 4" and "Back to today's run".
- **Prototype:**
  - DRV-03 Proof of delivery / Before proof: the "W. Rathnayake" chip and the photo tile both go to "DRV-03 Proof of delivery" (the prototype fills name and photo in one step). "Use a signature instead" goes to "DRV-03 Proof of delivery / Signature". Back goes to "DRV-02 Stop / Stop 3 offline". The disabled button has no target.
  - DRV-03 Proof of delivery: "Complete stop" goes to "DRV-03 Proof of delivery / Saved". "Change a line" goes to "DRV-03 Proof of delivery / Change a line". "Use a signature instead" goes to "DRV-03 Proof of delivery / Signature". Back goes to "DRV-02 Stop / Stop 3 offline". "Retake" has no target.
  - DRV-03 Proof of delivery / Change a line: "All delivered" goes to "DRV-03 Proof of delivery". Back goes to "DRV-02 Stop / Stop 3 offline" and "Complete stop" to "DRV-03 Proof of delivery / Saved", as on DRV-03. Steppers have no target.
  - DRV-03 Proof of delivery / Signature: the `x`, "Clear" and the scrim go back to "DRV-03 Proof of delivery".
  - DRV-03 Proof of delivery / Saved: "Open stop 4" goes to "DRV-S2 Last stop offline". "Back to today's run" goes to "DEG-01 Working offline" (`prototype/10`) when both sections share a page. It has no in-page fallback: "DRV-01 Today's run" is the 5:20 moment with all synced and would take the story back in time, so on 06 Driver the button has no target.
- **Rationale:** Proof of delivery is what ends "my word against theirs". The screen asks for the least that settles a dispute: what came off the truck, who took it, and a photo, while the phone adds the time and place itself. The six missing rice and dhal cases show as already short, so nobody reopens at the door what Nuwan decided at 2:52 AM. Complete stop saves to the phone first and says so, because the storm has taken the network down at Hemmathagama and the stop still has to count. Photos are shrunk before saving, since Kasun pays for his own data, and the store sees the same numbers he confirmed.

---

## DRV-04 Report a problem

- **Frame:** "DRV-04 Report a problem", phone 390 x 844, background `asphalt-50`. Snapshot: Wednesday 8 April 2026, 5:20 AM, opened from the Next stop card on DRV-01 while Kasun is pulled over with stop 2 next. All synced. In the story he looks and closes it; nothing is reported on this trip.
- **Purpose:** Let Kasun report what is stopping a delivery in two taps when stopped, instead of a phone call while driving.
- **Layout:** vertical, fits in 844 without scrolling.
  1. System status bar, 390 x 44.
  2. Top bar / phone header with sync pill / field / close, 390 x 64, no title (accessible label on `x` "Close"). Sync pill / all synced.
  3. Context block, vertical, padding 16 16 0, gap 4: context in Label `asphalt-500`, question in Heading 1 `asphalt-900`.
  4. Reason list, margin 16 16 0, vertical, gap 8. Six Choice row / field / reason, 358 wide, at least 68 high, fill `white`, 1 px `asphalt-200`, radius 12, horizontal, padding 12 16, gap 12, centered: icon box 40 x 40, radius 8, fill `asphalt-100`, icon 24 `asphalt-900`; text stack: label in Field title `asphalt-900`, caption in Label `asphalt-700` (one line); `chevron-right` 20 `asphalt-500` trailing. Pressed: fill `asphalt-100`. Icons stay neutral: color is kept for status.
  5. Footer, margin 24 16 0, vertical, gap 8, top border 1 px `asphalt-200`, padding-top 16: Button / quiet / field, 48 high, left-aligned, `phone` 24 leading, text `asphalt-900`; caption in Label `asphalt-500`.
  6. Home-indicator area, 34.
- **Content:**
  - Status bar: "5:20"
  - Header: no title. Pill: "All synced"
  - 3: "About stop 2, Mawanella · VEH045" / "What's the problem?"
  - 4:

    | Icon | Label | Caption |
    |---|---|---|
    | `clock` | "Delayed" | "Stores ahead get a new expected time." |
    | `lock` | "Outlet closed" | "Nobody there. Try calling the store first." |
    | `route` | "Access blocked" | "Can't reach the dock or park." |
    | `store` | "Goods refused" | "Store won't accept some or all." |
    | `package-x` | "Damaged in transit" | "Broken, crushed or wet." |
    | `truck` | "Vehicle problem" | "Breakdown, tyre or warning light." |

  - 5: "Call Nuwan at dispatch" / "For emergencies. For anything else a report is faster, and it leaves a record."
- **States:**
  - **DRV-04 Report a problem / Delayed.** 5:20 AM, after tapping Delayed. This is a prototype branch (scenario, "Additional facts" 37): in the story Kasun sends nothing, so the frame shows the control with "20 min" picked as an example.
    - Header / back (`arrow-left`), no title, pill "All synced".
    - 3: `clock` 24 and "Delayed" in Heading 1, then "About stop 2, Mawanella" in Body `asphalt-700`.
    - Question in Heading 2, margin 24 16 0: "How much later than expected?"
    - Choice chip grid, 2 x 2, gap 8, each filling half the row x 56, radius 8, padding 0 12, Field button text: "10 min", "20 min" (selected: fill `petrol-50`, 2 px `petrol-700`, `check` 20, text `petrol-700`), "30 min", "More than 30 min".
    - Notice / info, 358 wide, margin 16 16 0, fill `white`, 1 px `asphalt-200`, radius 12, padding 12, gap 8, `info` 20 `asphalt-700`, Body `asphalt-900`: "Mawanella, Hemmathagama and Aranayake will see a later expected time. Nuwan sees your report straight away."
    - Input / text / multiline / field, 358 x 96, margin 16 16 0, label "Note for Nuwan (optional)" in Label `asphalt-700`, placeholder "What's holding you up?" in Body `asphalt-500`.
    - Bottom action bar / helper plus primary: helper `info` 16 and "Saves on this phone first, like your stops." Button "Send report" with `send` 24 leading.
  - Build rules (not drawn; same parts): every report takes a time and location stamp and saves on the phone first.
    - After "Send report", the screen shows the Confirmation panel as on DRV-03 / Saved: "Report sent" / "Nuwan has it with the time and your location. Mawanella, Hemmathagama and Aranayake now expect you about {n} min later." and Button / primary / field "Back to today's run". Offline, the title reads "Report saved on this phone" and the pill counts it with the stops.
    - Outlet closed and Access blocked: Button / secondary / field "Call the store" with `phone` 24 first, then an optional photo (Photo capture tile / empty, "Add a photo"), optional note, "Send report". The stop is marked "Problem reported" and Kasun can move on; Nuwan decides whether to retry.
    - Goods refused and Damaged in transit: pick the lines and counts with the field steppers from DRV-03, photo required for damage, optional note.
    - Vehicle problem: Choice chips "I can keep driving" and "I can't move". "I can't move" makes "Call Nuwan at dispatch" the primary button and marks the report urgent on DSP-04.
- **Prototype:**
  - DRV-04 Report a problem: `x` goes back to the screen it came from ("DRV-01 Today's run", "DRV-02 Stop" or "DRV-02 Stop / Arrived"). "Delayed" goes to "DRV-04 Report a problem / Delayed". The other five rows and the call button have no target (the build uses a `tel:` link).
  - DRV-04 Report a problem / Delayed: back goes to "DRV-04 Report a problem". "Send report" and the chips have no target; the branch ends here.
- **Rationale:** Today a problem on the road means a phone call, often made while driving. This screen turns it into two taps made when stopped. The six reasons cover what actually stops a Fresh delivery, from a closed store to a truck that will not start, and each is a full-width row with a plain label, easy to read and hit at arm's length. A delay report moves the expected time for every store still to come, so store managers stop calling too. Reports save on the phone first like everything else, and a call to Nuwan stays one tap away for emergencies.

---

## DRV-05 Trip summary

- **Frame:** "DRV-05 Trip summary", phone 390 x 844 (1,095 high on the canvas), background `asphalt-50`. Snapshot: Wednesday 8 April 2026, 7:17 AM, at Aranayake's dock, just before Finish trip. All four stops delivered. The signal came back at 7:14 and stops 2, 3 and 4 sent with their 2 photos. Kasun answered the stop 4 question in DEG-02 at 7:15 ("Yes, I delivered it"), Relay cancelled VEH060's copy of stop 4 at 7:15, and at 7:16 Nuwan's view showed the conflict resolved. All synced.
- **Purpose:** Close the trip cleanly and confirm to Kasun and the hub that nothing is left on the phone.
- **Layout:** vertical, scrolls under the fixed action bar.
  1. System status bar, 390 x 44.
  2. Top bar / phone header with sync pill / field / back, 390 x 64 (accessible label "Back to today's run"). Sync pill / all synced.
  3. Hero block, vertical, padding 16 16 0, gap 4: title in Heading 1 `asphalt-900`; trip line in Body `asphalt-700`; times in Label `asphalt-500`.
  4. Notice / done, 358 wide, margin 16 16 0, fill `done-soft`, radius 12, padding 12 16, horizontal, gap 12: `circle-check` 24 `done-strong`; text stack, gap 2: title in Heading 3 `asphalt-900`, body in Body `asphalt-900`.
  5. Notice / info, 358 wide, margin 8 16 0, fill `white`, 1 px `asphalt-200`, radius 12, padding 12 16, gap 12: `info` 24 `asphalt-700`; title in Heading 3, body in Body `asphalt-900`.
  6. Windows row, margin 16 16 0, horizontal, gap 8: `circle-check` 20 `done-strong` and Body `asphalt-900`.
  7. Stops section, margin 24 16 0: Heading 2, gap 8, then a list card, fill `white`, 1 px `asphalt-200`, radius 12, four Stop row / field / summary (no chevron), padding 10 16, gap 12, dividers inset 60: Stop marker / delivered 32; text stack, gap 2: name in Field title, "Delivered" time in Body strong `done-strong`, extra lines in Label `asphalt-500`.
  8. Bottom spacer 24.
  9. Bottom action bar / helper plus primary, 390 x 140: helper row, gap 8, `truck` 16 `asphalt-700` and Label `asphalt-700`; Button / primary / field 358 x 56 with `circle-check` 24 leading.
- **Content:**
  - Status bar: "7:17"
  - Header: "Trip summary". Pill: "All synced"
  - 3: "All 4 stops done" / "VEH045 · Trip 1 · Fresh dry, Kegalle district" / "Left Kandy hub 3:44 AM · Last delivery 7:09 AM"
  - 4: "Everything is sent" / "Stops 2, 3 and 4 reached the office at 7:14 AM, with 2 photos."
  - 5: "Stop 4 is settled" / "Nuwan moved stop 4 to VEH060 at 6:15 AM while you had no signal. You said you delivered it, so VEH060's visit was cancelled at 7:15 AM."
  - 6: "All 4 deliveries were inside their windows."
  - 7: "Stops"

    | Stop | Name | Status line | Extra lines |
    |---|---|---|---|
    | 1 | "Kegalle" | "Delivered 5:11 AM" | none |
    | 2 | "Mawanella" | "Delivered 5:59 AM" | "Saved offline, sent 7:14 AM" |
    | 3 | "Hemmathagama" | "Delivered 6:36 AM" | "96 cases. 6 rice and dhal cases short, store told." / "Saved offline, sent 7:14 AM" |
    | 4 | "Aranayake" | "Delivered 7:09 AM" | "Saved offline, sent 7:14 AM" |

  - 9: helper "No second trip today. Head back to the Kandy hub." Button "Finish trip"
- **States:**
  - **DRV-05 Trip summary / Still waiting.** 7:10 AM, at Aranayake's dock, straight after completing stop 4 at 7:09 with no signal. This is where "Complete stop" on the last stop lands. Pill "3 stops to send". Status bar "7:10", `signal` in `asphalt-300`. 997 high on the canvas.
    - 3: unchanged ("All 4 stops done" / "VEH045 · Trip 1 · Fresh dry, Kegalle district" / "Left Kandy hub 3:44 AM · Last delivery 7:09 AM").
    - 4 becomes Notice / waiting, fill `waiting-soft`, 1 px `asphalt-300`, `cloud-off` 24 `asphalt-700`: "3 stops are on this phone" / "Stops 2, 3 and 4, with 2 photos. They send by themselves when you have signal."
    - 5 is not shown (the phone does not yet know about the backup for stop 4).
    - 6: "All 4 deliveries were inside their windows."
    - 7: row 1 as in DRV-05. Rows 2, 3 and 4 keep their "Delivered" line and show Status chip / waiting to send "Waiting to send" instead of "Saved offline, sent 7:14 AM". Row 3 keeps "96 cases. 6 rice and dhal cases short, store told."
    - 9: helper `cloud-off` 16 and "3 stops still to send. Finishing saves on this phone too." Button / primary / field, enabled: "Finish trip".
  - **DRV-05 Trip summary / Finished.** 7:17 AM, at Aranayake's dock, after "Finish trip". Pill "All synced". 1,107 high on the canvas. Regions 3 to 7 unchanged except the title, which reads "Trip 1 finished". The action bar holds a Notice / done instead of the helper and button: `circle-check` 24, "Trip finished at 7:17 AM" in Heading 3 and "The Kandy hub expects you back around 9:05 AM." in Body. Home indicator below. Kasun leaves Aranayake at 7:18.
  - Not drawn, for the build:
    - Finished while offline: the notice reads "Trip finished at {time}" / "Saved on this phone. The hub sees it when your stops send." The Trip finished record joins the queue after the stops.
    - A failed stop: a line under the hero, `x` 16 `problem-strong` and Body strong `problem-strong`, for example "1 stop not delivered", and that row uses Stop marker / failed. The line is hidden when nothing failed.
- **Prototype:**
  - DRV-05 Trip summary / Still waiting: after a 3 second delay, goes to "DEG-02 Back in coverage / sending" (`prototype/10`) when both sections share a page. Built alone, and on 06 Driver in the 13-page file, it goes to "DRV-S3 Signal back", whose tap goes to "DRV-05 Trip summary", so the signal return and the stop 4 answer are never skipped. "Finish trip" has no target in the prototype, because the story waits for the signal.
  - The degradation steps wire the rest: "DEG-02 Back in coverage / sending" moves on to "DEG-02 Back in coverage", "Yes, I delivered it" goes to "DEG-02 Back in coverage / answered yes" (7:15), and its "Finish trip" goes to "DRV-05 Trip summary / Finished" (7:17, still at the dock). "DRV-05 Trip summary" (7:17) is the reference frame for the same screen just before that tap.
  - DRV-05 Trip summary: "Finish trip" goes to "DRV-05 Trip summary / Finished". Back has no target (the build returns to the run, now all done).
  - DRV-05 Trip summary / Finished: end of the driver flow.
- **Rationale:** The trip summary gives Kasun a clean close and gives the Kandy hub a check that nothing is left on his phone before he leaves Aranayake. It says in plain words which stops reached the office and when, and it closes the loop on stop 4: while Kasun was out of contact, Nuwan sent the standby van as a backup, Kasun's answer settled it, and the van's visit was cancelled. The hub sees when to expect him back. Finish trip works with or without signal, like every other action in the driver app, and any stop still waiting stays marked on the list, so nothing is hidden.

---

## Prototype-only frames

These three cards carry the story across the gaps between drawn moments in the prototype and the demo video. They are not app screens and are not built in the Hackathon.

### DRV-S1 Signal drops

- **Frame:** "DRV-S1 Signal drops", phone 390 x 844, background `asphalt-900`. Story time: Wednesday 8 April 2026, 5:41 to 5:59 AM.
- **Purpose:** Bridge from the arrival at stop 2 to the offline run at 6:05.
- **Layout:** vertical, centered, padding 32. Content column 326 wide, gap 16: `clock` 32 `white`; time in Display `white`; sentence in Heading 2 `white`; prompt pinned 48 above the bottom in Label `asphalt-300`.
- **Content:** "5:41 AM" / "A thunderstorm takes the mobile network down while Kasun unloads at the curb in Mawanella. At 5:59 he records stop 2 with the receiver's signature, and it saves on his phone." / "Tap to continue"
- **States:** none.
- **Prototype:** tap anywhere goes to "DEG-01 Working offline" (`prototype/10`); built alone, to "DRV-02 Stop / Stop 3 offline".
- **Rationale:** not needed; prototype device only.

### DRV-S2 Last stop offline

- **Frame:** "DRV-S2 Last stop offline", phone 390 x 844, background `asphalt-900`. Story time: 6:56 to 7:09 AM.
- **Purpose:** Bridge from stop 3 saved to the trip summary at 7:10.
- **Layout:** as DRV-S1.
- **Content:** "6:56 to 7:09 AM" / "Still no signal on the hill road. Kasun arrives at Aranayake at 6:56 and completes stop 4 at 7:09. It saves on his phone with the others." / "Tap to continue"
- **States:** none.
- **Prototype:** tap anywhere goes to "DRV-05 Trip summary / Still waiting".
- **Rationale:** not needed; prototype device only.

### DRV-S3 Signal back

- **Frame:** "DRV-S3 Signal back", phone 390 x 844, background `asphalt-900`. Story time: 7:14 to 7:15 AM.
- **Purpose:** Bridge from Still waiting (7:10) to the trip summary (7:17) on 06 Driver, where DEG-02 is on another page, so the signal return and the stop 4 answer are shown and not skipped.
- **Layout:** as DRV-S1.
- **Content:** "7:14 to 7:15 AM" / "The signal returns at Aranayake's dock. Stops 2, 3 and 4 send with their 2 photos, and Kasun tells Nuwan he delivered stop 4. See DEG-02 on 08 Degradation." / "Tap to continue"
- **States:** none.
- **Prototype:** reached from "DRV-05 Trip summary / Still waiting" after 3 s; tap anywhere goes to "DRV-05 Trip summary".
- **Rationale:** not needed; prototype device only.

---

## Canvas (as built)

- Driver section at (0, 7200) when built alone, 11,260 x 2,405. Section header at (80, 80): role, persona and moment, the flow, and the prototype note. Frames in one row at y 520: the six main screens (Accept load, DRV-01, DRV-02, DRV-03, DRV-05, DRV-04) with their rationale cards in one row, 40 below the tallest main screen, then the sixteen states in story order: Behind plan, Behind plan / Night, Language, Sinhala (with its own rationale card), Delayed, Arrived, DRV-S1, Stop 3 offline, Before proof, Change a line, Signature, Saved, DRV-S2, Still waiting, DRV-S3, Finished. Columns 510 apart.
- Captions sit 64 above each frame (Caption, `asphalt-500`, 390 wide), each starting with the snapshot time. Group labels "Main screens and rationale" and "States, in story order" sit 120 above the row. Flow connectors between consecutive main screens carry the time of the screen they lead to: 5:20, 5:30, 6:36 and 7:17 AM (DRV-04 is a side branch).
- The Night token table is a card on the Design System page.

## Components needed

Used as they are from the style guide: Button (primary, secondary, quiet), Status chip (Dry, Short, waiting to send), Sync pill (all synced, offline with count), Sheet (bottom sheet), Input (segmented control, number stepper, text), Notice (info, attention). The items below are new, or new variants to add. Where the store manager or loader spec already asks for the same thing, it is marked "shared" so it is built once.

| Component | Variants | Used in |
|---|---|---|
| Next stop card | full (marker, name block, window status line, 2 x 2 detail grid with the two named times, primary and quiet buttons); compact (marker, name, window and access, the two named times) | DRV-01, DRV-01 / Sinhala, DRV-03 / Saved |
| Stop marker | next (`signal-400` with `signal-ink` ring and number), pending, short, delivered, failed; 32 and 40 | Every DRV frame; matches the marker in STM-04 |
| Step progress | segments done, next, pending; 1 to 12 segments; 8 high, square ends | DRV-01, / Accept load, / Sinhala |
| Stop row, field variants | optional chip line and extra lines (Planned, Expected, notes); summary variant without chevron | DRV-01, DRV-01 / Sinhala, DRV-05 all states |
| Window panel | opens soon, open, closing soon, closed (with the late note); each with the Unload at row and the Call the store row | DRV-02 all states |
| Window status line | opens soon, open, closing soon, closed; DRV-02 copy and DRV-01 copy | DRV-01, DRV-02 all states |
| Load line, drop-off variants | read-only count; inline Short chip; short sub-row (chip plus explanation); adjust (field stepper). Dry lines use `box`, chilled lines `snowflake`. The line Rizwan checks at the dock is the line Kasun confirms at the door | DRV-02 all states, DRV-03, / Change a line |
| Handover table (shared with the loader spec) | header row, stop row (Stop marker 32: Pending on the driver side, Done, numbered on the loader side; Short on a short row with the chip under the name), total row with a weight caption | DRV-01 / Accept load, LDR-04 |
| Detail row, field variants (shared) | stacked (icon and label over value); inline (label left, value right); field sizes | DRV-01, DRV-02 all states |
| Choice row, field variants (shared) | reason (68 high, icon box, label, caption, chevron); option (64 high, selected with `check`) | DRV-04, DRV-01 / Language |
| Choice chip | 48 and 56 high; default, selected | DRV-03, / Before proof, / Change a line, DRV-04 / Delayed |
| Photo capture tile | empty (dashed, `camera`); captured (image with time chip) | DRV-03, / Before proof |
| Signature pad | empty, signed | DRV-03 / Signature |
| Confirmation panel (shared) | done; used as in the store manager spec | DRV-03 / Saved, DRV-04 report sent (build) |
| Bottom action bar, field variants (shared) | primary plus quiet (170); helper plus primary (140); notice only | DRV-01 / Accept load, DRV-02 all states, DRV-03 all states, DRV-04 / Delayed, DRV-05 all states |
| Button, disabled with reason (shared with the loader spec) | primary / field: `asphalt-100` fill, no border, `asphalt-700` label that says what is left, optional 24 px icon. Replaces the plain disabled variant on driver frames | DRV-03 / Before proof, / Signature |
| Button / quiet / icon only, field size (shared) | 48 x 48 (the store manager size is 44 x 44) | Every DRV back or close header, sheets |
| Notice, new variants | done (shared); waiting (`waiting-soft`, `cloud-off`); done used as the arrival strip (title, Expected line, location line, optional waiting chip) | DRV-02 / Arrived, / Behind plan, / Stop 3 offline, DRV-05 all states |
| Top bar / phone header with sync pill / field | 64 high; root (Heading 1 title, pill); back and close (Heading 2 title that truncates, pill); close without title; plain | Every DRV frame |
| Sync pill, offline and sending copy | "Offline"; "{n} stop(s) to send"; "{n} photo(s) to send"; sending "Sending {n} stops" or "Sending {n} photos"; never truncates, under 180 wide | Every offline DRV frame, DEG-01, DEG-02 all states |
| Status chip / Short (shared) | label set per use: "6 short", "6 short, store told", "6 rice and dhal cases short, store told"; grows in height instead of truncating | DRV-01, / Accept load, / Sinhala, DRV-02 / Stop 3 offline, DRV-03 all states |
| Input, field sizes (shared) | text 56 high with 18 px value; multiline 96 high | DRV-03, DRV-04 / Delayed |
| Text styles | Field title 18/24 SemiBold; Sinhala set in Yaldevi with taller line heights (listed in DRV-01 / Sinhala) | Every DRV frame, DRV-01 / Sinhala |
| Night mode (color variables) | second variable mode "Night" with the same token names; new tokens `signal-ink` and `scrim`; kept in the Night token table while the file has one mode | DRV-02 / Behind plan / Night; every driver component |
| Story card | prototype only, not built | DRV-S1, DRV-S2 |

Count: 25 entries.

---

## Values derived from the scenario

Every other value on the driver frames is copied from `05-scenario-data.md` v0.4. These follow directly from it:

1. Minutes left in a window, from the snapshot time to the window's close: Mawanella at 5:20, "2 h 25 min" (closes 7:45); Mawanella at 5:30, "2 h 15 min"; Kegalle at 4:52, "3 h 8 min" (closes 8:00); Hemmathagama at 6:21, "1 h 24 min" (closes 7:45).
2. Behind plan, the arrival against the planned time: Mawanella "29 min" (5:30 against 5:01), Hemmathagama "51 min" (6:21 against 5:30). Kegalle's "19 min" is the scenario's own.
3. "Ordered 36. The other 6 come Thursday." ORD0098595 has 36 rice and dhal cases; 30 were on the shelf.
4. "2 stops to send", "3 stops to send" and "with 2 photos" follow from the record counts and proofs in "Additional facts" 27 and 29 (stop 2 was signed, stops 3 and 4 have photos).
5. "All 4 deliveries were inside their windows." from the stop table: 5:11, 5:59, 6:36 and 7:09 against closes of 8:00, 7:45, 7:45 and 7:30.
6. The Before proof snapshot uses 6:36, the delivery minute, because the scenario gives no minute between the 6:21 arrival and the 6:36 delivery.

## Open questions

1. **Language check.** Every Sinhala string in the DRV-01 / Sinhala table needs a native reader's check with a Sinhala-speaking driver before the prototype is recorded, in particular "මහනුවර මධ්‍යස්ථානය" for the Kandy hub against the spoken "ඩිපෝ එක".

The cross-section links are settled: `tools/figma-builder/steps/prototype/10-driver-to-degradation.js` now looks up "DRV-02 Stop / Stop 3 offline", so in the full build that frame's back button goes to DEG-01. The DRV-01 target set in `driver/12-prototype.js` stays as the fallback the 13-page packaging uses.
