# Loader Screens: Frame Spec (Relay, Team Ryzera)

> **v0.4 (data aligned).** Frame-by-frame spec for the Loader role, for the Figma build (`tools/figma-builder/steps/loader`) and for the Hackathon front end. Persona: Mohamed Rizwan, loading supervisor on the night shift at the Kandy hub dock, with loaders Suresh Kumar and Anjali Wickramasinghe. The night is Tuesday 7 to Wednesday 8 April 2026. Every name, ID, time and quantity comes from `05-scenario-data.md` v0.4; values the screens need that the scenario does not print are derived from it and listed under "Facts and derived values". Shared components are defined once in `components.md`.
>
> **v0.4 data alignment: what changed from v0.3.**
> - Date: Wednesday 14 October becomes **Wednesday 8 April 2026** ("Wed 8 Apr" in the app bar).
> - The load: VEH047 (refrigerated, Fresh chilled, 5 stops, 108 cases planned, 106 loaded) becomes **VEH045, a dry-box truck, Fresh dry, Kegalle district, 4 stops, 383 cases planned and 377 loaded**, loaded in reverse stop order: 4 Aranayake, 3 Hemmathagama (Dilani), 2 Mawanella, 1 Kegalle.
> - Case types: dairy crates, produce crates and frozen boxes become **rice and dhal, packet foods, tea and biscuit** (heaviest first). Every load line takes the Dry modifier (no chilled bar, `package` and "Stop N · Dry"); the "Chilled load" chip is gone from LDR-02.
> - The 9:12 PM change: stops 4 and 5 swapped becomes **stops 3 and 4 swapped**; Aranayake (was stop 3) now loads first and is already loaded at 2:40. Banner: "VEH045 stops 3 and 4 swapped" / "Plan changed 9:12 PM by Nuwan Perera. Aranayake now loads first (done)."
> - The shortfall: 2 dairy crates missing for stop 4 (ORD0094612) becomes **6 rice and dhal cases missing for stop 3, Hemmathagama (ORD0098595)**: 30 of 36 on the shelf. Nuwan's answer: send short, **add the 6 to Dilani's Thursday dry order ORD0098747, marked from Wednesday** (was a separate chilled order ORD0094705).
> - Loading counts follow the scenario: 86 of 383 at 2:40, 116 at 2:47, 122 at 2:48, 146 at 2:52, 377 at 3:30. The counts between whole lines needed a new, small Load line modifier: the **line in progress** shows how many of its cases are on ("30 of 36 on").
> - LDR-01 is regrouped around the real Kandy night: **Loading** (VEH045, VEH057), **Ready to leave** (VEH042, VEH059), **Still to load** (VEH049 and the three second trips), **Already left** (7 vehicles), **In the workshop** (VEH039, VEH058). The PIN switch now follows Anjali marking VEH042 complete at 2:36; its caption on the canvas names Rizwan's 2:18 AM sign-in and his 2:20 start on VEH045.
> - The interactive part on the Design System page is now **Stop group / stop 4** (Aranayake), not stop 5.
> - Review fixes (this pass): the prototype flow is named **"Loader flow"** in the step and in the section header, as Figma lists it (it was "Loader night"). On LDR-02 / answer in the list is scrolled so the top of the alert bar falls between rows (the stop 1 header ends on "OUT119 · ORD0098598 · 57 cases" and its tag line sits under the bar), instead of showing a cut strip of "Load last, by the doors". The LDR-01 rationale keeps "9:12 PM" on one line.

## Screen set

The loader works on one shared tablet mounted near the bays. Judges review the loader on a phone, so every screen is designed at 390 x 844 first, and one landscape tablet frame shows how the same screen stretches to the dock tablet. 14 frames and one prototype overlay: 13 phone frames, 1 tablet frame, and Overlay / Language sheet.

Main frames are shown in English for review. In use, each loader's language comes back when they sign in, and one frame shows the load list in Tamil, the language Rizwan reads most easily. Sinhala is shown on the driver side (DRV-01 Today's run / Sinhala), so the two field roles show all three languages between them.

| Frame | Size | Snapshot, Wed 8 Apr 2026 | What it shows |
|---|---|---|---|
| LDR-01 Tonight's loads / PIN switch | Phone | 2:40 AM | Rizwan switches back on the shared tablet after Anjali marked VEH042 complete |
| LDR-01 Tonight's loads | Phone | 2:40 AM | The Kandy hub's Fresh loads by status, the 9:12 PM plan change banner above VEH045 |
| LDR-02 Load vehicle | Phone | 2:47 AM | VEH045 trip 1 in reverse stop order. Stop 4 loaded, stop 3 loading, its rice and dhal line at 30 of 36 with the shelf empty |
| LDR-02 Load vehicle / Language | Phone | 2:47 AM | Language sheet: Sinhala, Tamil, English |
| LDR-02 Load vehicle / Tamil | Phone | 2:47 AM | The same moment in Tamil, scrolled to stop 3 |
| LDR-03 Flag a shortfall | Phone | 2:47 AM | 6 rice and dhal cases missing for stop 3, ORD0098595 |
| LDR-02 Load vehicle / flag sent | Phone | 2:48 AM | The flag waits for Nuwan while packet foods go on |
| LDR-02 Load vehicle / answer in | Phone | 2:52 AM | Rizwan is on stop 3's packet foods when Nuwan's answer arrives in the bottom bar |
| LDR-03 Flag a shortfall / decision | Phone | 2:52 AM | Nuwan's answer: send short, add to Thursday's order ORD0098747 |
| LDR-02 Load vehicle / all checked | Phone | 3:30 AM | Every line loaded or decided: 377 of 383 |
| LDR-04 Handover / ready | Phone | 3:31 AM | The shortfall, planned against loaded, Load complete |
| LDR-04 Handover / waiting for driver | Phone | 3:32 AM | Sent to Kasun's phone, with the dock tablet as a fallback |
| LDR-04 Handover | Phone | 3:32 AM | Kasun accepted the load |
| LDR-02 Load vehicle / tablet | Tablet 1024 x 768 | 2:47 AM | Dock tablet layout with a load map of the truck |

The table is in story order. Prototype flow "Loader flow" starts on LDR-01 Tonight's loads / PIN switch and runs down the table to LDR-04 Handover. The Language sheet and the Tamil frame are a side trip from LDR-02 Load vehicle. The tablet frame stands alone. Before the first frame, not framed: Rizwan signs in at 2:18 AM and starts VEH045 at 2:20 with stop 4, Aranayake.

**What crosses between roles in this set**
- In from the dispatcher: Nuwan's 9:12 PM swap of stops 3 and 4 on VEH045 reaches the dock as the banner on LDR-01 and the moved tags on LDR-02. Because the plan was published before the night shift, Aranayake is already loaded first by 2:40.
- Out to the dispatcher: the 2:47 AM flag reaches Nuwan's phone, and he opens it at 2:48 (DSP-04 Live runs / shortfall decision).
- Back from the dispatcher: the 2:52 AM decision arrives in LDR-02's bottom bar wherever Rizwan has scrolled. It updates the rice and dhal line, Dilani's Thursday dry order ORD0098747 (127 to 133 cases, marked from Wednesday; STM-03 Deferral notice / short delivery, which reaches her silently in quiet hours and is opened at 5:05 AM) and Kasun's stop 3 (96 cases).
- Out to the driver: Load complete at 3:32 AM goes to Kasun's phone (DRV-01 Today's run / Accept load), and his acceptance comes back to LDR-04 the same minute. If his phone cannot answer, he accepts on the dock tablet with his own PIN.

### Shared conventions for every loader frame

