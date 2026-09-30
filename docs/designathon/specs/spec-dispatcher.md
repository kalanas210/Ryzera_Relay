# Dispatcher Screens: Frame Spec (Relay, Team Ryzera)

> **v0.4 data alignment.** Every value in this spec now comes from `05-scenario-data.md` v0.4 (data aligned), and every frame is described as the Relay Builder draws it (`tools/figma-builder/steps/dispatcher`). Values the screens need that the scenario does not print are derived from it and listed under "Derived values". What changed from v0.3:
> - **Dates.** Planning day Tuesday 7 April 2026, delivery Wednesday 8 April, catch-up Thursday 9 April, in the week before the Sinhala and Tamil New Year. The October dates are gone.
> - **The Kandy hub this week.** Two of the seven refrigerated vehicles are in the workshop: VEH039 (refrigeration fault since Monday 6 April, 2:50 AM) and VEH058 (booked service). The dry-box VEH053 story, the "small dry orders ride chilled runs" rule and the store line "Our refrigerated vehicles take only small dry orders" are removed.
> - **DSP-01.** 125 orders at 3:12 PM (74 Fresh dry, 46 Fresh chilled, 3 Style, 2 Tech; Peliyagoda 73, Kandy hub 52) and 136 at 4:00 PM (79, 50, 4, 3; Peliyagoda 79, Kandy hub 57). 2 late orders, not 3: Kadawatha's dry (4:01 PM) and chilled (4:02 PM). The six outlets to chase and every order row are real records. New flags: Waited Monday (OUT119), Van only, Large truck (the Style order, no vehicle named), Truck only (the Tech order).
> - **DSP-02.** The board is filtered to the Kandy hub's refrigerated vehicles, with per-filter counts; the banner reads "Kandy hub: 57 orders, 56 on 18 trips, 1 waits"; the right panel shows VEH057 trip 2; the broken-rule drag is Dilani's chilled order ORD0098596 onto VEH057 trip 2 (3 rules broken). The publish check lists the 5 stops Relay expects after their window, with a "Why Relay keeps it" column.
> - **DSP-03.** One chilled order waits, not three dry orders. The drawer separates what was unavoidable (five refrigerated vehicles serve 22 of 23) from Relay's choice (three numbered rules), and adds the pool, the cost, the plan that works only on paper and the Thursday check. The protected store is OUT119 Kegalle.
> - **DSP-04.** Kasun on VEH045 (ambient truck, Kegalle, 4 stops); Sampath's 45 minute delay on the Matale road replaces Priyantha's; new counts; VEH060 is the standby. The 2:48 AM phone decision adds 6 rice and dhal cases to Dilani's Thursday dry order ORD0098747.
> - **DSP-05.** ISO weeks 15 to 20 of 2026. Headline: Wednesday 29 April is the heaviest of the 5 Wednesdays ahead and, like each of them, needs 6 of the 7 refrigerated vehicles. The limit is vehicles before 8 AM, not cubic metres.
> - **Review fixes (this pass).** DSP-04: every recorded marker on a stop track names its kind of time ("Delivered 5:11" at Kegalle; "Arrived 3:49" and "Arrived 4:28" at Matale Town and Palapathwela, derived below); the phone card is titled "missing" (before the decision) and the 5:20 AM feed says "short" (after it), as the loader words them; the rationale gives 2:47 AM for the phone alert. DSP-05: the vehicles row is top aligned, and week 15 draws the vehicle that is needed but not available. The section header names the flows as Figma lists them, and the area step now sets those names itself.
> - **Shell as built.** The desktop frames use the 88 px Nav rail with key hints, and the snapshot clock sits in the page header. The old 192 px Side nav description is replaced.
> - **History removed.** The v0.2 review notes, the v0.3 consistency pass, the "New facts introduced" list and the open questions described the October story. They are replaced by "Derived values" and "Cross-role agreements".

Frame-by-frame spec for the Dispatcher role, written for the Figma build and for the Hackathon front end. Persona: Nuwan Perera, senior dispatcher, who plans the Peliyagoda depot and the Kandy hub from the Peliyagoda planning office on two large monitors and is on call by phone on Fresh nights. The offline and conflict states of Live runs (6:05 to 7:16 AM) belong to the degradation spec (DEG-03, DEG-05); those frames reuse this shell. Shared components are defined once in `components.md`.

## Screen set

14 frames: 12 desktop frames at 1440 x 900, 1 phone frame at 390 x 844 and 1 overlay dialog, 560 x 398.

| Frame | Size | Snapshot | What it shows |
|---|---|---|---|
| DSP-01 Order queue | Desktop | Tue 7 Apr 2026, 3:12 PM | 48 min to the cutoff. 125 orders in, 6 Fresh outlets to chase, the Fresh chilled tab open |
| DSP-01 Order queue / after cutoff | Desktop | Tue 4:02 PM | Locked at 4:00 PM with 136 orders; Kadawatha's 2 late orders moved to Thursday |
| DSP-02 Plan board | Desktop | Tue 4:35 PM | Relay's proposed Kandy plan, filtered to refrigerated vehicles, VEH057 trip 2 selected |
| DSP-02 Plan board / dragging | Desktop | Tue 4:35 PM | ORD0098596 held over VEH057 trip 2; every slot says whether it fits |
| DSP-02 Plan board / broken rule | Desktop | Tue 4:35 PM | Just after the drop: 3 rules broken on VEH057 trip 2, Undo move |
| DSP-03 Deferrals | Desktop | Tue 4:50 PM | The deferral drawer; the one chilled order still needs a reason |
| DSP-03 Deferrals / override | Desktop | Tue 4:51 PM | Defer anyway on the protected OUT119 asks for a written note |
| DSP-03 Deferrals / ready | Desktop | Tue 4:52 PM | Relay's reason used; the deferral is ready |
| DSP-02 Plan board / publish check | Desktop | Tue 6:39 PM | Peliyagoda published at 6:31 PM; 5 of 53 Fresh stops expected after their window, each with a reason |
| DSP-02 Publish dialog | Overlay 560 x 398 | Tue 6:39 PM | What publishing does |
| DSP-02 Plan board / published | Desktop | Tue 6:40 PM | Straight after Publish plan: the plan bar in the done tone, and who now has the plan |
| DSP-05 Capacity outlook | Desktop | Tue 6:45 PM | Weeks 15 to 20: refrigerated vehicles needed on each week's busiest day |
| DSP-04 Live runs / shortfall decision | Phone | Wed 8 Apr, 2:48 AM | On call at home: 6 rice and dhal cases missing on VEH045, stop 3 |
| DSP-04 Live runs | Desktop | Wed 5:20 AM | Every driver in contact; Sampath's delay handled at 4:35 AM |

Must frames for the judged file: DSP-01, DSP-01 / after cutoff, DSP-02, DSP-02 / broken rule, DSP-03, DSP-03 / ready, DSP-05, DSP-04 / shortfall decision, DSP-04. The rest complete the prototype flows.

### Canvas (as built)

- Section "Dispatcher", 20,470 x 1,632, built at (0, 0) and moved into story order by `prototype/20-canvas-layout.js`.
- Section header at (80, 80), 2,400 wide: "Dispatcher" in Doc heading; the persona, device and moment line in Doc lead ("Nuwan Perera, senior dispatcher, plans the Peliyagoda depot and the Kandy hub from the Peliyagoda office on two large monitors with a keyboard; on Fresh nights he is on call on his own phone. Desktop 1440 x 900, one phone frame at 390 x 844. Tuesday 7 April 2026, 3:12 PM, to Wednesday 8 April, 5:20 AM, in the week before the Sinhala and Tamil New Year. Two of the Kandy hub's seven refrigerated vehicles are in the workshop."); the flow line in Doc body ("Flow: DSP-01 Order queue, DSP-02 Plan board, DSP-03 Deferrals, DSP-02 Publish, DSP-05 Capacity outlook, DSP-04 Live runs (the 2:48 AM phone decision, then the 5:20 AM desk). Prototype flows: Dispatcher flow, Dispatcher: Broken rule, Dispatcher: Deferrals to publish, Dispatcher: Shortfall at night, Dispatcher: Next weeks.", each flow name kept on one line).
- One row at y 452, in the order of the table above, 160 px between frames, starting at x 80.
- "Caption / <frame name>" above each frame in Caption `asphalt-500`, as wide as the frame, clear of the 22 px where Figma draws frame names. The captions are listed under each frame.
- "Rationale / <frame name>" 40 px below each of the five main screens (DSP-01, DSP-02, DSP-03, DSP-05, DSP-04), as wide as the frame: fill `white`, 1 px `asphalt-200`, radius 12, padding 24, gap 48; a 344 wide title block (frame name in Heading 3, purpose in Label `asphalt-500`) beside the rationale in Body `asphalt-700`.
- Flow connectors (88 x 16 arrows in `asphalt-300`) between consecutive frames, level with the shorter frame's middle. Where time passes with no click, a time label replaces the arrow: "Tue 6:45 PM" after DSP-02 / published and "Wed 2:48 AM" after DSP-05.
- Text keeps a time with its AM or PM, a range "4:00 to 7:45 AM" together and a sum "239 + 68 = 307" together (no-break spaces), so no line ends on a lone "AM" or "min".

### Prototype flows (Figma flow starting points)

The area step sets these names, the ones Figma lists; `prototype/30-flow-starts.js` keeps them (and still renames the spec names of older builds, given in the second column).

| Flow | Earlier spec name | Starts at | Path |
|---|---|---|---|
| Dispatcher flow | Cutoff to plan | DSP-01 Order queue | Click the countdown ("4:00 PM passes"), / after cutoff, "Go to plan board", DSP-02 Plan board |
| Dispatcher: Broken rule | Broken rule | DSP-02 Plan board | Click the ORD0098596 card, / dragging, click VEH057 trip 2 (the drop), / broken rule, "Undo move", back to DSP-02 |
| Dispatcher: Deferrals to publish | Deferrals to publish | DSP-03 Deferrals | "Use Relay's reason", / ready, "Confirm deferral", DSP-02 / publish check, "Publish plan" opens the Publish dialog, its "Publish plan" lands on DSP-02 / published |
| Dispatcher: Shortfall at night | Shortfall at night | DSP-04 Live runs / shortfall decision | "Send short, add to Thursday", DSP-04 Live runs at 5:20 AM |
| Dispatcher: Next weeks | Next weeks | DSP-05 Capacity outlook | No further steps |

Figma keeps one starting point per frame, so "Dispatcher: Deferrals to publish" starts on the drawer; "Review deferral" on DSP-02 also leads there.

---

## Shared shell for every desktop frame

Every desktop frame uses this shell. Frame sections below describe only what changes. The phone frame's shell is under DSP-04.

- **Frame:** 1440 x 900, fill `asphalt-50`, clip content. Horizontal: Nav rail, then the main column (1352 wide).
- **Type:** Atkinson Hyperlegible Next everywhere; tabular figures in every table, meter value and time. Styles: Display 32/40 Bold, Heading 2 20/28 SemiBold, Heading 3 16/24 SemiBold, Body 15/22, Body dense 14/20 (and strong), Label 13/18 Medium, Label strong 13/18 SemiBold, Caption 12/16 Medium.
- **Icons:** Lucide at 1.75 stroke, 20 px unless stated, 16 px inside chips, meters and compact rows.

### 1. Nav rail (component "Nav rail", variant by active item), 88 x 900

- Fill `white`, right border 1 px `asphalt-200`, vertical, padding 20 0, gap 8, centered.
- Relay mark (Logo, type Mark, surface Light), then four items, each 72 x 64, radius 10, vertical, gap 4, centered: icon 22 (`asphalt-500`; `petrol-700` when active) over a label row (Caption, `asphalt-700`; `petrol-700` when active) with a Key hint. Active item: fill `petrol-50`.

  | Icon | Label | Key hint |
  |---|---|---|
  | `clipboard-list` | Queue | 1 |
  | `layers` | Plan | 2 |
  | `route` | Live | 3 |
  | `chart-column` | Outlook | 4 |

