# Loader guide

Mohamed Rizwan is the loading supervisor on the night shift at the Kandy hub dock. In Relay, Rizwan loads each truck in reverse stop order on a dock tablet shared with Suresh and Anjali, flags missing or damaged cases for the dispatcher, and hands each load to its driver on one record that both of them confirm.

**Open it.** Go to https://relay-ryzera.tech in a tablet-size window (1024 x 768) or on a phone (390 x 844). The shared walkthrough holds its clock at 2:05 PM, so open **Demo controls** in the bar at the top (a sliders icon on a phone), choose **Start a private copy**, then press **Go** beside **2:40 AM: Loading at the Kandy hub**. On "Who is signing in?", tap **Loader**: Rizwan is already picked, so enter the PIN `2580`.

## LDR-01 Tonight's loads

- **What it is for:** Showing every load at the hub tonight, grouped as Loading, Ready to leave, Still to load, Already left and In the workshop, with when each one leaves and who is signed in on the tablet.
- **How to reach it:** It is the first screen after sign in. Tap **Switch**, pick Rizwan, Suresh or Anjali and enter their PIN (Suresh `4826`, Anjali `1357`; in the demo the sheet shows it). The lock button locks the tablet, and it locks itself after 15 minutes with no taps.
- **Notice:** Suresh's screens come up in Tamil and Anjali's in Sinhala, because each loader's language comes back when they sign in. Above VEH045 a banner reads "VEH045 stops 2 and 3 swapped", says who changed the plan and when, and warns that lists printed before then are wrong for this truck.

## LDR-02 Load vehicle

- **What it is for:** Loading one truck in the order that makes unloading work, with one tap a line once all its cases are on.
- **How to reach it:** On Tonight's loads, tap the VEH045 card.
- **Notice:** The lines run in reverse stop order, heaviest case type first: "Stop 4 goes in first, at the cab end". Hemmathagama shows "Was stop 2 until" the time of the change. At tablet width a load map draws the truck from cab end to doors beside the lines. When a finished stop folds away, the list holds still, so nothing moves under a gloved finger. Press and hold a line to count part of it on.

## LDR-03 Flag a shortfall

- **What it is for:** Recording missing or damaged cases in a couple of taps, so the dispatcher can decide before the truck leaves while loading goes on.
- **How to reach it:** On stop 3's Rice and dhal line, tap **Flag**. Keep **Missing**, set 6 and tap **Flag 6 missing**.
- **Notice:** The sheet says "Only 30 were on the shelf. All 30 are on the truck.", and the line then waits for Nuwan while the other lines still load. Nuwan's answer arrives in the bottom bar with **See answer**, and the line reads "30 loaded, 6 short" and "6 come on Thursday". If nobody signed in as Nuwan has used the copy for a few minutes, Relay answers in Nuwan's place five minutes after the flag. A photo is asked for only when cases are damaged.

## LDR-04 Handover

- **What it is for:** One record of what is short and why, and the planned and loaded cases for each stop, confirmed by Rizwan and accepted by Kasun before the truck leaves.
- **How to reach it:** Tap each remaining line, then **Go to handover**. Check the totals (383 planned, 377 loaded) and tap **Load complete**. Kasun accepts on the driver's phone: sign in as `kasun` with the password `relay2026`, press **Go** beside **3:16 AM: Handover at the dock** and tap **Accept load**. If the phone has no signal, tap **Kasun accepts on this tablet** and enter Kasun's PIN `3690`.
- **Notice:** The shortfall comes first, with who flagged it, who decided and when the store was told. The table runs in stop order, the way Kasun unloads. If Kasun's phone has not answered after a minute, the tablet says so and **Kasun accepts on this tablet** becomes the main button.

## Where the code lives

The screens are in [apps/web/src/roles/loader/](../../apps/web/src/roles/loader/), and their words in English, Sinhala and Tamil are in [apps/web/src/i18n/loader.ts](../../apps/web/src/i18n/loader.ts). The server side is [apps/api/src/relay_api/services/dock.py](../../apps/api/src/relay_api/services/dock.py).

Tests: [apps/api/tests/test_dock.py](../../apps/api/tests/test_dock.py), steps 9 to 12 of [e2e/tests/walkthrough.spec.ts](../../e2e/tests/walkthrough.spec.ts), and the loader's PIN sign-in and wrong PIN in [e2e/tests/roles.spec.ts](../../e2e/tests/roles.spec.ts).