- **Framing assumptions:** the Kandy hub dock has depot Wi-Fi, so every frame shows All synced. The dock tablet is a rugged tablet with glove mode on, or loaders wear touchscreen-tip gloves.
- **Frame fill:** `asphalt-50`. Cards and sheets are `white` with a 1 px `asphalt-200` border. Radius 12 for cards, 8 for buttons and load lines, 6 for chips and inputs, 16 for the top corners of sheets. No shadows except on sheets (0 8 24, #14181F at 12%). Sheet scrim: the `scrim` token (#14181F at 40%, the same in every mode) over the frame.
- **Status tokens** are the Status table in the style guide, written as `chilled-strong` #0A6EBD, `chilled-soft` #E4F1FB, `done-strong` #1F7A4D, `done-soft` #E3F3EA, `attention-strong` #A15C00, `attention-soft` #FCEFD9, `problem-strong` #B3261E, `problem-soft` #FBE9E7, `waiting-strong` #69727F, `waiting-soft` #ECEFF3.
- **Type:** Atkinson Hyperlegible Next. Display 32/40 Bold, Heading 1 24/32 Bold, Heading 2 20/28 SemiBold, Heading 3 16/24 SemiBold, Body 15/22 Regular, Label 13/18 Medium, Caption 12/16 Medium, Field button 18/24 SemiBold. Body SemiBold is Body at SemiBold weight, used for counts and compact button labels. Item names on load lines use the driver spec's Field title (18/24 SemiBold), because they are read from a step away in a dim dock. All counts, times and IDs use tabular figures, never a monospace face.
- **Sinhala and Tamil:** Sinhala in Yaldevi, Tamil in Noto Sans Tamil, matched in size and weight, on the same taller ramp as the driver spec's Sinhala frame so marks above and below the letters never clip: Display 32/48, Heading 1 24/36, Heading 2 20/30, Heading 3 16/26, Body 15/24, Label 13/20, Caption 12/18, Field title and Field button 18/28. IDs, numbers and people's names stay in Atkinson. Outlet names stay in Latin letters on loader screens, because loaders match them against case labels printed in English (the driver screens write them in Sinhala, because drivers match road signs; the rule is stated once under Text rules in `components.md`). Digits are Western digits in every language.
- **Field density** (Driver and Loader column of the style guide): primary and full-width buttons 56 high; list rows and load lines 64 minimum; every tap target at least 48 x 48 with 8 between targets, so gloved fingers do not hit the neighbor. Inline controls inside rows and bars are 48 high.
- **Icons:** Lucide, 1.75 stroke. 24 px in app bars, in every button, in notices, and in the hint, info, consequence and sign-off rows. 28 px in the load line check slot. 20 px in table cells and captions. 16 px in chips, pills, status lines and meta lines.
- **System status bar** (frame dressing): phone 390 x 44, tablet 1024 x 24, fill `white`, the snapshot time on the left (for example "2:40"), `signal` 16 on the right.
- **Home indicator** (frame dressing, phone only): 34 px of `white` at the bottom of the bottom action bar or sheet, with a 134 x 5 `asphalt-900` bar, radius 3, centered 8 px from the bottom. On LDR-01, which has no bottom bar, only the bar is drawn over the content.
- **App bar:** Top bar / phone header with sync pill, the driver spec's component, 390 x 64, fill `white`, bottom border 1 px `asphalt-200`, horizontal, centered vertically, space between. It stays fixed while content scrolls.
  - Root (LDR-01): padding 8 8 8 16. Left, gap 8: Relay mark 24, then a text stack: "Kandy hub" in Heading 3 `asphalt-900`, "Wed 8 Apr" in Caption `asphalt-500`. Right, gap 4: Sync pill, Language button.
  - Back (LDR-02, LDR-04): padding 8 8 8 4. Left, gap 4: Button / quiet / icon only, 48 x 48, `arrow-left` 24 `asphalt-900`, then the title in Heading 3 `asphalt-900` ("VEH045 trip 1"). Right, gap 4: Sync pill, Language button. The title is Heading 3, one step below the driver's back header, because the loader header also carries the Language button.
  - Overflow rule: when the title does not fit on one line (Tamil, for example), it wraps to two lines and the bar grows to fit. The vehicle ID is never truncated or dropped.
  - **Sync pill / all synced:** 32 high, radius 6, fill `done-soft`, `circle-check` 16 `done-strong`, "All synced" in Label `done-strong`. Status only, not tappable. If Wi-Fi drops, checks and flags save on the tablet and the pill switches to the offline-with-count variant, the same as on the driver app.
  - **Language button:** Button / quiet / icon only, 48 x 48, `languages` 24 `asphalt-900`, accessible label "Language", the same button as on the driver app.
- **Sheets:** Sheet / bottom sheet, fill `white`, top corners radius 16, shadow, vertical, padding 8 16 0. Grabber 36 x 4, `asphalt-300`, radius 2, centered at the top. The home indicator closes the sheet.
- **Bottom action bar:** fixed, fill `white`, top border 1 px `asphalt-200`, padding 12 16, vertical, gap 8, then the 34 px home indicator.
- **Motion:** sheets slide up in 250 ms, ease out. A line that is checked changes fill in 120 ms. The "Go to handover" button and the Bar alert row slide up inside the bottom bar in 200 ms. A finished stop collapses in 200 ms with the scroll anchored (see the collapse rule on LDR-02). Nothing else moves.

### Loader components used across frames

These are specified once here and referenced by name in each frame.

**Vehicle load card.** 358 wide, fill `white`, 1 px `asphalt-200`, radius 12, padding 16, vertical, gap 8. The whole card is one tap target.
- Row 1, horizontal, gap 8, centered: vehicle icon 24 `asphalt-900` (`truck` or `van`), vehicle ID in Heading 2 `asphalt-900`, Status chip / Chilled on refrigerated loads only, spacer, departure stack (right aligned: "Leaves" in Caption `asphalt-500`, time in Heading 2 `asphalt-900`), then `chevron-right` 24 `asphalt-500`.
- Row 2: trip line in Body `asphalt-700`: temperature, district, stops and cases ("Dry · Kegalle · 4 stops · 383 cases"). A second trip starts with "Trip 2".
- Row 3 (when known): people line in Label `asphalt-500`, driver and loader.
- Row 4: status chips, horizontal, wrap, gap 8. On Ready cards the completion time follows the chip in Caption `asphalt-700` ("Complete at 2:36 AM").
- Row 5: Loading: Load progress bar, 326 x 6, then a caption in Caption `asphalt-700` ("86 of 383 cases loaded"). Second trips: a caption with when to pick it ("Pick before VEH059 is back, planned 5:16 AM").
- Variants: Not started, Loading, Ready, Short, In the workshop. Modifier "Plan changed": border becomes 2 px `attention-strong` and the Plan changed chip is added to row 4. In the workshop: fill `asphalt-100`, text and icon `asphalt-500`, "No load" in place of the departure stack, no chevron, not tappable.

**Departed card** (new). 358 wide, fill `white`, 1 px `asphalt-200`, radius 12, padding 16, vertical, gap 12. One row per departure time: time in Body SemiBold `asphalt-900` in a 64 wide column, gap 12, then the district in Body SemiBold `asphalt-900` over the vehicle IDs in Label `asphalt-700`. Not tappable.

**Status chips used on loader frames.** Status chip, 28 high, radius 6, padding 4 8, gap 4, icon 16 plus Label.

| Chip text | Chip | Tone | Icon |
|---|---|---|---|
| Chilled | Status chip / Chilled (existing), on refrigerated loads on LDR-01 | `chilled-strong` on `chilled-soft` | `snowflake` |
| Not started | Status chip / Not started | `asphalt-700` on `waiting-soft`, 1 px `asphalt-300` | `circle` |
| Loading, Loading now | Status chip / Loading | `petrol-700` on `petrol-50` | `circle-dot` |
| Ready | Status chip / Ready | `done-strong` on `done-soft` | `circle-check` |
| Plan changed 9:12 PM | Status chip / Plan changed | `attention-strong` on `attention-soft` | `refresh-cw` |
| 1 flag waiting | Status chip / Flag waiting | `attention-strong` on `attention-soft` | `clock` |
| 6 short | Status chip / Short (shared with the store manager and driver specs) | `attention-strong` on `attention-soft` | `package-x` |
| Send short | Status chip / Short, decision label | `attention-strong` on `attention-soft` | `package-x` |
| In the workshop | Status chip / In the workshop | `asphalt-700` on `waiting-soft`, 1 px `asphalt-300` | `info` |

Rule on these screens: gray means not started, petrol means someone is working on it, green means done, amber means something changed, is waiting on a decision, or is short. Every chip has an icon and a word. Gray chips use `asphalt-700` text and icons on `waiting-soft`, because `waiting-strong` on `waiting-soft` is only 4.2:1 (the shared Waiting rule in `components.md`). A dry load gets no temperature chip; the trip line and every load line say "Dry".

**Stop marker** (shared with the driver spec and STM-04). A circle with the stop number in Heading 3, 32 x 32 on every loader frame.
- To load uses **Pending**: fill `white`, 1.5 px `asphalt-300` ring, number `asphalt-700`.
- Loading now uses **Next**: fill `signal-400`, 1.5 px `signal-ink` ring, number `signal-ink`. Signal yellow marks the stop being loaded, as it marks the next stop on the driver app.
- **Done, numbered**: fill `done-soft`, 1.5 px `done-strong` ring, number `done-strong`. The loader keeps the number, because the stop still has to be told apart after it is loaded.
- **Short**: fill `attention-soft`, 1.5 px `attention-strong` ring, number `attention-strong`. Used for a stop with a decided short.

**Stop group header.** One per stop, in reverse stop order.
- Expanded (To load, Loading now, Done with short): no fill, 358 wide, min 64 high, horizontal, padding 8 0, gap 12.
  - Stop marker 32, in the state above.
  - Text stack, gap 2: title "Stop N · Place" in Heading 2 `asphalt-900`; meta "OUT ID · ORD ID · N cases" in Label `asphalt-700`; optional tag row, wrap, gap 8: Status chip / Loading ("Loading now"), a moved tag (`refresh-cw` 16 plus Caption, both `attention-strong`: "Was stop 4 until 9:12 PM") and a position tag in Caption `asphalt-700` ("Load first, at the cab end" on the first group, "Load last, by the doors" on the last).
  - Right: count of cases on in Body SemiBold `asphalt-900`, tabular ("30 of 102").
- Collapsed (Done): a card, 358 wide, min 72 high, fill `white`, 1 px `asphalt-200`, radius 12, padding 12 4 12 12. The meta line is replaced by a result line: `check` 16 plus "All 86 cases loaded" in Label `done-strong` (or, for a stop collapsed by hand with a short, `package-x` 16 plus "96 of 102 loaded, 6 short" in `attention-strong`). The moved tag stays. The count is replaced by Button / quiet / icon only, 48 x 48, `chevron-down` 24 `asphalt-700`, which expands the group.
- Sticky: when a stop's header scrolls under the app bar, a compact copy pins there until the next stop's header pushes it up. Phone 390 x 48, fill `white`, bottom border 1 px `asphalt-200`, padding 0 16, gap 12: Stop marker 32, "Stop N · Place" in Heading 3, spacer, count in Body SemiBold. In Tamil the place name takes its own line and the header grows to 64 (padding 6), as the app bar does. Not tappable.
- "Loading now" is the first stop, in loading order, that still has a line To load.

**Load line** (existing component, `components.md` #49). 358 wide on phone, min 64 high, grows to fit when a status line or a Sinhala or Tamil name wraps. Never truncated. Tablet sizes are given in LDR-02 / tablet.
- Container: fill `white`, 1 px `asphalt-200`, radius 8, horizontal, padding 8 8 8 12, gap 8, centered. Chilled modifier: a 4 px `chilled-strong` bar on the inside left edge (the component's Chilled property). **Dry modifier** (every VEH045 line): Chilled off, so no bar; status line 1 reads "Stop N · Dry" with `package` 16, both `asphalt-700`.
- Check slot, 48 x 48, icon 28, centered.
- Quantity, 36 wide, Heading 1 `asphalt-900`, tabular, right aligned. A line with a flag shows the cases on the truck with "of 36" in Caption `asphalt-700` under it.
- Text stack, fills the remaining width (146 on phone in English), gap 2: item name in Field title `asphalt-900` ("Rice and dhal", "Packet foods", "Tea and biscuit"); then status lines in Label. Status line 1 always names the stop, so a line is never read against the wrong stop.
- **Line in progress** (new modifier on To load): a second line of status line 1, in Label SemiBold `petrol-700`, says how many of the line's cases are on so far ("30 of 36 on"). The stop count and the bar count these cases, so the totals match what is on the truck. How loaders set it is a build note under LDR-02.
- Line button, Button / secondary / compact, 48 high, min 84 wide on phone, radius 8, fill `white`, 1 px `asphalt-300`, padding 0 10, gap 4, icon 24 plus Body SemiBold `asphalt-900`.
- Row tap: on To load and Checked, tapping anywhere on the row except the line button toggles between them. On Flag waiting, Short decided and Flagged damaged, a row tap opens LDR-03 the same as View and never toggles to Checked.

| Variant | Fill and border | Check slot | Status lines after line 1 ("Stop 3 · Dry") | Line button |
|---|---|---|---|---|
| To load | `white`, `asphalt-200` | `square` `asphalt-700` | none (in progress: "30 of 36 on" in petrol) | `circle-alert` "Flag" |
| Checked | `done-soft`, 1 px `done-strong` | `square-check` `done-strong` | `check` 16 plus "Loaded" in `done-strong` | `circle-alert` "Flag" |
| Flag waiting | `attention-soft`, 1 px `attention-strong` | `clock` `attention-strong` | "30 loaded, 6 missing" in Label SemiBold, then "Waiting for Nuwan", both `attention-strong`. Height 96 | `chevron-right` "View" |
| Short decided | `attention-soft`, 1 px `attention-strong` | `package-x` `attention-strong` | "30 loaded, 6 short" in Label SemiBold, then "6 come on Thursday". Height 96 | `chevron-right` "View" |
| Flagged damaged | `problem-soft`, 1 px `problem-strong` | `triangle-alert` `problem-strong` | "N loaded, N damaged", then "Waiting for Nuwan" | `chevron-right` "View" |
| Changed (build only) | `white`, 2 px `attention-strong` | `refresh-cw` `attention-strong` | for example "Now 30, was 36. Take 6 off." or "Moved to another trip. Take it off." | `circle-alert` "Flag" |

**Load progress bar.** Track `asphalt-200`, radius 4. In progress: fill `petrol-700`. Complete: fill `done-strong`. Complete with short: `done-strong` for the loaded share and `attention-strong` for the short share at the end. 8 high in the bottom action bar, 6 high on vehicle cards.

**Bar alert row.** The top row of the bottom action bar, used when something reaches the loader while he is working, so it is seen wherever the list is scrolled. 390 wide, min 56 high, fill `attention-soft`, top border 1 px `attention-strong`, padding 4 8 4 16, gap 12: icon 24 `attention-strong`, text in Body SemiBold `asphalt-900` (two lines where needed, broken between who and what), Button / secondary / compact, 48 high. It hides once the loader opens what it points to.

**Notice** (the shared definition is in `components.md`). 358 wide, radius 12, soft fill with no border, padding 16, gap 12. Icon 24 in the strong tone. Content stack, gap 8: title in Heading 3, body in Body, optional Button / secondary / field. Tones used here: Attention, Info (white, 1 px `asphalt-200`), Done and Waiting (`waiting-soft`, 1 px `asphalt-300`).

---

## LDR-01 Tonight's loads

- **Frame:** `LDR-01 Tonight's loads`, phone 390 x 844, fill `asphalt-50`. Snapshot Wednesday 8 April 2026, 2:40 AM, Kandy hub, signed in as Mohamed Rizwan. Status bar, app bar and loader bar are fixed; the content scrolls.
- **Purpose:** Show every Fresh load at the Kandy hub tonight, what state each is in and when it leaves, who is using the tablet, and what changed in the plan after the loading lists were printed.
- **Layout:**
  1. System status bar, 390 x 44.
  2. App bar, Top bar / phone header with sync pill / root, 390 x 64.
  3. Loader bar, 390 x 56, fill `white`, bottom border 1 px `asphalt-200`, padding 4 16, gap 8. Left stack: "Signed in as" in Caption `asphalt-500`, name in Heading 3 `asphalt-900`. Spacer. Button / secondary / compact, `users` 24 plus "Switch". Button / quiet / icon only, 48 x 48, `lock` 24, accessible label "Lock this tablet".
  4. Content, vertical, padding 12 16 32, gap 12, scrolls. The 12 on top keeps the VEH057 caption "40 of 118 cases loaded" 8 px clear of the home indicator.
     - 4a. Title block, gap 4: "Tonight's loads" in Heading 1; the count line in Label `asphalt-500` (176 to 230).
     - 4b. Notice / attention (instance of the interactive part Notice / plan change), 358 x 130 (242 to 372). `refresh-cw` 24 `attention-strong`, title and body, no button: the VEH045 card below is the target, and it carries the 2 px attention border. Dismiss: Button / quiet / icon only, 48 x 48, `x` 24, pinned 4 px from the top right corner; the title keeps 40 px of right padding.
     - 4c. Five groups, each a label in Label `asphalt-500`, then its cards (gap 12 between label and cards, 8 between cards), each group in departure order: Loading, Ready to leave, Still to load, Already left, In the workshop. Loads in progress come first because they are what the dock is working on.
  - Visible at scroll 0: the title block, the notice, the "Loading" label (396 to 414), the VEH045 card in full (426 to 630) and most of the VEH057 card. The other groups are below the fold.
- **Content:**
  - Status bar "2:40". App bar "Kandy hub" / "Wed 8 Apr", "All synced". Loader bar "Signed in as" / "Mohamed Rizwan", "Switch".
  - 4a: "Tonight's loads" / "15 loads: 2 loading, 2 ready, 4 still to load, 7 gone"
  - 4b title: "VEH045 stops 3 and 4 swapped"
  - 4b body: "Plan changed 9:12 PM by Nuwan Perera. Aranayake now loads first (done). Lists printed before then are wrong for this truck."
  - 4c cards:

| Group | Card | Row 1 | Row 2 | Row 3 | Row 4 | Row 5 |
|---|---|---|---|---|---|---|
| Loading | Loading, Plan changed | `truck` "VEH045", "Leaves" / "3:40 AM" | "Dry · Kegalle · 4 stops · 383 cases" | "Driver Kasun Bandara · Loader Mohamed Rizwan" | "Loading", "Plan changed 9:12 PM" | Bar at 22%, "86 of 383 cases loaded" |
| Loading | Loading | `van` "VEH057", chip "Chilled", "3:40 AM" | "Chilled · Kandy · 5 stops · 118 cases" | "Driver Priyantha Silva · Loader Suresh Kumar" | "Loading" | Bar at 34%, "40 of 118 cases loaded" |
| Ready to leave | Ready | `truck` "VEH042", chip "Chilled", "2:44 AM" | "Chilled · Matale · 4 stops · 324 cases" | "Driver Sampath Lakmal · Loader Anjali Wickramasinghe" | "Ready", "Complete at 2:36 AM" | none |
| Ready to leave | Ready | `van` "VEH059", "3:00 AM" | "Dry · Kandy · 5 stops · 136 cases" | "Loader Suresh Kumar" | "Ready", "Complete at 2:31 AM" | none |
| Still to load | Not started | `truck` "VEH049", "4:48 AM" | "Dry · Kandy · 4 stops · 242 cases" | none | "Not started" | none |
| Still to load | Not started | `van` "VEH059", "5:26 AM" | "Trip 2 · Dry · Kandy · 3 stops · 71 cases" | none | "Not started" | "Pick before VEH059 is back, planned 5:16 AM" |
| Still to load | Not started | `van` "VEH057", chip "Chilled", "6:12 AM" | "Trip 2 · Chilled · Kegalle · 2 stops · 112 cases" | "Driver Priyantha Silva" | "Not started" | "Pick before VEH057 is back, planned 6:02 AM" |
| Still to load | Not started | `truck` "VEH042", chip "Chilled", "6:26 AM" | "Trip 2 · Chilled · Kandy · 3 stops · 166 cases" | "Driver Sampath Lakmal" | "Not started" | "Pick before VEH042 is back, planned 6:16 AM" |
| In the workshop | In the workshop | `truck` "VEH039", "No load" | "Refrigerated truck · back on Thursday" | none | "In the workshop" | none |
| In the workshop | In the workshop | `van` "VEH058", "No load" | "Refrigerated van · back on Thursday" | none | "In the workshop" | none |

  - Already left (Departed card): "2:00 AM" / "Badulla" / "VEH040, VEH041, VEH046, VEH056". "2:30 AM" / "Matale" / "VEH048". "2:35 AM" / "Nuwara Eliya" / "VEH043, VEH044".
  - The drivers of VEH049 and VEH059 are not named in the story, so their cards have no driver. A load not yet started has no loader.
- **States:**
  - **LDR-01 Tonight's loads / PIN switch.** Same moment, 2:40 AM. Rizwan signed in at 2:18 AM and started VEH045 at 2:20; Anjali Wickramasinghe signed in at 2:36 to mark VEH042 complete, so the loader bar behind the sheet reads "Signed in as" / "Anjali Wickramasinghe", dimmed by the scrim. Sheet / bottom sheet, 390 x about 590, gap 16:
    1. Grabber.
    2. Header row: "Who is loading?" in Heading 2, Close button (`x` 24, accessible label "Close").
    3. Loader picker, 358 x 64, three person buttons 114 x 64, radius 8: initials circle 28 (fill `asphalt-100`, Label SemiBold) over the first name in Label SemiBold. Selected: fill `petrol-50`, 2 px `petrol-700`, name in `petrol-700`, and the initials circle turns `white` with the initials in `petrol-700`, so it still shows on the petrol fill. "MR" / "Rizwan" (selected), "SK" / "Suresh", "AW" / "Anjali".
    4. PIN block, centered, gap 12: "Enter Rizwan's PIN" in Heading 3; 4 dots of 16 with 16 between, 3 filled `asphalt-900`, the 4th empty with a 2 px `asphalt-300` ring; "Each loader's language comes back when they sign in." in Caption `asphalt-500`.
    5. Input / PIN pad / field, 4 rows of 3 keys, 114 x 64, gap 8, digit in Heading 1: "1 2 3 / 4 5 6 / 7 8 9 / empty, 0, Delete". Delete uses Body SemiBold, accessible label "Delete last digit".
    6. Home indicator.
    - Not framed, for the build: a wrong PIN clears the dots, rings them in `problem-strong` and shows "That PIN did not match. Try again." The tablet stays signed in while a loader works at the truck. It locks only on Switch, on Lock, or after 15 minutes with no taps; after an idle lock the sheet opens with the last person selected. Every check and flag is recorded against the person who made it.
  - Not framed, for the build: the notice hides when a loader taps dismiss or the load is complete, and the Plan changed chip stays on the card until the load is complete. A vehicle shows "1 flag waiting" while a flag waits for the dispatcher, and "6 short" after a send-short decision. After a handover the card moves to Ready to leave with "Accepted by Kasun Bandara at 3:32 AM", then to Already left.
- **Prototype:**
  - "Switch" and the lock button go to "LDR-01 Tonight's loads / PIN switch".
  - VEH045 card goes to "LDR-02 Load vehicle".
  - Notice dismiss: no navigation (the interactive part changes to Dismissed and the list moves up).
  - Language button: opens Overlay / Language sheet as an overlay; any option, Close or the scrim closes it.
  - Other cards: no target in the prototype. In the build they open LDR-02 for that vehicle and trip.
  - On "LDR-01 Tonight's loads / PIN switch": any digit key goes to "LDR-01 Tonight's loads" (it stands in for the fourth digit). Close goes to "LDR-01 Tonight's loads". This frame is the flow start "Loader flow".
- **Rationale:** Rizwan's night starts with one question: what has to leave this dock, and when? The loads in progress come first, then those ready to leave, those still to load (with the three second trips, picked before each vehicle is back) and those already gone, each group in departure order and readable from across the bay. The shared tablet switches loaders with a name and a four-digit PIN, because passwords do not survive gloves. The banner answers the failure Rizwan describes: Nuwan moved two stops at 9:12 PM and nobody told the dock. It says what changed, that Aranayake has already gone in first, and it sits right above the truck it affects.

---

## LDR-02 Load vehicle

- **Frame:** `LDR-02 Load vehicle`, phone 390 x 844, fill `asphalt-50`. Snapshot Wednesday 8 April 2026, 2:47 AM. VEH045 trip 1. Stop 4 (Aranayake, 86 cases) went on from 2:20 to 2:40. Rizwan has counted 30 rice and dhal cases for stop 3 onto the truck and the shelf is empty: 6 are missing. Status bar, app bar and bottom action bar are fixed; the content scrolls.
- **Purpose:** Load one vehicle and trip in the order that makes unloading work, check each line with one gloved tap, and flag anything missing or damaged before the truck leaves.
- **Layout:**
  1. System status bar, 390 x 44.
  2. App bar / back, 390 x 64: back button (accessible label "Back to tonight's loads"), title, Sync pill, Language button.
  3. Title block, fill `white`, bottom border, padding 12 16 16, gap 8, scrolls with the content: meta line in Body `asphalt-700`; chip row, wrap, gap 8.
  4. Load hint row, padding 12 16, gap 12: `layers` 24 `asphalt-700`, text in Body `asphalt-700`.
  5. Stop groups, padding 0 16 24, gap 16 between groups, gap 8 inside a group. Order: stop 4, 3, 2, 1. Within each stop, lines run heaviest case type first (rice and dhal 10.0 kg, packet foods 5.2 kg, tea and biscuit 4.4 kg a case), so the heaviest cases go in at the bottom.
     - 5a. Stop 4: instance of the interactive part Stop group / stop 4, Collapsed.
     - 5b. Stop 3: Stop group header, Loading now (120 high, the tag row wraps), then 3 load lines.
     - 5c. Stop 2 and 5d. Stop 1 (with the "Load last, by the doors" tag): headers To load, 3 lines each.
  6. Bottom action bar / progress, 390 x 96: progress row (left in Body SemiBold; right `user` 16 plus the signed-in loader's first name in Caption `asphalt-700`), then Load progress bar 358 x 8.
  - Visible at scroll 0: app bar (44 to 108), title block, hint, the stop 4 card, the stop 3 header (390 to 510), the rice and dhal line (518 to 596), packet foods (604 to 668) and tea and biscuit (676 to 740). The bottom bar starts at 748.
- **Content:**
  - Status bar "2:47". App bar "VEH045 trip 1", "All synced".
  - Meta: "Kasun Bandara · Dry-box truck · Leaves 3:40 AM". Chip: "Plan changed 9:12 PM".
  - Hint: "Work down this list. Stop 4 goes in first, at the cab end. Stop 1 goes in last, by the doors. Tap a line when all its cases are on the truck."
  - Stop groups (every line has the Dry modifier, the line button "Flag" and status line 1 "Stop N · Dry"):

| Group | Header content | Lines (quantity, name, variant) |
|---|---|---|
| Stop 4, collapsed, Done | Marker "4" (Done). "Stop 4 · Aranayake". "All 86 cases loaded". Moved tag "Was stop 3 until 9:12 PM". Expand button | When expanded: meta "OUT116 · ORD0098593 · 86 cases", tag "Load first, at the cab end", count "86 of 86"; 30 Rice and dhal, 32 Packet foods, 24 Tea and biscuit, all Checked |
| Stop 3, loading now | Marker "3" (Next). "Stop 3 · Hemmathagama". "OUT117 · ORD0098595 · 102 cases". Chip "Loading now", moved tag "Was stop 4 until 9:12 PM". Count "30 of 102" | 36 Rice and dhal, To load, in progress "30 of 36 on". 44 Packet foods, To load. 22 Tea and biscuit, To load |
| Stop 2, to load | Marker "2" (Pending). "Stop 2 · Mawanella". "OUT118 · ORD0098597 · 138 cases". Count "0 of 138" | 40 Rice and dhal, 58 Packet foods, 40 Tea and biscuit, To load |
| Stop 1, to load | Marker "1" (Pending). "Stop 1 · Kegalle". "OUT119 · ORD0098598 · 57 cases". Tag "Load last, by the doors". Count "0 of 57" | 23 Rice and dhal, 20 Packet foods, 14 Tea and biscuit, To load |

  - Bottom action bar: "116 of 383 cases loaded" / "Rizwan", bar at 30%.
- **States:**
  - **LDR-02 Load vehicle / Language.** 2:47 AM. LDR-02 behind the scrim. Sheet, gap 12: Grabber; header "Language" with Close; helper "Relay remembers each loader's choice and brings it back when they sign in." in Body `asphalt-700`; three Choice row / field / option, 358 x 64, radius 12: "සිංහල" (Yaldevi) / "Sinhala", "தமிழ்" (Noto Sans Tamil) / "Tamil", "English" selected (`petrol-50`, 2 px `petrol-700`, `check` 24); note "Outlet names and IDs stay in English letters, so they match the case labels." in Caption `asphalt-500`; home indicator. Overlay / Language sheet is the same sheet in a clear 390 x 844 frame, for the overlay opened from LDR-01.
  - **LDR-02 Load vehicle / Tamil.** 2:47 AM, the same moment and data as LDR-02 Load vehicle, with every interface string in Tamil from the Tamil column of "Language strings", on the taller ramp. Scrolled so stop 3's header is pinned as the sticky header:
    - App bar, about 70 high (44 to 114): title "VEH045" / "பயணம் 1" on two lines, because the Tamil sync pill "அனைத்தும் அனுப்பப்பட்டது" takes two lines, broken at the space (about 109 wide).
    - Sticky header (114 to 179): marker "3" (Next), "நிறுத்தம் 3" over "Hemmathagama", count "102 இல் 30".
    - Stop 3 lines: 36 "அரிசி, பருப்பு", status "நிறுத்தம் 3" / "உலர்" and, in petrol, "36 இல் 30 ஏறியது" (124 high; scrolled 45 px, so its name has gone under the sticky header and the quantity, status lines and button show); 44 "பக்கெட் உணவுகள்" and 22 "தேயிலை, பிஸ்கட்", names on two lines (110 high). Button "புகாரளி" on each line.
    - Stop 2 header: marker "2" (Pending), "நிறுத்தம் 2" over "Mawanella", "OUT118 · ORD0098597 · 138 பெட்டிகள்", count "138 இல் 0". Then its first line, 40 "அரிசி, பருப்பு", whole, ending just above the bottom bar. The step measures the fold: the scroll offset is the one where no text is cut by the sticky header or the bar.
    - Bottom action bar: "383 பெட்டிகளில் 116 ஏற்றப்பட்டன" / `user` "Rizwan", bar at 30%.
    - The Sinhala column of the strings table is for the build. There is no Sinhala loader frame.
  - **LDR-02 Load vehicle / flag sent.** 2:48 AM, after "Flag 6 missing" on LDR-03. Nuwan opens the flag on his phone at 2:48. Differences from LDR-02 Load vehicle:
    - Chip row adds Status chip / Flag waiting, "1 flag waiting" (the two chips share one row).
    - Scrolled 41 px, so the taller Flag waiting line does not push tea and biscuit under the bar: that line ends at the top of the bar, the meta line has gone under the app bar and both chips stay whole just below it.
    - Stop 3 header count "36 of 102". Marker stays Next and the chip "Loading now".
    - The rice and dhal line becomes Flag waiting, 358 x 96: quantity "30" over "of 36", "Rice and dhal", "Stop 3 · Dry", "30 loaded, 6 missing", "Waiting for Nuwan", line button "View".
    - Packet foods is the line in progress: "6 of 44 on".
    - Bottom action bar: "122 of 383 cases loaded", bar at 32%.
  - **LDR-02 Load vehicle / answer in.** 2:52 AM. Nuwan has just answered. Rizwan is loading stop 3's packet foods, scrolled so the rice and dhal line is just off screen above. Differences:
    - Sticky header (108 to 156): marker "3" (Next), "Stop 3 · Hemmathagama", count "60 of 102".
    - Visible: 44 Packet foods, in progress "30 of 44 on"; 22 Tea and biscuit, To load; stop 2 header "Stop 2 · Mawanella", "OUT118 · ORD0098597 · 138 cases", "0 of 138", and its three lines; the stop 1 header's marker, title "Stop 1 · Kegalle" and count, with the marker ending flush with the top of the bar. The step measures the fold and adds top padding to the list (20 instead of 8 in the file) so that no line of text is cut by the bar; the meta line "OUT119 · ORD0098598 · 57 cases" and the tag line "Load last, by the doors" sit wholly under it.
    - Off screen above, for the build: the rice and dhal line is now Short decided and the title block chip "1 flag waiting" has become "6 short". A stop with a short stays expanded until handover.
    - Bottom action bar, from about y 692: Bar alert row, `circle-alert` 24, "Nuwan answered:" / "stop 3 rice and dhal", Button / secondary / compact "See answer". Then "146 of 383 cases loaded" / "Rizwan", bar at 38%.
  - **LDR-02 Load vehicle / all checked.** 3:30 AM. Every line is loaded or decided. Scrolled 75 px, so tea and biscuit ends 8 px above the bottom bar; the meta line and the chip row are under the app bar, and "6 short" reads in the bar. Differences:
    - Chip row (scrolled under the app bar): "Plan changed 9:12 PM", "6 short".
    - Hint: `check` 24 `done-strong`, "All 12 lines are done. Go to handover and check the totals with Kasun."
    - Stop 4: collapsed, "All 86 cases loaded", "Was stop 3 until 9:12 PM".
    - Stop 3: expanded, Done with short: marker "3" (Short), "Stop 3 · Hemmathagama", "OUT117 · ORD0098595 · 102 cases", "Was stop 4 until 9:12 PM", count "96 of 102". Lines: Rice and dhal as Short decided ("30" over "of 36", "30 loaded, 6 short", "6 come on Thursday", "View"); 44 Packet foods, Checked; 22 Tea and biscuit, Checked.
    - Stop 2: collapsed, "All 138 cases loaded". Stop 1: collapsed, "All 57 cases loaded".
    - Bottom action bar: "377 of 383 cases loaded" then `package-x` 16 "6 short" in Label SemiBold `attention-strong`, and "Rizwan"; Load progress bar / complete with short; then Button / primary / field, `handshake` 24, "Go to handover".
  - Not framed, for the build:
    - **Counting part of a line on.** Tapping a line still checks it whole. Press and hold a line to open a stepper sheet, "How many are on?", with the same stepper as LDR-03; loaders use it when a line goes on in several trips from the shelf. The count shows as the line in progress ("30 of 36 on") and adds to the stop count and the bar. When a line in progress is flagged, the flag sheet opens with the rest already filled in as missing.
    - **Collapse rule.** A finished stop stays expanded while the loader works, so the list never jumps under a gloved finger. It collapses when he touches a line in the next stop, with the scroll anchored to that line, or after 10 seconds with no touch on the screen. That is why stop 4 is collapsed at 2:47. A stop with a flag or a short never collapses by itself.
    - **Plan change during loading.** If Nuwan changes the load while it is open, the Bar alert row reads, for example, "Nuwan changed this load. 2 lines to check." with "Show me", which scrolls to the first affected line. Only the affected lines change, to Load line / changed. No mid-load change happens in the story.
- **Language strings** (every string on LDR-02 and its states that a loader reads). Latin values (IDs, people's names, outlet names, numbers) stay in Atkinson. Both scripts need a check by a native reader before the build freezes. The Tamil column is built on LDR-02 Load vehicle / Tamil where marked.

| Where | English | Sinhala (Yaldevi) | Tamil (Noto Sans Tamil) |
|---|---|---|---|
| App bar, title (built) | VEH045 trip 1 | VEH045 ගමන 1 | VEH045 பயணம் 1 |
| App bar, back, accessible label (built) | Back to tonight's loads | අද රෑ පටවන වාහන වෙත ආපසු | இன்றிரவு ஏற்றும் வாகனங்களுக்குத் திரும்பு |
| App bar, sync pill (built) | All synced | සියල්ල යැවුණා | அனைத்தும் அனுப்பப்பட்டது |
| App bar, language button, accessible label | Language | භාෂාව | மொழி |
| Header, meta | Kasun Bandara · Dry-box truck · Leaves 3:40 AM | Kasun Bandara · වියළි බඩු ලොරිය · පෙ.ව. 3:40ට පිටත් වේ | Kasun Bandara · உலர் பொருள் லொறி · காலை 3:40க்கு புறப்படும் |
| Header, chip | Plan changed 9:12 PM | ප.ව. 9:12ට සැලසුම වෙනස් විය | இரவு 9:12க்கு திட்டம் மாறியது |
| Header, chip | 1 flag waiting | දැනුම්දීම් 1ක් පිළිතුරු බලාපොරොත්තුවෙන් | 1 புகார் பதிலுக்குக் காத்திருக்கிறது |
| Header, chip | 6 short | 6ක් අඩුයි | 6 குறைவு |
| Hint | Work down this list. Stop 4 goes in first, at the cab end. Stop 1 goes in last, by the doors. Tap a line when all its cases are on the truck. | මේ ලැයිස්තුවේ පිළිවෙළට පටවන්න. නැවතුම 4 මුලින්ම, කැබින් පැත්තට. නැවතුම 1 අන්තිමට, දොර ළඟ. පේළියක සියලු පෙට්ටි ලොරියට දැමූ පසු එය ඔබන්න. | இந்தப் பட்டியலின் வரிசைப்படி ஏற்றவும். நிறுத்தம் 4 முதலில், ஓட்டுநர் அறைப் பக்கம். நிறுத்தம் 1 கடைசியாக, கதவருகில். ஒரு வரியின் எல்லாப் பெட்டிகளும் லொறியில் ஏறியதும் அதைத் தட்டவும். |
| Stop group, title | Stop 4 · Aranayake | නැවතුම 4 · Aranayake | நிறுத்தம் 4 · Aranayake |
| Stop group, title (built) | Stop 3 · Hemmathagama | නැවතුම 3 · Hemmathagama | நிறுத்தம் 3 · Hemmathagama |
| Stop group, title (built) | Stop 2 · Mawanella | නැවතුම 2 · Mawanella | நிறுத்தம் 2 · Mawanella |
| Stop group, title | Stop 1 · Kegalle | නැවතුම 1 · Kegalle | நிறுத்தம் 1 · Kegalle |
| Stop group, meta | OUT117 · ORD0098595 · 102 cases | OUT117 · ORD0098595 · පෙට්ටි 102 | OUT117 · ORD0098595 · 102 பெட்டிகள் |
| Stop group, meta (built) | OUT118 · ORD0098597 · 138 cases | OUT118 · ORD0098597 · පෙට්ටි 138 | OUT118 · ORD0098597 · 138 பெட்டிகள் |
| Stop group, result | All 86 cases loaded | පෙට්ටි 86ම පටවා ඇත | 86 பெட்டிகளும் ஏற்றப்பட்டன |
| Stop group, moved tag | Was stop 3 until 9:12 PM | ප.ව. 9:12 දක්වා නැවතුම 3 විය | இரவு 9:12 வரை நிறுத்தம் 3 ஆக இருந்தது |
| Stop group, moved tag | Was stop 4 until 9:12 PM | ප.ව. 9:12 දක්වා නැවතුම 4 විය | இரவு 9:12 வரை நிறுத்தம் 4 ஆக இருந்தது |
| Stop group, chip | Loading now | දැන් පටවමින් | இப்போது ஏற்றப்படுகிறது |
| Stop group, count (built) | 30 of 102 | 102න් 30 | 102 இல் 30 |
| Stop group, count (built) | 0 of 138 | 138න් 0 | 138 இல் 0 |
| Stop group, position tag | Load first, at the cab end | මුලින්ම පටවන්න, කැබින් පැත්තට | முதலில் ஏற்றவும், ஓட்டுநர் அறைப் பக்கம் |
| Stop group, position tag | Load last, by the doors | අන්තිමට පටවන්න, දොර ළඟ | கடைசியாக ஏற்றவும், கதவருகில் |
| Load line, item (built) | Rice and dhal | හාල්, පරිප්පු | அரிசி, பருப்பு |
| Load line, item (built) | Packet foods | පැකට් කෑම | பக்கெட் உணவுகள் |
| Load line, item (built) | Tea and biscuit | තේ, බිස්කට් | தேயிலை, பிஸ்கட் |
| Load line, status (built) | Stop 3 · Dry | නැවතුම 3 · වියළි | நிறுத்தம் 3 · உலர் |
| Load line, in progress (built) | 30 of 36 on | 36න් 30ක් පටවා ඇත | 36 இல் 30 ஏறியது |
| Load line, status | Loaded | පටවා ඇත | ஏற்றப்பட்டது |
| Load line, status | 30 loaded, 6 missing | 30ක් පටවා ඇත, 6ක් නැහැ | 30 ஏற்றப்பட்டது, 6 காணவில்லை |
| Load line, status | Waiting for Nuwan | Nuwan ගේ පිළිතුර එනතුරු | Nuwan இன் பதிலுக்குக் காத்திருக்கிறது |
| Load line, status | 30 loaded, 6 short | 30ක් පටවා ඇත, 6ක් අඩුයි | 30 ஏற்றப்பட்டது, 6 குறைவு |
| Load line, status | 6 come on Thursday | 6ක් බ්‍රහස්පතින්දා එයි | 6 வியாழன் அன்று வரும் |
| Load line, button (built) | Flag | දන්වන්න | புகாரளி |
| Load line, button | View | බලන්න | பார்க்க |
| Bottom bar, progress (built) | 116 of 383 cases loaded | පෙට්ටි 383න් 116ක් පටවා ඇත | 383 பெட்டிகளில் 116 ஏற்றப்பட்டன |
| Bar alert row | Nuwan answered: stop 3 rice and dhal | Nuwan පිළිතුරු දුන්නා: නැවතුම 3 හාල්, පරිප්පු | Nuwan பதில் அளித்தார்: நிறுத்தம் 3 அரிசி, பருப்பு |
| Bar alert row, button | See answer | පිළිතුර බලන්න | பதிலைப் பார்க்க |
| Primary button | Go to handover | භාරදීමට යන්න | ஒப்படைப்புக்குச் செல்லவும் |

  Word choices for the native readers: the hint should mean "load in the order of this list", not "load from above". "කැබින් පැත්තට" and "ஓட்டுநர் அறைப் பக்கம்" mean "toward the driver's cab". Case type names use everyday shop words: "හාල්, පරිප්පු" and "அரிசி, பருப்பு" (rice, dhal), "පැකට් කෑම" and "பக்கெட் உணவுகள்" (packet food), "තේ, බිස්කට්" and "தேயிலை, பிஸ்கட்" (tea, biscuits; தேயிலை is packed tea, not the drink). "Dry" is "වියළි" and "உலர்", as in dry goods. "Missing" is "නැහැ" and "காணவில்லை" (not there), kept apart from "short", "අඩුයි" and "குறைவு", used once Nuwan has decided. "Dry-box truck" is written as a dry goods lorry, "වියළි බඩු ලොරිය" and "உலர் பொருள் லொறி". On the built Tamil frame, status line 1 breaks before "உலர்" and stop titles put the place name on its own line, because the " · " form does not fit the column.
- **Prototype:**
  - Back: go to "LDR-01 Tonight's loads". Language button: go to "LDR-02 Load vehicle / Language".
  - Stop 3, Rice and dhal, "Flag": go to "LDR-03 Flag a shortfall".
  - Any other load line: interactive component, tap changes To load to Checked and back. Stop 4's card expands and its header collapses it (interactive part).
  - On "LDR-02 Load vehicle / Language": "தமிழ்" goes to "LDR-02 Load vehicle / Tamil". "English", Close and the scrim go to "LDR-02 Load vehicle". "සිංහල" has no target (the Sinhala layout is shown in DRV-01 Today's run / Sinhala).
  - On "LDR-02 Load vehicle / Tamil": the Language button goes to "LDR-02 Load vehicle / Language". The rice and dhal "புகாரளி" goes to "LDR-03 Flag a shortfall" (the prototype carries on in English). Back goes to "LDR-01 Tonight's loads".
  - On "LDR-02 Load vehicle / flag sent": after 2,000 ms, go to "LDR-02 Load vehicle / answer in". Back goes to "LDR-01 Tonight's loads".
  - On "LDR-02 Load vehicle / answer in": "See answer" goes to "LDR-03 Flag a shortfall / decision". Back goes to "LDR-01 Tonight's loads".
  - On "LDR-02 Load vehicle / all checked": "Go to handover" goes to "LDR-04 Handover / ready". The rice and dhal row and its "View" go to "LDR-03 Flag a shortfall / decision". Back goes to "LDR-01 Tonight's loads".
- **Rationale:** Loading order is unloading order backwards, so the list runs from stop 4 down to stop 1 and starts with what goes in at the cab end. Within a stop the heaviest case type leads, so rice and dhal sit at the bottom. The two stops Nuwan swapped at 9:12 PM are marked, so nobody falls back on the old sheet. Each line checks with one gloved tap and names its stop, the line in progress shows how many of its cases are on, and the stop header stays pinned while the list scrolls. Flag is a separate button, so a check is never read as a problem. Each loader reads the list in Tamil, Sinhala or English.

---

## LDR-02 Load vehicle / tablet

- **Frame:** `LDR-02 Load vehicle / tablet`, tablet 1024 x 768 landscape, fill `asphalt-50`. Snapshot 2:47 AM, the same moment and data as LDR-02 Load vehicle, on the shared dock tablet.
- **Purpose:** Show the same loading job on the dock tablet, readable from a step away, with the truck's loading order drawn as a picture and the vehicle, loader and progress always in view.
- **Layout:**
  1. System status bar, 1024 x 24.
  2. Top bar / tablet header, 1024 x 64, padding 6 24 6 12, gap 12: back button (accessible label "Back to tonight's loads"); title stack (title in Heading 1, meta in Label `asphalt-700`); spacer; Loader bar / tablet (Button / secondary / compact, `user` 24, name, `chevron-down` 24); Sync pill; Language button.
  3. Body, padding 24, gap 24.
     - 3a. Control column, 320 wide, fill `white`, 1 px `asphalt-200`, radius 12, padding 16, gap 16, fixed: chip row; "Load map" in Heading 3 with "Cab end at the top, doors at the bottom." in Caption; Load map (2 px `asphalt-300` border, radius 12, padding 8, gap 4): "Cab end" label, one 56 high band per stop, cab end first, padding 0 8, gap 8, the stroke kept out of the layout (Stop marker 32, place in Body SemiBold, `refresh-cw` 20 `attention-strong` right after the place where the stop moved at 9:12 PM, accessible label "Moved at 9:12 PM", spacer, count in Label, right aligned and at least 8 px after the icon; Loaded: `done-soft` with 1 px `done-strong` and `check` 20; Loading now: `white` with 2 px `signal-400`; To load: `asphalt-100`), "Doors" label; progress block anchored at the bottom (progress row, then bar 288 x 8).
     - 3b. Line column, vertical scroll, gap 16: hint row, then the stop groups as on the phone, set larger: stop titles in Heading 1, counts in Heading 3, load lines 632 wide, min 72 high, 32 icon in the check slot, quantity in Display, item names 24/32 SemiBold, status lines in Body, line button min 104 wide. The line in progress is 94 high.
- **Content:**
  - Status bar "2:47". Title "VEH045 trip 1". Meta "Kasun Bandara · Dry-box truck · Leaves 3:40 AM". Loader button "Rizwan". "All synced".
  - Chip: "Plan changed 9:12 PM".
  - Load map: "Cab end". Bands: "4" "Aranayake" moved "86 of 86" (Loaded). "3" "Hemmathagama" moved "30 of 102" (Loading now). "2" "Mawanella" "0 of 138" (To load). "1" "Kegalle" "0 of 57" (To load). "Doors".
  - Progress: "116 of 383 cases loaded" / "3 of 12 lines", bar at 30%.
  - Hint and stop groups: identical strings to LDR-02 Load vehicle, with the stop 4 card collapsed ("All 86 cases loaded", "Was stop 3 until 9:12 PM").
- **States:** none framed. For the build: from 768 px wide and up the screen uses this two-column layout; below 768 it is the phone layout. Flag a shortfall, Language and the loader button's PIN switch open as bottom sheets 560 wide, centered. The Bar alert row appears at the top of the control column, 288 wide.
- **Prototype:** standalone frame, not part of the "Loader flow" flow. Each Load map band scrolls the line column to that stop's header (Scroll to, 300 ms, ease out). Load lines toggle as interactive components.
- **Rationale:** The dock tablet is mounted near the bays and read from a step away, so the landscape layout splits the job in two. On the left, a load map draws the truck from cab to doors with each stop as a band, which shows the loading order as a picture rather than a rule to remember. On the right are the same lines, buttons and flags as the phone, set larger: 24 pixel item names, 32 pixel quantities and 72 pixel rows. A loader who learned one can use the other. The vehicle, the signed-in loader and the progress stay fixed and always in view.

---

## LDR-03 Flag a shortfall

- **Frame:** `LDR-03 Flag a shortfall`, phone 390 x 844. Snapshot 2:47 AM. The shelf held only 30 of the 36 rice and dhal cases for ORD0098595, and all 30 are on the truck. Rizwan taps Flag on that line. LDR-02 Load vehicle sits behind the scrim.
- **Purpose:** Record a missing or damaged line in two taps, get it to the dispatcher before the truck leaves, and keep loading while he decides.
- **Layout:** Sheet / bottom sheet, gap 16:
  - Header row, top aligned: title in Heading 2; meta line 1 in Label `asphalt-700`; meta line 2, `package` 16 plus Label `asphalt-700`; Close button.
  - Field group: "What is wrong?" in Label `asphalt-700`; Input / segmented control / field, two 64 high segments, icon 24 plus Field button text. Selected: `petrol-50`, 2 px `petrol-700`.
  - Field group: "How many are missing?"; Input / number stepper / field (64 x 64 minus and plus, value box with the value in Display and "of 36" in Label); helper in Body `asphalt-700`.
  - Info row: `info` 24, text in Body `asphalt-700`.
  - Button / primary / field, `send` 24.
  - No photo button while Missing is selected: there is nothing to photograph when a case is not there.
- **Content:**
  - Title "Rice and dhal, stop 3". Meta "Hemmathagama · OUT117 · ORD0098595" / "Dry · 36 planned".
  - "What is wrong?": "Missing" (`package-x`, selected), "Damaged" (`triangle-alert`).
  - "How many are missing?": "6" "of 36". Helper: "Only 30 were on the shelf. All 30 are on the truck."
  - Info: "Keep loading. Nuwan Perera, the dispatcher on duty, sees this straight away and decides about the other 6."
  - Button: "Flag 6 missing".
  - The sheet opens with Missing selected and the value filled in from the line in progress: 36 planned minus the 30 counted on.
- **States:**
  - **LDR-03 Flag a shortfall / decision.** 2:52 AM. Behind the scrim: LDR-02 Load vehicle / answer in. Sheet, gap 16:
    1. Header: "Rice and dhal, stop 3" / "Hemmathagama · OUT117 · ORD0098595", Close.
    2. Your flag row, fill `asphalt-50`, 1 px `asphalt-200`, radius 12: `package-x` 24 `attention-strong`, "6 missing" in Heading 3, "Sent by Mohamed Rizwan at 2:47 AM" in Label.
    3. Dispatcher decision card / answered, fill `attention-soft`, 1 px `attention-strong`, radius 12, padding 16, gap 8: "Nuwan Perera answered at 2:52 AM" (Caption); "Send short, add to Thursday" (Heading 2); "Keep the 30 on the truck. The 6 missing cases are added to Hemmathagama's Thursday dry order, ORD0098747, marked from Wednesday." (Body); divider; consequence rows with icon 24: `message-square` "A notice has gone to Dilani Jayawardena at the store.", `route` "Kasun's run sheet now shows 96 cases for stop 3.", `clipboard-list` "This goes on the handover record."
    4. Button / primary / field, `check` 24, "Back to loading".
  - Not framed, for the build:
    - With Damaged selected: "How many are damaged?", helper "Damaged cases stay off the truck.", Button / secondary / field `camera` "Add a photo" (a photo is expected for damage), and the button reads "Flag 6 damaged".
    - If the dispatcher answers "Swap from" another vehicle, the decision card names the vehicle and the line stays To load until the swapped cases are checked on.
    - **If the flag cannot be sent.** A flag saves on the tablet first. If it has not reached Relay after 60 seconds, the sync pill shows offline with count and line 3 of the flagged line reads `cloud-off` 16 plus "Not sent yet" in `asphalt-700`. Reopened from View, the sheet adds Button / secondary / field, `phone` 24, "Call Nuwan at dispatch", which shows the dispatch number in Display size, because the tablet cannot place calls.
    - **If Nuwan has not answered.** 15 minutes before departure (3:25 AM for VEH045), line 3 turns to `problem-strong` with `circle-alert` 16, "No answer yet", and the Bar alert row, in `problem-soft`, reads "No answer from Nuwan. Call before 3:40 AM." with "Call Nuwan".
- **Prototype:**
  - "Flag 6 missing" goes to "LDR-02 Load vehicle / flag sent". Close and the scrim go to "LDR-02 Load vehicle".
  - On the decision state, "Back to loading" and Close go to "LDR-02 Load vehicle / all checked". The prototype jumps to 3:30 AM here; the demo narration says so.
- **Rationale:** At 2:47 AM, 53 minutes before VEH045 leaves, Rizwan finds 30 rice and dhal cases on the shelf where there should be 36. Without Relay he would tell Kasun at the gate and hope the message reached Hemmathagama. Here the line already counts 30 on, so the sheet opens at 6 missing and it takes two taps: Flag, send. There is nothing to type and no photo to take of a case that is not there. Loading goes on, because the rest of stop 3 and stops 2 and 1 load in on top. At 2:52 AM Nuwan's answer comes back to the same place: send short, the 6 go on Hemmathagama's Thursday order, and the store has been told. Rizwan never has to phone anyone.

---

## LDR-04 Handover

- **Frame:** `LDR-04 Handover`, phone 390 wide, full length (1,334 high; a top-level frame taller than the device scrolls in the prototype). The status bar, app bar and bottom action bar are fixed while the content scrolls: the content is the bottom layer and the bars above it are fixed children, with the bottom bar pinned to the foot of the device. Snapshot 3:32 AM. Rizwan marked the load complete and Kasun Bandara accepted it on his phone. VEH045 leaves at 3:40 AM.
- **Purpose:** Give the loader and the driver one record of what is short and why, and what was planned against what was loaded, confirmed by both of them before the truck leaves.
- **Layout:**
  1. System status bar and App bar / back.
  2. Content, padding 16 16 24, gap 16. The difference comes first, then the totals.
     - Title block: "Handover" in Heading 1, meta in Body `asphalt-700`.
     - Notice / done: `circle-check` 24, title, body.
     - "Shortfall" in Heading 2, then Dispatcher decision card / record, fill `white`, 1 px `attention-strong`, radius 12, padding 16, gap 8: header row (`package-x` 24, the stop in Heading 3, Status chip / Short "Send short"), one Body line, three Label `asphalt-700` lines.
     - "Planned and loaded" in Heading 2 with "In stop order, the way Kasun unloads" in Caption, then the Handover table, radius 12, clipping its rows. Rows have 12 px side padding. Columns, measured so every row shares them: Stop 154 (marker 32, gap 8, place in Body SemiBold), Planned 45 (right), Loaded 135 (a 40 wide right-aligned number, then the check or the Short chip). Header row 40 high in Caption `asphalt-500`; stop rows 64 high; the short row has fill `attention-soft`; total row fill `asphalt-50`, the three cells in Heading 3, then weight and volume in Caption `asphalt-700` on two lines.
     - "Sign-off" in Heading 2, then a card with two Sign-off rows, 64 high: icon 24, text in Body, time in Label SemiBold with `check` 16 `done-strong`.
  3. Bottom action bar: Button / primary / field.
- **Content:**
  - Status bar "3:32". App bar "VEH045 trip 1", "All synced".
  - "Handover" / "Kasun Bandara · Leaves 3:40 AM".
  - Notice: "Kasun accepted the load" / "On his phone at 3:32 AM. You marked it complete at 3:32 AM."
  - Shortfall: "Stop 3 · Hemmathagama", chip "Send short". "6 rice and dhal cases missing from ORD0098595." / "Flagged by Mohamed Rizwan at 2:47 AM." / "Nuwan Perera decided at 2:52 AM: send short, add to Thursday's order ORD0098747." / "A notice went to Dilani Jayawardena at 2:52 AM."
  - Table header: "Stop", "Planned", "Loaded". Rows:

| Stop | Planned | Loaded |
|---|---|---|
| Marker "1" (Done), "Kegalle" | "57" | "57" with check |
| Marker "2" (Done), "Mawanella" | "138" | "138" with check |
| Marker "3" (Short), "Hemmathagama" (row fill `attention-soft`) | "102" | "96" with chip "6 short" (chip fill `white` on this row, so it keeps an edge) |
| Marker "4" (Done), "Aranayake" | "86" | "86" with check |
| "Total cases" | "383" | "377" |

  - Total row caption: "Weight 2,470.8 of 2,530.8 kg planned" / "Volume 13.864 of 14.104 m³ planned".
  - Sign-off: `user` "Loaded by Mohamed Rizwan" "3:32 AM" with check; `truck` "Accepted by Kasun Bandara" "3:32 AM" with check.
  - Bottom action bar: "Back to tonight's loads".
- **States:**
  - **LDR-04 Handover / ready.** 3:31 AM (1,380 high), opened from "Go to handover". Back button accessible label "Back to the load list". Notice / info: "Ready to hand over" / "Check these totals with Kasun, then mark the load complete. He accepts it on his phone." Sign-off rows: "Loaded by Mohamed Rizwan" with "Not sent", "Kasun accepts on his phone" with "Not yet", both in Label `asphalt-500`. Bottom action bar: caption "Sends the handover to Kasun's phone." then Button / primary / field, `package-check` 24, "Load complete".
  - **LDR-04 Handover / waiting for driver.** 3:32 AM (1,420 high), straight after Load complete. Notice / waiting with its button: `clock` 24, "Waiting for Kasun to accept" / "Sent to his phone at 3:32 AM. If his phone has no signal, he can accept here with his own PIN.", Button / secondary / field, `pen-line` 24, "Kasun accepts on this tablet". Sign-off row 2: "Kasun accepts on his phone" with `clock` 16 and "Waiting". Bottom action bar: Button / secondary / field "Back to tonight's loads".
  - Not framed, for the build:
    - **If Kasun's phone does not answer.** After 60 seconds, the notice becomes Notice / attention, `circle-alert` 24, "Kasun's phone has not answered" / "It may have no signal or no data. He can accept here with his own PIN.", and "Kasun accepts on this tablet" moves to the bottom bar as the primary. It opens the PIN sheet from LDR-01 with Kasun Bandara as the only person and the title "Kasun, enter your PIN". Row 2 then reads "Accepted by Kasun Bandara on the dock tablet" with the time, and his phone receives the record when it reconnects.
    - If Kasun reports a difference instead of accepting, the notice becomes Notice / problem with his note, and the dispatcher sees it on DSP-04 Live runs.
- **Prototype:**
  - On ready: "Load complete" goes to waiting for driver. Back goes to "LDR-02 Load vehicle / all checked".
  - On waiting for driver: after 2,000 ms, go to "LDR-04 Handover" (Kasun accepts). "Back to tonight's loads" goes to "LDR-01 Tonight's loads".
  - On "LDR-04 Handover": "Back to tonight's loads" and Back go to "LDR-01 Tonight's loads". The shortfall card goes to "LDR-03 Flag a shortfall / decision". This is the end of the "Loader flow" flow.
- **Rationale:** A handover that both sides confirm replaces "I told him at the gate". The one difference comes first: 6 rice and dhal cases for Hemmathagama, with who flagged it, who decided and when the store was told. Below it, planned against loaded runs in stop order, the way Kasun will unload, so the two of them can check it together in under a minute. Load complete sends it to Kasun's phone, and his acceptance comes back with a time. If his phone has no signal, he accepts on the dock tablet with his own PIN, so a dead phone never holds a truck at the gate.

---

## Loader prototype parts (10 Style Guide page)

Two interactive component sets, used as instances on the screens:
- **Notice / plan change**, variants Visible and Dismissed (no height). The LDR-01 banner; dismiss changes it to Dismissed so the cards move up.
- **Stop group / stop 4**, variants Collapsed (the Done card, "Stop 4 · Aranayake", "All 86 cases loaded", "Was stop 3 until 9:12 PM") and Expanded (the header with "OUT116 · ORD0098593 · 86 cases", "Load first, at the cab end", "86 of 86", and its three Checked lines: 30 Rice and dhal, 32 Packet foods, 24 Tea and biscuit). Tap the card to expand, the header to collapse.

## Components needed

Reused as they are from the driver spec: Top bar / phone header with sync pill (root and back), Sync pill, Button / quiet / icon only (back, close, lock, expand, Language), Choice row / field / option, Sheet / bottom sheet.

| Component | Variants | Used in |
|---|---|---|
| Vehicle load card | Not started, Loading, Ready (with completion time), Short, In the workshop; Plan changed modifier; second-trip caption | LDR-01, LDR-01 / PIN switch |
| Departed card | One row per departure time: time, district, vehicles | LDR-01 |
| Status chip, loader variants | Not started, Loading ("Loading" or "Loading now"), Ready, Plan changed, Flag waiting, Short (count or decision label), In the workshop; Chilled | Every loader frame |
| Loader bar | Phone strip, 56 high; tablet compact button | LDR-01, LDR-01 / PIN switch, LDR-02 / tablet |
| Loader picker | Person button, selected and unselected; single-person variant for a driver accepting a handover (build only) | LDR-01 / PIN switch |
| Input / PIN pad / field | Keys 114 x 64: digit, Delete, empty; PIN dots: empty, filled, error | LDR-01 / PIN switch |
| Top bar, loader variants | Root with depot and date plus Language; back with a Heading 3 title plus Language, title wraps and the bar grows; tablet header | Every loader frame |
| Stop marker, loader states | Done, numbered; Short (added to the shared Next, Pending, Delivered, Failed) | LDR-02 all states, tablet, LDR-04 |
| Stop group header | Loading now, To load, Done collapsed, Done with short, Sticky (phone 390 x 48, grows in Tamil; tablet 632 x 56); moved tag; position tag | LDR-02 all states, tablet |
| Load line | To load, Checked, Flag waiting, Short decided, Flagged damaged, Changed (build only); Chilled and Dry modifiers; line in progress; phone and tablet sizes | LDR-02 all states, tablet |
| Load progress bar | In progress, Complete, Complete with short; 8 px and 6 px | LDR-01, LDR-02 all states, tablet |
| Bottom action bar, loader variants | Progress only; progress plus primary; Bar alert row plus progress; caption plus primary; primary only; secondary only | LDR-02 phone states, LDR-04 |
| Bar alert row | Attention: answer in, load changed (build only); Problem: no answer yet (build only) | LDR-02 / answer in |
| Input / segmented control / field | Two segments, 64 high | LDR-03 |
| Input / number stepper / field | 64 x 64 buttons, Display value with "of N" | LDR-03 |
| Dispatcher decision card | Answered (with consequence rows); Record | LDR-03 / decision, LDR-04 |
| Notice, loader tones | Attention with dismiss; Info; Done; Waiting with button | LDR-01, LDR-04 |
| Handover table | Header row, stop row, short row, total row with weight and volume | LDR-04 all states |
| Sign-off row | Done with time, Waiting, Not yet; accepted on the dock tablet (build only) | LDR-04 all states |
| Load map | Band: To load, Loading now, Loaded, Loaded with short; moved marker; cab and doors labels | LDR-02 / tablet |

## Facts and derived values

From `05-scenario-data.md` v0.4 (copied as given): the people and their roles; VEH045 (ambient dry-box truck, Kasun Bandara, planned to leave 3:40 AM); the four stops and their orders and case mixes (OUT116 ORD0098593 30/32/24, 86 cases; OUT117 ORD0098595 36/44/22, 102; OUT118 ORD0098597 40/58/40, 138; OUT119 ORD0098598 23/20/14, 57); stop order before 9:12 PM (Aranayake 3, Hemmathagama 4); 383 cases, 2,530.8 kg and 14.104 m³ planned; 377 cases, 2,470.8 kg and 13.864 m³ loaded; the loading table (0 at 2:20, 86 at 2:40, 116 at 2:47, 122 at 2:48, 146 at 2:52, 377 at 3:30, handover ready 3:31, Load complete and acceptance 3:32); the PIN story (Rizwan 2:18, Anjali 2:36, switch back 2:40); tonight's loads at 2:40 (additional fact 21) and the banner; the shortfall and decision (2:47, 2:48, 2:52, ORD0098747 marked from Wednesday); the quiet-hours notice; the workshop vehicles back on Thursday 9 April; the trips table's planned back times (VEH059 5:16, VEH057 6:02, VEH042 6:16).

Derived here, each following directly from the scenario:
1. **15 loads** on LDR-01: 7 already left + 2 ready + 2 loading + 4 still to load, the 15 Fresh trips in the Kandy plan (the other 3 trips are daytime Style and Tech runs).
2. **12 lines** on VEH045: 4 stops x 3 case types. At 2:47, **3 of 12 lines** are checked (stop 4's three).
3. **Stop 3's count** is its cases on the truck: 30 at 2:47 (the rice and dhal on the shelf), 36 at 2:48 and 60 at 2:52 (the loading table's 122 and 146, minus stop 4's 86 and the 30), 96 at 3:30.
4. **Packet foods is the line in progress** after the flag ("6 of 44 on" at 2:48, "30 of 44 on" at 2:52), by the heaviest-first rule: after rice and dhal comes packet foods.
5. **The flag sheet's 6** is 36 planned minus the 30 counted on.
6. **53 minutes** between the flag (2:47) and VEH045's planned departure (3:40).
7. **Progress bar shares:** 86 of 383 (22%), 40 of 118 (34%), 116 of 383 (30%), 122 of 383 (32%), 146 of 383 (38%), and 377 done with 6 short at 3:30.
8. Trip lines on LDR-01 (district, stops, cases) are the trips table's rows for each vehicle and trip.

Design additions in this version (not data): the line in progress on the Load line, the press-and-hold count sheet (build note), the flag sheet prefilled from the line's count, and the Departed card.

## Open questions

1. **Counting part of a line on.** The scenario's counts between whole lines (122 at 2:48, 146 at 2:52) need the line in progress. The team should confirm the press-and-hold count sheet as the way loaders set it, or name another input, before the Hackathon build.
2. **Native readers.** The Tamil column (built on the Tamil frame) and the Sinhala column (build only) need a check by native readers, in particular the new case type names and "உலர்" / "වියළි" for dry.

## Earlier review decisions still in force

Kept as history, without the old story's data. Where a decision names a number, the number is the v0.4 one above.
- Loading starts with the stop that goes in at the cab end; the flag loads what is there and the line then waits for the dispatcher; the heaviest-first rule is shown on screen.
- The Tamil frame replaced a Sinhala loader frame, so the two field roles show all three languages. The back header's title is the vehicle ID, which is never dropped: in Tamil it wraps and the bar grows.
- The Language button is the driver's icon-only button. The loader's back header uses a Heading 3 title because it also carries the Language button.
- Outlet names stay in Latin letters on loader screens (they are matched against English case labels), as a stated rule in `components.md`.
- The sticky header uses the 32 px Stop marker; status line 1 keeps the temperature word next to the stop.
- Dock fallbacks: the driver-offline path is the "Kasun accepts on this tablet" button in the 3:32 AM waiting frame plus a 60-second build note, so the single story holds (Kasun accepts on his phone at 3:32). "Not sent yet" uses the waiting treatment; it escalates to Problem 15 minutes before departure. "Call Nuwan" shows the number, because the tablet cannot place calls.
- The answer from Nuwan arrives in the bottom bar (LDR-02 / answer in) wherever the list is scrolled.
- The tablet keeps "N of 12 lines" in its progress row, because the signed-in name is already in its app bar.
- No disabled buttons: "Go to handover" appears only when every line is done.
- A finished stop also collapses after 10 seconds with no touch; stops with a flag or a short never collapse by themselves.
- A photo is asked for only for damage.