- Spacer, then the Shortcuts entry (Key hint "?" over "Shortcuts" in Caption `asphalt-700`) and the avatar "NP".
- The dispatcher frames switch the component's "Key hints" property on: Nuwan's desk is keyboard first. Key hint: 20 x 20, 1 px `asphalt-300`, radius 6, fill `white`, Caption `asphalt-500`, centered, not monospace.

### 2. Page header, 1352 x 80

- Fill `white`, bottom border 1 px `asphalt-200`, horizontal, padding 12 24, space between, centered.
- Left: title in Display `asphalt-900`; meta line in Body dense `asphalt-700` (it can carry a 16 px icon, as on DSP-01 / after cutoff and DSP-02 / publish check).
- Right, gap 12:
  - **Clock:** `calendar-clock` 20 `asphalt-500` and the snapshot time in Label `asphalt-700`, for example "Tue 7 Apr · 3:12 PM".
  - **Depot switch** (Input / segmented control / depot): track fill `asphalt-100`, radius 6, padding 2; segments 32 high, padding 0 12, radius 6: "All", "Peliyagoda", "Kandy hub". Selected: fill `white`, 1 px `asphalt-300`, Label strong `asphalt-900`. Unselected: Label `asphalt-700`. On the plan board "All" is disabled (Label `asphalt-300`), with the tooltip "Plans are made one depot at a time, because each vehicle serves only its home depot."
  - Page controls, where the frame has any (DSP-04: Button / secondary "Fresh" with `filter`).
  - **Search**, 280 x 36, fill `white`, 1 px `asphalt-300`, radius 6, `search` 20 `asphalt-500`, placeholder in Body dense `asphalt-500`: "Search orders, stores, vehicles" (DSP-04: "Search vehicle, driver or outlet"). Tooltip "Search (/)".

### 3. Content region

- Vertical, padding 16 24 24 24, gap 16 (DSP-05: 12), so the usable area is 1304 x 780.

### Keyboard (build and the Shortcuts sheet)

Letter and number shortcuts are off while a text field has focus. None of them sends anything to a store or a driver.

| Keys | Action | Where |
|---|---|---|
| 1, 2, 3, 4 | Go to Queue, Plan, Live, Outlook | Everywhere |
| / | Focus search | Everywhere |
| ? | Open the shortcuts sheet | Everywhere |
| Shift A, Shift P, Shift K | Depot: All, Peliyagoda, Kandy hub | Where the segment is enabled |
| Up, Down | Move between rows, lanes, stops or items | Tables, lanes, feeds |
| Enter | Open the focused row, trip or item | Everywhere |
| Esc | Close a drawer, menu or dialog | Everywhere |
| M | Move the focused stop or order to a trip: opens the Trip picker (build only, see DSP-02) | Plan |
| Ctrl Z | Undo the last move | Plan |
| P | Propose again: opens a confirm first if anything was moved by hand | Plan |
| D | Open deferrals | Plan |
| Ctrl Enter | Publish plan, when allowed: opens the Publish dialog | Plan |

### Shared rules for these frames

