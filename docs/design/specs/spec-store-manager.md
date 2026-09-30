# Store Manager Screens: Frame Spec (Relay, Team Ryzera)

> **v0.4 data alignment.** Every value in this spec now comes from `05-scenario-data.md` v0.4 (data aligned), and every frame is described as the Relay Builder draws it (`tools/figma-builder/steps/store-manager`). What changed from v0.3:
> - **Store and dates.** Dilani runs OUT117 Waypoint Fresh Hemmathagama (Kegalle district, rear dock, window 4:00 to 7:45 AM), not OUT057 Nawalapitiya. Planning is Tuesday 7 April 2026, delivery Wednesday 8 April, the catch-up run Thursday 9 April.
> - **Orders and case types.** Chilled order ORD0098596, placed 2:10 PM: 40 dairy crates, 32 produce crates, 20 meat and fish boxes (92 cases, 659.2 kg, 3.464 m³). Dry order ORD0098595, placed 2:14 PM: 36 rice and dhal cases, 44 packet foods cases, 22 tea and biscuit cases (102 cases, 685.6 kg, 3.772 m³). The four old case types (dairy crate, frozen box, produce crate, dry carton) are replaced by the scenario's six. On the phone and desktop, the dry cards come before the chilled cards, as Waypoint's order numbers do.
> - **The deferral is now the chilled order.** STM-03 moves ORD0098596 to Thursday 9 April, 4:00 to 7:45 AM; the dry order still comes Wednesday, expected around 7:15 AM. The reason is refrigerated capacity, told in store words: two refrigerated vehicles in the workshop, the one refrigerated van that can still reach her area has no room, another store in her area already waited on Monday (rule 2), and Thursday was checked first. The old "refrigerated vehicles take only small dry orders" line is gone.
> - **The shortfall.** 6 rice and dhal cases short on the dry order, added to her own Thursday dry order ORD0098747, marked from Wednesday. The separate order ORD0094705 is gone.
> - **Kasun's run.** VEH045, an ambient (dry-box) truck, Kegalle Fresh dry run, 4 stops. Dilani is stop 3 (Kegalle, Mawanella, then her store). Planned 5:30 AM, expected around 6:35 AM after the 9:12 PM swap (around 7:15 AM before it). Kasun left the Kandy hub at 3:44 AM.
> - **Frames.** New: STM-01 My orders / moved earlier (9:12 PM) and STM-05 Confirm receipt / before driver proof (6:42 AM). Dropped: STM-01 My orders / delivered, because Dilani now confirms receipt from the arrival tracker at 6:42 AM. STM-04 / past estimate moves from 6:30 to 6:40 AM and offers Confirm receipt. STM-05 / confirmed moves to 6:42 AM, before Kasun's proof; STM-05 at 7:22 AM is her receipt with his proof attached, and the flag branch adds an issue to that confirmed receipt. The "After delivery" flow now starts at STM-04 / past estimate.
> - **Words.** No store screen claims "no signal" or a low-signal area: Relay cannot tell a lost signal from a flat battery. The chip is "Estimate passed". STM-04 names both times, Planned and Expected, as every role does.
> - **Review fixes (this pass).** STM-05 says what Kasun's proof holds at stop 3: "Photo and location recorded at your store" (the receiver's name and a photo, no signature; stop 2 was the signed one). The section header dates the proof correctly: Dilani opens her receipt at 7:22 AM, and Kasun's proof joined it at 7:14 AM. The header and this spec name the flows as Figma lists them ("Store Manager flow", "Store Manager: Order not sent" ...); the store step now sets those names itself.
> - **History removed.** The v0.2 review notes, the v0.3 consistency pass and the old "New facts introduced" list described the October story. They are replaced by "Derived values" and "Cross-role agreements" below.

Frame-by-frame spec for the Store Manager role, written for the Figma build and for the Hackathon front end. Persona: Dilani Jayawardena, Store Manager at Waypoint Fresh Hemmathagama (OUT117), Kegalle district, served from the Kandy hub. The arrival tracker at 6:05 AM, while Kasun is silent, belongs to the degradation spec (DEG-04). Shared components are defined once in `components.md`.

## Screen set

22 frames: 21 phone frames at 390 x 844 and 1 desktop frame at 1440 x 900. Four are branches beside the main story: "STM-02 Place order / not sent" and the three flag frames on STM-05. Every other frame is one moment in Dilani's Tuesday and Wednesday.

| Frame | Size | Snapshot | What it shows |
|---|---|---|---|
| STM-02 Place order | Phone | Tue 7 Apr, 2:10 PM | Chilled order filled in: 40 dairy crates, 32 produce crates, 20 meat and fish boxes |
| STM-02 Place order / received | Phone | Tue 2:10 PM | "Received by Waypoint", ORD0098596, with the dry order as the next step |
| STM-02 Place order / desktop | Desktop | Tue 2:10 PM | The same chilled order from the back-office PC |
| STM-02 Place order / dry | Phone | Tue 2:14 PM | Dry order filled in: 36 rice and dhal, 44 packet foods, 22 tea and biscuit cases |
| STM-02 Place order / not sent | Phone | Tue 2:14 PM | Branch: the dry order with no connection, her counts are kept |
| STM-01 My orders / before cutoff | Phone | Tue 2:14 PM | Both orders received, 1 h 46 min to the cutoff |
| STM-03 Deferral notice | Phone | Tue 6:41 PM | Chilled order moved to Thursday, dry order still coming, the reason |
| STM-03 Deferral notice / acknowledged | Phone | Tue 6:41 PM | After "Got it" reaches Relay |
| STM-01 My orders | Phone | Tue 7:30 PM | Dry expected around 7:15 AM, chilled moved to Thursday |
| STM-02 Place order / after cutoff | Phone | Tue 7:30 PM | A new order now goes on Thursday's run; she sends nothing |
| STM-01 My orders / moved earlier | Phone | Tue 9:12 PM | Nuwan swaps stops 3 and 4: dry now expected around 6:35 AM |
| STM-03 Deferral notice / short delivery | Phone | Wed 8 Apr, 5:05 AM | Sent 2:52 AM: 6 rice and dhal cases short, added to Thursday's dry order |
| STM-01 My orders / on the way | Phone | Wed 5:20 AM | Dry order on the way, around 6:35 AM |
| STM-04 Arrival tracker | Phone | Wed 5:20 AM | Expected around 6:35 AM (planned 5:30), 1 stop before you, Kasun Bandara |
| STM-04 Arrival tracker / past estimate | Phone | Wed 6:40 AM | The 6:35 estimate has passed, no word from Kasun since 5:41 AM; Confirm receipt |
| STM-05 Confirm receipt / before driver proof | Phone | Wed 6:42 AM | She checks the 96 cases at her dock against what was loaded for her |
| STM-05 Confirm receipt / confirmed | Phone | Wed 6:42 AM | Receipt confirmed; driver's proof still waiting for Kasun's phone |
| STM-05 Confirm receipt | Phone | Wed 7:22 AM | Her receipt with Kasun's proof attached (sent at 7:14 AM) |
| STM-01 My orders / receipt confirmed | Phone | Wed 7:22 AM | Card closed out: confirmed at 6:42, proof in at 7:14 |
| STM-05 Confirm receipt / flag a line | Phone | Wed 7:22 AM | Branch: 1 packet foods case marked damaged |
| STM-05 Confirm receipt / issue added | Phone | Wed 7:22 AM | Branch: the flagged line, ready to send |
| STM-05 Confirm receipt / sent with issue | Phone | Wed 7:22 AM | Branch: the issue reaches the dispatcher with Kasun's proof |

The table is in story order, which is also the order of the states on the canvas. The spec below is in screen order.

### Canvas (as built)

- Section "Store Manager", 12,390 x 2,253, built at (0, 9600) and moved into story order by `prototype/20-canvas-layout.js`.
- Section header at (80, 80), 1640 wide: "Store Manager" in Doc heading; the persona, device and moment line in Doc lead; the flow line and the prototype note in Doc body.
- One row at y 596: the five phone main screens and the desktop frame (510 px pitch), then the sixteen states in story order, 200 px after the desktop frame. A group label in Heading 3 `asphalt-700` sits 120 above the row over each group: "Main screens and rationale" and "States, in story order".
- Full-length frames: a phone frame whose content scrolls runs its full height on the canvas (844 to 1,237), so every part can be read at 100%. In the prototype the status bar, header and bottom bar stay fixed while the content scrolls. "STM-05 Confirm receipt / flag a line" keeps the 844 viewport, because the scrim and sheet belong to it.
- Each main screen has "Rationale / <frame name>" 40 px below it, the same width (the desktop card lays its title block and text side by side). Each frame has "Caption / <frame name>" above it in Caption `asphalt-500`, clear of the 22 px where Figma draws frame names. Flow connectors between consecutive main phone screens carry the time of the next screen: "Tue 6:41 PM", "Tue 7:30 PM", "Wed 5:20 AM", "Wed 7:22 AM".
- Every text in the section keeps a time with its AM or PM, "4:00 to 7:45" together, a count with the word after it ("6 rice and dhal cases"), and never leaves one short word alone on a last line (no-break spaces).

### Shared conventions for every phone frame

