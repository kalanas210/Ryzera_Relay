# Components: Relay (Team Ryzera)

> **v0.4 data alignment.** The component list, anatomy and sizes are unchanged. Examples and "Used in" lists now follow `05-scenario-data.md` v0.4: the shortfall is 6 rice and dhal cases for stop 3, added to Dilani's own Thursday dry order ORD0098747, not a separate order; the load line example is a dry line ("Stop 3 · Dry"); the handover caption is "Weight 2,470.8 kg of 2,530.8 kg planned"; Kasun's run has 4 stops ("Stop N of 4"); the dispatcher's drag placeholder is Dilani's chilled order and the rule check counts 11 rules; the clock row reads "Wed 8 Apr · 6:05 AM"; DEG-03 / move stop 5 and / stop 5 moved are renamed / move stop 4 and / stop 4 moved; DRV-02 / Early is replaced by DRV-02 / Behind plan, shown in neutral tones; DEG-03 / receipt in and STM-05 / before driver proof are new states. A text rule for the two named times, Planned and Expected, is added.
>
> The one canonical component list for all four roles and the degradation page. It merges the style guide's 12 components with the "Components needed" sections of `spec-dispatcher.md`, `spec-loader.md`, `spec-driver.md`, `spec-store-manager.md` and `spec-degradation.md`, after the cross-role consistency check. Where a spec and this file differ, this file wins. Build each component once in Figma, with the variants below as component properties, and reuse the same names in the Hackathon front end.

## How to read this file

- **Density** names the three size sets from the style guide: **Desk** (Dispatcher, desktop 1440), **Store** (Store Manager, phone and desktop) and **Field** (Driver and Loader, phone and dock tablet). A component keeps its name, anatomy and colors across densities; only sizes change.
- **Used in** lists frames by ID. "All states" means the base frame and every "/ state" frame of that ID.
- Token names are the style guide's: `asphalt-900` to `asphalt-50`, `white`, `petrol-700`, `petrol-800`, `petrol-50`, `signal-400`, and the status pairs written `chilled-strong` / `chilled-soft`, `done-strong` / `done-soft`, `attention-strong` / `attention-soft`, `problem-strong` / `problem-soft`, `waiting-strong` / `waiting-soft`. Two tokens were added by the driver spec and are used on every role: `signal-ink` (#14181F in every mode) and `scrim` (#14181F at 40%; #000000 at 60% in Night mode).

## Shared rules