- **Color means status.** Rows and cards stay neutral. Color appears only on chips, meters, markers, tone bars and the one primary button per screen.
- **Every status has an icon and a word.** No status is shown by color alone.
- **Capacity meters:** normal below 90% (bar `petrol-700` on `asphalt-100`); near limit from 90% to 100% (bar and value `attention-strong`); over limit above 100% (bar `problem-strong`, full width, value `problem-strong`). Fuel is near its limit from 85% of the weekly quota. Meter bars and legend swatches are fully rounded.
- **Two named times.** *Planned* is the organizers' published standard at free flow, the clock the plan is checked on. *Expected* is Relay's model (each leg at free flow times 100/speed index times 100/road index, plus each store's usual unloading time in monsoon months). Dispatcher screens show Expected to the minute; driver and store screens round it to 5 minutes ("around 6:35 AM"). Behind Planned is normal in monsoon months and is never shown as a problem; only a stop expected after its window is.
- **Fresh time** is the published standard's minutes for a trip (outbound, legs between stops, handling at each stop; the drive back is not counted), counted against 270 Fresh minutes per vehicle per day; Style and Tech trips count against 480 daytime minutes. A trip card shows the vehicle's total for the day.
- **Access words:** "Rear dock" (`warehouse`), "Curb" (`store`), "Van only" (`van`), the same on every role. "street" is only the dataset value for curb access.
- **Numbers never change between roles.** A figure shown here for VEH045, ORD0098595, ORD0098596 or ORD0098747 is the figure the loader, driver and store see.

### Status chips used on these frames

Chip: 24 high, radius 6, padding 3 8 3 6, 16 px icon, Label text. Count badge (Status chip / compact): 20 high, padding 0 7, Label strong, no icon.

| Label | Tone | Icon | Where |
|---|---|---|---|
| Chilled | `chilled-strong` on `chilled-soft` | `snowflake` | Type cell, drag ghost |
| Van only | `asphalt-900` on `asphalt-100` | `van` | DSP-01 flags |
| Large truck, Truck only | `asphalt-900` on `asphalt-100` | `truck` | DSP-01 flags (Style, Tech) |
| Waited Monday | `attention-strong` on `attention-soft` | `history` | DSP-01 flag, DSP-03 protected card |
| To defer | `attention-strong` on `attention-soft` | `clock` | DSP-02 Not placed card |
| Moved to Thursday | `attention-strong` on `attention-soft` | `clock` | DSP-01 late orders, DSP-02 / publish check, DSP-03 preview (the label the store sees on STM-01 and STM-03) |
| Proposed 4:35 PM | `petrol-700` on `petrol-50` | `circle-dot` | DSP-02 plan bar |
| Edited 4:35 PM | `attention-strong` on `attention-soft` | `clock` | DSP-02 / broken rule |
| Ready 4:52 PM | `done-strong` on `done-soft` | `circle-check` | DSP-02 / publish check |
| Published 6:40 PM | `done-strong` on `white` (the plan bar behind it is `done-soft`) | `circle-check` | DSP-02 / published |
| New Year ramp, Vesak ramp, Vesak | `attention-strong` on `attention-soft` | `calendar` | DSP-05 week header |
| New Year | `asphalt-700` on `asphalt-100` | `lock` | DSP-05 week 16 (closed days) |

Access flags stay neutral because they are facts about the store, not problems.

---

## DSP-01 Order queue

- **Frame:** "DSP-01 Order queue". Snapshot Tuesday 7 April 2026, 3:12 PM, 48 minutes before the 4:00 PM cutoff. Depot switch on "All". Nav: Queue.
- **Purpose:** Show every order for tomorrow in one list as it arrives, flag what limits how it can travel, and show which Fresh outlets still need chasing before the 4:00 PM cutoff.
- **Layout:**
  1. Page header: "Order queue" / "Orders for Wednesday 8 April". Clock "Tue 7 Apr · 3:12 PM".
  2. Cutoff banner (Summary card / petrol), 1304 x 88: fill `white`, 1 px `asphalt-200`, radius 12, 4 px `petrol-700` tone bar on the left, horizontal, padding 10 20 10 24, gap 32, centered.
     - Countdown: `clock` 20 `petrol-700`; "Orders for Wednesday close at 4:00 PM" in Label `asphalt-700`; "48 min" in Display.
     - Divider 1 x 56 `asphalt-200`.
     - Progress (fills the width): "Fresh outlets ordered" in Label `asphalt-700` and "74 of 80" in Heading 3 at the right; Capacity meter / progress, 8 high, fully rounded, `petrol-700`, 92.5%; caption "Style and Tech order on their own schedule, so only Fresh outlets are counted." in Caption `asphalt-500`.
     - Divider.
     - Key figure / inline, 200 wide: "Orders in" / "125" (Heading 2) / "Peliyagoda 73 · Kandy hub 52" (Caption `asphalt-500`).
  3. Main row, gap 16:
     - **Queue card**, 920 x 676, fill `white`, 1 px `asphalt-200`, radius 12, clip.
       - Toolbar, 52 high, padding 8 16, bottom border: filter tabs (32 high, radius 6, Label plus the count in Label strong; selected fill `petrol-50`, text `petrol-700`): "All 125", "Fresh dry 74", "Fresh chilled 46" (selected), "Style 3", "Tech 2". Right: "Flags" (`filter` 20, `chevron-down`) and "Needs attention first" (`chevron-down`).
       - Table header row, 36 high, fill `asphalt-50`, Caption `asphalt-500`. Columns inside 16 px padding, 8 px gaps: Order 92, Outlet 176, Type 84, Cases 48 (right), kg 64 (right), m³ 60 (right), an 8 px spacer, Window 140, Flags 152. Rows are grouped by depot, so there is no depot column.
       - Table group rows, 32 high, bottom border: chevron 16, `warehouse` 16, depot in Label strong, count in Label `asphalt-500`, caption at the right in Caption `asphalt-500`. "Peliyagoda 24" folded (`chevron-right`, fill `asphalt-50`); "Kandy hub 22" open, caption "VEH039 and VEH058 are in the workshop".
       - Order rows, 40 high, Body dense, tabular. Outlet cell: ID in SemiBold, then the name. A chilled order's Type cell is the Chilled chip. Flags are chips. The body scrolls.
     - **Not ordered panel**, 368 x 676, padding 16, gap 12: header "Not ordered yet" (Heading 3) with count badge "6" (attention); caption "Fresh outlets with no order for Wednesday yet." Six contact rows (padding 10 0, gap 4, bottom border): line 1, ID and name with Button / secondary "Remind" (`send` 16) and Button / quiet "Call" (`phone` 16), 32 high, at the right; line 2, one full width Caption `asphalt-500` line with the depot first, "Peliyagoda · Orders dry and chilled on Wednesdays". Footer: Button / primary "Remind all 6" (`send`), full width; caption "A reminder appears in the store's Relay app with the 4:00 PM cutoff. Call uses the number on the outlet record."
- **Content:** Kandy hub rows in the Fresh chilled tab. Flagged orders first, then by the time the store's window closes.

  | Order | Outlet | Type | Cases | kg | m³ | Window | Flags |
  |---|---|---|---|---|---|---|---|
  | ORD0098599 | OUT119 Kegalle | Chilled | 65 | 466.4 | 2.438 | 3:00 to 8:00 AM | Waited Monday |
  | ORD0098545 | OUT076 Katugastota | Chilled | 25 | 174.8 | 0.930 | 3:00 to 8:00 AM | Van only |
  | ORD0098550 | OUT080 Watapuluwa | Chilled | 23 | 150.3 | 0.799 | 5:30 to 8:00 AM | Van only |
  | ORD0098552 | OUT081 Hantana | Chilled | 29 | 210.7 | 1.112 | 3:00 to 8:00 AM | Van only |
  | ORD0098554 | OUT082 Ampitiya | Chilled | 17 | 114.6 | 0.602 | 3:00 to 8:00 AM | Van only |
  | ORD0098556 | OUT083 Suduhumpola | Chilled | 24 | 154.1 | 0.811 | 4:00 to 7:45 AM | Van only |
  | ORD0098560 | OUT085 Kandy Town | Chilled | 77 | 559.5 | 2.931 | 5:00 to 7:30 AM | |
  | ORD0098570 | OUT099 Rattota | Chilled | 49 | 355.6 | 1.892 | 5:00 to 7:30 AM | |
  | ORD0098574 | OUT101 Elkaduwa | Chilled | 77 | 515.0 | 2.811 | 5:00 to 7:30 AM | |
  | ORD0098578 | OUT105 Nuwara Eliya | Chilled | 37 | 274.8 | 1.469 | 5:00 to 7:30 AM | |
  | ORD0098594 | OUT116 Aranayake | Chilled | 47 | 335.2 | 1.774 | 5:00 to 7:30 AM | |
  | ORD0098589 | OUT112 Bandarawela | Chilled | 60 | 417.4 | 2.207 | 4:00 to 7:45 AM | |
  | ORD0098596 | OUT117 Hemmathagama | Chilled | 92 | 659.2 | 3.464 | 4:00 to 7:45 AM | |

  Not ordered yet (buttons "Remind" and "Call" on every row):

  | Outlet | Depot | Line 2 |
  |---|---|---|
  | OUT012 Borella | Peliyagoda | Orders dry and chilled on Wednesdays |
  | OUT032 Kadawatha | Peliyagoda | Orders dry and chilled on Wednesdays |
  | OUT041 Panadura | Peliyagoda | Orders dry and chilled on Wednesdays |
  | OUT053 Hikkaduwa | Peliyagoda | Orders dry and chilled on Wednesdays |
  | OUT087 Mulgampola | Kandy hub | Orders dry and chilled on Wednesdays |
  | OUT098 Aluvihare | Kandy hub | Orders dry only on Wednesdays |

- **Build behaviour:** "Waited Monday" pins a store whose last chilled order waited, until it is planned. "Needs attention first" sorts: waited last run, then orders that need a truck, then chilled van-only orders, then other van-only orders, then the rest by the time the window closes. An order counts as received when it reaches Relay, and Relay's receive time decides its run. The store's own countdown appears only in the last 4 hours before a cutoff.
- **Caption:** "Tue 7 Apr · 3:12 PM · 48 min before the cutoff. 125 orders are in and 6 Fresh outlets still need chasing."

### State: DSP-01 Order queue / after cutoff

- Tuesday 7 April, 4:02 PM. The queue locked at 4:00 PM. Differences from the base frame:
  - Page header meta: `lock` 16 and "Orders for Wednesday 8 April · Locked at 4:00 PM". Clock "Tue 7 Apr · 4:02 PM".
  - Banner becomes Summary card / asphalt (tone bar `asphalt-700`): `lock` 20; "Orders for Wednesday closed at 4:00 PM" over "136" (Display) with "orders locked" (Label). Middle: "By type" / "79 Fresh dry · 50 Fresh chilled · 4 Style · 3 Tech" / "Late orders go on Thursday's run by themselves." Right: Button / primary "Go to plan board" with `arrow-right` 20, 36 high.
  - Left column, 920 wide, gap 16:
    - **Late orders card**, 920 x 132, fill `white`, 4 px `attention-strong` tone bar, padding 12 16 12 20. Header: `clock` 20 `attention-strong`, "2 orders came in after 4:00 PM" (Heading 3), caption "Moved to Thursday's run. The store was told the minute each arrived." Compact rows, 36 high:

      | Order | Outlet | Depot | Type | kg | m³ | Received | Now | Store |
      |---|---|---|---|---|---|---|---|---|
      | ORD0098496 | OUT032 Kadawatha | Peliyagoda | Dry | 932.4 kg | 5.118 m³ | 4:01 PM | Moved to Thursday | Told 4:01 PM |
      | ORD0098497 | OUT032 Kadawatha | Peliyagoda | Chilled | 985.4 kg | 5.299 m³ | 4:02 PM | Moved to Thursday | Told 4:02 PM |

    - **Queue card**, 920 x 528. Tabs "All 136" (selected), "Fresh dry 79", "Fresh chilled 50", "Style 4", "Tech 3". Groups "Peliyagoda 79" (folded) and "Kandy hub 57" (open, "VEH039 and VEH058 are in the workshop"). Rows, needs attention first:

      | Order | Outlet | Type | Cases | kg | m³ | Window | Flags |
      |---|---|---|---|---|---|---|---|
      | ORD0098599 | OUT119 Kegalle | Chilled | 65 | 466.4 | 2.438 | 3:00 to 8:00 AM | Waited Monday |
      | ORD0098600 | OUT120 Kegalle | Style | 77 | 1,109.9 | 17.730 | 9:00 AM to 5:00 PM | Large truck |
      | ORD0098592 | OUT115 Passara | Tech | 10 | 2,136.2 | 7.070 | 9:00 AM to 5:00 PM | Truck only |
      | ORD0098545 | OUT076 Katugastota | Chilled | 25 | 174.8 | 0.930 | 3:00 to 8:00 AM | Van only |
      | ORD0098550 | OUT080 Watapuluwa | Chilled | 23 | 150.3 | 0.799 | 5:30 to 8:00 AM | Van only |
      | ORD0098552 | OUT081 Hantana | Chilled | 29 | 210.7 | 1.112 | 3:00 to 8:00 AM | Van only |
      | ORD0098554 | OUT082 Ampitiya | Chilled | 17 | 114.6 | 0.602 | 3:00 to 8:00 AM | Van only |
      | ORD0098556 | OUT083 Suduhumpola | Chilled | 24 | 154.1 | 0.811 | 4:00 to 7:45 AM | Van only |
      | ORD0098544 | OUT076 Katugastota | Dry | 34 | 227.3 | 1.264 | 3:00 to 8:00 AM | Van only |

      The Style order is light and bulky (it needs a large truck; vans take 9.0 m³ at most); the Tech order is heavy (it needs a truck; vans take 1,200 kg at most). No vehicle is named: the plan does not exist yet.
  - **Cutoff summary panel**, 368 x 676: "Wednesday 8 April" (Heading 3) / "Locked at 4:00 PM". Key figure rows, 28 high: Fresh dry 79, Fresh chilled 50, Style 4, Tech 3, then "Total 136" in Label strong over a top border. "By depot": Peliyagoda 79, Kandy hub 57. Divider. "79 of 80 Fresh outlets ordered in time" (Label strong) / "OUT032 Kadawatha's two orders came at 4:01 and 4:02 PM. They ride Thursday's run." Divider. `snowflake` 16 `chilled-strong` "Kandy hub chilled for Wednesday": Chilled orders 23; Weight 8,144.5 kg; Volume 43.630 m³; Refrigerated vehicles free 5 of 7; caption "More chilled volume than on 113 of the 115 Kandy Wednesdays in the data. VEH039 and VEH058 are back on Thursday 9 April."
- **Caption:** "Tue 7 Apr · 4:02 PM · The queue locked at 4:00 PM with 136 orders. Kadawatha's 2 late orders moved to Thursday by themselves."

- **Prototype:** DSP-01: the countdown jumps to / after cutoff (dissolve 300 ms; the flow step is "4:00 PM passes"). Nav Live to DSP-04, Outlook to DSP-05; Plan has no target before the cutoff. / after cutoff: "Go to plan board" and nav Plan go to DSP-02 (dissolve 300 ms); Live and Outlook as above. Remind, Call, tabs, sort and rows have no target.
- **Rationale (Rationale / DSP-01 Order queue):** Purpose: "Show every order for tomorrow in one list as it arrives, flag what limits how it can travel, and show which Fresh outlets still need chasing before the 4:00 PM cutoff." Text: "Today Nuwan spends his afternoon retyping orders from calls and messages, and finds a missing store at 5 PM. This queue shows every order the moment a store places it, with the facts he used to carry in his head as flags on the row: van only, an order that needs a truck, and a store whose last chilled order waited. This week two of the Kandy hub's refrigerated vehicles are in the workshop, so he keeps the chilled tab open. Before the cutoff the side panel turns the gaps into a short call list. At 4:00 PM the list locks, Kadawatha's two late orders move to Thursday by themselves, and the store is told the minute each arrives."

---

## DSP-02 Plan board

- **Frame:** "DSP-02 Plan board". Snapshot Tuesday 7 April, 4:35 PM: Relay has proposed the Kandy hub plan. Depot switch on "Kandy hub" ("All" disabled). Nav: Plan. The board is filtered to the refrigerated vehicles, and VEH057 trip 2 is selected.
- **Purpose:** Let Nuwan check and adjust Relay's proposed allocation, see how full every trip is on each limit, and see which order doesn't fit and why.
- **Layout:**
  1. Page header: "Plan board" / "Kandy hub · Wednesday 8 April". Clock "Tue 7 Apr · 4:35 PM".
  2. Plan bar, 1304 x 56, fill `white`, 1 px `asphalt-200`, radius 12, padding 10 16, space between. Left, gap 12: plan status chip "Proposed 4:35 PM"; summary in Body dense "Kandy hub: 57 orders, 56 on 18 trips, 1 waits". Right, gap 8: helper "Give the deferral a reason to publish." (Caption `asphalt-500`); Button / secondary "Propose again" (`refresh-cw`); Button / primary "Publish plan" (`send`), disabled (fill `asphalt-200`, text `asphalt-500`). Tooltips: "Propose again (P)", "Publish plan (Ctrl Enter)".
  3. Board, 1304 x 708, horizontal, gap 16:
     - **Not placed column**, 288 wide, padding 16, gap 12:
       - "Not placed" (Heading 3) with count badge "1" (attention).
       - Notice / attention (fill `attention-soft`, radius 8, padding 12): `circle-alert` 20 and "1 chilled order doesn't fit" (Label strong); body "659.2 kg and 3.464 m³. VEH039 and VEH058 are in the workshop, and VEH057 trip 2, the only refrigerated trip planned to reach Kegalle in time, has no room for it."; link button "Review deferral" with `chevron-right` (`petrol-700`).
       - Order row / board card, fill `white`, 1 px `asphalt-200`, radius 8, padding 8 12 8 4: `grip-vertical` 16 `asphalt-300`; "OUT117 Hemmathagama"; "ORD0098596 · Fresh chilled · 92 cases" (Caption `asphalt-500`); "659.2 kg · 3.464 m³ · 4:00 to 7:45 AM" (Caption `asphalt-700`); chip "To defer".
       - Divider; "Placed 56" (open, `chevron-down`) with rows 26 high: Fresh dry 31, Fresh chilled 22, Style 1, Tech 2.
       - Spacer; helper at the foot "Drag an order onto a trip. Relay checks every rule as you drop."
     - **Vehicles column**, 640 wide, clip:
       - Header, 48 high: "Vehicles" (Heading 3) with the filter count "Refrigerated: 5 running, 2 in the workshop" (Caption `asphalt-500`); at the right the vehicle type filter (Input / segmented control) "All 22", "Refrigerated 7" (selected), "Ambient 15".
       - Five Vehicle lanes, 122 high, padding 8 16, gap 12, bottom border. Vehicle block, 120 wide: ID in Heading 3 with a type icon 16 (`snowflake` for a refrigerated truck, `van` for the refrigerated van, both `chilled-strong`); type in Caption `asphalt-700`; limits in Caption `asphalt-500`; Capacity meter / fuel / compact: "Fuel" and the value in Caption over a 4 px bar. Then two trip slots, 232 x 106.
       - Trip card / compact: fill `white`, 1 px `asphalt-200`, radius 12, padding 6 12, gap 4. Header: title in Label strong and `circle-check` 16 `done-strong`. Line 2 in Caption `asphalt-500`. Three compact meters (`weight`, `box`, `timer`), each a 64 x 4 bar and the value in Caption. Selected: 2 px `petrol-700`, fill `petrol-50`.
       - Empty trip slot: dashed 1 px `asphalt-300`, radius 12, fill `asphalt-50`; title in Caption SemiBold `asphalt-700`, line in Caption `asphalt-500`, centered.
       - Out of service band, fill `asphalt-50`, filling to the card's rounded foot: `circle-alert` 16 and two lines in Label `asphalt-500`: "VEH039 · Refrigerated truck · In the workshop, back Thu 9 Apr" and "VEH058 · Refrigerated van · In the workshop, back Thu 9 Apr". Not selectable, not a drop target.
     - **Trip detail panel**, 344 wide, padding 16, gap 10, clip:
       - Header: title in Heading 2; line in Body dense `asphalt-700`; line in Caption `asphalt-500`.
       - Meter grid, 2 x 2, gap 16 x 8: Capacity meter / full, 148 wide: icon and label (Caption), value in Label strong, 8 px bar, caption.
       - Rule check summary, 32 high, radius 8: pass (fill `done-soft`, `circle-check`) or fail (fill `problem-soft`, `triangle-alert`), Label, `chevron-down`.
       - "Stops, in delivery order" (Label strong `asphalt-700`) with "Planned" at the right (Caption). Stop row / planned, 44 high: `grip-vertical` 16 `asphalt-300`, 24 x 24 number badge (`asphalt-100`), store in Body dense SemiBold over access and window in Caption (access icon first), planned arrival in Label at the right.
       - Trip note: `info` 16 and a Caption `asphalt-700` line.
- **Content:** lanes (trip card: title / line 2 / weight / volume / Fresh minutes for the day):

  | Lane | Vehicle block | Trip 1 | Trip 2 |
  |---|---|---|---|
  | VEH040 | Refrigerated truck · 5,510 kg · 26.4 m³ · Fuel 159.9 of 380 L | "Trip 1 · Badulla" / "2 stops · leaves 2:00 AM" / 409.7 of 5,510 / 2.247 of 26.4 / 239 of 270 | Empty: "No trip 2" / "Back at the hub 9:05 AM" |
  | VEH041 | Refrigerated truck · 3,610 kg · 19.4 m³ · Fuel 126.6 of 600 L | "Trip 1 · Badulla" / "2 stops · leaves 2:00 AM" / 835.6 of 3,610 / 4.447 of 19.4 / 239 of 270 | Empty: "No trip 2" / "Back at the hub 9:05 AM" |
  | VEH042 | Refrigerated truck · 6,180 kg · 29.9 m³ · Fuel 44.3 of 480 L | "Trip 1 · Matale" / "4 stops · leaves 2:44 AM" / 2,185.3 of 6,180 / 12.009 of 29.9 / 129 of 270 | "Trip 2 · Kandy" / "3 stops · leaves 6:26 AM" / 1,171.0 of 6,180 / 6.080 of 29.9 / 202 of 270 |
  | VEH043 | Refrigerated truck · 5,510 kg · 26.4 m³ · Fuel 115.8 of 450 L | "Trip 1 · Nuwara Eliya" / "4 stops · leaves 2:35 AM" / 1,277.6 of 5,510 / 6.917 of 26.4 / 231 of 270 | Empty: "No trip 2" / "Back at the hub 8:51 AM" |
  | VEH057 | Refrigerated van · 1,040 kg · 7.0 m³ · Fuel 25.2 of 450 L | "Trip 1 · Kandy" / "5 stops · leaves 3:40 AM" / 804.5 of 1,040 / 4.254 of 7.0 / 120 of 270 | Selected. "Trip 2 · Kegalle" / "2 stops · leaves 6:12 AM" / 801.6 of 1,040 / 4.212 of 7.0 / 216 of 270 |

  Trip detail, VEH057 trip 2 (VEH039's usual Kegalle run, 2 of its 3 orders):
  - Header: "VEH057 · Trip 2" / "Fresh chilled · Kegalle district · Priyantha Silva" / "Refrigerated van · leaves 6:12 AM · back 8:41 AM".

    | Meter | Icon | Value | Caption |
    |---|---|---|---|
    | Weight | `weight` | 801.6 of 1,040 kg | 238.4 kg free |
    | Volume | `box` | 4.212 of 7.0 m³ | 2.788 m³ free |
    | Fresh time | `timer` | 216 of 270 min | 96 on this trip |
    | Fuel this week | `fuel` | 25.2 of 450 L | 424.8 L left, Thu to Sat |

  - Rule check: "All 11 rules pass".
  - Stops: 1 "OUT116 Aranayake" / `warehouse` "Rear dock · 5:00 to 7:30 AM" / "7:05 AM"; 2 "OUT119 Kegalle" / `warehouse` "Rear dock · 3:00 to 8:00 AM" / "7:33 AM".
  - Note: "VEH039's usual Kegalle run, 2 of its 3 orders, while VEH039 is in the workshop. It leaves 10 min after trip 1 is back at 6:02 AM."
- **The 11 rules** (the Rule check list, expanded in the build): 1 Weight within the vehicle's limit. 2 Volume within the vehicle's limit. 3 Chilled on a refrigerated vehicle, Fresh dry on an ambient one. 4 Van-only stores go by van. 5 Every store belongs to the vehicle's home depot. 6 One brand and one district a trip. 7 Fresh trips within 270 min a day (Style and Tech within 480). 8 Every planned arrival inside the store's window. 9 At most 2 trips a day. 10 First trips leave at 2:00 AM or later; a second trip leaves at least 10 min after the first is back at the hub. 11 Fuel stays within the weekly quota. Rules 1 to 7 and 9 are the organizers' published standard; 8 and 10 are Relay's clock; 11 is Waypoint's quota.
- **Filters:** the three filters count "All: 12 running, 1 standby, 2 in the workshop, 7 not needed" (22 vehicles), "Refrigerated: 5 running, 2 in the workshop" (7) and "Ambient: 7 running, 1 standby, 7 not needed" (15). The board has 18 trips: 7 refrigerated, 11 ambient. Under Ambient (not drawn) VEH056 trip 2 carries the Style order to OUT120 at 80.6% of its volume and 29.2% of its weight, and VEH060 shows as the standby, free until 8 AM.
- **Build behaviour:** every drop re-runs all 11 rules in under a second and updates the meters on both trips. Dragging a stop moves all of that store's orders on the trip; dragging a Not placed card moves one order. A broken rule marks the trip and keeps Publish off. Nuwan can always drop; Relay never refuses the move, it explains it. M on a focused stop or order opens the Trip picker (Input / select menu, one row per trip with the same fit hint as the drag state), the keyboard path for the same move. "Propose again" (P) asks first when anything was moved by hand: "Propose again? Relay keeps the orders you moved and re-plans the rest." When a depot has more lanes than fit (Peliyagoda), a lane whose trips all pass and stay under 90% on every meter collapses to Vehicle lane / compact, 56 high; the selected lane never collapses.
- **Caption:** "Tue 7 Apr · 4:35 PM · Relay's proposed Kandy hub plan, filtered to the refrigerated vehicles, with VEH057 trip 2 selected."

### State: DSP-02 Plan board / dragging

- 4:35 PM. Nuwan picked up Dilani's chilled order from Not placed and holds it over VEH057 trip 2. Differences:
  - Not placed: the card becomes a placeholder (dashed 1 px `asphalt-300`, fill `asphalt-50`, 92 high): "Moving ORD0098596".
  - Every trip card and empty slot replaces line 2 with a Fit hint (Caption SemiBold, `triangle-alert` 16 `problem-strong`):

    | Lane | Trip 1 | Trip 2 |
    |---|---|---|
    | VEH040 | Serves Badulla only | Fresh time 307 of 270 |
    | VEH041 | Serves Badulla only | Fresh time 307 of 270 |
    | VEH042 | Serves Matale only | Serves Kandy only |
    | VEH043 | Serves Nuwara Eliya only | Fresh time 299 of 270 |
    | VEH057 | Serves Kandy only | Over weight and volume (hovered: 2 px dashed `problem-strong`) |

  - Trip detail (VEH057 trip 2) adds a Stop row / placeholder as stop 3: "Drop to add OUT117 as stop 3".
  - Drag ghost (Order row / board card / dragging), 264 wide, 2 px `petrol-700`, floating shadow, over VEH057 trip 2: "OUT117 Hemmathagama" / "ORD0098596 · Fresh chilled · 92 cases" / "659.2 kg · 3.464 m³ · 4:00 to 7:45 AM" / chip "Chilled".
  - Tooltip (fill `asphalt-900`, radius 8, padding 8 12, Body dense `white`, 256 text width, with a caret), right of the hovered trip: "VEH057 trip 2 would carry 1,460.8 of 1,040 kg. You can drop it here, but the plan won't publish until it fits."
- **Caption:** "Tue 7 Apr · 4:35 PM · Nuwan holds Dilani's chilled order, ORD0098596, over VEH057 trip 2. Every slot says whether it fits."

### State: DSP-02 Plan board / broken rule

- 4:35 PM, just after the drop. Differences from the base frame:
  - Plan bar: chip "Edited 4:35 PM"; summary "3 rules broken on VEH057 trip 2. Publish stays off until they're fixed."; helper "Fix 3 broken rules to publish."
  - Not placed: badge "0" (neutral); notice in `asphalt-50` with no title: "Every order is placed, but VEH057 trip 2 now breaks 3 rules. Undo the move and Relay's deferral comes back."; no cards; "Placed 57": Fresh dry 31, Fresh chilled 23, Style 1, Tech 2.
  - VEH057 trip 2 card: selected and broken (2 px `problem-strong`, fill `white`), status icon `triangle-alert`, line 2 "3 rules broken" as a Fit hint; meters "1,460.8 of 1,040" (over), "7.676 of 7.0" (over), "244 of 270" (near limit).
  - Trip detail:
    - Notice / problem at the top (fill `problem-soft`, radius 8, padding 12): `triangle-alert` 20 and "3 rules broken"; body "Weight and volume: 1,460.8 kg and 7.676 m³ on a van that takes 1,040 kg and 7.0 m³. Window: stop 3 would arrive at 8:01 AM, after every Kegalle window closes."; Button / primary "Undo move" (tooltip "Undo move (Ctrl Z)").
    - Meters: Weight "1,460.8 of 1,040 kg", caption "420.8 kg over"; Volume "7.676 of 7.0 m³", caption "0.676 m³ over"; Fresh time "244 of 270 min", caption "124 on this trip"; Fuel this week as in the base frame.
    - Rule check summary / fail: "8 of 11 rules pass". Expanded (build): the three failing rules first ("Weight: 1,460.8 of 1,040 kg", "Volume: 7.676 of 7.0 m³", "Window: OUT117 at 8:01 AM, closes 7:45"), then the eight that pass.
    - Stops: 1 OUT116 Aranayake 7:05 AM; 2 OUT119 Kegalle 7:33 AM; 3 "OUT117 Hemmathagama" / "Rear dock · 4:00 to 7:45 AM" / "8:01 AM" as Stop row / planned / broken (fill `problem-soft`, number badge `problem-strong` with `white` text, text `problem-strong`).
- **Caption:** "Tue 7 Apr · 4:35 PM · Just after the drop. The 3 broken rules are named on the trip, with Undo move beside them."

### State: DSP-02 Plan board / publish check

- Tuesday 7 April, 6:39 PM. Between 4:52 and 6:31 PM Nuwan planned Peliyagoda and published it; he is back on the Kandy board, ready since 4:52 PM. Differences from the base frame:
  - Page header meta: "Kandy hub · Wednesday 8 April ·" then `circle-check` 16 `done-strong` and "Peliyagoda published 6:31 PM". Clock "Tue 7 Apr · 6:39 PM".
  - Plan bar: chip "Ready 4:52 PM"; summary "Kandy hub: 57 orders, 56 on 18 trips, 1 waits for Thursday with a reason."; no helper; "Publish plan" enabled.
  - Left column: "Deferred" with a neutral badge "1"; notice (no title) "1 chilled order moves to Thursday 9 April. Hemmathagama is told when you publish."; the ORD0098596 card with chip "Moved to Thursday"; "Placed 56"; helper "Stores are told when you publish, not before."
  - The vehicles column and trip detail give way to the **Publish check panel** (1000 wide, padding 16 20, gap 10):
    - Header: `list-checks` 20, "Publish check" (Heading 2), "53 Fresh stops · checked 6:39 PM" (Caption); link "Back to the board" with `arrow-left`.
    - Check line / pass (fill `done-soft`, `circle-check`): "**No planned arrival is after its window closes.** Early arrivals wait for the store to open."
    - Check line / attention (fill `attention-soft`, `clock`): "**Relay expects 5 of the 53 Fresh stops to arrive after their window**, and says why it keeps each one where it is."
    - Expected late table. Columns: Trip 104, Store 150, Closes 52, Planned 60, Expected 66 (`clock` 16 and the time in Body dense SemiBold `attention-strong`), Why Relay keeps it 440 (Body dense `asphalt-700`).

      | Trip | Store | Closes | Planned | Expected | Why Relay keeps it |
      |---|---|---|---|---|---|
      | VEH042 trip 2 | OUT087 Mulgampola | 8:00 | 7:03 | 8:25 | VEH042 runs Matale first (VEH039's run: Matale's stores close at 7:30 and 8:00, and the road index there is 72), then its own Kandy run. VEH057, back at 6:02, is needed for Kegalle (rule 1). VEH040, VEH041 and VEH043 are back after 8:40 AM. |
      | VEH042 trip 2 | OUT085 Kandy Town | 7:30 | 7:24 | 8:59 | Same trip. Kandy Town would miss its 7:30 close in any stop order, so Relay puts it last and keeps Bogambara inside its window instead. |
      | VEH044 trip 1 | OUT107 Maskeliya | 8:00 | 7:20 | 8:17 | The last store on the Nuwara Eliya road. VEH044 leaves at 2:35 so it reaches Nuwara Eliya at its 5:00 opening. An idle truck could take Maskeliya alone (expected about 4:21 AM), but that is a second truck and driver for about 4 hours at free flow and about 23 L of fuel for one store. Relay's choice is not to send a truck for one store; Maskeliya is told its expected time. |
      | VEH057 trip 2 | OUT116 Aranayake | 7:30 | 7:05 | 7:43 | VEH057's second trip is the only refrigerated trip planned to reach Kegalle (rule 1). It leaves 10 minutes after its first trip is back, and that trip can't end earlier because Watapuluwa opens at 5:30. |
      | VEH057 trip 2 | OUT119 Kegalle | 8:00 | 7:33 | 8:32 | Same trip. This is the protected order: late by Relay's estimate, but the same morning instead of Thursday. |

    - Footer: `info` 16 "Planned is the published standard at free flow. Expected is Relay's model of the day, shown to the minute here."
  - The publish check counted VEH045 in its order before the 9:12 PM swap; both orders keep every stop expected inside its window. Every other Fresh stop is expected inside its window.
- **Caption:** "Tue 7 Apr · 6:39 PM · Peliyagoda was published at 6:31 PM. Relay expects 5 of the 53 Fresh stops after their window and says why."

### Overlay: DSP-02 Publish dialog

- 560 x 398, fill `white`, radius 16, floating shadow, padding 24, gap 16. Opened as an overlay on DSP-02 / publish check, centered, background `scrim` (#14181F at 40%), close on click outside (set by hand in Figma; the Plugin API cannot set it).
- "Publish the Kandy hub plan?" (Heading 2); "56 orders on 18 trips for Wednesday 8 April. 1 chilled order moves to Thursday with a reason, and Relay expects 5 stops after their window." (Body dense `asphalt-700`).
- "When you publish" (Label strong), four rows with `check` 16 `petrol-700`: "Tonight's loading lists update at the Kandy hub dock." / "The drivers of all 12 vehicles see their runs on their phones. Nimal Fernando sees VEH060 on standby until 8 AM." / "Every store on these trips sees its expected arrival." / "OUT117 Hemmathagama gets a notice with the new date and the reason."
- Caption: "You can still change the plan after publishing. Every change reaches the dock, the driver and the store."
- Buttons, right: "Cancel" (quiet), "Publish plan" (primary, `send`).
- **Caption:** "Tue 7 Apr · 6:39 PM · Opens as an overlay on the publish check."

### State: DSP-02 Plan board / published

- Tuesday 7 April, 6:40 PM, straight after "Publish plan" in the dialog. The plan is out: loading lists, run sheets and store statuses update, and the deferral notice goes out (the scenario's 6:40 PM row). Differences from / publish check:
  - Page header meta: "Kandy hub · Wednesday 8 April ·" then `circle-check` 16 `done-strong` and "Published 6:40 PM". Clock "Tue 7 Apr · 6:40 PM".
  - Plan bar: fill `done-soft`, no border. Chip "Published 6:40 PM" (`done-strong` on `white`, `circle-check`); the summary is unchanged. "Propose again" and "Publish plan" give way to "Sent to the dock, the drivers of all 12 vehicles and every store on these trips." (Body dense `asphalt-700`).
  - Deferred column: the notice reads "1 chilled order moves to Thursday 9 April. Hemmathagama was told at 6:40 PM."; the helper reads "Stores were told at 6:40 PM."
  - The publish check panel stays as it was at 6:39 PM, as the record of what was checked.
- **Caption:** "Tue 7 Apr · 6:40 PM · Straight after Publish plan. The dock, the drivers and every store on the Kandy trips have the plan, and Hemmathagama has its notice."

- **Prototype:** DSP-02: clicking the ORD0098596 card goes to / dragging (instant); "Review deferral" goes to DSP-03 (move in from the right, 240 ms); nav Queue to DSP-01 / after cutoff, Live to DSP-04, Outlook to DSP-05. / dragging: clicking VEH057 trip 2 or the ghost (the drop) goes to / broken rule (instant). / broken rule: "Undo move" goes back to DSP-02 (dissolve 200 ms). / publish check: "Publish plan" opens the Publish dialog as an overlay (dissolve 200 ms); nav as in DSP-02. Dialog: "Cancel" closes it; "Publish plan" goes to / published (dissolve 300 ms). / published: nav as in DSP-02; the dispatcher flow ends here (in the cross-role story, STM-03 at 6:41 PM and LDR-01 follow).
- **Rationale (Rationale / DSP-02 Plan board):** Purpose: "Let Nuwan check and adjust Relay's proposed allocation, see how full every trip is on each limit, and see which order doesn't fit and why." Text: "This is where Nuwan's afternoon goes today: matching orders to vehicles from memory. Relay proposes a plan that passes all eleven rules, and each trip shows how close it is to each limit. With two refrigerated vehicles in the workshop he filters the board to the five left and sees the one chilled order that doesn't fit. He keeps the judgment calls: he can drag Dilani's order onto VEH057's second trip and Relay never blocks the move, but the broken rules are named in plain words on the trip, with undo beside them. Before he publishes, the check lists the 5 stops Relay expects after their window and why it keeps each one where it is."

---

## DSP-03 Deferrals

- **Frame:** "DSP-03 Deferrals". Snapshot Tuesday 7 April, 4:50 PM. The drawer is open over DSP-02 Plan board (the 4:35 PM proposed state, the move undone). Relay proposes one chilled order to defer; it has no reason yet.
- **Purpose:** Say why one chilled order waits, keep what was unavoidable apart from what was Relay's choice, show the store it protected, and show the words the waiting store will read.
- **Layout:**
  1. DSP-02 Plan board behind, clock "Tue 7 Apr · 4:50 PM", under a `scrim` layer over the whole frame. Clicking the scrim closes the drawer.
  2. Sheet / side drawer, 880 x 900 at x 560, fill `white`, radius 16 on the left corners, floating shadow. Vertical: header, body, footer.
     - Header, 72 high, padding 12 16 12 24, bottom border: "Deferrals for the Kandy hub" (Heading 2) / "Wednesday 8 April · 1 chilled order · proposed 4:35 PM" (Label `asphalt-500`); close button 40 x 40 with `x` 20 (tooltip "Close (Esc)").
     - Body, 748 high, padding 16 24, gap 24, scrolls: left column 520, right column 288. Where the fold crosses a text line, the build adds a small gap before that block so no line is cut in half; inside a card the gap goes between the card's own rows (in Relay's choice, between two rule rows), so the gaps between the left column's blocks stay 12 in every state.
     - Footer, 80 high, padding 16 24, top border: status line (icon 16 and Label strong) over "Stores are told when you publish the plan, not before." (Caption); right: "Close" (quiet) and "Confirm deferral" (primary, disabled until the deferral has a reason).
- **Left column, top to bottom:**
  1. **Unavoidable card** (Summary card pattern: fill `white`, 1 px `asphalt-200`, radius 12, a 4 px `attention-strong` tone bar at the left, padding 16, gap 6): eyebrow `boxes` 16 "Unavoidable: one chilled order waits" (Label strong `attention-strong`); headline "5 refrigerated vehicles can serve 22 of the 23 chilled orders" (Heading 3); body "VEH039 and VEH058 are in the workshop. Relay searched every plan for the five left, with each vehicle in one place at a time: at most 22 of the 23 reach their stores inside their windows, even with no reload time at the dock. With either vehicle back, all 23 fit." Key figure table (label 248, orders 72, size 168), 24 high rows:

     | Row | Orders | Size |
     |---|---|---|
     | Chilled orders for Wednesday | 23 | 8,144.5 kg · 43.630 m³ |
     | Planned on 5 refrigerated vehicles | 22 | 7,485.3 kg · 40.166 m³ |
     | Waits (Label strong `attention-strong`, top border) | 1 | 659.2 kg · 3.464 m³ |

  2. **Order to defer** (Heading 3) with badge "1" (attention; neutral when ready). Deferral row (fill `white`, 1 px `asphalt-200`, radius 12, padding 8 16 10): "OUT117 Hemmathagama" with "659.2 kg · 3.464 m³" at the right; "ORD0098596 · Fresh chilled · 92 cases · last chilled delivery Sat 4 Apr"; `package` 16 "Dry order ORD0098595 still comes Wednesday on VEH045"; Input / date "Thu 9 Apr, 4:00 to 7:45 AM" (`calendar`, label "Moves to") and Input / select "Choose a reason" (placeholder, 1.5 px `problem-strong` border); helper row `circle-alert` "Add a reason. The store sees it." with Button / secondary "Use Relay's reason"; next-run line `circle-check` `done-strong` "Thursday checked: VEH039's Kegalle run has room, planned 4:45 AM."
  3. **Relay's choice** (card, padding 16, gap 10): `list-checks` "Relay's choice: which order waits"; "Relay applies three rules, in order." Three rows, each a 20 x 20 number badge (policy order, not a section label), the rule in Body dense SemiBold and the reason in Body dense `asphalt-700`:
     1. "Keep every other vehicle on its usual run, and give the missing vehicle's runs, whole, to vehicles with time left." / "VEH039's runs are Matale and Kegalle. VEH042 runs Matale before its own Kandy run, so VEH057's second trip is the only refrigerated trip planned to reach Kegalle in time. It takes 1,040 kg, and the three Kegalle orders are 1,460.8 kg. Back from trip 1 at 6:02, it also can't reach all three stores inside their windows."
     2. "Never make a store wait twice in a row without an override." / "OUT119 Kegalle had its Monday chilled order wait a day, so it rides."
     3. "Keep the most goods moving." / "With OUT119 on the van, OUT116 Aranayake fits beside it (801.6 kg together). OUT117 and OUT119 together would be 1,125.6 kg."

     Result box (fill `asphalt-50`, `circle-dot`): "So Hemmathagama's order waits, and its dry order still comes on Wednesday."
  4. **The pool** (card): `boxes` "The pool: 15 of the 23 could have waited"; rows Badulla "OUT110, OUT111, OUT112, OUT113"; Nuwara Eliya "OUT104, OUT105, OUT106, OUT107"; Matale "OUT097, OUT099, OUT100, OUT101"; Kegalle "OUT116, OUT117, OUT119". Then "Only OUT117 and OUT119 keep all five vehicles on their usual runs. Rule 2 picks OUT117."
  5. **What the choice costs** (card, `weight`), four lines with `circle-dot`:
     - "659.2 kg of chilled goods waits a day. Hemmathagama's chilled shelf goes from its Saturday 4 April delivery to Thursday 9 April."
     - "Making the lightest order in the pool wait, OUT111 Hali-Ela (159.8 kg), would keep 499.4 kg more moving, but every such plan moves at least one other vehicle off its usual run. Rule 1 comes before rule 3, so Relay doesn't do that."
     - "Without rule 2, OUT119's 466.4 kg would wait instead: 192.8 kg less, but its second chilled order in a row."
     - "The protected order still arrives late: Relay expects OUT119 at 8:32 AM, 32 min after its 8:00 close, but the same morning."
  6. **On paper, all 23 fit** (card, fill `asphalt-50`, `info`): "The published standard adds up minutes only. It does not check store windows, departure times or the drive back to the hub, so the organizers' checker would pass this plan:" Table (Vehicle 80, Takes, Standard min 136, right):

     | Vehicle | Takes | Standard min |
     |---|---|---|
     | VEH042 | Matale, then all three Kegalle stores | 129 + 124 = 253 |
     | VEH057 | Trip 2: Bogambara and Kandy Town | 120 + 52 = 172 |
     | VEH040 | Badulla, then Mulgampola | 239 + 31 = 270 |

     Then: "On the clock it fails. VEH040 is back from Badulla at 9:05 AM and would reach Mulgampola at 9:31, after its 8:00 close. VEH042, back from Matale at 6:16, would reach its third Kegalle store at 8:15 at the earliest, after every Kegalle store has closed. VEH040 can't take Hemmathagama even on paper: 239 + 68 = 307 of 270 min." Relay never says Dilani's order breaks the published standard.
  7. **Thursday checked** (fill `done-soft`, radius 12, padding 16): `circle-check` "Thursday checked: the next run can carry it"; "VEH039 is back from the workshop. Its usual Kegalle trip carries this order with Thursday's chilled orders from Hemmathagama (ORD0098748), Mawanella (ORD0098750) and Kegalle (ORD0098752). Every planned arrival is inside its window, and its Matale trip still follows." Rows: Load "2,921.6 of 6,180 kg · 15.641 of 29.9 m³"; Fresh time "153 of 270 min, 256 for the day"; Leaves the hub "2:55 AM, back 6:21 AM"; At Hemmathagama "Planned 4:45 and 5:13 AM, two stops". Then "Thursday needs 5 of the 7 refrigerated vehicles, so the standby stays free."
- **Right column:**
  - "Protected" (Label strong `asphalt-700`). Protected card (fill `asphalt-50`, radius 12, padding 12 16): `lock` 16 "OUT119 Kegalle"; chip "Waited Monday"; "ORD0098599 · Fresh chilled · 65 cases" / "466.4 kg · 2.438 m³" (Caption); "Its Monday chilled order waited a day, so it rides VEH057 trip 2. Relay expects it at 8:32 AM, after its 8:00 close, but the same morning."; Button / quiet "Defer anyway", right.
  - "What OUT117 will see" (Label strong) / "Sent to Dilani Jayawardena when you publish" (Caption).
  - Message preview (card, padding 16, gap 8), STM-03 at desktop scale in the same words and order: chip "Moved to Thursday"; "Your chilled order now comes Thursday" (Heading 3); "40 dairy crates, 32 produce crates, 20 meat and fish boxes" / "ORD0098596. Placed 2:10 PM"; Was "Wednesday 8 April, 4:00 to 7:45 AM" (strikethrough, `asphalt-500`); Now "Thursday 9 April, 4:00 to 7:45 AM" (Body dense SemiBold; "Now" in `attention-strong`); `lock` "This order won't be moved again unless the dispatcher approves it."; `package` "Your dry order still comes Wednesday, expected around 7:15 AM."; "Why it moved" and three paragraphs: "Two of our refrigerated vehicles are in the workshop this week. The one refrigerated van that can still reach your area on Wednesday morning has no room for your order." / "Another store in your area had its chilled order wait on Monday, so it goes first this time. We avoid making any store wait twice in a row." / "Before moving your order, we checked Thursday: a refrigerated truck back from the workshop has room for it, alongside your Thursday chilled order."; a disabled "Got it" button as the store sees it.
  - Link "Edit wording" (`pen-line`).
- **Footer:** `circle-alert` `problem-strong` "The deferral needs a reason"; "Confirm deferral" disabled.
- **Build behaviour:** the reason select lists "Refrigerated capacity short" (Relay's suggestion, marked "Suggested"), "Dry-box capacity short", "Fresh window full", "Vehicle in the workshop", "Van-only access", "Store asked to move it", "Other (with a note)"; each maps to one store-facing sentence in the preview. After publishing, the deferral record shows when the store saw the notice ("Seen 6:41 PM", from STM-03).
- **Caption:** "Tue 7 Apr · 4:50 PM · The deferrals drawer over the plan board. The one chilled order still needs a reason."

### State: DSP-03 Deferrals / override

- 4:51 PM. Nuwan clicked "Defer anyway" on OUT119. Differences: the protected card becomes Deferral row / override (fill `white`, 1.5 px `attention-strong`): lines 1 to 3 as before, then Notice / attention inline (`history` 16) "OUT119's Monday chilled order waited a day. Deferring this one too means two in a row."; "If you defer it, Hemmathagama's order rides VEH057 with Aranayake instead: 994.4 kg on the van."; Input / text / multiline "Why is this needed? (required)", 72 high, focused (2 px `petrol-700`), placeholder "Write a note for the record"; caption "Your name, the time and this note are kept with the order. The store sees the reason you pick."; "Cancel" (quiet) and "Defer OUT119" (danger, disabled until the note has text). The message preview moves down the right column. Clock "Tue 7 Apr · 4:51 PM".
- **Caption:** "Tue 7 Apr · 4:51 PM · Defer anyway on the protected OUT119 asks for a written note first. Nuwan cancels it."

### State: DSP-03 Deferrals / ready

- 4:52 PM. Nuwan clicked "Use Relay's reason". Differences: the select reads "Refrigerated capacity short" with a normal border; the helper row is gone; the badge is neutral; footer `circle-check` `done-strong` "Deferral ready"; "Confirm deferral" enabled. Clock "Tue 7 Apr · 4:52 PM".
- **Caption:** "Tue 7 Apr · 4:52 PM · Relay's reason is used. The deferral is ready and the Kandy plan can publish."

- **Prototype:** DSP-03: "Use Relay's reason" to / ready (dissolve 200 ms); "Defer anyway" to / override (dissolve 200 ms); "Close", the `x` and the scrim to DSP-02 (move out to the right, 200 ms). / override: "Cancel" back to DSP-03 (dissolve 200 ms). / ready: "Confirm deferral" to DSP-02 / publish check (dissolve 300 ms; the flow step is "Peliyagoda planned, 6:39 PM"). The select, date field, "Edit wording" and "Defer OUT119" have no target.
- **Rationale (Rationale / DSP-03 Deferrals):** Purpose: "Say why one chilled order waits, keep what was unavoidable apart from what was Relay's choice, show the store it protected, and show the words the waiting store will read." Text: "The booklet asks the dispatcher to decide what to defer and explain the consequences, and today that decision leaves no trace. The drawer starts with the part no plan could avoid: five refrigerated vehicles can serve 22 of the 23 chilled orders. Then it shows Relay's choice as three numbered rules, the orders that could have waited, what the choice costs, the plan that only works on paper, and the check that Thursday's run has room. OUT119 waited on Monday, so it is protected and needs a written override. The deferral needs a reason before publishing, and the preview shows the exact words Dilani will read that evening."

---

## DSP-05 Capacity outlook

- **Frame:** "DSP-05 Capacity outlook". Snapshot Tuesday 7 April, 6:45 PM, just after the Kandy plan was published. Depot switch on "Kandy hub". Nav: Outlook. ISO weeks 15 to 20 of 2026 (6 April to 17 May).
- **Purpose:** Show, weeks ahead, when the Kandy hub will need every refrigerated vehicle it has, and what to arrange.
- **Layout and content:**
  1. Page header: "Capacity outlook" / "Kandy hub · weeks 15 to 20 · forecast updated Mon 6 Apr". Clock "Tue 7 Apr · 6:45 PM".
  2. **Answer card** (Summary card / attention), 1304 wide, fill `white`, 1 px `asphalt-200`, radius 12, 4 px `attention-strong` tone bar, padding 12 20 12 24, gap 24:
     - 760 wide stack: `circle-alert` 20 `attention-strong` and the headline in Heading 2 "Wednesday 29 April is the heaviest of the 5 Wednesdays ahead, and like each of them it needs 6 of the 7 refrigerated vehicles."; "The seventh is the standby and nothing is spare: keep all 7 in service that day." (Body dense); supporting line "The heaviest Wednesday ahead: 7,510.9 kg chilled (Vesak ramp, payday week)" (Body dense `asphalt-700`).
     - Two Key figure / inline, 196 wide: "6 of 7" (Heading 2 `attention-strong`) / "refrigerated vehicles needed, Wed 29 Apr, as on every Wednesday ahead"; "22 of 23" (Heading 2 `asphalt-900`, so only "6 of 7" carries the status colour) / "chilled orders five refrigerated vehicles can serve on a Wednesday".
  3. **Outlook grid**, 1304 wide, fill `white`, 1 px `asphalt-200`, radius 12, clip. Row label column 290, six week columns of 169.
     - Header row, 120 high. Label cell: Marker legend (16 x 6 swatches, fully rounded, Caption `asphalt-700`): "Within capacity" (`petrol-700`), "At the limit" (`attention-strong`), "Over capacity" (`problem-strong`). Week cell, padding 8 12: week in Heading 3 with the open days at the right (Caption `asphalt-500`); dates (Caption `asphalt-500`); calendar chip; calendar lines (Caption `asphalt-700`).

       | Week | Open days | Dates | Chip | Calendar lines |
       |---|---|---|---|---|
       | Week 15 | 6 open days | 6 to 12 Apr | New Year ramp | |
       | Week 16 | 4 open days | 13 to 19 Apr | New Year (`lock`) | Closed Mon 13 and Tue 14 |
       | Week 17 | 6 open days | 20 to 26 Apr | Vesak ramp | From Wed 22 Apr / Payday Sat 25 Apr |
       | Week 18 | 5 open days | 27 Apr to 3 May | Vesak | Payday Thu 30 Apr / Closed Fri 1 May |
       | Week 19 | 6 open days | 4 to 10 May | | |
       | Week 20 | 6 open days | 11 to 17 May | | |

     - Group row, 26 high, fill `asphalt-50`, Caption SemiBold `asphalt-700`: "Forecast demand, m³ a week".
     - Demand rows, 28 high (Tech 38), values right aligned, tabular. Tech values sit on one 24 high `asphalt-100` band, radius 6, across the six week columns (8 px in from each edge), with the sub-line "One Kandy Tech order can be 15 m³". "All brands" is Body dense SemiBold over a 1 px `asphalt-300` border.

       | Row | Icon | Wk 15 | Wk 16 | Wk 17 | Wk 18 | Wk 19 | Wk 20 |
       |---|---|---|---|---|---|---|---|
       | Fresh chilled | `snowflake` `chilled-strong` | 267.3 | 133.2 | 200.1 | 188.6 | 188.1 | 188.3 |
       | Fresh dry | `package` | 477.3 | 230.4 | 357.4 | 333.5 | 337.3 | 337.7 |
       | Style | | 118.0 | 52.2 | 78.2 | 80.4 | 75.2 | 75.2 |
       | Tech (band) | | 22.4 | 21.3 | 22.4 | 18.2 | 22.4 | 22.4 |
       | All brands | | 885.0 | 437.1 | 658.1 | 620.7 | 623.0 | 623.6 |

     - Group row: "Against the Kandy hub's refrigerated fleet".
     - Meter row "Chilled space, m³" / "One load per refrigerated vehicle per open day", 48 high: Capacity meter / compact vertical, 136 wide (value in Label strong, percent in Caption at the right, 6 px bar), all within capacity: "267.3 of 765.3" 34.9%; "133.2 of 584.0" 22.8%; "200.1 of 876.0" 22.8%; "188.6 of 730.0" 25.8%; "188.1 of 876.0" 21.5%; "188.3 of 876.0" 21.5%.
     - Meter row "Refrigerated vehicles needed" / "On the week's busiest day. The seventh is the standby.", 80 high: Capacity meter / vehicles: "N of M" in Label strong and the state at the right; seven 16 x 6 segments, one per refrigerated vehicle (needed: filled; standby: outlined; needed but not available: `problem-soft` with a 1 px `problem-strong` edge; in the workshop: `asphalt-100`); the day in Caption. Every week cell is top aligned (padding 10 above), so the "N of M" lines share one baseline and week 15's second caption hangs below; the label cell is top aligned too.

       | Week | Value | State | Day |
       |---|---|---|---|
       | 15 | 6 of 5 | Over (`problem-strong`; 5 filled, the 6th needed but not available, the 7th in the workshop) | Wed 8 Apr / 2 in the workshop |
       | 16 | 6 of 7 | At the limit (`attention-strong`; 6 filled, the standby outlined) | Wed 15 Apr |
       | 17 | 6 of 7 | At the limit | Wed 22 Apr |
       | 18 | 6 of 7 | At the limit | Wed 29 Apr |
       | 19 | 6 of 7 | At the limit | Wed 6 May |
       | 20 | 6 of 7 | At the limit | Wed 13 May |

     - Row "Chilled on that day, kg" / "8 April from the order book, the rest forecast", 48 high: 8,144.5 "23 orders, 1 waits"; 5,958.8 "23 orders"; 6,015.1 "23 orders"; 7,510.9 "23 orders, heaviest"; 5,980.5 "23 orders"; 5,987.5 "23 orders".
     - Week 18 is outlined, 1.5 px `attention-strong`, radius 8, inset 2, the full grid height.
  4. **Arrange card**, 1304 wide, padding 12 20, gap 32. Left, 700 wide: `list-checks` 20 "What to arrange" (Heading 3), then three rows with `circle-dot`: "Book refrigerated servicing away from Wednesdays: on Relay's clock every Wednesday needs 6 of 7" / "Keep all 7 in service on Wednesday 29 April (Vesak ramp, payday week)" / "Tell stores early when a refrigerated vehicle is out". Right, two notes with `info` 16 (Caption `asphalt-700`): "Space is not the limit: week 15's chilled volume is 34.9% of one load per refrigerated vehicle per open day. The number of stores and their windows before 8 AM are. Saturday 11 April carries 10,857.6 kg and needs 5." / "Needed is the fewest refrigerated vehicles that carry every chilled order that day on Relay's clock, where a vehicle is in one place at a time. One out on a Wednesday means no standby; two out means a chilled order waits, as on 8 April."
- **How the numbers are made (build):** the forecast is an ordinary week for each group and weekday (2026 weeks 1 to 13) times the festival lift for that festival and ramp day times the payday lift, times growth, counted over open days. In April to June 2025 this method missed Kandy Fresh by 2.7% a week on average, against 11.1% for "same week last year times growth". "Needed" is the fewest refrigerated vehicles that carry every chilled order that day, found by exact search under the plan's rules (published standard, windows at free flow, 2:00 AM earliest, 10 minutes to reload, a vehicle in one place at a time). 8 April uses the order book; every other day uses the forecast. Wednesdays need 6, Mondays and Thursdays 5, most other days 4 (the New Year and payday Saturdays, 11 and 25 April, need 5). Week 15 carries the New Year ramp: 267.3 m³ chilled, 1.41 times an ordinary 2026 week (189.0 m³); the week before New Year 2025 was Kandy's highest chilled week on record at 260.2 m³. Hovering a week shows its days.
- **States:** none. The Peliyagoda view is build behaviour and is not drawn.
- **Caption:** "Tue 7 Apr · 6:45 PM · Just after the Kandy plan was published. ISO weeks 15 to 20."
- **Prototype:** nav Queue to DSP-01 / after cutoff, Live to DSP-04. Plan has no target (the published plan is not drawn). No click leads from DSP-05 to the 2:48 AM phone; the time label "Wed 2:48 AM" stands between them.
- **Rationale (Rationale / DSP-05 Capacity outlook):** Purpose: "Show, weeks ahead, when the Kandy hub will need every refrigerated vehicle it has, and what to arrange." Text: "Waypoint can't see a tight week coming in its fleet numbers today. This screen answers one question for the next six weeks: will the Kandy hub have the refrigerated vehicles it needs before 8 AM? Space is not the limit; time before 8 AM is, so the row that matters counts the vehicles needed on each week's busiest day, the seventh being the standby. On Relay's clock, where a vehicle is in one place at a time, every Wednesday ahead needs 6 of 7, and Wednesday 29 April carries the most chilled goods, so Nuwan books servicing away from Wednesdays. The forecast method missed Kandy Fresh by 2.7% a week in April to June 2025, against 11.1% for last year's week times growth. It stays light on purpose: the forecasting belongs to the Datathon."

---

## DSP-04 Live runs

### State: DSP-04 Live runs / shortfall decision (phone, first in story order)

- **Frame:** phone 390 x 844, fill `asphalt-50`. Snapshot Wednesday 8 April, 2:48 AM. Nuwan is on call at home. Rizwan's 2:47 AM flag reached his phone and he has opened it. At phone width DSP-04 shows only its exceptions feed.
- **Layout:**
  1. System status bar, 390 x 44, time "2:48".
  2. Top bar / phone header / home, 390 x 80, padding 12 16, gap 12: Relay mark (0.75 scale), "Live runs" (Heading 1) / "Kandy hub · Wednesday 8 April" (Label `asphalt-700`). No sync pill.
  3. Content, padding 16, gap 12: group label "Now" (Caption `asphalt-500`); Exception item / attention / expanded / phone, 358 wide: fill `white`, 1 px `asphalt-300`, 4 px `attention-strong` tone bar, radius 12, padding 16, gap 12 (8 between each button and its caption).
     - Header: `package-x` 24 `attention-strong` and "6 rice and dhal cases missing on VEH045, stop 3" (Heading 3, 250 wide); "1 min" (Label `asphalt-500`) at the right.
     - Meta: "Mohamed Rizwan, Kandy hub dock, 2:47 AM" / "VEH045 leaves 3:40 AM" (Label `asphalt-700`).
     - Detail box (fill `asphalt-50`, 1 px `asphalt-200`, radius 8, padding 12): "OUT117 Hemmathagama · ORD0098595" (Body strong); `package` 16 "Dry · 30 of 36 rice and dhal cases on the shelf" (Body); "No spare at the hub. The next rice and dhal delivery comes at 5:00 AM, after VEH045 leaves." (Body `asphalt-700`).
     - "Your decision" (Label `asphalt-500`).
     - Button / primary / phone, full width: `send` "Send short, add to Thursday". Caption `asphalt-700`: "Kasun takes 96 cases to stop 3. The 6 missing cases join Dilani's Thursday dry order, ORD0098747, marked from Wednesday: Thursday 9 April, 4:00 to 7:45 AM."
     - Button / secondary / phone: "Send short, no replacement". Caption `asphalt-500`: "Dilani Jayawardena is told either way."
     - Under the item, centered: "Sent to your phone at 2:47 AM because you are on call tonight."
  4. Home indicator at y 810.
- **Build behaviour:** the dispatcher's phone shows Notice / info if it goes offline. Nuwan decides at 2:52 AM; the answer reaches the dock tablet (LDR-02 / answer in) and Dilani's short-delivery notice waits for quiet hours to end (she opens it at 5:05 AM). ORD0098747 grows from 127 to 133 cases (51 rice and dhal, 55 packet foods, 27 tea and biscuit; 914.8 kg, 4.938 m³) and rides Thursday's Kegalle dry run. Kasun's stop 3 now shows 96 cases, 625.6 kg, 3.532 m³.
- **Caption:** "Wed 8 Apr · 2:48 AM · On call at home. Rizwan's flag from the Kandy hub dock reached the phone at 2:47 AM."
- **Prototype:** "Send short, add to Thursday" goes to DSP-04 Live runs (dissolve 300 ms; the flow step is "Decided 2:52 AM. Runs under way, 5:20 AM"). In the cross-role story it continues to LDR-02 Load vehicle / answer in (2:52 AM). "Send short, no replacement" has no target.

### DSP-04 Live runs (desktop)

- **Frame:** "DSP-04 Live runs". Snapshot Wednesday 8 April, 5:20 AM, Kandy hub, Fresh runs. Every driver is in contact. Kasun delivered stop 1 (Kegalle) at 5:11 and is on the way to stop 2, Mawanella. Sampath's 4:28 AM delay was handled from Nuwan's phone at 4:35 AM. Depot switch on "Kandy hub". Nav: Live.
- **Purpose:** Show Nuwan how every Fresh run is going, stop by stop, and put what needs his attention in one feed, before a store has to call.
- **Layout:**
  1. Page header: "Live runs" / "Wednesday 8 April · Fresh window 3:30 to 8:00 AM". Clock "Wed 8 Apr · 5:20 AM". Controls: Button / secondary "Fresh" (`filter`). Search "Search vehicle, driver or outlet".
  2. Key figure tiles, four of 314 x 56 (shared with DEG-03 and DEG-05): icon 20, number in Heading 2, label in Label `asphalt-700`.

     | Icon | Number | Label |
     |---|---|---|
     | `truck` `asphalt-700` | 12 | vehicles running |
     | `package-check` `done-strong` | 18 of 53 | stops delivered |
     | `cloud-off` `asphalt-500` | 0 | drivers out of contact |
     | `van` `asphalt-700` | 1 | standby vehicle free |

  3. Main area, 1304 x 708, gap 16:
     - **Runs panel** (fills 888), clip:
       - Panel header, 48 high: "Kandy hub · Fresh runs" (Heading 3); Marker legend "Recorded" (16 px solid ring `asphalt-900`) and "Estimated" (16 px dashed ring `asphalt-500`); "Needs attention first" (`chevron-down`).
       - Column header row, 32 high, fill `asphalt-50`: "Vehicle and driver" 200, "Stops" 472, "Last synced" 128, menu 32.
       - Run rows, padding 12 16, gap 8: vehicle block (ID Heading 3; driver Body dense; type icon and line in Label `asphalt-700`; trip line in Label `asphalt-500`); Stop track (28 px markers on the selected row, 24 px on the others, evenly spaced whenever every label fits, 2 px `asphalt-300` connectors, place and status in Caption under each marker) with a caption line under it; last synced (`check` 16 `done-strong` and Label, optional second line in Caption); menu `ellipsis`. Selected row: fill `petrol-50`, 3 px `petrol-700` bar at the left edge.
       - Stop markers: delivered (fill `done-strong`, `check`); arrived (`white`, 2 px `asphalt-900` ring, `circle-dot`); next (fill `signal-400`, 1.5 px `signal-ink` ring, number); pending, an estimated time (`white`, 1.5 px dashed `asphalt-500` ring, dash 3 2, number, as the "Estimated" legend entry); hub (24 x 24 `asphalt-100` square, `warehouse`).
       - Rows:

         | Row | Vehicle block | Track (place / status) | Caption | Last synced |
         |---|---|---|---|---|
         | VEH045, selected | "Kasun Bandara" / `truck` "Ambient truck · Trip 1" / "Fresh dry, Kegalle district" | delivered "Kegalle" "Delivered 5:11"; next 2 "Mawanella" "Next, 5:31"; pending 3 "Hemmathagama" "6:36"; pending 4 "Aranayake" "7:13" | "Reached Kegalle at 4:52 AM, 19 min behind plan and on Relay's expected time. Every stop is expected inside its window." | "Synced 5:20 AM" |
         | VEH042 | "Sampath Lakmal" / `snowflake` "Refrigerated truck · Trip 1" / "Fresh chilled, Matale" | delivered "Matale Town" "Arrived 3:49"; delivered "Palapathwela" "Arrived 4:28"; arrived "Rattota" "Arrived 5:06"; pending 4 "Elkaduwa" "5:39"; hub "Then trip 2" | "Sampath reported a 45 min delay at 4:28 AM. Rattota and Elkaduwa stay inside their windows." | "Synced 5:20 AM" / "Delay at 4:28 AM" |
         | VEH060 | "Nimal Fernando" / `van` "Ambient van · Standby" / "Free until 8 AM" | hub "At the Kandy hub" | | "Synced 5:20 AM" |

       - Run group row, 48 high: `chevron-right`, "10 more vehicles running" (Body dense SemiBold), "All in contact, nothing to act on" (Label `asphalt-500`).
       - Out of service rows, 48 high, fill `asphalt-50`, Label `asphalt-500`: "VEH039 · Refrigerated truck · In the workshop (refrigeration fault)" and "VEH058 · Refrigerated van · In the workshop (booked service)".
       - Footnote at the foot, Caption `asphalt-500`: "Progress comes from each driver's stop records, not from tracking. When a phone stops reaching Relay, its row keeps the last record and the time of last contact, and every time after that is an estimate."
     - **Exceptions panel**, 400 wide, clip; the body scrolls:
       - Header, 48 high: "Exceptions" (Heading 3), "Kandy hub · today" (Caption).
       - "Now": Empty state (fill `asphalt-50`, radius 8, padding 10 12): `circle-check` `done-strong` "Nothing needs you now. Every driver is in contact."
       - "Earlier today": Exception item / done / expanded (1 px `asphalt-200`, 4 px `done-strong` tone bar, padding 16, gap 12):
         - `clock` 20 `done-strong` "VEH042 running about 45 min late" (Heading 3, one line; the same title as DEG-03's collapsed item).
         - "Sampath Lakmal reported it at 4:28 AM, at stop 2, Palapathwela" (Label `asphalt-700`).
         - "Note from the driver" / quote box (fill `asphalt-50`, 1 px `asphalt-200`, radius 8, padding 12): "Slow on the Matale road, one lane open."
         - "What changed": Estimate rows, 40 high: pending marker 3, "Stop 3 · Rattota" / "Window 5:00 to 7:30", "5:06" over "planned 4:12"; pending marker 4, "Stop 4 · Elkaduwa" / "Window 5:00 to 7:30", "5:39" over "planned 5:26". Caption: "Both stay inside their windows. The three Kandy stores of trip 2 have new times too."
         - "Stores told": "OUT099, OUT101, OUT084, OUT087 and OUT085 got their new times at 4:28 AM."
         - `check` `done-strong` "You marked it handled at 4:35 AM, from your phone."
       - Exception item / done / collapsed: `package-x` 20 `done-strong`, "Shortfall on VEH045, stop 3" / "6 rice and dhal cases short. Decided 2:52 AM: send short, add to Thursday.", `chevron-down`.
- **Build behaviour:** "Last synced" is the last time the phone reached Relay, the same meaning as DEG-03's "No contact since" and the store's "Last heard from Kasun". A delay report shifts the expected times of every stop still to come on that trip and on the next trip and sends those stores their new times. A run turns to late risk only when an expected time crosses a window. "Mark as handled" moves the item to "Earlier today" with the time and Nuwan's name. There is no call button on a driver's item: drivers act only when stopped, and the driver app holds a question while the phone senses the vehicle moving. Expanding the shortfall item shows its record: "2:47 AM · Mohamed Rizwan flagged 6 rice and dhal cases missing on VEH045, stop 3. 30 of 36 on the shelf." / "2:52 AM · You decided: send short, add to Thursday. The 6 cases joined ORD0098747, marked from Wednesday." / "2:52 AM · Dilani Jayawardena was told. She saw it at 5:05 AM." / "3:32 AM · Load complete: 377 of 383 cases. Kasun accepted the load."
- **Caption:** "Wed 8 Apr · 5:20 AM · Every driver in contact. Sampath's delay was handled from the phone at 4:35 AM."
- **Prototype:** nav Queue to DSP-01 / after cutoff, Outlook to DSP-05. Plan has no target. Rows, markers, the filter and the collapsed item have no target. The 6:05 AM silence is DEG-03, reached through the Degradation page's own flows.
- **Rationale (Rationale / DSP-04 Live runs):** Purpose: "Show Nuwan how every Fresh run is going, stop by stop, and put what needs his attention in one feed, before a store has to call." Text: "Once the trucks leave, Nuwan used to be blind until a store rang. This screen builds progress from the drivers' own stop records, so it works on personal phones without tracking anyone, and each row says when the phone last reached Relay, so silence is never mistaken for trouble or for progress. Problems arrive as one short feed that already carries what changed and who was told. At 2:47 AM the same feed reaches his phone at home, so the dock gets a decision before VEH045 leaves. At 5:20 AM nothing needs him: Sampath's delay was handled from the phone at 4:35, and Kasun is behind plan but on Relay's expected time."

---

## Components needed

The canonical list is `components.md`; where the two differ, `components.md` wins.

| Component | Variants used here | Used in |
|---|---|---|
| Nav rail, Key hint | Active Queue, Plan, Live, Outlook; "Key hints" on | Every desktop frame |
| Top bar | Desktop page header (title, meta, clock, depot switch, controls, search); phone header / home | Every frame |
| Input / segmented control | Depot (disabled "All" with tooltip); filter tabs with counts; vehicle type filter with counts | DSP-01, DSP-02, DSP-04, DSP-05 |
| Input | Date; select (default, error, suggested option; also the build-only Trip picker); text multiline desktop | DSP-03 and states |
| Summary card | Tone bar petrol, asphalt or attention; none (plan bar) | DSP-01 banner and late orders, DSP-02 plan bar, DSP-05 answer card |
| Key figure | Inline; table row (with an emphasis row); tile | DSP-01, DSP-03, DSP-04, DSP-05 |
| List row | Contact row with two buttons; numbered rule row; icon line | DSP-01, DSP-03, DSP-05, Publish dialog |
| Table rows | Header, group (open, folded), order row with Type chip and flag chips | DSP-01 |
| Order row / board card | Default, to defer, deferred, placeholder, dragging | DSP-02 and states |
| Status chip | As in "Status chips used on these frames"; count badge (attention, neutral) | Every frame |
| Vehicle lane | Default; compact (build); out of service band | DSP-02 and states |
| Trip card / compact | Proposed, selected, broken, with Fit hint | DSP-02 and states |
| Empty trip slot | No trip 2, with Fit hint | DSP-02 and states |
| Capacity meter | Compact inline, fuel compact, full, compact vertical, vehicles (7 segments), progress | DSP-01, DSP-02, DSP-05 |
| Rule check | Summary pass and fail | DSP-02 and states |
| Stop row / planned | Default, placeholder, broken | DSP-02 and states |
| Tooltip | Dark with caret | DSP-02 / dragging, buttons |
| Dialog, `scrim` | Confirmation with list, as an overlay | DSP-02 Publish dialog |
| Sheet / side drawer | 880 wide, fixed header and footer, two scrolling columns | DSP-03 and states |
| Deferral row | Missing reason, ready, protected, override | DSP-03 and states |
| Message preview | STM-03 at desktop scale | DSP-03 |
| Publish check panel | Check lines (pass, attention), expected late table | DSP-02 / publish check |
| Run row, Stop track, Stop marker (shared) | Selected, default, group row, out of service; delivered, arrived, next, pending, hub | DSP-04 |
| Exception item (shared) | Attention expanded (phone); done expanded and collapsed; Estimate rows; quote box; empty state | DSP-04 and state |
| Marker legend (shared) | Recorded and estimated; meter variant with 3 swatches | DSP-04, DSP-05 |
| Outlook grid | Header with calendar lines, group, demand, meter, vehicles and day rows; highlighted week | DSP-05 |

---

## Derived values

Values on the frames that `05-scenario-data.md` v0.4 does not print, each following directly from it.

1. **Fresh outlets: 80.** 79 Fresh dry orders at 4:00 PM plus Kadawatha, whose dry order came at 4:01 PM (every Fresh outlet orders dry every operating day). At 3:12 PM 74 of 80 had ordered (80 less the 6 not ordered); at 4:00 PM, 79 of 80.
2. **Chilled at 3:12 PM by depot:** Kandy hub 22 (its 23 less Mulgampola's, not yet ordered), Peliyagoda 24 (46 less 22).
3. **Planned on 5 refrigerated vehicles:** 22 orders, 7,485.3 kg and 40.166 m³ (8,144.5 less 659.2; 43.630 less 3.464).
4. **VEH057 trip 2 meters:** 238.4 kg free (1,040 less 801.6), 2.788 m³ free (7.0 less 4.212), 424.8 L of fuel left for Thursday to Saturday (450 less 25.2).
5. **The broken-rule move:** 420.8 kg over (1,460.8 less 1,040), 0.676 m³ over (7.676 less 7.0), 124 standard minutes for a trip to all three Kegalle stores (the paper plan's VEH042 Kegalle trip, the same three stores), so 244 of 270 minutes for the day (120 plus 124). 3 of the 11 rules break (weight, volume, window), so 8 of 11 pass.
6. **Drag hints:** a Kegalle trip after Badulla is 239 + 68 = 307 of 270 minutes (the scenario gives it for VEH040; VEH041 has the same 239), and after Nuwara Eliya 231 + 68 = 299.
7. **The 11 rules:** the published standard's limits, Relay's clock and Waypoint's fuel quota, as listed under DSP-02; the grouping into 11 lines is this spec's.
8. **Sampath's times:** the plan's 3:19 at Matale Town plus 30 minutes is 3:49; the plan's 3:46 at Palapathwela plus 42 is 4:28 (as fact 31 prints); the plan's 4:12 at Rattota plus 54 minutes is 5:06; the plan's 5:26 at Elkaduwa plus 13 minutes is 5:39 (fact 31's minutes behind plan).
9. **DSP-04:** "10 more vehicles running" is the 12 running less VEH045 and VEH042.
10. **Chilled space shares on DSP-05:** 267.3 of 765.3 is 34.9%, 133.2 of 584.0 is 22.8%, 200.1 of 876.0 is 22.8%, 188.6 of 730.0 is 25.8%, 188.1 of 876.0 is 21.5%, 188.3 of 876.0 is 21.5%.

## Cross-role agreements

- **Loader.** The shortfall is 6 rice and dhal cases for stop 3 (ORD0098595), 30 of 36 on the shelf; flagged 2:47 AM, opened 2:48 AM, decided 2:52 AM: send short, add to ORD0098747, marked from Wednesday. The same words appear on LDR-02 / answer in and LDR-03 / decision.
- **Driver.** VEH045 left at 3:44 (planned 3:40) and reached Kegalle at 4:52, 19 minutes behind plan and on Relay's time. At 5:20 AM Kasun is on the way to stop 2. Driver screens round Expected to 5 minutes (5:30, 6:35, 7:15); this spec shows the same times to the minute (5:31, 6:36, 7:13).
- **Store manager.** The DSP-03 preview is STM-03 word for word, including "We avoid making any store wait twice in a row." At 4:50 PM her dry order is expected around 7:15 AM; the 9:12 PM swap moves it to around 6:35 AM (STM-01 / moved earlier).
- **Degradation.** DEG-03 and DEG-05 reuse this shell, the tiles, the Stop track, the Marker legend and the Exception item. DEG-03's "Earlier today" keeps Sampath's item with the title "VEH042 running about 45 min late". The standby is VEH060 (Nimal Fernando), free until 8 AM.
- **Components.** `components.md` still describes the desktop Side nav at 192 x 900 with the clock in the nav and the page header at 1248 x 80 from x 192. As built, the dispatcher frames (and DEG-03, DEG-05) use the 88 px Nav rail, the clock sits in the page header, and the page header is 1352 x 80 from x 88.

## Open questions

None for this spec.