- **Frame fill:** `asphalt-50`. Cards are `white` with a 1 px `asphalt-200` border and 12 radius. No shadows except on the bottom sheet (0 8 24, #14181F at 12%).
- **Type:** Atkinson Hyperlegible Next throughout, English only (decision 4 in `01-problem-framing.md`). Styles: Display 32/40 Bold, Heading 1 24/32 Bold, Heading 2 20/28 SemiBold, Heading 3 16/24 SemiBold, Body 15/22 Regular, Body strong 15/22 SemiBold, Label 13/18 Medium, Label strong 13/18 SemiBold, Caption 12/16 Medium, Button 15/22 SemiBold. Every button on a Store Manager screen uses Button. All times, quantities, kg, m³ and IDs use tabular figures.
- **Density:** the Store column of the style guide on every device. Buttons 48 high, list rows 56 or more, tap targets at least 44 x 44, body text 15.
- **Icons:** Lucide at 1.75 stroke. 24 px in the header, 20 px in content rows, 16 px inside chips and meta lines.
- **System status bar** (frame dressing): 390 x 44, fill `white`, padding 0 24, space between. Left: the snapshot time in Label strong `asphalt-900` (for example "7:30"). Right: signal and battery; `wifi-off` 16 when the frame shows her phone offline. Dilani's phone uses the store's Wi-Fi and stays connected all morning.
- **Top bar / phone header / home** (STM-01 only): 390 x 80, fill `white`, bottom border 1 px `asphalt-200`, padding 12 16. A vertical stack, gap 2: title in Heading 1 `asphalt-900` and the store line in Label `asphalt-700`, "Waypoint Fresh Hemmathagama, OUT117". No icon buttons; sign out sits in the account footer at the end of STM-01.
- **Top bar / phone header / back** (all other phone frames): 390 x 64, fill `white`, bottom border 1 px `asphalt-200`, padding 10 16 10 4, gap 4. Button / quiet / icon only 44 x 44 with `arrow-left` 24 (accessible label "Back"), then the title in Heading 1 `asphalt-900`.
- **Content region:** vertical auto layout, padding 16 16 24, gap 16, scrolls under the fixed header and, where there is one, the fixed bottom action bar.
- **Bottom action bar:** fill `white`, top border 1 px `asphalt-200`, padding 12 16, vertical gap 8, then a 34 px home-indicator area in `white` with a 134 x 5 `asphalt-900` bar, radius 3. Buttons are 358 x 48, radius 8, text in Button, never pill shaped. Heights, bar plus home indicator: one button 72 + 34 = 106. Caption and button 96 + 34 = 130. Two buttons, or a one-line notice and a button, 128 + 34 = 162. Totals and button 100 + 34 = 134. Totals, button and caption 124 + 34 = 158. Notice, totals and button about 176 + 34 = 210. STM-01 and STM-04 have no action bar; the home indicator floats over the content.
- **Order ID:** on every phone card the order ID leads the meta line, in Label `asphalt-500`, for example "ORD0098596. Placed 2:10 PM". It never sits in the chip row, so two chips always fit on one line; the chip row still wraps if a longer label ever appears.
- **Contents lists:** each item stays on one line ("20 meat and fish boxes"), so a list wraps between items, never inside one.
- **Sending (build rule for every action that sends):** Relay shows "Received by Waypoint", "Seen" or "Receipt confirmed" only once the server has the record. If her phone is offline, the screen keeps what she entered and shows the not-sent notice from "STM-02 Place order / not sent" with "Try again". This applies to "Send order", "Got it", "Everything arrived" and "Send 1 issue". For orders, Relay's receive time decides the run: an order that reaches Relay after 4:00 PM goes on the next run, and the confirmation says so.
- **Quiet hours (build rule):** notices sent between 10:00 PM and 5:00 AM arrive silently and wait on her lock screen. The 9:12 PM change rings; the 2:52 AM short-delivery notice waits until she opens it at 5:05 AM.
- **Two named times:** *Planned* is the published standard at free flow; *Expected* is Relay's model, rounded to 5 minutes on store screens ("Expected around 6:35 AM"). The store's cards lead with Expected, the time to roster staff around. STM-04 also names Planned, in quiet type; being behind Planned is normal in monsoon months and is never shown as a problem.

### Status language (one set across every store manager frame)

| Word on the chip | Chip | Tone | Icon |
|---|---|---|---|
| Chilled | Status chip / Chilled | `chilled-strong` text and icon on `chilled-soft` | `snowflake` |
| Dry | Status chip / Dry | `asphalt-700` on `asphalt-100` | `package` |
| Received by Waypoint | Status chip / Received | `asphalt-900` on `asphalt-100` | `clipboard-list` |
| Scheduled | Status chip / Scheduled | `asphalt-900` on `asphalt-100` | `calendar-clock` |
| On the way | Status chip / On the way | `asphalt-900` on `asphalt-100` | `truck` |
| Estimate passed | Status chip / waiting to send, label "Estimate passed" | `asphalt-700` text and icon on `waiting-soft`, 1 px `asphalt-300` border (the shared Waiting rule) | `history` |
| Delivered | Status chip / delivered (defined, not drawn on a store frame in v0.4) | `done-strong` on `done-soft` | `check` |
| Receipt confirmed | Status chip / Receipt confirmed | `done-strong` on `done-soft` | `circle-check` |
| Moved to Thursday | Status chip / deferred, label set per order | `attention-strong` on `attention-soft` | `clock` |
| 6 short | Status chip / Short (count label) | `attention-strong` on `attention-soft` | `package-x` |

`box` is kept for volume (m³) everywhere and never means Dry. A flagged receipt line is not a chip: it uses `problem-soft` with `triangle-alert` and "Flagged: 1 damaged" in `problem-strong`.

Rule: neutral gray while an order is moving normally, green only when it has arrived or been confirmed, amber when something changed, red only for a problem she reports. On any screen, the amber card is the one that needs her attention. When Relay has no word from the driver it says so in the Waiting style and never guesses the cause: the chip reads "Estimate passed", not "No signal". Status tokens are the Status table in the style guide.

Chips: 28 high, radius 6, padding 5 8, gap 4, Label text, 16 px icon.

---

## STM-01 My orders

- **Frame:** "STM-01 My orders", phone 390 x 844, full length 1,116 on the canvas. Snapshot: Tuesday 7 April 2026, 7:30 PM. The plan was published at 6:40 PM and Dilani saw the deferral notice at 6:41 PM. Nuwan's 9:12 PM swap has not happened yet, so Hemmathagama is still stop 4 on VEH045 and the dry order is expected around 7:15 AM.
- **Purpose:** Answer "is it coming, and when?" for each of tomorrow's orders, with the dry and chilled orders on separate cards so a moved order can never hide behind one that is on time.
- **Layout:**
  1. System status bar, 390 x 44.
  2. Top bar / phone header / home, 390 x 80.
  3. Content region, vertical, padding 16 16 24, gap 16. About 990 of content; in the prototype about 300 px scroll. The first view holds the section header, the dry card and the chilled card down to its reason.
     - 3a. Section header, 358 x 48, vertical, gap 2. Date label in Label `asphalt-700`, summary in Heading 2 `asphalt-900`.
     - 3b. Order card / scheduled (dry), 358 x about 243, fill `white`, 1 px `asphalt-200`, radius 12, vertical, padding 16, gap 12.
       - Chip row, horizontal, gap 8, wraps: Status chip / Dry, Status chip / Scheduled.
       - Headline block, vertical, gap 2: headline in Heading 2 `asphalt-900`, subline in Body `asphalt-700`.
       - Divider, 1 px `asphalt-200`, full card width.
       - Contents group, vertical, gap 4: contents in Body `asphalt-900` (two lines), meta line in Label `asphalt-500`.
       - Detail row, horizontal, gap 8: `truck` 16 in `asphalt-700`, text in Label `asphalt-700`.
     - 3c. Order card / moved (chilled), 358 x about 360, same shell, padding 16 16 4.
       - Chip row: Status chip / Chilled, Status chip / deferred labelled "Moved to Thursday".
       - Headline block as in 3b.
       - Reason: Notice / attention, compact inline, fill `attention-soft`, radius 8, horizontal, padding 12, gap 8, top aligned. `clock` 20 in `attention-strong`, text in Body `asphalt-900` (three lines).
       - Divider.
       - Contents group: contents in Body `asphalt-900` (two lines), meta line in Label `asphalt-500`.
       - Link row, 326 x 44, top border 1 px `asphalt-200`, horizontal, space between. Text in Label strong `petrol-700`, `chevron-right` 20 in `petrol-700`.
     - 3d. Cutoff line / next run, 358 x about 72, fill `white`, 1 px `asphalt-200`, radius 12, horizontal, padding 12 16, gap 12, top aligned. `timer` 20 in `asphalt-700` in a slot as tall as the first line, then a vertical text stack, gap 2: line 1 in Label `asphalt-900`, line 2 in Body `asphalt-700`.
     - 3e. Button / secondary / phone, 358 x 48, `plus` 20 leading. It sits 12 below the cutoff line, because the two belong together.
     - 3f. Account footer, 358 x 52, top border 1 px `asphalt-200`, padding 8 0 0, horizontal, space between. Left, gap 8: `user` 20 in `asphalt-700` and the name in Label `asphalt-700`. Right: Button / quiet / phone, 44 high, padding 0 12, `log-out` 20 plus Button text in `asphalt-900`.
- **Content:**
  - Status bar: "7:30"
  - Header: "My orders" / "Waypoint Fresh Hemmathagama, OUT117"
  - 3a: "Tomorrow, Wednesday 8 April" / "1 order coming, 1 moved to Thursday"
  - 3b, dry card:
    - Chips: "Dry", "Scheduled"
    - Headline: "Expected around 7:15 AM"
    - Subline: "Your window is 4:00 to 7:45 AM"
    - Contents: "36 rice and dhal cases, 44 packet foods cases, 22 tea and biscuit cases"
    - Meta: "ORD0098595. Placed 2:14 PM. Locked at 4:00 PM."
    - Detail row: "Dry-box truck VEH045, Kandy hub"
  - 3c, chilled card:
    - Chips: "Chilled", "Moved to Thursday"
    - Headline: "Now Thursday 9 April"
    - Subline: "Same window, 4:00 to 7:45 AM"
    - Reason: "Two of our refrigerated vehicles are in the workshop, and the one van still going to your area has no room for it."
    - Contents: "40 dairy crates, 32 produce crates, 20 meat and fish boxes"
    - Meta: "ORD0098596. Placed 2:10 PM. Locked at 4:00 PM."
    - Link row: "Read the notice"
  - 3d: "New orders now go on Thursday's run" / "Orders for Thursday close tomorrow at 4:00 PM"
  - 3e: "Place an order"
  - 3f: "Dilani Jayawardena" / "Sign out"
  - Empty state (not drawn, for the build): section header "Tomorrow, Wednesday 8 April" / "No orders yet", then Body `asphalt-700` "Orders for Wednesday close at 4:00 PM. Place one now and you'll get a confirmation straight away.", then the cutoff line and "Place an order" as Button / primary / phone. This is the only state in which "Place an order" is primary.
  - Card order rule: cards follow Waypoint's order numbers for the day, dry before chilled, in every state.
- **States:**
  - **STM-01 My orders / before cutoff.** Tuesday 7 April, 2:14 PM, just after the dry order is sent. Status bar "2:14". Full length 1,008.
    - 3a: "Tomorrow, Wednesday 8 April" / "Both orders received"
    - Dry card, Order card / received, about 258 high: chips "Dry", "Received by Waypoint". Headline "Wednesday, 4:00 to 7:45 AM". Subline "Delivery time shows here this evening". Contents "36 rice and dhal cases, 44 packet foods cases, 22 tea and biscuit cases". Meta "ORD0098595. Placed 2:14 PM". No vehicle row. Link row "Change this order".
    - Chilled card, Order card / received, same height: chips "Chilled", "Received by Waypoint". Same headline and subline. Contents "40 dairy crates, 32 produce crates, 20 meat and fish boxes". Meta "ORD0098596. Placed 2:10 PM". Link row "Change this order".
    - 3d becomes Cutoff line / countdown: "Orders for Wednesday close at 4:00 PM" in Label `asphalt-900`, then "1 h 46 min left" in Heading 3 `asphalt-900`. The countdown appears only when less than 4 hours remain. Under one hour the line switches to `attention-soft` fill with `timer` in `attention-strong` (variant defined, not drawn).
    - 3e stays Button / secondary / phone "Place an order". 3f unchanged.
    - "Change this order" (build only, not drawn): opens STM-02 with the order's counts filled in, header "Change ORD0098595" (or ORD0098596), button "Save changes". At 4:00 PM the link row disappears and the meta line adds "Locked at 4:00 PM."
  - **STM-01 My orders / moved earlier.** Tuesday 7 April, 9:12 PM. Nuwan swaps stops 3 and 4 on VEH045 so that Kasun reaches the Aranayake hill road after first light; Hemmathagama becomes stop 3 and is reached earlier. The new time replaces the old one, and the card says what it was. Status bar "9:12". Full length 1,196.
    - 3a as in the main frame.
    - Dry card, Order card / moved earlier, about 323 high: chips "Dry", "Scheduled". Headline "Expected around 6:35 AM". Subline "Your window is 4:00 to 7:45 AM". Then Notice / info, compact inline, fill `petrol-50`, radius 8, padding 12, gap 8, `calendar-clock` 20 in `petrol-700`, Body `asphalt-900`: "Moved earlier at 9:12 PM. It was expected around 7:15 AM." Divider, contents and meta as in the main frame, detail row "Dry-box truck VEH045, Kandy hub".
    - Chilled card, 3d, 3e and 3f as in the main frame.
    - The note stays until the truck leaves the hub.
    - Notification text (build, 9:12 PM, outside quiet hours so it rings): "Waypoint: your dry order tomorrow is now expected earlier, around 6:35 AM. Your window is still 4:00 to 7:45 AM."
  - **STM-01 My orders / on the way.** Wednesday 8 April, 5:20 AM. Kasun delivered stop 1 (Kegalle) at 5:11 and is on the way to stop 2 (Mawanella). All synced. Status bar "5:20". Full length 1,182.
    - 3a: "Today, Wednesday 8 April" / "1 on the way, 1 moved to Thursday"
    - Dry card, Order card / on the way, about 353 high: chips "Dry", "On the way". Headline "Arriving around 6:35 AM". Subline "1 stop before you. Last heard from Kasun 5:20 AM" (two lines). Divider. Contents "30 rice and dhal cases, 44 packet foods cases, 22 tea and biscuit cases". Meta "ORD0098595. Placed Tuesday 2:14 PM". Then Link row / attention, 326 x 44 or more, fill `attention-soft`, radius 8, horizontal, padding 0 12, gap 8: `clock` 16 in `attention-strong`, "6 rice and dhal cases short. They come Thursday." in Label `asphalt-900`, `chevron-right` 20 in `asphalt-700`. Then Button / primary / phone, 326 x 48, `navigation` 20 leading: "Track delivery".
    - Chilled card as in the main frame, with meta "ORD0098596. Placed Tuesday 2:10 PM".
    - 3d becomes Cutoff line / time, 358 x 48, padding 12 16, gap 12: `timer` 20 in `asphalt-700` and Body `asphalt-900` "Orders for Thursday close today at 4:00 PM".
    - 3e stays secondary.
  - **STM-01 My orders / receipt confirmed.** Wednesday 8 April, 7:22 AM. Dilani confirmed receipt at 6:42 AM from the arrival tracker; Kasun's proof reached Relay at 7:14 AM. Status bar "7:22". Full length 1,166.
    - 3a: "Today, Wednesday 8 April" / "1 arrived, 1 moved to Thursday"
    - Dry card, Order card / receipt confirmed, about 337 high: chips "Dry", "Receipt confirmed". Headline "Delivered 6:36 AM". Subline "You confirmed receipt at 6:42 AM. Kasun's proof arrived at 7:14 AM." Divider. Contents "30 rice and dhal cases, 44 packet foods cases, 22 tea and biscuit cases". Meta "ORD0098595. Placed Tuesday 2:14 PM". Link row / attention "6 rice and dhal cases follow on Thursday." Link row "See the receipt and Kasun's proof".
    - Chilled card, 3d and 3e as in the on the way state.
  - **Build states (not drawn):**
    - *Past the estimate.* From 6:40 AM the dry card mirrors "STM-04 Arrival tracker / past estimate": chips "Dry", "Estimate passed", headline "The estimate has passed", subline "No word from Kasun since 5:41 AM.", and Button / primary / phone "Confirm receipt" (`package-check`).
    - *Her own phone offline.* Notice / info at the top of the content, `wifi-off` 20 in `asphalt-700`, Body `asphalt-900`: "You're offline. Showing what we knew at 5:20 AM." The time is the last moment her phone heard from Relay. STM-04 uses the same notice.
    - *Delivery window of a mall store.* For an outlet whose data carries a mall delivery window, the card adds Status chip / mall window with that outlet's bay hours under the headline, because the truck can only unload inside them. No Kegalle Fresh store has one.
- **Prototype:**
  - STM-01 My orders: "Read the notice" goes to "STM-03 Deferral notice / acknowledged". "Place an order" goes to "STM-02 Place order / after cutoff". "Sign out" has no target.
  - STM-01 My orders / before cutoff: no targets. "Change this order" and "Place an order" are build only. This frame ends the "Store Manager flow" and "Store Manager: Order not sent" flows.
  - STM-01 My orders / moved earlier: "Read the notice" goes to "STM-03 Deferral notice / acknowledged". "Place an order" has no target.
  - STM-01 My orders / on the way: "Track delivery" goes to "STM-04 Arrival tracker". "6 rice and dhal cases short. They come Thursday." goes to "STM-03 Deferral notice / short delivery". "Read the notice" goes to "STM-03 Deferral notice / acknowledged".
  - STM-01 My orders / receipt confirmed: "See the receipt and Kasun's proof" goes to "STM-05 Confirm receipt". "6 rice and dhal cases follow on Thursday." goes to "STM-03 Deferral notice / short delivery". "Read the notice" goes to "STM-03 Deferral notice / acknowledged".
- **Rationale:** Dilani's worry is simple: is it coming, and when? Today she orders on WhatsApp and hears nothing back, so this screen leads with that answer, one card per order. Dry and chilled orders get separate cards because they travel on different vehicles and can have different outcomes. On a night like this one, a single green tick would hide the fact that her chilled order has moved to Thursday. The card that changed carries the only amber on the screen and the reason in one line. When the plan changes after publishing, as at 9:12 PM, the new time replaces the old one and the card says what it was. Placing a new order comes after the cards, beside the cutoff that decides which run it joins.

---

## STM-02 Place order

- **Frame:** "STM-02 Place order", phone 390 x 844. Snapshot: Tuesday 7 April 2026, 2:10 PM, the moment before Dilani sends her chilled order.
- **Purpose:** Let Dilani send a dry or a chilled order by counting standard cases, with weight and volume worked out for her and the 4 PM cutoff always in view.
- **Layout:**
  1. System status bar, 390 x 44.
  2. Top bar / phone header / back, 390 x 64.
  3. Content region, 390 x 602 visible (844 minus 44, 64 and 134), vertical, padding 16 16 24, gap 16. The content fits without scrolling.
     - 3a. Cutoff line / countdown, 358 x 64 (as in STM-01 / before cutoff).
     - 3b. Detail row / label and value, 358 x 44, no card, horizontal, gap 12. `calendar` 20 in `asphalt-700`, then a vertical stack: label in Caption `asphalt-500`, value in Body `asphalt-900`.
     - 3c. Order type block, vertical, gap 8.
       - Label in Label `asphalt-700`.
       - Input / segmented control / with icons, 358 x 48. Track fill `asphalt-100`, 1 px `asphalt-200`, radius 6, padding 4. Two segments, radius 6, centered, gap 8. Selected segment: fill `white`, 1 px `asphalt-300`, Label strong `asphalt-900`, icon in its status color (`snowflake` in `chilled-strong`; `package` in `asphalt-900`). Unselected segment: no fill, Label `asphalt-700`, icon `asphalt-700`. An unselected segment that holds unsent counts shows a count badge after its label: Caption `asphalt-900` on `asphalt-200`, radius 6, padding 2 6.
       - Helper in Label `asphalt-700`, up to two lines.
     - 3d. Cases card, 358 x about 268, fill `white`, 1 px `asphalt-200`, radius 12, vertical, padding 16 16 4, gap 0.
       - Header row, 32 high, space between: title in Heading 3 `asphalt-900`, hint in Caption `asphalt-500`.
       - Three Case type rows, each 326 x 72, space between, centered vertically, bottom divider 1 px `asphalt-200` on all but the last. Left: vertical stack, gap 2, name in Heading 3 `asphalt-900` and per-case size in Label `asphalt-500`. Right: Input / number stepper / store, 148 x 48, 1 px `asphalt-300`, radius 6: a `minus` button (48 x 48), the value (52 wide, Heading 3, tabular, centered, typeable) and a `plus` button (48 x 48). Icons 20 `asphalt-900`. At 0 the minus button is disabled (icon `asphalt-300`).
  4. Bottom action bar with totals, 390 x 134 (100 bar plus 34 home indicator), padding 12 16, vertical, gap 8.
     - Order totals row, 358 x 20, gap 16: `boxes` 16 plus value, `weight` 16 plus value, `box` 16 plus value. Values in Label strong `asphalt-900`, tabular, icons `asphalt-700`. The totals sit in the fixed bar so they are visible when she taps Send.
     - Button / primary / phone, 358 x 48, `send` 20 leading.
- **Content:**
  - Status bar: "2:10"
  - Header: "Place an order"
  - 3a: "Orders for Wednesday close at 4:00 PM" / "1 h 50 min left"
  - 3b: "Delivery" / "Wednesday 8 April, 4:00 to 7:45 AM"
  - 3c: "Order type". Segments: "Dry" (`package`), "Chilled" (`snowflake`, selected). Helper: "Chilled goods need a refrigerated vehicle. Send dry goods as their own order."
  - 3d header: "Cases" / "Tap or type a number"
  - 3d rows:

    | Name | Size line | Stepper value |
    |---|---|---|
    | "Dairy crate" | "8.4 kg, 0.038 m³ each" | "40" |
    | "Produce crate" | "5.6 kg, 0.042 m³ each" | "32" |
    | "Meat and fish box" | "7.2 kg, 0.030 m³ each" | "20" |

  - Stepper accessible labels: "Fewer dairy crates", "More dairy crates", and the same pattern for each case type.
  - Totals row: "92 cases", "659.2 kg", "3.464 m³"
  - Button: "Send order"
  - Build rules: kg and m³ are the sum of quantity times the case size in the scenario's case table. Dry shows the three dry rows (rice and dhal case 10.0 kg, 0.040 m³; packet foods case 5.2 kg, 0.036 m³; tea and biscuit case 4.4 kg, 0.034 m³). Chilled shows the three chilled rows. Each type keeps its own counts if she switches segments before sending, and the other segment shows its count badge. "Send order" sends only the selected type.
- **States:**
  - **STM-02 Place order / received.** Tuesday 7 April, 2:10 PM, straight after "Send order", once Relay has the order. Status bar "2:10". Header title "Order sent", with no back button (title only, padding 10 16), so the sent form cannot be reopened and sent twice. The content region is replaced; the header and bar shells stay. Full length 956.
    - Confirmation panel / done, 358 x about 256, fill `white`, 1 px `asphalt-200`, radius 12, vertical, centered, padding 24, gap 8. A 64 x 64 circle in `done-soft` holding `circle-check` 32 in `done-strong`. Title "Received by Waypoint" in Heading 1 `asphalt-900`. Body `asphalt-700`: "Your chilled order is in the queue for Wednesday." Order ID "ORD0098596" in Heading 3 `asphalt-900`. Label `asphalt-500`: "Received 2:10 PM, Tuesday 7 April".
    - Order summary card, 358 x about 170, padding 16, gap 8: Status chip / Chilled. Then three Detail rows (icon 20 `asphalt-700`, Body `asphalt-900`, top aligned): `boxes` "40 dairy crates, 32 produce crates, 20 meat and fish boxes", `weight` "659.2 kg, 3.464 m³", `calendar` "Wednesday 8 April, 4:00 to 7:45 AM".
    - "What happens next" card, 358 x about 176, padding 16, gap 12: title "What happens next" in Heading 3. Three Detail rows: `clock` "Orders for Wednesday close at 4:00 PM.", `route` "The dispatcher then plans Wednesday's runs.", `calendar-clock` "Your delivery time shows in My orders this evening."
    - Bottom action bar, 390 x 162: Button / secondary / phone "Back to my orders", then Button / primary / phone "Place your dry order" (`package` 20 leading).
    - Build rules: "Place your dry order" is the primary only while no dry order exists for that delivery day, because a Fresh store orders dry for every operating day. Otherwise the primary is "Back to my orders" and the secondary is "Place another order" (`plus`). If Relay receives an order after 4:00 PM, the body reads "Orders for Wednesday closed at 4:00 PM, so this one goes on Thursday's run." and the summary shows Thursday's date.
  - **STM-02 Place order / dry.** Tuesday 7 April, 2:14 PM. Status bar "2:14". The content fits the 844 viewport.
    - 3a: "Orders for Wednesday close at 4:00 PM" / "1 h 46 min left"
    - 3b as default.
    - New row under 3b, Detail row: `clipboard-list` 16 in `asphalt-700`, Label `asphalt-700`: "Already sent for Wednesday: chilled order ORD0098596"
    - 3c: "Dry" selected (`package` in `asphalt-900`), "Chilled" unselected with no badge (the chilled order was sent, so it holds no counts). Helper: "Dry goods only. Chilled goods go as their own order."
    - 3d rows: "Rice and dhal case" / "10.0 kg, 0.040 m³ each" / "36"; "Packet foods case" / "5.2 kg, 0.036 m³ each" / "44"; "Tea and biscuit case" / "4.4 kg, 0.034 m³ each" / "22".
    - Totals row: "102 cases", "685.6 kg", "3.772 m³". Button: "Send order".
    - Build note: sending shows the same confirmation panel with "Your dry order is in the queue for Wednesday.", "ORD0098595", "Received 2:14 PM, Tuesday 7 April", the three dry lines, "685.6 kg, 3.772 m³", "Wednesday 8 April, 4:00 to 7:45 AM", with "Back to my orders" as the primary. The prototype skips this repeat and goes to STM-01 / before cutoff.
  - **STM-02 Place order / not sent.** Tuesday 7 April, 2:14 PM. A branch: the same dry order when her phone has no connection. Status bar "2:14" with `wifi-off` in place of the signal. The content region is identical to "STM-02 Place order / dry". Full length 912.
    - Bottom action bar, about 210 (176 plus 34), padding 12 16, vertical, gap 8:
      - Notice / waiting, 358 x about 68, fill `waiting-soft`, 1 px `asphalt-300` border, radius 8, padding 12, gap 8, top aligned. `wifi-off` 20 in `asphalt-700`, Body `asphalt-900`: "Not sent. Your phone is offline. Your counts are saved here." Offline is a wait, not a problem she reports, so it uses the shared Waiting style of the Driver and Degradation screens, never red.
      - Order totals row: "102 cases", "685.6 kg", "3.772 m³".
      - Button / primary / phone, `refresh-cw` 20 leading: "Try again".
    - Build rules: the counts stay on the phone until Relay has the order, and "Received by Waypoint" never appears before that. If the retry lands after 4:00 PM, the confirmation says the order goes on Thursday's run. "Got it" on STM-03, "Everything arrived" and "Send 1 issue" on STM-05 use the same notice and button when they cannot be sent.
  - **STM-02 Place order / after cutoff.** Tuesday 7 April, 7:30 PM, opened from STM-01 My orders. Status bar "7:30". Nothing is sent in this frame. Full length 998.
    - 3a becomes Cutoff line / closed, 358 x about 80, fill `attention-soft`, no border, radius 12, top aligned. `clock` 20 in `attention-strong`. Line 1 in Label strong `asphalt-900`: "Orders for Wednesday closed at 4:00 PM". Line 2 in Body `asphalt-900`: "Anything you send now goes on Thursday's run."
    - 3b: "Delivery" / "Thursday 9 April, 4:00 to 7:45 AM", then a second Detail row, `timer` 20 `asphalt-700`, Label `asphalt-700`: "Orders for Thursday close tomorrow at 4:00 PM"
    - Notice / info, 358 x about 92, fill `white`, 1 px `asphalt-200`, radius 12, padding 12, gap 8, `info` 20 `asphalt-700`, Body `asphalt-900`: "Your chilled order ORD0098596 has already moved to Thursday. Those 92 cases are coming, so order only what else you need."
    - 3c: "Chilled" selected. Helper: "Chilled goods need a refrigerated vehicle. Send dry goods as their own order."
    - 3d: the three chilled rows at "0", minus disabled.
    - Bottom action bar, 390 x 158: totals row "0 cases", "0.0 kg", "0.000 m³"; Button / primary / phone, disabled (fill `asphalt-200`, text `asphalt-500`): "Send for Thursday's run"; Caption `asphalt-500`, centered: "Add at least one case to send."
- **Prototype:**
  - STM-02 Place order: "Send order" goes to "STM-02 Place order / received". Back has no target (the order is not sent yet). This frame starts the flow "Store Manager flow".
  - STM-02 Place order / received: "Place your dry order" goes to "STM-02 Place order / dry". "Back to my orders" and back have no target: the drawn My orders frame at 2:14 PM already shows the dry order, which does not exist yet at 2:10 PM.
  - STM-02 Place order / dry: "Send order" goes to "STM-01 My orders / before cutoff". Back has no target.
  - STM-02 Place order / not sent: "Try again" goes to "STM-01 My orders / before cutoff" (the retry succeeds at 2:14 PM). Back has no target. This frame starts the flow "Store Manager: Order not sent".
  - STM-02 Place order / after cutoff: back goes to "STM-01 My orders". The disabled button has no target.
- **Rationale:** Dilani knows her stock in crates and cases, not in kilograms or cubic meters. So she counts standard case types and Relay works out weight and volume, which the dispatcher needs to fill vehicles against both limits. Fresh stores order dry and chilled separately, because chilled goods need a refrigerated vehicle and the two never share a trip. The countdown keeps the 4 PM cutoff in view while she counts. She sees Received by Waypoint only once Relay really has the order, the confirmation she has never had. If her phone is offline, her counts wait for her. After 4 PM the screen says plainly that a new order joins Thursday's run.

---

## STM-02 Place order / desktop

- **Frame:** "STM-02 Place order / desktop", desktop 1440 x 900, background `asphalt-50`. Snapshot: Tuesday 7 April 2026, 2:10 PM, the same chilled order as the phone frame, placed from the back-office PC.
- **Purpose:** The back-office version of Place order: same steps and words as the phone, laid out as a table she can type into, with the summary and send button always beside it.
- **Layout:** Store density applies on the desktop too: 48 px buttons and steppers, 64 px table rows, 44 x 44 icon buttons, Body 15, 20 px icons.
  1. Desktop app bar / store, 1440 x 64, fill `white`, bottom border 1 px `asphalt-200`, padding 0 32, space between, centered vertically.
     - Left group, gap 24: Relay mark 28 x 28 plus the wordmark in Heading 3 `asphalt-900` (gap 8); vertical divider 1 x 24 `asphalt-200`; store block (store name in Label `asphalt-900`, code line in Caption `asphalt-500`); nav tabs, gap 4, 16 left margin, each 64 high with padding 0 12, a 20 px icon and Label text. Inactive `asphalt-700`; active `petrol-700` text and icon with a 2 px `petrol-700` bottom border.
     - Right group, gap 8: user block (`user` 20 plus the name in Label `asphalt-900`), then Button / quiet / icon only, 44 x 44, `log-out` (tooltip and accessible label "Sign out").
  2. Page body: container 1136 wide, centered, padding 32 0, vertical, gap 24.
     - 2a. Title block, gap 4: page title in Display `asphalt-900`, subline in Body `asphalt-700`.
     - 2b. Two columns, gap 32, top aligned.
       - Left column, 744 wide: form card, fill `white`, 1 px `asphalt-200`, radius 12, padding 24, gap 24, about 500 high.
         - Order type block, gap 8: label in Label `asphalt-700`, Input / segmented control / with icons at 320 x 48, helper in Label `asphalt-700`.
         - Case table, 696 wide. Column widths: Case type 208, Each 156, Quantity 156, Weight 88 (right aligned), Volume 88 (right aligned); the number columns hold "659.2 kg" and "3.464 m³" in Heading 3. Header row 40 high, bottom border 1 px `asphalt-200`, Caption `asphalt-500`. Case rows 64 high, bottom border 1 px `asphalt-200`: name in Heading 3 `asphalt-900`, size in Body `asphalt-700`, stepper at 148 x 48, line weight and volume in Body `asphalt-900`, tabular. Total row 56 high, top border 1 px `asphalt-300`, values in Heading 3 `asphalt-900`.
         - Caption in `asphalt-500`.
       - Right column, 360 wide, gap 16, fixed while the page scrolls: Cutoff line / countdown 360 x 64; Summary card (padding 24, gap 16: title, Status chip / Chilled, six Detail rows, divider, Button / primary 312 x 48 with `send` 20, centered caption); Sent list card (padding 24, gap 8: title, empty text in Body `asphalt-500`).
- **Content:**
  - App bar: Relay mark, "Relay". Store block: "Waypoint Fresh Hemmathagama" / "OUT117, Kandy hub". Tabs: "My orders" (`list-checks`), "Place an order" (`plus`, active). Right: "Dilani Jayawardena", `log-out`.
  - 2a: "Place an order" / "For Wednesday 8 April. Your delivery window is 4:00 to 7:45 AM."
  - Order type: "Order type". Segments: "Dry" (`package`), "Chilled" (`snowflake`, selected). Helper: "Chilled goods need a refrigerated vehicle. Send dry goods as their own order."
  - Case table:

    | Case type | Each | Quantity | Weight | Volume |
    |---|---|---|---|---|
    | "Dairy crate" | "8.4 kg, 0.038 m³" | "40" | "336.0 kg" | "1.520 m³" |
    | "Produce crate" | "5.6 kg, 0.042 m³" | "32" | "179.2 kg" | "1.344 m³" |
    | "Meat and fish box" | "7.2 kg, 0.030 m³" | "20" | "144.0 kg" | "0.600 m³" |
    | "Total" | (blank) | "92 cases" | "659.2 kg" | "3.464 m³" |

  - Caption under the table: "Weight and volume are worked out from standard case sizes. Type a number or use the buttons."
  - Cutoff line: "Orders for Wednesday close at 4:00 PM" / "1 h 50 min left"
  - Summary card: "Your order", chip "Chilled", Detail rows `calendar` "Wednesday 8 April", `clock` "4:00 to 7:45 AM", `boxes` "92 cases", `weight` "659.2 kg", `box` "3.464 m³", `truck` "Travels on a refrigerated vehicle". Button: "Send order". Caption: "You'll see Received by Waypoint straight away."
  - Sent list card: "Already sent for Wednesday" / "Nothing yet."
  - Keyboard (build): Tab moves through the segmented control, then each quantity field in order, then Send order. Enter in a quantity field moves to the next row and never sends the order. Up and down arrow keys change the value by 1.
- **States:** None drawn. In the build, "Send order" swaps the summary card for the same confirmation panel as "STM-02 Place order / received", and the sent list card shows "ORD0098596, chilled, received 2:10 PM". If the PC is offline, the not-sent notice appears above the button in the summary card, and the button becomes "Try again". After 4 PM the cutoff line and button follow "STM-02 Place order / after cutoff".
- **Prototype:** Static reference frame. "My orders", "Send order" and `log-out` have no targets; the phone frames carry the clickable flow.
- **Rationale card title block:** "STM-02 Place order / desktop" and "Back-office PC, 1440 x 900. Keyboard: Tab moves through the order type, each quantity, then Send order. Enter never sends."
- **Rationale:** In the back office Dilani often orders from the desktop PC, with a keyboard and her stock count beside her. The desktop frame keeps the same steps and words as the phone, so nothing has to be learned twice, but lays the case types out as a table she can type into. Each row shows its own weight and volume, so she can see which line makes an order heavy. The countdown, summary and send button stay fixed on the right, and the list of orders already sent for Wednesday helps her avoid sending the same order twice.

---

## STM-03 Deferral notice

- **Frame:** "STM-03 Deferral notice", phone 390 x 844, full length 1,149. Snapshot: Tuesday 7 April 2026, 6:41 PM, one minute after Nuwan published the Kandy plan.
- **Purpose:** Tell Dilani the evening before that her chilled order has moved, when it will come instead, that her dry order is still coming, and why, then record that she has seen it.
- **Layout:**
  1. System status bar, 390 x 44.
  2. Top bar / phone header / back, 390 x 64.
  3. Content region, 606 visible (844 minus 44, 64 and 130), vertical, padding 16 16 24, gap 16. About 880 of content; the first view holds 3a to 3d.
     - 3a. Meta line in Caption `asphalt-500`.
     - 3b. Headline block, gap 8: Status chip / deferred labelled "Moved to Thursday", then the headline in Heading 2 `asphalt-900` (two lines).
     - 3c. Change block card, 358 x about 264, padding 16, gap 12.
       - Order group, vertical, gap 8: Status chip / Chilled, then contents in Body `asphalt-900` and (gap 2) the meta line in Label `asphalt-500`.
       - Divider.
       - Two Change rows, gap 8, each with gap 12 and a fixed 48 px label column, label and value on one baseline. "Was" row: label in Label `asphalt-500`, value in Body `asphalt-500` with strikethrough. "Now" row: label in Label strong `attention-strong`, value in Heading 3 `asphalt-900`.
       - Detail row, gap 12, top aligned: `lock` 20 in `asphalt-700`, Body `asphalt-900`.
     - 3d. Still coming card, 358 x about 119, padding 16, gap 8: Status chip / Dry, then the line in Body `asphalt-900` (two lines), then (gap 2) the meta line in Label `asphalt-500`.
     - 3e. Reason card, 358 x about 299, padding 16, gap 8: title in Heading 3, then three paragraphs in Body `asphalt-900`.
  4. Bottom action bar, 390 x 130: a centered caption in Caption `asphalt-500`, then Button / primary / phone with `check` 20 leading.
- **Content:**
  - Status bar: "6:41"
  - Header: "Delivery update"
  - 3a: "Sent 6:41 PM, Tuesday 7 April"
  - 3b: chip "Moved to Thursday". Headline: "Your chilled order now comes Thursday"
  - 3c: chip "Chilled". Contents: "40 dairy crates, 32 produce crates, 20 meat and fish boxes". Meta: "ORD0098596. Placed 2:10 PM". Change rows: "Was" / "Wednesday 8 April, 4:00 to 7:45 AM" and "Now" / "Thursday 9 April, 4:00 to 7:45 AM". Lock row: "This order won't be moved again unless the dispatcher approves it."
  - 3d: chip "Dry". "Your dry order still comes Wednesday, expected around 7:15 AM." Meta: "ORD0098595"
  - 3e: "Why it moved"
    - "Two of our refrigerated vehicles are in the workshop this week. The one refrigerated van that can still reach your area on Wednesday morning has no room for your order."
    - "Another store in your area had its chilled order wait on Monday, so it goes first this time. We avoid making any store wait twice in a row."
    - "Before moving your order, we checked Thursday: a refrigerated truck back from the workshop has room for it, alongside your Thursday chilled order."
  - Bottom bar caption: "Got it lets the dispatcher know you've seen this." Button: "Got it"
  - Notification text (build, sent at 6:41 PM): "Waypoint: your chilled order ORD0098596 moves to Thursday 9 April, 4:00 to 7:45 AM. Your dry order is still coming Wednesday. Tap to see why."
  - Where the reason comes from ("Why one chilled order waits" in the scenario): paragraph 1 is the capacity (VEH039 and VEH058 in the workshop; VEH057's second trip is the only refrigerated trip planned to reach Kegalle, and it has no room for three orders); paragraph 2 is rule 2 (OUT119 Waypoint Fresh Kegalle had its Monday chilled order wait a day); paragraph 3 is the next-run check (VEH039 is back on Thursday and its Kegalle trip carries her Wednesday order with Thursday's Kegalle chilled orders). The store never sees vehicle codes, kilograms, the pool of orders that could have waited, or the paper alternative: those are on DSP-03 for the dispatcher. "We avoid" rather than "we never", because the dispatcher can override rule 2.
- **States:**
  - **STM-03 Deferral notice / acknowledged.** Tuesday 7 April, 6:41 PM, after "Got it" reaches Relay. Full length 1,177. The content is unchanged. The bottom action bar becomes 390 x 162:
    - Notice / done, 358 x 48, fill `done-soft`, radius 8, padding 12, gap 8, centered. `circle-check` 20 in `done-strong`, Label `asphalt-900`, one line: "Seen 6:41 PM. The dispatcher can see this."
    - Button / secondary / phone: "Back to my orders"
    - Cross-role: the same "Seen 6:41 PM" appears on ORD0098596 in the dispatcher's deferral record (DSP-03).
  - **STM-03 Deferral notice / short delivery.** Wednesday 8 April, 5:05 AM. At 2:47 AM Rizwan found only 30 of the 36 rice and dhal cases for ORD0098595 on the shelf; at 2:52 AM Nuwan decided "send short, add to Thursday". The notice arrived silently in quiet hours and Dilani opens it at 5:05 AM. Status bar "5:05". Header "Delivery update". Same shell and bottom bar as the default frame. Full length 1,237. The content follows the same order: what changed, what is still coming, why.
    - 3a: "Sent 2:52 AM, Wednesday 8 April"
    - 3b: Status chip / Short "6 short". Headline, two lines: "6 rice and dhal cases are short in today's dry order"
    - 3c, change block card, about 324 high: chip "Dry". Line in Body `asphalt-700`: "Today, 4:00 to 7:45 AM, expected around 6:35 AM". Meta: "ORD0098595. Placed Tuesday 2:14 PM". Divider. Three Receipt line / read-only rows, each 326 x 56, space between, centered. Name in Body `asphalt-900`; on the right, quantity in Heading 3 tabular, with an optional note to its left.

      | Name | Quantity | Note |
      |---|---|---|
      | "Rice and dhal case" | "30" | "was 36", in Label `attention-strong`, left of the quantity |
      | "Packet foods case" | "44" | none |
      | "Tea and biscuit case" | "22" | none |

    - 3d, card "The 6 cases still to come", about 180 high, padding 16, gap 8: title in Heading 3. Detail row, `calendar` 20 `asphalt-700`, Body `asphalt-900`: "Thursday 9 April, 4:00 to 7:45 AM". Body `asphalt-700`: "We have added them to your Thursday dry order (ORD0098747), marked from Wednesday. Your chilled order ORD0098596 comes the same morning."
    - 3e, reason card: "Why" / "While your order was being loaded at the Kandy hub, only 30 of your 36 rice and dhal cases were on the shelf. The dispatcher chose to send the rest of your order on time rather than hold the truck."
    - 3f, Notice / info, 358 x about 84, fill `white`, 1 px `asphalt-200`, radius 12, padding 12, `info` 20 `asphalt-700`, Body `asphalt-900`: "When you check this delivery, the list will show 30 rice and dhal cases. There's no need to report these 6 as missing."
    - Bottom bar caption: "Got it lets the dispatcher know you've seen this." Button: "Got it"
    - The headline and the first sentence of 3d are the scenario's notice text.
    - Notification text (build, sent 2:52 AM, silent): "Waypoint: 6 rice and dhal cases are short in today's dry order. They come Thursday. Tap for details."
    - After "Got it" at 5:05 AM (not drawn): the bar changes as in "/ acknowledged", with "Seen 5:05 AM. The dispatcher can see this." The dispatcher's shortfall record shows "Seen 5:05 AM". Opened later from STM-01, this frame shows that acknowledged bar.
- **Prototype:**
  - STM-03 Deferral notice: this frame starts the flow "Store Manager: Evening notice". "Got it" goes to "STM-03 Deferral notice / acknowledged". Back goes to "STM-01 My orders".
  - STM-03 Deferral notice / acknowledged: "Back to my orders" goes to "STM-01 My orders". Back uses the prototype's Back action, so it returns to whichever frame opened the notice, including the Wednesday states of STM-01.
  - STM-03 Deferral notice / short delivery: this frame starts the flow "Store Manager: Delivery morning". "Got it" goes to "STM-01 My orders / on the way". Back uses the Back action.
- **Rationale:** Dilani used to learn about a deferral when the truck didn't come. Now she hears the evening before, at 6:41 PM, while she can still plan her chilled shelf and her staff. The notice leads with the new date, then answers her next worry straight away: her dry order still comes Wednesday. The reason follows in words a store manager would use, not a vehicle code or a capacity figure: two refrigerated vehicles are out, the one van to her area is full, and a store that already waited this week goes first. It also tells her Thursday was checked before her order moved. Got it tells the dispatcher she has seen it. The 2:52 AM short delivery uses the same notice and waits quietly until she wakes.

---

## STM-04 Arrival tracker

- **Frame:** "STM-04 Arrival tracker", phone 390 x 844, full length 1,045. Snapshot: Wednesday 8 April 2026, 5:20 AM. Kasun delivered stop 1 (Kegalle) at 5:11 AM and is on the way to stop 2 (Mawanella), expected around 5:30. All records synced. Dilani is stop 3.
- **Purpose:** Give Dilani an arrival time she can roster staff against, with how far away the truck is, who is driving, and how fresh the information is.
- **Layout:**
  1. System status bar, 390 x 44.
  2. Top bar / phone header / back, 390 x 64.
  3. Content region, 702 visible (844 minus 44, 64 and the 34 home indicator; no action bar), vertical, padding 16 16 24, gap 16. The arrival card and the run card are in the first view.
     - 3a. Arrival card, 358 x about 288, fill `white`, 1 px `asphalt-200`, radius 12, padding 20, gap 8.
       - Chip row, gap 8: Status chip / Dry, Status chip / On the way.
       - The order ID in Label `asphalt-500`.
       - Label in Label `asphalt-700`.
       - The time in Display `asphalt-900`, tabular.
       - Window line in Body `asphalt-700`.
       - Planned line in Label `asphalt-500`.
       - Divider.
       - Row, gap 8: `route` 20 in `asphalt-900` plus Heading 3 `asphalt-900`.
       - Row, gap 8: `history` 16 in `asphalt-700` plus Label `asphalt-700`.
     - 3b. Run card, 358 x about 234, padding 16, gap 12.
       - Title in Heading 3.
       - Stop progress list (store view), three rows of 326 x 56, gap 12, centered. Left rail: 24 wide, holding the stop icon, with a 2 px `asphalt-300` connector between icons. Text column, gap 2: stop name in Body strong `asphalt-900`, status in Label.
         - Delivered row: `circle-check` 20 in `done-strong`, status in `done-strong`.
         - Current row: 12 px `signal-400` dot with a 1.5 px `signal-ink` ring (the driver's next-stop marker), status in Label strong `asphalt-900`.
         - Your store row: fill `petrol-50`, radius 8, padding 0 12, `map-pin` 20 in `petrol-700`, status in Label strong `petrol-700`.
       - Caption in `asphalt-500`.
     - 3c. Person row / driver, 358 x about 95, padding 16, gap 12. Avatar: 40 x 40 circle in `asphalt-100` with `user` 20 in `asphalt-700`. Text stack, gap 2: name in Heading 3 `asphalt-900`, vehicle line in Label `asphalt-700`, departure line in Label `asphalt-500`. No call button: the driver is on the road.
     - 3d. On board card, 358 x about 163, padding 16, gap 8. Title in Heading 3. Contents in Body `asphalt-900` (two lines). Attention row: `clock` 16 in `attention-strong` plus Label `attention-strong`. Detail row: `warehouse` 20 in `asphalt-700` plus Body `asphalt-900`.
- **Content:**
  - Status bar: "5:20"
  - Header: "Your delivery"
  - 3a: chips "Dry", "On the way". "ORD0098595". "Arriving around". "6:35 AM". "Your window is 4:00 to 7:45 AM". "Planned 5:30 AM". "1 stop before you". "Last heard from Kasun 5:20 AM"
  - 3b: "Kasun's run this morning"

    | Icon | Stop name | Status |
    |---|---|---|
    | `circle-check` | "Stop 1, Kegalle" | "Delivered 5:11 AM" |
    | `signal-400` marker | "Stop 2, Mawanella" | "Next stop, expected around 5:30 AM" |
    | `map-pin` | "Stop 3, your store" | "Around 6:35 AM" |

    Caption: "Times update each time Kasun records a stop."
  - 3c: "Kasun Bandara" / "Driver, VEH045 dry-box truck" / "Left the Kandy hub at 3:44 AM"
  - 3d: "Coming to you" / "30 rice and dhal cases, 44 packet foods cases, 22 tea and biscuit cases" / "6 rice and dhal cases follow on Thursday" / "Unloading at your rear dock"
  - Build rules:
    - "Last heard from Kasun" is the last time Relay heard from Kasun's phone (a check-in once a minute while Relay is open), not the time of the last stop event. It names Kasun so it can never be read as the age of her own screen; her own connection has its own notice (STM-01 build states).
    - One estimate rule, shared with the dispatcher (DEG-03) and DEG-04: the estimate is the last stop event plus the usual unloading and each leg by the Expected model, rounded to 5 minutes. It moves only when a stop event arrives, and a store's confirmed receipt counts as a stop event. While Kasun is silent the time shows with a likely range (DEG-04 at 6:05: "Likely between 6:05 and 7:05 AM"). Once the estimate passes with no word, the card switches to the past-estimate state below instead of pushing the time later. The dispatcher and the store read the same estimate.
    - Stops after hers are not shown.
- **States:**
  - **6:05 AM, while Kasun is silent:** owned by the degradation spec as DEG-04 ("Arriving around 6:35 AM", "Likely between 6:05 and 7:05 AM", "Kasun's phone last reached us at 5:41 AM, after he arrived at Mawanella. Hill roads often lose signal, so these times are our estimate."). DEG-04 reuses this frame's layout and components.
  - **STM-04 Arrival tracker / past estimate.** Wednesday 8 April, 6:40 AM. The 6:35 estimate has passed and Relay has heard nothing from Kasun since 5:41 AM. In fact he arrived at 6:21 and delivered at 6:36 while his phone was offline; the goods are at her dock. Status bar "6:40". Full length 1,087. Same layout, with these differences:
    - 3a, Arrival card / past estimate, about 332 high: chips "Dry", "Estimate passed". "ORD0098595". Label `asphalt-700`: "Planned 5:30 AM · Expected around 6:35 AM". In place of the Display time, Heading 2 `asphalt-900`: "The estimate has passed". Body `asphalt-900`: "No word from Kasun since 5:41 AM." Divider. Receipt prompt, gap 12: "Goods already at your store?" in Body strong `asphalt-900` and, gap 4, Body `asphalt-700` "Check them and confirm. Kasun's proof joins your receipt when his phone reaches us."; then Button / primary, 318 x 48, `package-check` 20 leading: "Confirm receipt". No route row and no last-heard row.
    - 3b rows: stop 1 as before. Stop 2 keeps the marker as the last known position, status "Arrived 5:30 AM. Last heard 5:41 AM". Stop 3, your store: "Estimate passed (around 6:35 AM)". Caption: "Times update when Kasun's phone next reaches us."
    - 3c and 3d unchanged. Nothing on the screen invites a call to Kasun, and nothing guesses why he is silent.
- **Prototype:** STM-04 Arrival tracker: back goes to "STM-01 My orders / on the way". Nothing else is tappable. STM-04 Arrival tracker / past estimate: this frame starts the flow "Store Manager: After delivery"; "Confirm receipt" goes to "STM-05 Confirm receipt / before driver proof"; back uses the Back action. On the canvas it follows DEG-04 in the story (its caption says so); the Degradation section wires DEG-04's back button to "STM-01 My orders / on the way".
- **Rationale:** Dilani needs one number on a delivery morning: when to have someone at the rear dock. The tracker gives it as a plain time, around 6:35, next to her window, then shows how many stops are ahead and which are done. The planned time, 5:30, stays in small type: it is the published standard at free flow, and on a monsoon morning the expected time is the one to roster staff around. Progress comes from the stops Kasun records, not from tracking his phone, so the screen always says when Relay last heard from him. When it stops hearing from him and the estimate passes, the screen says so without guessing why, and lets her confirm the goods herself if they are already at her dock. The driver's name and truck tell her who to expect, without inviting a call to someone who is driving.

---

## STM-05 Confirm receipt

- **Frame:** "STM-05 Confirm receipt", phone 390 x 844, full length 914. Snapshot: Wednesday 8 April 2026, 7:22 AM. Dilani confirmed receipt at 6:42 AM from the store. Kasun delivered at 6:36 AM while offline, and his phone sent the proof at 7:14 AM, when its signal came back; it joined her receipt. She opens the receipt from My orders.
- **Purpose:** Show Dilani her confirmed receipt with the driver's proof attached, so the record holds both sides, and let her still flag a line until 4:00 PM.
- **Layout:**
  1. System status bar, 390 x 44.
  2. Top bar / phone header / back, 390 x 64. Title "Your receipt" (the 6:42 AM frames are titled "Confirm receipt").
  3. Content region, vertical, padding 16 16 24, gap 16. What is new at 7:22 is the proof, so it leads; the lines she confirmed at 6:42 follow.
     - 3a. Summary block, 358 x 50, gap 4: chip row (gap 8) with Status chip / Dry and Status chip / Receipt confirmed, then the meta line in Label `asphalt-500`.
     - 3b. Proof of delivery card, 358 x about 218, padding 16, gap 12.
       - Title in Heading 3 `asphalt-900`.
       - Row, gap 12, top aligned: Photo thumbnail, 72 x 72, radius 8, 1 px `asphalt-200`, showing Kasun's photo of the cases on her rear dock (a real photo or a neutral stand-in; no people), with an enlarge badge 24 x 24 (fill `white`, radius 6, `image` 16 in `asphalt-900`) in the bottom right corner; then a stack, gap 4, of three lines in Body `asphalt-900`, in time order, then who received.
       - Detail row, gap 8: `map-pin` 20 in `asphalt-700` plus Body `asphalt-900`.
       - Caption row, gap 8, top aligned: `upload` 16 in `asphalt-500` plus Caption `asphalt-500`, two lines.
     - 3c. Lines card, 358 x about 350, padding 16 16 4, gap 4. Title row, space between: "What arrived" in Heading 3 `asphalt-900` and the case total in Label strong `asphalt-700`. Then the helper in Body `asphalt-700`, then three Receipt line rows.
       - Receipt line / arrived, 326 x at least 64 (about 104 with a note). Horizontal, space between, centered, padding 8 0, bottom divider 1 px `asphalt-200` on all but the last.
       - Left stack, gap 2: name in Heading 3 `asphalt-900`, quantity in Body `asphalt-700`, and an optional note row (`info` 16 in `attention-strong` plus Label `attention-strong`, two lines).
       - Right: Button / quiet / phone, 44 high, padding 0 12, `circle-alert` 20 plus Button text `asphalt-900`.
  4. Bottom action bar, 390 x 130: caption in Caption `asphalt-500`, centered, then Button / primary / phone.
- **Content:**
  - Status bar: "7:22"
  - Header: "Your receipt"
  - 3a: chips "Dry", "Receipt confirmed". Meta: "ORD0098595. You confirmed receipt at 6:42 AM"
  - 3b: "Proof of delivery from Kasun Bandara"
    - Photo accessible label: "Delivery photo, 6:36 AM. Tap to enlarge."
    - Lines: "Arrived 6:21 AM", "Delivered 6:36 AM, in your window", "Received by W. Rathnayake"
    - Detail row: "Photo and location recorded at your store"
    - Caption: "Saved on Kasun's phone at 6:36 AM and sent at 7:14 AM, when his phone reached us again."
  - 3c: "What arrived" / "96 cases" / "Kasun's record matches what you confirmed. Flag a line if you find a problem."

    | Name | Quantity | Note | Button |
    |---|---|---|---|
    | "Rice and dhal case" | "30 delivered" | "6 short. You were told at 2:52 AM. Coming Thursday." | "Flag" |
    | "Packet foods case" | "44 delivered" | none | "Flag" |
    | "Tea and biscuit case" | "22 delivered" | none | "Flag" |

  - Bottom bar caption: "You can report a problem until 4:00 PM today." Button: "Back to my orders"
- **States:**
  - **STM-05 Confirm receipt / before driver proof.** Wednesday 8 April, 6:42 AM, opened from "Confirm receipt" on STM-04 / past estimate. She is at the dock with the cases in front of her; Kasun's record is still on his phone. Status bar "6:42". Header "Confirm receipt". The content fits the 844 viewport.
    - 3a: chip "Dry". Meta: "ORD0098595. Placed Tuesday 2:14 PM"
    - Lines card first: "What arrived" / "96 cases" / "Check the goods at your dock against what was loaded for you. Flag any line that's wrong." Lines: "Rice and dhal case" / "30 loaded" with the note "6 short. You were told at 2:52 AM. Coming Thursday."; "Packet foods case" / "44 loaded"; "Tea and biscuit case" / "22 loaded"; each with "Flag". Relay knows what was loaded for her from the dock's record, so that is what she checks against.
    - Proof of delivery card / waiting, padding 16, gap 12: "Proof of delivery" in Heading 3, then a Detail row, gap 12, `history` 20 in `asphalt-700`: "Driver's proof: waiting for Kasun's phone" in Body `asphalt-900`, and under it in Label `asphalt-500`: "It joins this receipt when his phone reaches us. You don't need to wait for it."
    - Bottom bar caption: "If something's wrong, flag that line first." Button / primary / phone with `package-check` 20 leading: "Everything arrived"
  - **STM-05 Confirm receipt / confirmed.** Wednesday 8 April, 6:42 AM, after "Everything arrived" reaches Relay. Status bar "6:42". Header "Confirm receipt". The content region is replaced. Full length 892.
    - Confirmation panel / done, 358 x about 250, padding 24, centered, gap 8. A 64 x 64 circle in `done-soft` with `package-check` 32 in `done-strong`. Title "Receipt confirmed" in Heading 1. Body `asphalt-700`: "Thanks, Dilani. The dispatcher can see your receipt, so they know Kasun has been to your store." Label `asphalt-500`: "ORD0098595, 96 cases, confirmed 6:42 AM"
    - Proof waiting card, padding 16, gap 8: `history` 20, "Driver's proof: waiting for Kasun's phone" / "It joins this receipt when his phone reaches us."
    - Still to come card, 358 x about 196, padding 16, gap 12. Title in Heading 3: "Still to come on Thursday 9 April". Two Detail rows, gap 12, each with a 20 px icon, a value in Body `asphalt-900` and a line in Label `asphalt-500`:
      - `snowflake` in `chilled-strong`: "Your chilled order, 92 cases" / "4:00 to 7:45 AM, ORD0098596, moved from Wednesday"
      - `package` in `asphalt-700`: "6 rice and dhal cases" / "4:00 to 7:45 AM, on ORD0098747, marked from Wednesday"
    - Report block, gap 4, left aligned: Button / quiet / phone, 44 high, `circle-alert` 20: "Report a problem". Caption `asphalt-500`: "You can still report a problem until 4:00 PM today"
    - Bottom action bar, 390 x 106: Button / primary / phone "Back to my orders"
    - Cross-role: at 6:42 the dispatcher's feed shows her receipt, treats Kasun as having delivered at Hemmathagama and moves Aranayake's estimate to around 7:05 AM, likely 6:45 to 7:55 AM (DEG-03 / receipt in). Relay counts her stop as delivered from the receipt time.
  - **STM-05 Confirm receipt / flag a line.** Wednesday 8 April, 7:22 AM. A branch that shows the flag path on her confirmed receipt; in the story nothing is flagged. Status bar "7:22". The 7:22 receipt sits underneath with the `scrim` token (#14181F at 40%). Frame 844.
    - Sheet / bottom sheet, 390 x about 594 including the 34 home indicator. Fill `white`, top corners radius 16, shadow 0 8 24 #14181F at 12%, vertical, padding 8 16 16, gap 16.
      - Grabber, 36 x 4, `asphalt-300`, radius 2, centered.
      - Title row, space between. Left stack: line name in Heading 2, quantity in Body `asphalt-700`. Right: Button / quiet / icon only 44 x 44 with `x` 24 (accessible label "Close").
      - Question in Label `asphalt-700`.
      - Two Choice rows, 358 x 56 each, gap 8, 1 px `asphalt-200`, radius 8, padding 0 16, gap 12: radio `circle` 20 in `asphalt-500`, a 20 px icon in `asphalt-700` and Body `asphalt-900`. Selected: 2 px `petrol-700` border, fill `petrol-50`, radio `circle-dot` 20 in `petrol-700`, label in Body strong `asphalt-900`.
      - "How many?" row, space between: label in Body `asphalt-900` and the stepper at 148 x 48.
      - Button / secondary / phone, `camera` 20 leading, with a centered caption in Caption `asphalt-500` under it.
      - Input / text / multiline, 358 x 72, 1 px `asphalt-300`, radius 6, padding 12, placeholder in Body `asphalt-500`.
      - Button / primary / phone, enabled.
    - Content:
      - Title: "Packet foods case" / "44 delivered"
      - Question: "What's wrong?"
      - Choices: `package-x` "Missing", `triangle-alert` "Damaged" (selected)
      - Stepper row: "How many?" / "1" (range 1 to 44, minus disabled at 1)
      - Photo button: "Add a photo". Caption: "A photo helps the dispatcher settle this quickly."
      - Note placeholder: "Add a note (optional)"
      - Button: "Add to receipt"
    - Build rules: "Not cold on arrival" (`thermometer`) appears only on chilled lines, so this dry line offers two choices. The stepper's maximum is the delivered quantity. "Add to receipt" stays disabled (fill `asphalt-200`, text `asphalt-500`) until a reason is picked.
  - **STM-05 Confirm receipt / issue added.** Wednesday 8 April, 7:22 AM, branch. Status bar "7:22". Full length 934. The same frame as STM-05 with two changes:
    - The packet foods line becomes Receipt line / flagged, 326 x about 84: fill `problem-soft`, radius 8, padding 8 12. Left stack: "Packet foods case" in Heading 3 `asphalt-900`, "44 delivered" in Body `asphalt-700`, then a note row, `triangle-alert` 16 plus Label strong, both `problem-strong`: "Flagged: 1 damaged". Right: Button / quiet / phone with `pen-line` 20: "Change".
    - Bottom bar caption: "The dispatcher gets your flag and Kasun's proof together." Button / primary / phone with `send` 20 leading: "Send 1 issue".
  - **STM-05 Confirm receipt / sent with issue.** Wednesday 8 April, 7:22 AM, branch. Status bar "7:22". Header "Your receipt". The content region is replaced:
    - Confirmation panel / issue, 358 x about 228, padding 24, centered, gap 8. A 64 x 64 circle in `problem-soft` with `circle-alert` 32 in `problem-strong`. Title in Heading 1 `asphalt-900`: "Issue sent". Body `asphalt-700`: "The dispatcher can see your flag and Kasun's photo." Label `asphalt-500`: "ORD0098595, sent 7:22 AM"
    - Still to come card, as in "/ confirmed".
    - Bottom action bar, 390 x 106: Button / primary / phone "Back to my orders".
- **Prototype:**
  - STM-05 Confirm receipt / before driver proof: back goes to "STM-04 Arrival tracker / past estimate". "Everything arrived" goes to "STM-05 Confirm receipt / confirmed". The "Flag" buttons have no target.
  - STM-05 Confirm receipt / confirmed: "Back to my orders" goes to "STM-01 My orders / receipt confirmed". "Report a problem" has no target; the build opens the flag sheet with a line picker first.
  - STM-05 Confirm receipt: this frame starts the flow "Store Manager: Report an issue". Back and "Back to my orders" go to "STM-01 My orders / receipt confirmed". "Flag" on Packet foods case goes to "STM-05 Confirm receipt / flag a line" with a Dissolve, so the scrim and sheet fade in over the same receipt. The other two "Flag" buttons and the photo have no target (the build opens a full-screen image viewer with an `x` close).
  - STM-05 Confirm receipt / flag a line: `x` and the scrim go back to "STM-05 Confirm receipt"; "Add to receipt" goes to "STM-05 Confirm receipt / issue added"; all three with a Dissolve.
  - STM-05 Confirm receipt / issue added: "Send 1 issue" goes to "STM-05 Confirm receipt / sent with issue". "Change" goes to "STM-05 Confirm receipt / flag a line" (Dissolve). Back goes to "STM-01 My orders / receipt confirmed".
  - STM-05 Confirm receipt / sent with issue: end of the branch. "Back to my orders" and back have no target, because the matching My orders state is not drawn.
- **Rationale:** This is where the loop closes, and it no longer waits for the driver's phone. At 6:42 AM Dilani checks the lines at her dock against what was loaded for her and confirms while Kasun's record is still on his phone, and her receipt tells the dispatcher Kasun has been there. The six cases she was already told about are marked, so she doesn't report them as missing. At 7:14 his proof arrives and joins her receipt: the photo, the times, who received it, and when it was saved and sent, so a late record never looks like a missing one. Until 4:00 PM a damaged or missing line still reaches the dispatcher with both sides' evidence.

---

## Captions on the canvas (as built)

| Frame | Caption |
|---|---|
| STM-02 Place order | Tue 7 Apr, 2:10 PM · Chilled order filled in: 40 dairy crates, 32 produce crates, 20 meat and fish boxes |
| STM-03 Deferral notice | Tue 6:41 PM · One minute after the plan is published: chilled order moved to Thursday, dry order still coming, the reason |
| STM-01 My orders | Tue 7:30 PM · Dry order expected around 7:15 AM, chilled order moved to Thursday |
| STM-04 Arrival tracker | Wed 8 Apr, 5:20 AM · Expected around 6:35 AM (planned 5:30), 1 stop before you, Kasun Bandara driving |
| STM-05 Confirm receipt | Wed 7:22 AM · Kasun's proof, sent at 7:14 AM, joins the receipt Dilani confirmed at 6:42 AM |
| STM-02 Place order / desktop | Tue 2:10 PM · The same chilled order from the back-office PC. A static reference frame: the phone frames carry the clickable flow. |
| STM-02 Place order / received | Tue 2:10 PM · Received by Waypoint, ORD0098596, with the dry order as the next step |
| STM-02 Place order / dry | Tue 2:14 PM · Dry order filled in: 36 rice and dhal, 44 packet foods, 22 tea and biscuit cases |
| STM-02 Place order / not sent | Tue 2:14 PM · Branch: the same dry order with no connection. Her counts are kept |
| STM-01 My orders / before cutoff | Tue 2:14 PM · Both orders received, 1 h 46 min to the cutoff |
| STM-03 Deferral notice / acknowledged | Tue 6:41 PM · After Got it reaches Relay |
| STM-02 Place order / after cutoff | Tue 7:30 PM · Opened from My orders: a new order now goes on Thursday's run. She sends nothing |
| STM-01 My orders / moved earlier | Tue 9:12 PM · Nuwan swaps stops 3 and 4 on VEH045 so Kasun reaches the Aranayake hill road after first light. Hemmathagama comes earlier: around 6:35 AM, not 7:15 |
| STM-03 Deferral notice / short delivery | Wed 5:05 AM · Sent silently at 2:52 AM: 6 rice and dhal cases short, added to Thursday's dry order |
| STM-01 My orders / on the way | Wed 5:20 AM · Dry order on the way, around 6:35 AM |
| STM-04 Arrival tracker / past estimate | Wed 6:40 AM · After DEG-04 (6:05 AM, in Degradation): the 6:35 estimate has passed, no word from Kasun since 5:41. The goods arrived at 6:36 |
| STM-05 Confirm receipt / before driver proof | Wed 6:42 AM · From the past estimate: she checks the cases at her dock and confirms before Kasun's record arrives |
| STM-05 Confirm receipt / confirmed | Wed 6:42 AM · After Everything arrived: the proof is still on Kasun's phone. Relay counts the receipt as his stop at her store |
| STM-01 My orders / receipt confirmed | Wed 7:22 AM · Confirmed at 6:42 AM, Kasun's proof in at 7:14 AM |
| STM-05 Confirm receipt / flag a line | Wed 7:22 AM · Branch: 1 packet foods case marked damaged |
| STM-05 Confirm receipt / issue added | Wed 7:22 AM · Branch: the flagged line, ready to send |
| STM-05 Confirm receipt / sent with issue | Wed 7:22 AM · Branch: the issue reaches the dispatcher with Kasun's proof |

Section header text:
- "Dilani Jayawardena, Store Manager at Waypoint Fresh Hemmathagama (OUT117), Kegalle district, served from the Kandy hub: rear dock, delivery window 4:00 to 7:45 AM. Her phone on the shop floor (390 x 844) and the back-office PC (1440 x 900), in English. Tuesday 7 April 2026 from 2:10 PM, when she sends tomorrow's orders, to Wednesday 8 April at 7:22 AM, when she opens the receipt she confirmed at 6:42 AM, now with Kasun's proof, which joined it at 7:14 AM."
- "Flow: STM-02 Place order, STM-03 Deferral notice, STM-01 My orders, STM-04 Arrival tracker, STM-05 Confirm receipt, and STM-02 Place order / desktop. The sixteen states follow in story order, each captioned with its moment. Prototype flows: Store Manager flow, Store Manager: Order not sent, Store Manager: Evening notice, Store Manager: Delivery morning, Store Manager: After delivery, Store Manager: Report an issue." (each flow name kept on one line)
- "Relay shows Received by Waypoint, Seen or Receipt confirmed only once the server has the record. A receipt Dilani confirms from the store counts as a stop event on Kasun's run, so the dispatcher's estimates move with it."

---

## Prototype flow starting points

| Flow name | Starts at | Path |
|---|---|---|
| Store Manager flow | STM-02 Place order | Send order, then Place your dry order, then Send order, ending on STM-01 My orders / before cutoff |
| Store Manager: Order not sent | STM-02 Place order / not sent | Try again, ending on STM-01 My orders / before cutoff |
| Store Manager: Evening notice | STM-03 Deferral notice | Got it, then Back to my orders, ending on STM-01 My orders, with a side trip to STM-02 Place order / after cutoff |
| Store Manager: Delivery morning | STM-03 Deferral notice / short delivery | Got it, then Track delivery on STM-01 My orders / on the way, ending on STM-04 Arrival tracker |
| Store Manager: After delivery | STM-04 Arrival tracker / past estimate | Confirm receipt, then Everything arrived, then Back to my orders, then See the receipt and Kasun's proof, ending on STM-05 Confirm receipt |
| Store Manager: Report an issue | STM-05 Confirm receipt | Flag on Packet foods case, then Add to receipt, then Send 1 issue, ending on STM-05 Confirm receipt / sent with issue |

The store step sets these names, the ones Figma lists; `prototype/30-flow-starts.js` keeps them (earlier builds named the first "Store Manager: Order before cutoff", which it still renames). The Store Manager step wires 35 links; every link stays inside the section.

---

## Components needed

Components from the style guide used as they are: Button (primary, secondary, quiet; phone size), Status chip (Chilled, deferred, delivered, waiting to send), Notice (info, attention, problem, done), Input (number stepper, segmented control, text), Sheet (bottom sheet), Order row (order card, phone), Stop row. The items below are new, or new variants.

| Component | Variants | Used in |
|---|---|---|
| Type styles (in the style guide) | Button 15/22 SemiBold, Label strong 13/18 SemiBold, Body strong 15/22 SemiBold | Every frame |
| Status chip, store variants | Dry (`package`), Received by Waypoint (`clipboard-list`), Scheduled (`calendar-clock`), On the way (`truck`), Receipt confirmed (`circle-check`), Short (count label), Estimate passed (waiting to send style, `history`). Deferred gets a per-order label, such as "Moved to Thursday" | STM-01 all states, STM-02 / received, STM-03 all, STM-04 all, STM-05 all |
| Order card (phone) | received, scheduled, moved earlier, moved, on the way, receipt confirmed. Slots: chip row (wraps), headline block, optional info note, optional attention reason, divider, contents, meta line led by the order ID, optional attention link row, optional detail row, optional button, optional link row | STM-01 all states |
| Top bar / phone header without sync pill | home (title and store line, no buttons); back (back button, title) | Every phone frame |
| Account footer | name with `user` icon, quiet Sign out button | STM-01 all states |
| Desktop app bar / store | store block, two nav tabs (active, inactive), user block, sign out | STM-02 / desktop |
| Button / quiet / icon only | 44 x 44 on every Store Manager device | Back buttons, STM-02 / desktop, STM-05 / flag a line |
| Button, disabled state | primary and secondary, phone size | STM-02 / after cutoff, STM-05 / flag a line (build) |
| Cutoff line | countdown (under 4 hours left), under one hour (attention), time (one line, 4 hours or more left), next run (two lines, after a cutoff), closed (attention) | STM-01 all states, STM-02 all, STM-02 / desktop |
| Section header | date label plus Heading 2 summary | STM-01 all states |
| Case type row (phone) | with stepper at 0 (minus disabled) and above 0 | STM-02, / dry, / not sent, / after cutoff |
| Case table (desktop) | header row, case row with stepper and line totals, total row | STM-02 / desktop |
| Order totals row | cases, kg, m³; zero state | STM-02 bottom bars |
| Input / number stepper / store | 148 x 48, radius 6, typeable value, min and max disabled ends | STM-02 all, STM-05 / flag a line |
| Input / segmented control / with icons | radius 6 track and segments, selected icon in its status color, count badge on an unselected segment that holds unsent counts | STM-02 all, STM-02 / desktop |
| Input / text / multiline | 72 high, placeholder | STM-05 / flag a line |
| Bottom action bar | one button; caption plus button; two buttons; done notice plus button; totals plus button; totals, button and caption; waiting notice, totals and button. Includes the 34 px home indicator | Every phone frame except STM-01 and STM-04 |
| Confirmation panel | done (`done-soft` circle), issue (`problem-soft` circle); title, body, optional order ID, meta | STM-02 / received, STM-05 / confirmed, STM-05 / sent with issue |
| Detail row | icon plus text; icon plus label and value; icon plus text and sub line | STM-01 to STM-05 |
| Link row | neutral (petrol text); attention (`attention-soft` fill) | STM-01 all states |
| Notice, store variants | done (one line, `done-soft`, `circle-check`); compact inline inside a card (info and attention); waiting with `wifi-off` for not sent (`waiting-soft`, 1 px `asphalt-300` border); info on white for after cutoff and short delivery | STM-01, STM-02, STM-03 |
| Change block | Was and Now rows with strikethrough on Was; lock row | STM-03 |
| Arrival card | on the way (Display time, window, Planned line, stops before you, last heard); past estimate (named times, Heading 2 message, receipt prompt with Confirm receipt) | STM-04 all |
| Stop progress list (store view) | 56 high rows: delivered, current (`signal-400` marker), last known (marker with "Last heard" status), your store (`petrol-50`); connector rail. A compact, read-only variant of Stop row | STM-04 all |
| Person row | avatar circle with user icon, name, role line, meta line | STM-04 all |
| Proof of delivery card | full (72 x 72 thumbnail, three fact lines, photo and location row, sent-later caption); waiting ("Driver's proof: waiting for Kasun's phone") | STM-05 all |
| Photo thumbnail and viewer | 72 x 72 with enlarge badge; full-screen viewer with close | STM-05 |
| Receipt line | loaded, delivered, with note, flagged (missing, damaged, not cold), read-only (56 high); the lines card title row carries the case total | STM-05 all, STM-03 / short delivery |
| Choice row | unselected, selected, disabled; icon plus label | STM-05 / flag a line |
| System status bar | time plus signal, or `wifi-off` (frame dressing) | Every phone frame |

Count: 30 entries.

---

## Derived values

Every other value on these frames is copied from `05-scenario-data.md` v0.4. These follow directly from it:

1. Desktop line totals, quantity times the case size: dairy crates 40 x 8.4 kg = 336.0 kg and 40 x 0.038 m³ = 1.520 m³; produce crates 32 x 5.6 kg = 179.2 kg and 32 x 0.042 m³ = 1.344 m³; meat and fish boxes 20 x 7.2 kg = 144.0 kg and 20 x 0.030 m³ = 0.600 m³. They add up to the order's 659.2 kg and 3.464 m³.
2. Countdowns to the 4:00 PM cutoff: "1 h 50 min left" at 2:10 PM, "1 h 46 min left" at 2:14 PM.
3. "96 cases" on her receipt: the 102 ordered less the 6 rice and dhal cases moved to Thursday (the scenario's "Kasun's stop 3 now shows 96 cases").
4. "1 stop before you" at 5:20 AM: stop 1 is delivered and stop 2, Mawanella, is next.
5. "Last heard from Kasun 5:20 AM" at 5:20: his phone checks in once a minute and everything is synced.
6. The flag stepper's range, 1 to 44: the delivered quantity of the packet foods line.
7. Notification texts (6:41 PM, 9:12 PM, 2:52 AM) are copy written for the build, built from the scenario's facts; they add no new facts.

## Cross-role agreements

- The dispatcher's deferral record for ORD0098596 shows "Seen 6:41 PM" once Dilani taps Got it (scenario fact 18), and the DSP-03 message preview is STM-03 at desktop scale.
- The shortfall (LDR-02, LDR-03, DSP-04) and STM-03 / short delivery agree: 6 rice and dhal cases, decided at 2:52 AM, added to ORD0098747, marked from Wednesday. The dispatcher's shortfall record shows "Seen 5:05 AM" (scenario fact 19).
- DRV-03 and STM-05 agree on the proof: arrived 6:21, delivered 6:36, received by W. Rathnayake, photo at the rear dock, location stamp at OUT117.
- DEG-04 (6:05) and STM-04 use one estimate rule and the same stop list; DEG-03 / receipt in (6:42) shows her receipt as Kasun's delivery at Hemmathagama.
- Every role names Planned and Expected; store screens round Expected to 5 minutes and never show being behind Planned as a problem.

## Open questions

1. **How notices reach her when the app is closed.** The 6:41 PM deferral, the 9:12 PM change and the 2:52 AM short delivery need to reach Dilani outside the app. Web push works on Android browsers but needs setup on iPhone. SMS needs a gateway. The team should choose one for the Hackathon build; the in-app screens work either way.
2. **Button size names.** The style guide names Button sizes by device (desktop 36, phone 48), but gives the Store Manager 48 px buttons on any device, so this spec uses the "phone" size on the desktop frame. Consider renaming the sizes to compact, comfortable and field so the name no longer implies a device. `components.md` lists the sizes by density for now.