1. **Color means status.** Rows and cards stay neutral. `petrol-700` is kept for the one primary button per screen, active navigation and selected choices (plus the "Proposed" plan chip and the loader's "Loading" chip). `signal-400` is only the next-stop marker and the current step, always with `signal-ink` on it.
2. **Every status has an icon and a word.** Attention always uses `clock` (one exception: the waited chip, "Waited Monday", uses `history`), problem `triangle-alert`, done `check` or `circle-check`, chilled `snowflake`, waiting and offline `cloud-off`.
3. **The Waiting rule.** `waiting-strong` on `waiting-soft` is only 4.2:1. On a `waiting-soft` fill, text and icons are `asphalt-700`, and chips and notices on it get a 1 px `asphalt-300` border. `waiting-strong` is used only for icons and bars on `white`.
4. **Shape.** Radius 6 for chips, inputs and pills; 8 for buttons, load lines and inset boxes; 12 for cards; 16 for sheets, drawers and dialogs. Buttons are never pill shaped. Meter bars, progress bars and legend swatches are fully rounded (radius half their height), the one exception.
5. **Depth.** Cards sit on `asphalt-50` with a 1 px `asphalt-200` border and no shadow. Only floating layers (sheets, drawers, dialogs, tooltips, toasts, the drag ghost) get the shadow 0 8 24, #14181F at 12%.
6. **Numbers** (times, counts, kg, m³, IDs) use tabular figures, never a monospace face. IDs are never truncated.
7. **Icons** are Lucide at a 1.75 px stroke, from the approved set only. Nothing smaller than 16 px, with one exception: the Recorded offline badge on a desktop Stop marker (`history` 10 in a 14 px circle).

### Density sizes

| Part | Desk (Dispatcher) | Store (Store Manager) | Field (Driver and Loader) |
|---|---|---|---|
| Primary button | 36 high | 48 high | 56 high |
| Secondary and quiet button | 32 or 36 | 48 (inline quiet 44) | 48 |
| Icon-only button | 32 x 32 (40 x 40 to close a drawer) | 44 x 44 | 48 x 48 |
| List row | 40 | 56 or more | 64 or more |
| Status chip | 24 high, icon 16 (count badge 20, no icon) | 28 high, icon 16 | 28 high, icon 16 |
| Text input | 36 (32 inside a row) | 48 (multiline 72) | 56 (multiline 96) |
| Phone header, one-line title | | 64 | 64 |
| Phone header, title and meta line | 80 (DSP-04 phone) | 80 (STM-01) | |
| Icons | 20; 16 in chips and compact rows | 24 header, 20 content, 16 chips | 24; 28 in the load line check slot; 20 in cells; 16 in chips |
| Default text | Body dense 14/20 | Body 15/22 | Body 15/22; Field title 18/24 for what is read at arm's length |
| Button text | Body dense or Label, SemiBold | Button 15/22 SemiBold | Field button 18/24 SemiBold (compact buttons Body SemiBold) |
| Minimum tap target | 32 | 44 | 48, spaced 8 apart for gloves |

### Status words (one set for every role)

| Word on screen | Status chip variant | Tone | Icon | Roles |
|---|---|---|---|---|
| Chilled, Chilled load | Chilled | `chilled-strong` on `chilled-soft` | `snowflake` | All |
| Dry | Dry | `asphalt-700` on `asphalt-100` | `package` | Store |
| Van only | Van only | `asphalt-900` on `asphalt-100` | `van` | Dispatcher |
| Mall window, Mall bay 6:00 to 8:00 AM | Mall window | `asphalt-900` on `asphalt-100` | `building-2` | Dispatcher, Store |
| Waited Monday (a store whose last chilled order waited) | Waited last run | attention | `history` | Dispatcher |
| To defer | To defer | attention | `clock` | Dispatcher |
| Moved to Thursday | Deferred | attention | `clock` | Dispatcher, Store |
| Received by Waypoint | Received | `asphalt-900` on `asphalt-100` | `clipboard-list` | Store |
| Scheduled | Scheduled | `asphalt-900` on `asphalt-100` | `calendar-clock` | Store |
| On the way | On the way | `asphalt-900` on `asphalt-100` | `truck` | Store |
| Delivered | Delivered | done | `check` | Store |
| Receipt confirmed | Receipt confirmed | done | `circle-check` | Store |
| Waiting to send | Waiting to send | Waiting rule | `cloud-off` | Driver, Degradation |
| No word since 5:41 | "No signal" variant, label "No word since 5:41" (Relay cannot tell a lost signal from a flat battery, so the label names neither) | Waiting rule | `cloud-off` | Degradation (DEG-04) |
| Estimate passed | Waiting to send, label "Estimate passed" | Waiting rule | `history` | Store |
| Sending | Sending | Waiting rule | `refresh-cw` | Degradation (driver) |
| 6 short; Send short; 6 short, store told; 6 rice and dhal cases short, store told | Short | attention | `package-x` | Loader, Driver, Store, Degradation |
| Late risk | Late risk | problem | `triangle-alert` | Dispatcher, Degradation |
| 1 rule broken | Rule broken | problem | `triangle-alert` | Dispatcher |
| Proposed 4:35 PM / Edited 4:35 PM / Ready 4:52 PM | Plan status | `petrol-700` on `petrol-50` with `circle-dot` / attention with `clock` / done with `circle-check` | as listed | Dispatcher |
| Payday / Festival | Calendar | `asphalt-700` on `asphalt-100` / attention | `calendar` | Dispatcher |
| Not started | Not started | Waiting rule | `circle` | Loader |
| Loading, Loading now | Loading | `petrol-700` on `petrol-50` | `circle-dot` | Loader |
| Ready | Ready | done | `circle-check` | Loader |
| Plan changed 9:12 PM | Plan changed | attention | `refresh-cw` | Loader |
| 1 flag waiting | Flag waiting | attention | `clock` | Loader |
| In the workshop | In the workshop | Waiting rule | `info` | Loader |
| Needs your answer | Needs answer | attention | `clock` | Degradation (driver) |
| Two copies | Two copies | attention | `clock` | Degradation (dispatcher) |
| Conflict resolved | Conflict resolved | done | `circle-check` | Degradation (dispatcher) |

Shortfall wording: Nuwan decided and the store was told, so nobody "agreed". The 6 short cases are added to Dilani's own Thursday dry order ORD0098747, marked "from Wednesday"; they ride Thursday's Kegalle dry run. They are not a new order.

### Text rules

- Times read "5:20 AM"; ranges "4:00 to 7:45 AM"; durations "8 min", "1 h 9 min". No dashes and no arrow characters anywhere in copy.
- **Two named times on every role.** *Planned* is the organizers' published standard at free flow, the clock the plan is checked on. *Expected* is Relay's model. Driver and store screens round Expected to 5 minutes ("Expected around 6:35 AM"); the dispatcher sees it to the minute. Being behind Planned is normal in monsoon months, so it is shown in neutral tones; only a stop expected after its window is a problem.
- Access words on every role: "Rear dock" (`warehouse`), "Curb" (`store`), "Mall bay" (`building-2`), "Van only" (`van`). "street" is only the dataset value.
- "Last synced" (dispatcher) and "Last heard from Kasun" (store) both mean the last time the driver's phone reached Relay, not the last stop event.
- The driver's sync pill and notices count **stops**; the dispatcher's screens count **records** ("7 records received").
- **Place names in Sinhala and Tamil** follow what the reader matches them against. Loader screens keep place names in Latin letters, because loaders match case labels printed in English. Driver screens write place names in the reader's script, because drivers match road signs. IDs, brand names ("Waypoint Fresh", "Fresh", "Relay") and people's names stay in Latin, in Atkinson Hyperlegible Next, on every role. Digits are Western digits.
- Sinhala is set in Yaldevi and Tamil in Noto Sans Tamil, matched in size and weight, on a taller ramp so marks never clip: Display 32/48, Heading 1 24/36, Heading 2 20/30, Heading 3 16/26, Body 15/24, Label 13/20, Caption 12/18, Field title and Field button 18/28. The Dispatcher and Store Manager screens stay in English.

### Text styles added to the style guide

Body strong 15/22 SemiBold, Label strong 13/18 SemiBold and Button 15/22 SemiBold (store spec); Field title 18/24 SemiBold (driver spec). Night mode is a second variable mode, "Night", with the same token names, used on the driver route only (values in `spec-driver.md`).

---

## Components

62 components, in five groups. Each lists variants, properties, sizes per density, and the frames that use it.

### A. Chrome and layout

#### 1. System status bar and home indicator (frame dressing, not built)
- **Variants:** phone status bar; tablet status bar; home indicator.
- **Properties:** status bar fill `white`, padding 0 24, space between; the snapshot time in Label SemiBold `asphalt-900`; `signal` 16 in `asphalt-900`, `asphalt-300` when there is no signal, or `wifi-off` 16 when the store's own phone is offline. Home indicator: 134 x 5 `asphalt-900` bar, radius 3, centered 8 from the bottom of a 34 px `white` area.
- **Sizes:** phone 390 x 44 plus the 34 px home area; tablet 1024 x 24.
- **Used in:** every phone and tablet frame (LDR, DRV, STM, DEG-01, DEG-02, DEG-04, DSP-04 / shortfall decision).

#### 2. Top bar
- **Variants:**
  - *Desktop page header* (Desk): title in Display, meta in Body dense `asphalt-700`, right slot for the snapshot clock (`calendar-clock` 20 and the time in Label `asphalt-700`, for example "Wed 8 Apr · 6:05 AM"), the Depot switch, page controls and Search. 1352 x 80 at x 88, padding 12 24.
  - *Desktop app bar / store* (Store desktop): Relay mark 28 and wordmark, store block, two nav tabs (active: `petrol-700` text and a 2 px `petrol-700` bottom border), user block and sign out. 1440 x 64.
  - *Phone header / home* (title and meta): Heading 1 title over a Label meta line, optional Relay mark 24. 390 x 80, padding 12 16.
  - *Phone header / back* (Store): back button 44 x 44 with `arrow-left` 24, Heading 1 title. 390 x 64.
  - *Phone header with sync pill / field*: root (Heading 1 title, Sync pill), back and close (48 x 48 button, Heading 2 title that truncates, Sync pill), close without title. 390 x 64, padding 8 16 (back 8 16 8 4). No mark and no language button; the driver's language lives in a row at the foot of DRV-01.
  - *Phone header with sync pill / loader*: root (Relay mark 24, depot and date stack, Sync pill, Language button), back (48 x 48 back button, Heading 3 vehicle title, Sync pill, Language button). 390 x 64; a wrapped title grows the bar.
  - *Tablet header* (loader): back, Heading 1 title with a Label meta line, loader button, Sync pill, Language button. 1024 x 64.
- **Properties:** fill `white`, bottom border 1 px `asphalt-200`, fixed while content scrolls. The Sync pill never truncates; the title gives way.
- **Used in:** every frame. Desktop page header: DSP-01 to DSP-05, DEG-03, DEG-05. App bar / store: STM-02 / desktop. Home: STM-01 all states, DSP-04 / shortfall decision. Back: STM-02 to STM-05, DEG-04. Field: DRV-01 to DRV-05, DEG-01, DEG-02. Loader: LDR-01 to LDR-04. Tablet: LDR-02 / tablet.

#### 3. Nav rail
- **Variants:** component set "Nav rail", `active` = Queue, Plan, Live or Outlook; BOOLEAN property "Key hints" (off by default; the dispatcher's desk frames and DEG-03 and DEG-05 switch it on). Item default and active (`petrol-50` fill, icon and label `petrol-700`). Top: Relay mark and the four items. Bottom: Shortcuts entry (Key hint "?" over "Shortcuts") and the user Avatar.
- **Properties:** 88 x 900, fill `white`, right border 1 px `asphalt-200`, padding 20 top and bottom, gap 8, items centered. Items 72 x 64, radius 10, icon 22 (`asphalt-500`, active `petrol-700`) over a Caption label with its Key hint. Items: `clipboard-list` Queue (1), `layers` Plan (2), `route` Live (3), `chart-column` Outlook (4). Shortcuts entry 72 x 52. Avatar 36 at the foot. No clock row: the snapshot clock sits in the Desktop page header.
- **Sizes:** Desk only.
- **Used in:** DSP-01 to DSP-05 (desktop), DEG-03 all states, DEG-05 all states.

#### 4. Key hint
- **Variants:** default (on `white`).
- **Properties:** 20 x 20, 1 px `asphalt-300`, radius 6, fill `white`, Caption `asphalt-500`, centered. Not monospace. Only on nav items, in tooltips and in the Shortcuts sheet.
- **Sizes:** Desk only.
- **Used in:** Nav rail on every desktop dispatcher frame and on DEG-03 and DEG-05.

#### 5. Loader bar
- **Variants:** phone strip (Signed in as, name, Switch, Lock); tablet compact button (`user` 24, first name, `chevron-down` 24).
- **Properties:** phone 390 x 56, fill `white`, bottom border 1 px `asphalt-200`, padding 4 16; Switch is Button / secondary / compact with `users` 24; Lock is an icon-only button with `lock` 24.
- **Sizes:** Field only.
- **Used in:** LDR-01 all states, LDR-02 / tablet.

#### 6. Account footer
- **Variants:** default.
- **Properties:** 358 x 44, top border 1 px `asphalt-200`, space between: `user` 20 and name in Label `asphalt-700`; Button / quiet / phone, 44 high, `log-out` 20, "Sign out".
- **Sizes:** Store only.
- **Used in:** STM-01 all states.

#### 7. Bottom action bar
- **Variants:** Field: primary plus quiet (170); helper plus primary (140); progress only; progress plus primary (the primary slides in); Bar alert row plus progress; caption plus primary; primary only; secondary only; notice only. Store: one button (106); caption and button (130); two buttons, or a one-line notice and a button (162); totals and button (134); totals, button and caption (158); problem notice, totals and button (210). Heights include the 34 px home area.
- **Properties:** fixed, fill `white`, top border 1 px `asphalt-200`, padding 12 16, vertical, gap 8. Buttons full width (358). Holds at most one primary.
- **Used in:** DRV-01 / Accept load, DRV-02 all states, DRV-03 all states, DRV-04 / Delayed, DRV-05 all states, DEG-02 all states, LDR-02 all phone states, LDR-04 all states, STM-02 to STM-05 all states.

#### 8. Sheet
- **Variants:** bottom sheet (phone; 560 wide and centered on the dock tablet); side drawer (desktop): 880 wide with two scrolling columns and a `scrim` behind (DSP-03), or 480 wide with no scrim so the run behind stays readable (DEG-03 / move stop 4).
- **Properties:** fill `white`, radius 16 on the open corners, the floating shadow. Bottom sheet: padding 8 16 16, grabber 36 x 4 `asphalt-300` radius 2, header row with a Heading 2 title and a close button; the home indicator closes it. Side drawer: fixed header (Heading 2 title, Label meta, close 40 x 40) and fixed footer (status or caption line left, buttons right).
- **Sizes:** bottom sheet 390 wide (tablet 560); drawer 880 x 900 or 480 x 900.
- **Used in:** LDR-01 / PIN switch, LDR-02 / Language, LDR-03 all states, DRV-01 / Language, DRV-03 / Signature, STM-05 / flag a line, DSP-03 all states, DEG-03 / move stop 4.

#### 9. Dialog
- **Variants:** confirmation with a list.
- **Properties:** 560 wide, fill `white`, radius 16, the floating shadow, padding 24, gap 16; Heading 2 title, Body dense text, a list of List rows with `check` 16 `petrol-700`, a Caption note, and right-aligned Cancel (quiet) and the primary. Opens over a `scrim`.
- **Sizes:** Desk only.
- **Used in:** DSP-02 Publish dialog.

#### 10. Tooltip
- **Variants:** dark.
- **Properties:** fill `asphalt-900`, radius 8, padding 8 12, Body dense `white`, max width 280. Carries shortcuts, for example "Publish plan (Ctrl Enter)".
- **Sizes:** Desk only.
- **Used in:** DSP-02 / dragging, the depot switch and buttons on every dispatcher frame.

#### 11. Toast
- **Variants:** confirmation.
- **Properties:** fill `asphalt-900`, radius 8, the floating shadow, padding 0 16, gap 12, `check` 20 `white` plus Body dense `white`. Fades after 6 seconds.
- **Sizes:** Desk, 560 x 48.
- **Used in:** DEG-03 / stop 4 moved.

#### 12. Story card (prototype only, not built)
- **Variants:** default.
- **Properties:** full frame, fill `asphalt-900`, padding 32, centered: `clock` 32 `white`, time in Display `white`, one sentence in Heading 2 `white`, "Tap to continue" in Label `asphalt-300`.
- **Sizes:** phone 390 x 844.
- **Used in:** DRV-S1 Signal drops, DRV-S2 Last stop offline.

### B. Actions and inputs

#### 13. Button
- **Variants:** primary (`petrol-700`, `white` text; pressed `petrol-800`), secondary (`white`, 1 px `asphalt-300`, `asphalt-900` text), quiet (no fill; `petrol-700` text for links and disclosures, `asphalt-900` otherwise), danger (`problem-strong`, `white` text), icon only. Disabled: Desk and Store use fill `asphalt-200` with `asphalt-500` text; Field uses "disabled with reason" (fill `asphalt-100`, no border, `asphalt-700` text that says what is left, for example "Add a name and a photo"). Field compact: 48 high, auto width (min 84 on the loader), icon 24 plus Body SemiBold.
- **Properties:** radius 8, never pill shaped; icon leading or trailing with gap 8.
- **Sizes:** Desk primary 36, others 32 or 36, icon only 32 x 32; Store 48 (quiet inline 44), icon only 44 x 44; Field primary 56, secondary and quiet 48, icon only 48 x 48.
- **Used in:** every frame.

#### 14. Input / text
- **Variants:** single line; multiline; with label above and helper below; focus (2 px `petrol-700`); error (1.5 px `problem-strong` with a helper in `problem-strong`).
- **Properties:** fill `white`, 1 px `asphalt-300`, radius 6, padding 0 16 (12 in multiline), placeholder in `asphalt-500`.
- **Sizes:** Desk 36 (search 240 x 36; drawer reason field 432 x 40; multiline 256 x 72); Store multiline 358 x 72; Field 358 x 56 with an 18 px value, multiline 358 x 96.
- **Used in:** DSP-01 to DSP-05 (search), DSP-03 / override, DEG-03 / move stop 4, STM-05 / flag a line, DRV-03 all states, DRV-04 / Delayed.

#### 15. Input / select
- **Variants:** default; error (missing value); menu with a "Suggested" option; Trip picker (build only, 8 rows of 40).
- **Properties:** 1 px `asphalt-300`, radius 6, Label `asphalt-900`, `chevron-down` 16 at the right.
- **Sizes:** Desk 240 x 32.
- **Used in:** DSP-03 all states (reason); DSP-02 (Trip picker, build).

#### 16. Input / date
- **Variants:** default.
- **Properties:** 1 px `asphalt-300`, radius 6, `calendar` 16 `asphalt-500`, Label `asphalt-900`, accessible label "Moves to".
- **Sizes:** Desk 240 x 32.
- **Used in:** DSP-03 all states.

#### 17. Input / segmented control
- **Variants:** depot (All, Peliyagoda, Kandy hub; a segment can be disabled with a tooltip); filter tabs with counts; four segments; with icons (the selected icon takes its status color; an unselected segment holding unsent counts shows a count badge); field two segments with icon.
- **Properties:** Desk and Store: track `asphalt-100`, radius 6, padding 2 to 4; selected segment `white` with 1 px `asphalt-300` and Label strong. Filter tabs: selected `petrol-50` with `petrol-700` text. Field: separate segments, radius 8; selected `petrol-50`, 1.5 to 2 px `petrol-700`, icon and text `petrol-700`.
- **Sizes:** Desk 36 high (segments 32), filter tabs 32; Store 358 x 48 (desktop 320 x 48); Field loader 358 x 64 (segments 175 x 64), driver 358 x 48.
- **Used in:** DSP-01 to DSP-05, DEG-03, DEG-05 (depot switch); DSP-01 (filter); DSP-05 (brands); STM-02 all states and / desktop; LDR-03; DRV-03 all states.

#### 18. Input / number stepper
- **Variants:** store (typeable value); field large (Display value with "of N"); field inline (per line). Minus disabled at the minimum, plus disabled at the maximum.
- **Properties:** minus and plus buttons with `minus` and `plus` icons, value tabular and centered.
- **Sizes:** Store 148 x 48 (buttons 48 x 48, value 52 wide); Field loader 358 x 64 (buttons 64 x 64); Field driver 152 x 48.
- **Used in:** STM-02 all states and / desktop, STM-05 / flag a line, LDR-03, DRV-03 / Change a line.

#### 19. Input / PIN pad
- **Variants:** keys: digit, Delete, empty; PIN dots: empty, filled, error.
- **Properties:** 4 rows of 3 keys, gap 8; keys `white`, 1 px `asphalt-300`, radius 8, digits in Heading 1. Dots 16 with 16 between; error rings them in `problem-strong`.
- **Sizes:** Field, 358 x 280 (keys 114 x 64).
- **Used in:** LDR-01 / PIN switch; the driver's accept-on-tablet fallback (build).

#### 20. Loader picker
- **Variants:** person button selected and unselected; single-person variant for a driver accepting on the tablet (build).
- **Properties:** initials in a 28 px `asphalt-100` circle plus the first name in Label SemiBold. Selected: `petrol-50`, 2 px `petrol-700`, name `petrol-700`. Unselected: `white`, 1 px `asphalt-300`.
- **Sizes:** Field, 358 x 64 (buttons 114 x 64).
- **Used in:** LDR-01 / PIN switch.

#### 21. Choice row
- **Variants:** Field option (name in Field title, caption, trailing `check` 24 when selected); Field reason (40 px icon box, label, caption, `chevron-right`); Store radio (radio `circle` or `circle-dot`, icon 20, label). Selected: `petrol-50` fill, 2 px `petrol-700`.
- **Properties:** fill `white`, 1 px `asphalt-200`, radius 12 (Store 8), padding 0 16.
- **Sizes:** Field option 358 x 64, reason 358 x 68; Store 358 x 56.
- **Used in:** DRV-01 / Language, LDR-02 / Language, DRV-04, STM-05 / flag a line.

#### 22. Choice chip
- **Variants:** default, selected (`petrol-50`, 2 px `petrol-700`, `check` 20, `petrol-700` text).
- **Properties:** radius 8, padding 0 16, Body Medium or Field button text.
- **Sizes:** Field 48 and 56 high.
- **Used in:** DRV-03 all states, DRV-04 / Delayed.

#### 23. Photo capture tile and Signature pad
- **Variants:** photo empty (dashed 1.5 px `asphalt-300`, `camera` 32, "Take a photo"); photo captured (image with a time chip in `asphalt-900`); signature pad empty and signed (baseline 1 px `asphalt-200`, `pen-line` 16 and "Sign here").
- **Properties:** radius 12, 1 px `asphalt-200` or `asphalt-300`.
- **Sizes:** Field: photo 358 x 160 (empty) or 358 x 200 (captured); signature 358 x 240.
- **Used in:** DRV-03, DRV-03 / Before proof, DRV-03 / Signature.

#### 24. Photo thumbnail
- **Variants:** store (72 x 72 with an enlarge badge, `image` 16 in a 24 px `white` square); desktop (56 x 56); placeholder "Photo on its way" (build). A full-screen viewer with an `x` close is build only.
- **Properties:** radius 8, 1 px `asphalt-200`, no people in the image.
- **Used in:** STM-05, DEG-05 all states.

### C. Status and feedback

#### 25. Status chip
- **Variants:** every word in the Status words table above, plus the Desk compact count badge (attention or neutral, no icon).
- **Properties:** radius 6, padding 0 8 (Desk) or 4 8 (Store, Field), gap 4, icon 16 plus Label, horizontal. A chip grows in height rather than truncating, and chip rows wrap.
- **Sizes:** Desk 24 high (count badge 20); Store and Field 28 high.
- **Used in:** every role. Desk: DSP-01 to DSP-05, DEG-03, DEG-05. Store: STM-01 to STM-05. Field: LDR-01 to LDR-04, DRV-01 to DRV-05, DEG-01, DEG-02.

#### 26. Sync pill
- **Variants:** all synced (`done-soft`, `circle-check` and text `done-strong`, "All synced"); offline ("Offline", or a count: driver "1 stop to send", "{n} stops to send", "{n} photos to send"; loader "{n} lines to send", build copy); sending ("Sending {n} stops", "Sending {n} photos", `refresh-cw`). Offline and sending follow the Waiting rule.
- **Properties:** radius 6 (not pill shaped), padding 0 10, gap 6, icon 16 plus Label. Status only, never tappable. Never truncates; copy keeps it under 180 wide.
- **Sizes:** Field, 32 high.
- **Used in:** LDR-01 to LDR-04, DRV-01 to DRV-05, DEG-01, DEG-02 all states.

#### 27. Notice
- **Variants:** tones info (fill `white`, 1 px `asphalt-200`, icon `asphalt-700`), attention (`attention-soft`, icon `attention-strong`), problem (`problem-soft`, icon `problem-strong`), done (`done-soft`, icon `done-strong`), waiting (`waiting-soft`, 1 px `asphalt-300`, icon `asphalt-700`). Sizes full and compact inline (inside a card, radius 8). Options: title, optional button, dismiss (loader). The done tone also serves as the driver's arrival strip, with an optional Waiting to send chip.
- **Properties:** soft fills have no border; radius 12 (compact 8); padding 12 to 16; icon 20 (Desk, Store) or 24 (Field) in the strong tone, title in Heading 3, body in Body or Body dense `asphalt-900`.
- **Used in:** DSP-02 all states, DSP-03 / override, DEG-03 / move stop 4, LDR-01, LDR-04 all states, DRV-01 / Accept load, DRV-02 all states, DRV-03 / Saved, DRV-04 / Delayed, DRV-05 all states, DEG-01, DEG-02 all states, DEG-04, STM-01 all states, STM-02 / not sent, STM-02 / after cutoff, STM-03 all states.

#### 28. Bar alert row
- **Variants:** attention (answer in; load changed, build); problem (no answer yet, build).
- **Properties:** top row of the bottom action bar, fill the soft tone, top border 1 px in the strong tone, padding 4 8 4 16, icon 24, Body SemiBold text, Button / secondary / compact at the right.
- **Sizes:** Field, 390 x 56 or more (288 wide on the tablet control column).
- **Used in:** LDR-02 / answer in.

#### 29. Confirmation panel
- **Variants:** done (`done-soft` circle with `circle-check` or `package-check` 32 `done-strong`); issue (`problem-soft` circle with `circle-alert` 32 `problem-strong`).
- **Properties:** card, padding 24, centered, gap 8: 64 x 64 circle, Heading 1 title, Body `asphalt-700`, optional ID in Heading 3 and a Label meta line.
- **Sizes:** Store and Field, 358 x about 212 to 234.
- **Used in:** STM-02 / received, STM-05 / confirmed, STM-05 / sent with issue, DRV-03 / Saved, DRV-04 (report sent, build).

#### 30. Estimate mark
- **Variants:** 16, 20 and 28 px.
- **Properties:** circle, `white` fill, 1.5 px dashed `asphalt-500` ring. Always beside an estimated time or position and the word "around". An estimate is never drawn like a record.
- **Used in:** DEG-03 all states, DEG-04.

#### 31. Marker legend
- **Variants:** stop (solid ring "Recorded", Estimate mark "Estimated"); meter (three 16 x 6 swatches: `petrol-700` "Within capacity", `attention-strong` "Near the limit", `problem-strong` "Over capacity").
- **Properties:** horizontal, gap 16, Caption text.
- **Sizes:** Desk.
- **Used in:** DSP-04, DSP-05, DEG-03 all states, DEG-05 all states.

#### 32. Capacity meter
- **Variants:** measure weight (`weight`), volume (`box`), time (`timer`: Fresh minutes against 270, Style and Tech against 480), fuel (`fuel`); state normal (`petrol-700` bar), near limit (90% or more, 85% for fuel; bar and value `attention-strong`), over limit (above 100%; bar full width `problem-strong`, value `problem-strong` plus the word "Over"). Sizes: full; compact inline; fuel compact; compact vertical; drawer compact; progress bar.
- **Properties:** bar on `asphalt-100`, fully rounded; values tabular.
- **Sizes:** Desk only: full 148 x 64 (8 px bar); compact inline 172 x 18 (4 px bar); fuel compact 120 x 32 (4 px bar); compact vertical 136 x 32 (6 px bar); drawer compact 208 x 40 (6 px bar); progress 360 x 8.
- **Used in:** DSP-01 (progress), DSP-02 all states, DSP-05, DEG-03 / move stop 4.

#### 33. Load progress bar
- **Variants:** in progress (`petrol-700`), complete (`done-strong`), complete with short (`done-strong` then `attention-strong` for the short share).
- **Properties:** track `asphalt-200`, fully rounded.
- **Sizes:** Field: 8 high in the bottom bar (358, or 288 on the tablet), 6 high on vehicle cards (326).
- **Used in:** LDR-01, LDR-02 all states, LDR-02 / tablet.

#### 34. Step progress
- **Variants:** segment done (`done-strong`), current (`signal-400`), pending (`asphalt-200`); 1 to 12 segments.
- **Properties:** gap 4, square ends, over a count line in Label.
- **Sizes:** Field, 358 x 8.
- **Used in:** DRV-01 all states, DEG-01.

#### 35. Key figure
- **Variants:** inline (label, number, caption); table row (label and value, emphasis row with a top border); tile (icon 20, number in Heading 2, label in Label). Tile icons are `asphalt-500` while the count is 0 and take their status tone above 0.
- **Properties:** tiles fill `white`, 1 px `asphalt-200`, radius 12, padding 8 16, gap 12.
- **Sizes:** Desk: tile 288 x 56; table rows 24 to 28 high.
- **Used in:** DSP-01 all states, DSP-03, DSP-04, DSP-05, DEG-03 all states, DEG-05 all states.

#### 36. Rule check
- **Variants:** summary pass (`done-soft`, `circle-check` 16, "All 11 rules pass") and fail (`problem-soft`, `triangle-alert` 16, "9 of 11 rules pass"), with a disclosure; line pass (`check` 16 `done-strong`), fail (`triangle-alert` 16, Label strong `problem-strong`), problem (inset `problem-soft` box, up to three lines), info (inset `asphalt-50` box with `info` 16).
- **Properties:** summary radius 8, padding 0 12; inset lines radius 8, padding 8 12.
- **Sizes:** Desk: summary 312 x 32; lines 24 high, inset lines about 44 to 60.
- **Used in:** DSP-02 all states, DEG-03 / move stop 4.

#### 37. Cutoff line
- **Variants:** countdown (under 4 hours left, value in Heading 3); under one hour (attention fill, build); time (one line); next run (two lines, after a cutoff); closed (attention fill, `clock`).
- **Properties:** card, radius 12, padding 12 16, gap 12, `timer` 20 (or `clock` when closed), Label line over a Body or Heading 3 line.
- **Sizes:** Store, 358 x 48 or 64 (desktop 360 x 64).
- **Used in:** STM-01 all states, STM-02 all states, STM-02 / desktop.

### D. Stops, runs and loads

#### 38. Stop marker
- **Variants:** next (`signal-400`, 1.5 px `signal-ink` ring, number `signal-ink`); pending (`white`, 1.5 px `asphalt-300` ring, number `asphalt-700`); delivered (`done-strong`, `check` `white`); failed (`problem-strong`, `x` `white`); arrived (`white`, 2 px `asphalt-900` ring, `circle-dot`); done, numbered (`done-soft`, 1.5 px `done-strong`, number `done-strong`; loader); short (`attention-soft`, 1.5 px `attention-strong`, number `attention-strong`); at risk (`problem-soft`, 1.5 px `problem-strong`, `triangle-alert`); estimated (`white`, 1.5 px dashed `asphalt-500`); moved (attention ring, number); conflict (attention ring, `clock`); cancelled (`asphalt-100`, `x` `asphalt-500`); hub (a 24 px `asphalt-100` square, radius 6, `warehouse` 16); recorded offline badge (14 px `white` circle with `history` 10) on delivered markers; store dot (12 px `signal-400` with a `signal-ink` ring, for the current row of the store view).
- **Properties:** circle; number in Heading 3 (Heading 2 at 40, Label SemiBold on desktop).
- **Sizes:** Desk 24 and 28; Field 32 and 40; Store 12 (dot) and 20 (icons).
- **Used in:** DSP-02 (number badge in stop rows), DSP-04, DEG-03 all states, DEG-05 all states, LDR-02 all states, LDR-02 / tablet, LDR-04 all states, DRV-01 all states, DRV-02 all states, DRV-03 / Saved, DRV-05 all states, DEG-01, DEG-02 all states, STM-04 all states, DEG-04.

#### 39. Stop track
- **Variants:** selected row (place and status labels under each marker, a caption line under the track); compact row (time labels only); connector solid for recorded and dashed for estimated; Estimated vehicle marker (28 px dashed `asphalt-500` circle with `truck` 16) on the connector.
- **Properties:** markers joined by a 2 px `asphalt-300` connector; labels in Caption, tabular, wrapping to a second line when needed.
- **Sizes:** Desk: 408 x 64 (80 when a label wraps); markers 28 (selected) or 24 (compact); labels 68 to 76 wide.
- **Used in:** DSP-04, DEG-03 all states, DEG-05 all states.

#### 40. Run row
- **Variants:** selected (`petrol-50`, 3 px `petrol-700` bar); compact; out of service (`asphalt-50`, not tappable); no signal (selected, 136 high); back in coverage, expanded with a Records table; trips 1 and 2 (two tracks); finished group (collapsed, `chevron-right`).
- **Properties:** columns Vehicle and driver 200, Stops 408, Last synced 128, menu 24, gaps 8; padding 12 16; bottom border 1 px `asphalt-200`. Vehicle column: ID in Heading 3, driver in Body dense, vehicle line with a type icon, trip line in Label `asphalt-500`. Last synced: `check` 16 `done-strong` or `cloud-off` 16 `waiting-strong` plus Label.
- **Sizes:** Desk: 784 wide; 124 selected, 88 compact, 48 out of service or finished group, 120 for two trips, about 520 expanded.
- **Used in:** DSP-04, DEG-03 all states, DEG-05 all states.

#### 41. Exception item
- **Variants:** tones attention (`clock`), waiting (`cloud-off`), done (`circle-check` or the event icon); expanded and collapsed; desktop and phone sizes. Parts: header row with minutes, meta, sections with Label headings, quote box (`asphalt-50`, 1 px `asphalt-200`, radius 8), Estimate rows, detail box, action buttons.
- **Properties:** fill `white`, 1 px `asphalt-300` (collapsed `asphalt-200`), 4 px left bar in the tone's strong color (`waiting-strong` for waiting), radius 12, padding 16 (collapsed 12 16), gap 12. Actions sit at the foot of the item when it fits the panel body, or in a fixed panel footer (400 x 64) when the expanded item is taller. A driver's item never carries a call button.
- **Sizes:** Desk 368 wide in a 400 panel (collapsed 368 x 64); phone 358 wide.
- **Used in:** DSP-04, DSP-04 / shortfall decision, DEG-03 all states, DEG-05 all states.

#### 42. Estimate row
- **Variants:** without Move (a delay report); with Move (a silent run).
- **Properties:** horizontal, gap 12: 24 px Stop marker (pending or estimated), stop in Body dense SemiBold over the window in Caption, time stack at the right (new or estimated time in Body dense SemiBold over the old time or range in Caption), optional Button / quiet / desktop 32 "Move".
- **Sizes:** Desk, 336 x 44 to 48.
- **Used in:** DSP-04, DEG-03.

#### 43. Stop row
- **Variants:** Desk planned (drag handle, 24 px number badge, outlet over access and window, planned arrival), placeholder (dashed, "Drop to add OUT117 as stop 3", while Dilani's chilled order ORD0098596 is dragged; its card reads "Moving ORD0098596"), broken (`problem-soft`, badge `problem-strong`); Field (Stop marker 32, name in Field title, meta, optional chip line, `chevron-right`), summary (no chevron, extra meta lines), and the style guide's states next, delivered, pending, failed, waiting to send.
- **Properties:** horizontal, gap 8 (Desk) or 12 (Field), dividers 1 px `asphalt-200` (inset 60 on Field).
- **Sizes:** Desk 312 x 44 (36 in the broken state); Field 358 wide, 64 or more.
- **Used in:** DSP-02 all states, DRV-01 all states, DRV-05 all states, DEG-01, DEG-02 all states.

#### 44. Stop progress list (store view)
- **Variants:** row delivered (`circle-check` 20 `done-strong`), current (the 12 px store dot), last known (the dot with a "Last heard" status), your store (`petrol-50` inset, `map-pin` 20 `petrol-700`).
- **Properties:** 24 px left rail with a 2 px `asphalt-300` connector; stop name in Body strong, status in Label; a caption under the list. Read-only; stops after hers are not shown.
- **Sizes:** Store, rows 326 x 56.
- **Used in:** STM-04 all states, DEG-04.

#### 45. Next stop card
- **Variants:** full (Stop marker 40, "Next stop" and "Stop N of 4", Chilled chip, name in Display, outlet line, Window status line, 2 x 2 Detail grid, primary and quiet buttons); compact (marker, name in Heading 2, window and access, planned arrival).
- **Properties:** fill `white`, 1 px `asphalt-300` (one step stronger than other cards), radius 12, padding 20 (compact 16).
- **Sizes:** Field, 358 x about 448 (full) or about 96 (compact).
- **Used in:** DRV-01 all states, DRV-03 / Saved, DEG-01.

#### 46. Window panel and Window status line
- **Variants:** opens soon (`timer`, "Opens in 8 min"; build only since v0.4, no frame arrives before a window opens), open (`circle-check` `done-strong`), closing soon (`clock` `attention-strong`, under 30 min), closed (`triangle-alert` `problem-strong`, with the late note). The status line has DRV-02 copy and DRV-01 copy.
- **Properties:** panel card with "Receiving window" label, the window in Heading 1, the status line, an "Unload at" Detail row and a "Call the store" quiet button.
- **Sizes:** Field, panel 358 x 214; status line icon 20.
- **Used in:** DRV-01 all states, DRV-02 all states, DEG-01.

#### 47. Detail row
- **Variants:** Field stacked (icon 20 and label over a Field title value, 153 wide in a 2 x 2 grid); Field inline (label left, value right, 326 x 56); Store icon and text; Store label and value (Caption label over a Body value).
- **Properties:** icon in `asphalt-500` or `asphalt-700`, gap 6 to 12.
- **Used in:** DRV-01 all states, DRV-02 all states, DEG-01, STM-01 to STM-05.

#### 48. Stop group header (loader)
- **Variants:** loading now, to load, done collapsed (card, result line, expand button), done with short (expanded, or collapsed by hand), sticky (pins under the app bar); moved tag (`refresh-cw` 16 plus "Was stop 4 until 9:12 PM", on stop 3 Hemmathagama); position tag ("Load first, at the cab end", "Load last, by the doors").
- **Properties:** Stop marker 32, title "Stop N · Place" in Heading 2, meta "OUT ID · ORD ID · N cases" in Label, count "30 of 102" in Body SemiBold at the right.
- **Sizes:** Field: phone 358 wide, 64 or more (sticky 390 x 48); tablet sticky 632 x 56 with a Heading 2 title.
- **Used in:** LDR-02 all states, LDR-02 / tablet.

#### 49. Load line
- **Variants:** loader states to load, checked (`done-soft`, "Loaded"), flag waiting ("30 loaded, 6 missing" / "Waiting for Nuwan"), short decided ("30 loaded, 6 short" / "6 come on Thursday"), flagged damaged (problem tones), changed (build); chilled modifier (4 px `chilled-strong` bar on the inside left edge) and dry modifier (`package` 16 plus "Dry"); driver drop-off states read-only, with an inline Short chip, with a short sub-row ("6 short, store told" / "Ordered 36. The other 6 come Thursday."), and adjust (field stepper).
- **Properties:** loader: fill `white`, 1 px `asphalt-200`, radius 8, check slot 48 with a 28 icon, quantity in Heading 1 tabular, item name in Field title, status line 1 always names the stop ("Stop 3 · Dry", or "Stop 2 · Chilled" on a chilled line), line button at the right. Driver: `snowflake` 24, name in Field title, count in Heading 1 at the right. The line Rizwan checks at the dock is the line Kasun confirms at the door. As built, the Load line set is drawn as Dilani's dry rice and dhal line for stop 3 (Chilled off, `package` in `asphalt-700` in the stop line), as every VEH045 line on the loader screens is; a chilled line turns Chilled on for the 4 px bar and swaps the stop line icon to `snowflake`.
- **Sizes:** Field: loader phone 358 x 64 or more (78 checked, 96 with a flag), tablet 632 x 72 or more with 24 px names and Display quantities; driver 326 x 56 (110 with a sub-row, 80 with a stepper).
- **Used in:** LDR-02 all states, LDR-02 / tablet, DRV-02 all states, DRV-03 all states.

#### 50. Handover table
- **Variants:** header row; stop row (Stop marker 32: done, numbered on the loader side, pending on the driver side; short on a short row); short row (`attention-soft`, Short chip); total row with the weight caption.
- **Properties:** fill `white`, 1 px `asphalt-200`, radius 12. Columns Stop 150, Planned 64, Loaded 112 (padding 16). Loaded is followed by `check` 20 `done-strong`. Total row fill `asphalt-50`, cells in Heading 3, caption "Weight 2,470.8 kg of 2,530.8 kg planned".
- **Sizes:** Field, 358 wide; rows 64, header 40, total 80.
- **Used in:** LDR-04 all states, DRV-01 / Accept load.

#### 51. Sign-off row
- **Variants:** done with time (`check` 16 `done-strong`), waiting (`clock` 16 `waiting-strong`, "Waiting"), not yet ("Not sent", "Not yet"), accepted on the dock tablet (build).
- **Properties:** icon 24 `asphalt-700`, Body text, time in Label SemiBold at the right; rows separated by 1 px `asphalt-200`.
- **Sizes:** Field, 358 x 64.
- **Used in:** LDR-04 all states. The driver's accept screen uses a one-line version (DRV-01 / Accept load).

#### 52. Dispatcher decision card
- **Variants:** answered (in the sheet, with three consequence rows); record (on the handover).
- **Properties:** answered: `attention-soft`, 1 px `attention-strong`, radius 12, padding 16; decision in Heading 2. Record: `white`, 1 px `attention-strong`, header with `package-x` 24, the stop and a Short chip "Send short".
- **Sizes:** Field, 358 wide.
- **Used in:** LDR-03 / decision, LDR-04 all states.

#### 53. Vehicle load card
- **Variants:** not started, loading (progress bar and caption), ready, short, in the workshop (`asphalt-100`, not tappable); modifier "Plan changed" (2 px `attention-strong` border plus the chip).
- **Properties:** fill `white`, 1 px `asphalt-200`, radius 12, padding 16, gap 8; the whole card is one tap target. Row 1: vehicle icon 24, ID in Heading 2, optional Chilled chip, "Leaves" and time in Heading 2, `chevron-right` 24.
- **Sizes:** Field, 358 wide.
- **Used in:** LDR-01 all states.

#### 54. Load map
- **Variants:** band to load (`asphalt-100`), loading now (`white`, 2 px `signal-400`), loaded (`done-soft`, 1 px `done-strong`, `check` 20), loaded with short; moved marker (`refresh-cw` 20); cab and doors labels.
- **Properties:** the truck body as a container with a 2 px `asphalt-300` border, radius 12, bands cab end first; each band scrolls the line column to its stop.
- **Sizes:** Field tablet, 288 x about 368 (bands 272 x 56).
- **Used in:** LDR-02 / tablet.

#### 55. Vehicle lane, Trip card and Empty trip slot
- **Variants:** lane default, compact (build, large depots), out of service row; trip card compact proposed, selected (2 px `petrol-700`, `petrol-50`), broken rule (2 px `problem-strong`, Rule broken chip), with a Fit hint while dragging; empty slot no trip, standby, with a Fit hint. Fit hint: fits (`check` `done-strong`), blocked (`triangle-alert` `problem-strong`), neutral (`asphalt-500`).
- **Properties:** lane: vehicle block (ID in Heading 3 with a type icon, type, driver, limits, fuel meter) plus two trip slots. Trip card: fill `white`, 1 px `asphalt-200`, radius 12, padding 8 12, three compact meters. Empty slot: 1 px dashed `asphalt-300`, `asphalt-50`.
- **Sizes:** Desk: lane 552 x 148; trip card and slot 196 x 128.
- **Used in:** DSP-02 all states.

#### 56. Vehicle picker row
- **Variants:** current (Estimate mark instead of a radio, not selectable), selected (`petrol-50`, 1.5 px `petrol-700`), available, blocked (`asphalt-50`, disabled radio, reason in `problem-strong` with `triangle-alert` 16).
- **Properties:** radius 8, padding 8 12, gap 12: radio 20, ID and driver over a state line, right text in Label.
- **Sizes:** Desk, 432 x 48.
- **Used in:** DEG-03 / move stop 4.

### E. Orders, receipts and records

#### 57. Order row and Order card
- **Variants:** queue row (Desk table row with a Type chip and flag chips; header row; group row; late-order compact row); board card (default, selected, dragging ghost, to defer, deferred); order card (Store phone: received, scheduled, moved, on the way, delivered, receipt confirmed). Store parts that belong to the card list: section header (date label in Label over a Heading 2 summary, 358 x 48) and link row (neutral with `petrol-700` text, or attention with an `attention-soft` fill, 326 x 44).
- **Properties:** queue row 40 high, Body dense, outlet ID in SemiBold, hover `asphalt-100`, focus ring inside the row. Board card: `grip-vertical` handle, radius 8. Order card: chip row (wraps), headline in Heading 2, subline, optional inline notice, divider, contents, meta line led by the order ID, optional detail row, link row and button.
- **Sizes:** Desk queue row 880 x 40, board card 240 x 92; Store order card 358 wide.
- **Used in:** DSP-01 all states, DSP-02 all states, STM-01 all states.

#### 58. Deferral row and Message preview
- **Variants:** deferral row default, selected, missing reason (error select and a helper with "Use Relay's reason"), protected (`asphalt-50`, `lock`), override (1.5 px `attention-strong`, inline notice, required note, danger button); message preview (the STM-03 notice at desktop scale, in STM-03's order: chip, headline, change block with the lock line, still coming, why, disabled "Got it").
- **Properties:** card, radius 12, padding 8 16 (protected and override 12 16); preview 288 wide, radius 12, padding 16.
- **Sizes:** Desk: deferral row 520 x 116 (152 with a helper); protected 288 x about 242; preview 288 x about 620.
- **Used in:** DSP-03 all states.

#### 59. Change block
- **Variants:** default.
- **Properties:** "Was" row (Label label, Body `asphalt-500` with strikethrough) and "Now" row (Label strong `attention-strong` label, Heading 3 value), a fixed 48 px label column, then a lock row (`lock` 20, "This order won't be moved again unless the dispatcher approves it.").
- **Sizes:** Store (inside a 358 card); Desk inside the Message preview.
- **Used in:** STM-03, STM-03 / acknowledged, DSP-03 (preview).

#### 60. Receipt line, Proof of delivery card and Arrival card
- **Variants:** receipt line arrived, arrived with note, flagged (missing, damaged, not cold; `problem-soft` with "Flagged: 1 damaged"), read-only; proof of delivery card (72 px thumbnail, three fact lines, location row, offline caption); arrival card on the way (time in Display) and past estimate (Heading 2 message, no route row); Person row (40 px avatar with `user` 20, name, vehicle line, departure line, no call button).
- **Properties:** cards fill `white`, 1 px `asphalt-200`, radius 12, padding 16 to 20.
- **Sizes:** Store: receipt line 326 x 64 (104 with a note, 56 read-only); proof card 358 x about 234; arrival card 358 x about 263 to 290 (about 500 on DEG-04); person row 358 x about 92.
- **Used in:** STM-03 / short delivery, STM-04 all states, STM-05 all states, DEG-04.

#### 61. Case entry
- **Variants:** case type row (phone, stepper at 0 or above); case table (desktop: header, case rows with line totals, total row); order totals row (cases, kg, m³, zero state).
- **Properties:** name in Heading 3, per-case size in Label or Body, Input / number stepper / store; totals with `boxes`, `weight`, `box` 16 and values in Label strong.
- **Sizes:** Store: case row 326 x 72; desktop table 696 wide with 64 px rows; totals row 358 x 20.
- **Used in:** STM-02 all states, STM-02 / desktop.

#### 62. Record and history parts (desktop)
- **Variants:** Records table (title bar with caption, header, rows with a record-type icon: `circle-check` Delivered, `map-pin` Arrived, `camera` Photo); Event timeline (time, rail with 8 px dots, text, optional thumbnail, last row `done-strong`); Recipient row (collapsed name and status, expanded message); Sync question card (phone; 2 px `attention-strong` border, record box, two field buttons); Outlook grid (header with week chips, group, demand, meter and meaning rows, a highlighted week column); Summary card (left bar petrol, asphalt, attention or none, with key figures, a compact table and actions); List row (leading icon, number badge or time, up to two buttons).
- **Properties:** cards and tables fill `white`, 1 px `asphalt-200`, radius 8 to 12; rows Body dense, tabular.
- **Sizes:** Desk: records table 752 wide, rows 32 (52 when Details wraps); recipient rows 336 x 32; outlook grid 1200 x 480; list rows 24 to 40. Field: sync question card 358 x about 500.
- **Used in:** DEG-05 all states (records table, event timeline, recipient rows), DEG-02 and DEG-02 / Sinhala (sync question card), DSP-05 (outlook grid, arrange card), DSP-01 to DSP-05 (summary cards and list rows), DSP-02 Publish dialog (list rows).

---

## Where each spec's "Components needed" entry went

| Spec entry | Canonical component |
|---|---|
| Side nav and Side nav item; Key hint | 3 Nav rail; 4 Key hint |
| Top bar, new variants (all specs); Desktop app bar / store; Top bar / phone header without sync pill; Top bar / phone header with sync pill / field; Top bar, loader variants | 2 Top bar |
| Input / segmented control (all specs); Input, new variants; Input / text / multiline; Input / PIN pad / field; Input / number stepper (store, field) | 14 to 19 |
| Summary card; Key figure; Stat tile (desktop); List row; Table rows | 35 Key figure; 57 Order row; 62 Record and history parts |
| Order row / board card; Order card (phone) | 57 Order row and Order card |
| Status chip, new variants (all specs) | 25 Status chip |
| Sync pill, offline copy; Sync pill, new variant | 26 Sync pill |
| Notice, new variants and tones (all specs) | 27 Notice |
| Vehicle lane; Trip card / compact; Empty trip slot | 55 |
| Capacity meter, new sizes | 32 Capacity meter |
| Rule check; Rule check line | 36 Rule check |
| Stop row / planned; Stop row, field variants | 43 Stop row |
| Stop marker (all specs) | 38 Stop marker |
| Run row with Stop track; Run row (desktop); Estimated vehicle marker | 39 Stop track; 40 Run row |
| Exception item (desktop and phone); Estimate row | 41; 42 |
| Marker legend | 31 |
| Tooltip; Toast; Dialog and the `scrim` token | 10; 11; 9 |
| Sheet / side drawer, new size | 8 Sheet |
| Deferral row; Message preview | 58 |
| Outlook grid | 62 |
| Vehicle load card; Loader bar; Loader picker | 53; 5; 20 |
| Stop group header; Load line (loader and driver variants); Load progress bar; Load map | 48; 49; 33; 54 |
| Bottom action bar (all specs); Bar alert row | 7; 28 |
| Button / secondary / compact; Button, disabled (store) and disabled with reason (field); Button / quiet / icon only (44 and 48) | 13 Button |
| Dispatcher decision card; Handover table; Sign-off row | 52; 50; 51 |
| Next stop card; Step progress; Window panel; Window status line; Detail row | 45; 34; 46; 47 |
| Choice row; Choice chip; Photo capture tile; Signature pad; Photo thumbnail and viewer | 21; 22; 23; 24 |
| Confirmation panel | 29 |
| Account footer; Section header; Link row; Cutoff line | 6; 57 (section header and link row are Store parts of the order card list); 37 |
| Case type row; Case table; Order totals row | 61 Case entry |
| Change block; Arrival card; Person row; Proof of delivery card; Receipt line; Stop progress list | 59; 60; 44 |
| Estimate mark; Sync question card; Event timeline; Records table; Recipient row; Vehicle picker row | 30; 62; 56 |
| System status bar; Device dressing; Story card | 1; 12 |
| Text styles; Night mode | Foundations, above (not counted as components) |
