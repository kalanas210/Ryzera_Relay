import type { Page, Response } from "@playwright/test";
import { type DemoState, expect, test } from "../support/relay";
import { dockTap, drag, expectAllSynced, minuteOrNext, photo, sign } from "../support/screens";

/** The README's judge walkthrough, end to end, in the order it is written, in one private copy of the day. The steps a
 *  judge performs are done through the screens; the demo bar's jumps between them go through the demo API, except
 *  where the README has the judge press the bar itself. Each step checks what the README tells the judge to notice.
 *
 *  One browser context holds all four roles, one tab each, as the README suggests: the dispatcher at a desk
 *  (1440 x 900), the store manager, the loader and the driver on a phone (375 x 812). Step 22, trying the engine,
 *  starts another copy, so it is a test of its own and runs beside the first. */

test("the judge walkthrough, from the first order to the outlook @desk", async ({ copy, page: desk }) => {
  // a plan proposal and a dozen jumps of the story autopilot: 1.5 to 2.5 minutes on a fresh database
  test.setTimeout(5 * 60_000);

  let store!: Page;
  let dock!: Page;
  let phone!: Page;

  await test.step("1. Start a private copy from the sign-in page", async () => {
    await desk.setViewportSize({ width: 1440, height: 900 });
    await desk.goto("/signin");
    await expect(desk.getByRole("heading", { name: "Who is signing in?" })).toBeVisible();
    await desk.getByRole("button", { name: "Demo controls" }).click();
    const controls = desk.getByRole("dialog", { name: "Demo controls" });
    const code = controls.getByText(/This is a private copy of the day, walkthrough [A-Z0-9]{6}\./);
    // the browser is already in the copy the test began in; the button starts another, with a new code
    await expect(code).toContainText(copy.code);
    await controls.getByRole("button", { name: "Start a private copy" }).click();
    await expect(code).not.toContainText(copy.code);
    const started = /walkthrough ([A-Z0-9]{6})/.exec((await code.textContent()) ?? "")?.[1];
    expect(started).toMatch(/^[A-Z0-9]{6}$/);
    await controls.getByRole("button", { name: "Close" }).click();
    // the bar names this copy and its clock, which is this browser's alone
    await expect(desk.getByText(`Walkthrough ${started}`, { exact: true })).toBeVisible();
    // every later call from this browser works in the new copy: its cookie replaced the first one
    const state = await copy.state();
    expect(state.workspace.code).toBe(started);
    expect(state.workspace.is_default).toBe(false);
  });

  await test.step("2. Dilani places the chilled and the dry order", async () => {
    await copy.signIn("store_manager");
    store = await copy.open("store_manager");
    await expect(store.getByRole("heading", { name: "My orders" })).toBeVisible();
    await store.getByRole("button", { name: "Place an order" }).click();
    await expect(store.getByRole("heading", { name: "Place an order" })).toBeVisible();
    // the cutoff countdown, and chilled selected
    await expect(store.getByText("Orders for Wednesday close at 4:00 PM")).toBeVisible();
    await expect(store.getByText(/^1 h 5\d min left$/)).toBeVisible();
    await expect(store.getByRole("radio", { name: "Chilled" })).toBeChecked();
    await expect(store.getByText("Send dry goods as their own order.", { exact: false })).toBeVisible();

    await store.getByRole("textbox", { name: "Dairy crate" }).fill("40");
    await expect(store.getByText("40 cases")).toBeVisible();
    await store.getByRole("textbox", { name: "Produce crate" }).fill("32");
    await store.getByRole("textbox", { name: "Meat and fish box" }).fill("20");
    // weight and volume worked out as the counts go in
    await expect(store.getByText("92 cases")).toBeVisible();
    await expect(store.getByText("659.2 kg")).toBeVisible();
    await expect(store.getByText("3.464 m³")).toBeVisible();
    await store.getByRole("button", { name: "Send order" }).click();
    await expect(store.getByRole("heading", { name: "Received by Waypoint" })).toBeVisible();
    await expect(store.getByText("ORD0098596")).toBeVisible();
    await expect(store.getByText("Your chilled order is in the queue for Wednesday.")).toBeVisible();

    await store.getByRole("button", { name: "Place your dry order" }).click();
    await expect(store.getByRole("radio", { name: "Dry" })).toBeChecked();
    await expect(store.getByText("Dry goods only. Chilled goods go as their own order.")).toBeVisible();
    await store.getByRole("textbox", { name: "Rice and dhal case" }).fill("36");
    await store.getByRole("textbox", { name: "Packet foods case" }).fill("44");
    await store.getByRole("textbox", { name: "Tea and biscuit case" }).fill("22");
    await expect(store.getByText("102 cases")).toBeVisible();
    await expect(store.getByText("685.6 kg")).toBeVisible();
    await expect(store.getByText("3.772 m³")).toBeVisible();
    await store.getByRole("button", { name: "Send order" }).click();
    await expect(store.getByRole("heading", { name: "Received by Waypoint" })).toBeVisible();
    await expect(store.getByText("ORD0098595")).toBeVisible();
    await expect(store.getByText("Your dry order is in the queue for Wednesday.")).toBeVisible();
  });

  await test.step("3. Nuwan watches the Kandy hub queue up to the cutoff", async () => {
    await copy.signIn("dispatcher");
    await desk.goto("/dispatcher");
    await expect(desk.getByRole("heading", { name: "Order queue" })).toBeVisible();
    await desk.getByRole("radio", { name: "Kandy hub" }).click();
    await expect(desk.getByRole("radio", { name: "Kandy hub" })).toBeChecked();
    const kandy = desk.getByRole("button", { name: /^Kandy hub \d+ VEH039 and VEH058 are in the workshop$/ });
    await expect(kandy).toBeVisible();
    const kandyOrders = async () => Number(/Kandy hub\s*(\d+)/.exec(await kandy.innerText())?.[1]);
    const before = await kandyOrders();
    expect(before).toBeGreaterThan(0);

    await desk.getByRole("button", { name: "Jump to 3:12 PM: Chasing the last orders" }).click();
    await expect(desk.getByRole("button", { name: "Jump to 4:00 PM: Cutoff: the queue locks" })).toBeVisible();
    // orders arrive as the other stores order
    await expect.poll(kandyOrders).toBeGreaterThan(before);
    await expect(desk.getByRole("heading", { name: "Not ordered yet" })).toBeVisible();
    await expect(desk.getByRole("row", { name: /ORD0098599 OUT119 Kegalle Chilled .* Waited Monday$/ })).toBeVisible();

    await desk.getByRole("button", { name: "Jump to 4:00 PM: Cutoff: the queue locks" }).click();
    await expect(desk.getByText("Locked at 4:00 PM", { exact: true })).toBeVisible();
    await expect(
      desk.getByRole("button", { name: "Kandy hub 57 VEH039 and VEH058 are in the workshop", exact: true }),
    ).toBeVisible();
    // the chilled summary as a screen reader reads it, each term followed by its own value
    await expect(desk.locator("body")).toMatchAriaSnapshot(`
      - paragraph: Kandy hub chilled for Wednesday
      - term: Chilled orders
      - definition: "23"
      - term: Weight
      - definition: 8,144.5 kg
      - term: Volume
      - definition: 43.630 m³
      - term: Refrigerated vehicles free
      - definition: 5 of 7
      - paragraph: VEH039 and VEH058 are in the workshop.
    `);
  });

  await test.step("4. Nuwan proposes the plan and tries a move that breaks the rules", async () => {
    await desk.getByRole("button", { name: "Go to plan board" }).click();
    await expect(desk.getByRole("heading", { name: "Plan board" })).toBeVisible();
    await expect(desk.getByRole("radio", { name: "Kandy hub" })).toBeChecked();
    await desk.getByRole("button", { name: "Propose plan" }).click();
    await expect(desk.getByText("Kandy hub: 57 orders, 56 on 18 trips, 1 waits.")).toBeVisible({ timeout: 120_000 });
    const card = desk.getByRole("button", { name: /^OUT117 Hemmathagama ORD0098596 · Fresh chilled/ });
    await expect(card).toBeVisible();
    await expect(desk.getByRole("button", { name: /^Trip 1 · Kegalle .*leaves 3:29\sAM/ })).toBeVisible();

    await desk.getByRole("radio", { name: /^Refrigerated/ }).click();
    const target = desk.getByRole("button", { name: /^Trip 2 · Kegalle (All rules pass|Rule broken)/ });
    await expect(target).toHaveCount(1);
    await drag(desk, card, target);
    await expect(target).toContainText("3 rules broken");
    await expect(desk.getByText("Fix 3 broken rules to publish.")).toBeVisible();
    await expect(
      desk.getByText("Every order is placed, but VEH057 trip 2 now breaks 3 rules.", { exact: false }),
    ).toBeVisible();
    // the three broken rules, in the trip's own words (the README names Aranayake, but the stop past its close is
    // OUT117 Hemmathagama itself, at 8:01 AM after its 7:45 close)
    await expect(
      desk.getByText("Weight: 1,460.8 of 1,040 kg. Volume: 7.676 of 7.0 m³. Window: OUT117 at 8:01 AM, closes 7:45."),
    ).toBeVisible();

    await desk.keyboard.press("Control+z");
    await expect(desk.getByText("Kandy hub: 57 orders, 56 on 18 trips, 1 waits.")).toBeVisible();
    await expect(card).toBeVisible();
    await expect(target).toHaveAccessibleName(/^Trip 2 · Kegalle All rules pass/);
    await expect(desk.getByText("Fix 3 broken rules to publish.")).toBeHidden();
  });

  await test.step("5. Nuwan reviews the deferral and confirms Relay's reason", async () => {
    await desk.getByRole("button", { name: "Review deferral" }).first().click();
    const drawer = desk.getByRole("dialog", { name: "Deferrals for the Kandy hub" });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText("Unavoidable: one chilled order waits", { exact: true })).toBeVisible();
    await expect(
      drawer.getByRole("heading", { name: "5 refrigerated vehicles can serve 22 of the 23 chilled orders" }),
    ).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "Relay's choice: which order waits" })).toBeVisible();
    // rule 1 leaves only OUT117 and OUT119, and rule 2 protects OUT119 Kegalle because its Monday order waited
    await expect(drawer.getByText(/Only OUT117 and OUT119 could wait without taking another vehicle/)).toBeVisible();
    await expect(drawer.getByText("OUT119 Kegalle had its Monday chilled order wait, so it rides.")).toBeVisible();
    await expect(drawer.getByRole("heading", { name: "What the choice costs" })).toBeVisible();
    await expect(drawer.getByText("Thursday checked: VEH039's Kegalle run has room, planned 4:00 AM.")).toBeVisible();
    await expect(drawer.getByText("What OUT117 will see")).toBeVisible();
    await drawer.getByRole("button", { name: "Use Relay's reason" }).click();
    await expect(drawer.getByText("Deferral ready")).toBeVisible();
    await drawer.getByRole("button", { name: "Confirm deferral" }).click();
    await expect(desk.getByRole("heading", { name: "Publish check" })).toBeVisible();
  });

  await test.step("6. Nuwan jumps to 6:39 PM and publishes the Kandy hub plan", async () => {
    await desk.getByRole("button", { name: "Demo controls" }).click();
    const controls = desk.getByRole("dialog", { name: "Demo controls" });
    const jumped = desk.waitForResponse(isJump, { timeout: 120_000 });
    await controls.getByRole("button", { name: "Go to 6:39 PM, Publishing the plan" }).click();
    // Relay published Peliyagoda at 6:31 PM on the way, and plays none of the steps Nuwan already took
    const played = await playedBy(jumped);
    expect(played).toContain("Nuwan publishes Peliyagoda");
    expect(played, "Nuwan proposed the Kandy plan in step 4").not.toContain("Relay proposes the Kandy plan");
    expect(played, "Nuwan confirmed the deferral in step 5").not.toContain(
      "Nuwan confirms the deferral with Relay's reason",
    );
    await expect(desk.getByText(/Nuwan publishes Peliyagoda/)).toBeVisible();
    await controls.getByRole("button", { name: "Close" }).click();

    await expect(desk.getByRole("heading", { name: "Publish check" })).toBeVisible();
    await expect(desk.getByText("No planned arrival is after its window closes.")).toBeVisible();
    await expect(
      desk.getByText("Relay expects 6 of the 53 Fresh stops to arrive after their window", { exact: true }),
    ).toBeVisible();
    await expect(desk.getByRole("columnheader", { name: "Why Relay keeps it" })).toBeVisible();
    // the plan bar and the foot of the Publish check both have a Publish plan button, and nothing names the check's
    // section, so the one under the table is the last on the page
    await desk.getByRole("button", { name: "Publish plan" }).last().click();
    const confirm = desk.getByRole("dialog", { name: "Publish the Kandy hub plan?" });
    await expect(confirm.getByText("When you publish")).toBeVisible();
    await expect(
      confirm.getByText("OUT117 Hemmathagama gets a notice with the new date and the reason."),
    ).toBeVisible();
    await confirm.getByRole("button", { name: "Publish plan" }).click();
    await expect(desk.getByText(new RegExp(`^Published ${minuteOrNext("6:39 PM").source}$`))).toBeVisible();
    await expect(desk.getByText("Sent to the dock, the drivers and every store on these trips.")).toBeVisible();
  });

  await test.step("7. Dilani reads the notice at 6:41 PM", async () => {
    const { played } = await copy.jump("evening");
    expect(played, "Nuwan published the Kandy plan in step 6").not.toContain("Nuwan publishes the Kandy plan");
    await store.goto("/store");
    await expect(store.getByRole("heading", { name: "1 order coming, 1 moved to Thursday" })).toBeVisible();
    await expect(store.getByRole("heading", { name: "Expected around 5:20 AM" })).toBeVisible();
    await expect(store.getByText("Dry-box truck VEH045, Kandy hub")).toBeVisible();
    // Opening the notice marks it read in the background. A Got it answered before that read comes back is
    // overwritten by it and shows Got it again until the next refresh, so the notice is read first, as a person does.
    const read = store.waitForResponse(
      (r) => r.request().method() === "POST" && /\/api\/store\/notices\/[^/]+\/read$/.test(new URL(r.url()).pathname),
    );
    await store.getByRole("link", { name: "Read the notice" }).click();
    await expect(store.getByText("Was", { exact: true })).toBeVisible();
    await expect(store.getByText("Now", { exact: true })).toBeVisible();
    await expect(store.getByRole("heading", { name: "Why it moved" })).toBeVisible();
    expect((await read).ok()).toBe(true);
    await store.getByRole("button", { name: "Got it" }).click();
    await expect(
      store.getByText(new RegExp(`^Seen ${minuteOrNext("6:41 PM").source}\\. The dispatcher can see this\\.$`)),
    ).toBeVisible();
  });

  await test.step("8. Nuwan moves Mawanella earlier on VEH045 and reads the cost first", async () => {
    await desk.goto("/dispatcher/plan");
    await desk.getByRole("radio", { name: /^Ambient/ }).click();
    await desk.getByRole("button", { name: /^Trip 1 · Kegalle .*leaves 3:29\sAM/ }).click();
    await expect(desk.getByRole("heading", { name: "VEH045 · Trip 1" })).toBeVisible();
    await desk.getByRole("button", { name: "Move Mawanella earlier, to stop 2" }).click();
    const swap = desk.getByRole("dialog", { name: "Swap stops 2 and 3 on VEH045?" });
    await expect(swap).toBeVisible();
    await expect(swap.getByText("Hemmathagama becomes stop 3: expected 6:25 AM, was 5:20 AM")).toBeVisible();
    await expect(swap.getByText(/Aranayake/).first()).toBeVisible();
    await expect(swap.getByText("When you confirm")).toBeVisible();
    await swap
      .getByRole("textbox", { name: "Why (kept on the record)" })
      .fill("Mawanella's curb is a bus stop from 5:30 AM");
    await swap.getByRole("button", { name: "Swap stops" }).click();
    await expect(swap).toBeHidden();
    // Mawanella is stop 2 now, and Hemmathagama stop 3
    await expect(desk.getByRole("button", { name: "Move Mawanella earlier, to stop 1" })).toBeVisible();
    await expect(desk.getByRole("button", { name: "Move Hemmathagama earlier, to stop 2" })).toBeVisible();
  });

  await test.step("9. Rizwan loads VEH045 at 2:40 AM and flags 6 rice and dhal cases missing", async () => {
    const state = await copy.jump("loading");
    expect(state.played).toContain("Rizwan loads the last stop first");
    expect(state.played, "the swap was Nuwan's, made by hand").not.toContain("Nuwan swaps two stops on Kasun's run");
    await copy.signIn("loader");
    dock = await copy.open("loader");
    await expect(dock.getByRole("heading", { name: "Tonight's loads" })).toBeVisible();
    await expect(dock.getByRole("heading", { name: "VEH045 stops 2 and 3 swapped" })).toBeVisible();
    await dock.getByRole("button", { name: /^VEH045 Leaves 3:29\sAM/ }).click();
    await expect(dock.getByText(/Stop 4 goes in first, at the cab end\./).filter({ visible: true })).toBeVisible();
    await expect(dock.getByText(/^Was stop 2 until/).first()).toBeVisible();

    await expect(dock.getByRole("button", { name: /^36 Rice and dhal .*Stop 3/ })).toBeVisible();
    // each line's Flag button is described by the line's case and stop
    await dock.getByRole("button", { name: "Flag", exact: true, description: /^Rice and dhal Stop 3/ }).click();
    const flag = dock.getByRole("dialog");
    await expect(flag.getByRole("radio", { name: "Missing" })).toBeChecked();
    await flag.getByRole("textbox").fill("6");
    await expect(flag.getByText("Only 30 were on the shelf. All 30 are on the truck.")).toBeVisible();
    await flag.getByRole("button", { name: "Flag 6 missing" }).click();
    // the line waits for Nuwan while loading goes on
    await expect(
      dock.getByRole("button", { name: /^30 of 36 Rice and dhal Stop 3 .*Waiting for Nuwan$/ }),
    ).toBeVisible();
    await expect(dock.getByRole("button", { name: /^44 Packet foods Stop 3/ })).toBeEnabled();
  });

  await test.step("10. Nuwan decides the shortfall on Live", async () => {
    await desk.goto("/dispatcher/live");
    const exceptions = desk.getByRole("region", { name: "Exceptions" });
    const shortfall = exceptions.getByRole("article").filter({
      has: desk.getByRole("button", { name: /^6 rice and dhal cases missing on VEH045, stop 3/ }),
    });
    await expect(shortfall).toBeVisible();
    // what the shelf and the hub hold
    await expect(shortfall.getByText("Dry · 30 of 36 rice and dhal cases on the shelf")).toBeVisible();
    await expect(
      shortfall.getByText(
        "No spare at the hub. The next rice and dhal delivery comes at 5:00 AM, after VEH045 leaves.",
      ),
    ).toBeVisible();
    // both choices
    await expect(shortfall.getByRole("button", { name: "Send short, no replacement" })).toBeVisible();
    await shortfall.getByRole("button", { name: "Send short, add to Thursday" }).click();
    await expect(exceptions.getByText("Dilani Jayawardena was told.").first()).toBeVisible();
    await expect(exceptions.getByText(/ORD0098747/).first()).toBeVisible();
  });

  await test.step("11. Rizwan finishes loading and completes the handover", async () => {
    await dock.reload();
    await expect(
      dock.getByRole("button", { name: /^30 of 36 Rice and dhal Stop 3 .*30 loaded, 6 short 6 come on Thursday$/ }),
    ).toBeVisible();
    await expect(dock.getByRole("status").filter({ hasText: /Nuwan answered:\s*stop 3 rice and dhal/ })).toBeVisible();
    // each remaining line, tapped as its cases go on: a line still to load reads only its count, case, stop and kind
    const toLoad = dock.getByRole("button", { name: /^\d+ (Rice and dhal|Packet foods|Tea and biscuit) Stop \d Dry$/ });
    await expect(toLoad).toHaveCount(8);
    for (let left = 8; left > 0; left--) {
      await toLoad.first().click();
      await expect(toLoad).toHaveCount(left - 1);
    }
    // the dock's next-page buttons take no tap in their first half second, so a double tap never skips the totals
    await dockTap(
      dock.getByRole("button", { name: "Go to handover" }),
      dock.getByRole("heading", { name: "Shortfall" }),
    );
    // the shortfall, and the planned and loaded cases per stop: 383 planned, 377 loaded
    await expect(dock.getByText("6 rice and dhal cases missing from ORD0098595.")).toBeVisible();
    await expect(dock.getByRole("heading", { name: "Planned and loaded" })).toBeVisible();
    await expect(dock.getByText(/Total cases\s*383\s*377/)).toBeVisible();
    await dockTap(
      dock.getByRole("button", { name: "Load complete" }),
      dock.getByRole("heading", { name: "Waiting for Kasun to accept" }),
    );
    await expect(dock.getByRole("button", { name: "Kasun accepts on this tablet" })).toBeVisible();
  });

  await test.step("12. Kasun accepts the load at the 3:16 AM handover and leaves", async () => {
    const { played } = await copy.jump("handover");
    expect(played, "Nuwan answered the flag in step 10").not.toContain("Nuwan answers: send short, add to Thursday");
    expect(played, "Rizwan finished loading in step 11").not.toContain("Rizwan finishes loading");
    await copy.signIn("driver");
    phone = await copy.open("driver");
    await expect(phone.getByRole("heading", { name: "Today's run" })).toBeVisible();
    await expect(phone.getByText("Stop 3 is 6 rice and dhal cases short")).toBeVisible();
    await expect(phone.getByRole("heading", { name: "Planned and loaded" })).toBeVisible();
    await expect(phone.getByText(/Total cases\s*383\s*377/)).toBeVisible();
    await phone.getByRole("button", { name: "Accept load" }).click();
    await expect(phone.getByText(new RegExp(`Load accepted ${minuteOrNext("3:16 AM").source}`))).toBeVisible();
    // Relay has a record once the phone reads All synced. A record saved while the one before it is still on its
    // way waits for the next send (the minute check-in), so each tap here waits for the one before to arrive.
    await expectAllSynced(phone);
    // Leave the hub saves the time the truck drives out
    await phone.getByRole("button", { name: "Leave the hub" }).click();
    await expect(phone.getByText(new RegExp(`Left Kandy hub ${minuteOrNext("3:16 AM").source}`))).toBeVisible();
    await expectAllSynced(phone);
  });

  await test.step("13. Kasun records the first stop, Kegalle, at 4:52 AM", async () => {
    const { played } = await copy.jump("first_stop");
    expect(played).toContain("Kasun arrives at Kegalle");
    // Kasun's own taps reached Relay before the jump, so the autopilot leaves them alone
    expect(played, "Kasun accepted the load in step 12").not.toContain("Kasun accepts the load");
    expect(played, "Kasun left the hub in step 12").not.toContain("Kasun leaves the hub");
    await phone.goto("/driver");
    await phone.getByRole("button", { name: "Open stop 1" }).click();
    const arrival = phone.getByRole("status").filter({ hasText: "Arrived 4:52 AM. 30 min behind plan" });
    await expect(arrival).toBeVisible();
    // beside it the time Relay expected, and the receiving window
    await expect(arrival.getByText(/^Expected around 4:\d\d\sAM$/)).toBeVisible();
    await expect(phone.getByText("Receiving window", { exact: true })).toBeVisible();
    await expect(phone.getByText("3:00 to 8:00 AM", { exact: true })).toBeVisible();
    await phone.getByRole("button", { name: "Record delivery" }).click();
    await phone.getByRole("textbox", { name: "Receiver's name" }).fill("S. Perera");
    await phone.getByLabel(/Take a photo/).setInputFiles(photo());
    await phone.getByRole("button", { name: "Complete stop" }).click();
    await expect(phone.getByText("Relay has it, and the store can see it now.")).toBeVisible();
    // the photo follows the record; both are with Relay before the signal drops
    await expectAllSynced(phone);
  });

  await test.step("14. The signal drops near Mawanella and Kasun records stop 2 on the phone", async () => {
    await copy.jump("signal_lost");
    await phone.goto("/driver");
    await expect(phone.getByRole("switch", { name: "Kasun's phone: storm until 7:14 AM" })).toBeChecked();
    await phone.getByRole("button", { name: "Open stop 2" }).click();
    await phone.getByRole("button", { name: "Record delivery" }).click();
    await phone.getByRole("textbox", { name: "Receiver's name" }).fill("R. Silva");
    await phone.getByRole("button", { name: "Use a signature instead" }).click();
    const sheet = phone.getByRole("dialog");
    await sign(phone, sheet.getByRole("img", { name: /Signature box/ }));
    await sheet.getByRole("button", { name: "Use this signature" }).click();
    // In the storm the phone hands what it saves to the demo's stand-in for its memory, which is all that keeps the
    // next jump from recording stop 2 itself: the test waits for that hand-off before it moves on
    const handed = phone.waitForResponse(
      (r) =>
        r.request().method() === "POST" &&
        new URL(r.url()).pathname === "/api/driver/held" &&
        (r.request().postDataJSON() as { records: { kind: string }[] }).records.some((x) => x.kind === "delivered"),
    );
    await phone.getByRole("button", { name: "Complete stop" }).click();
    expect((await handed).ok(), "the phone handed its stop 2 record to the storm's stand-in").toBe(true);
    await expect(phone.getByText("Stop 2 saved on this phone")).toBeVisible();
    await expect(phone.getByRole("status").filter({ hasText: "1 stop to send" })).toBeVisible();
    // the run and the waiting record come back from the phone
    await phone.goto("/driver");
    await expect(phone.getByRole("heading", { name: "VEH045 · Trip 1 · Fresh dry, Kegalle district" })).toBeVisible();
    await expect(phone.getByRole("status").filter({ hasText: "1 stop to send" })).toBeVisible();
  });

  await test.step("15. The office sees the silence at 6:05 AM", async () => {
    const { played } = await copy.jump("silence");
    expect(played, "Kasun recorded stop 2 on the phone in step 14").not.toContain("Kasun delivers to Mawanella");
    await desk.goto("/dispatcher/live");
    const runs = desk.getByRole("region", { name: "Kandy hub Fresh runs" });
    await expect(runs.getByText(/No contact\s*since 5:41\sAM/)).toBeVisible();
    await expect(runs.getByText(/Last record: stop 2, arrived 5:30\sAM\./)).toBeVisible();
    const exceptions = desk.getByRole("region", { name: "Exceptions" });
    // for each stop to come, an estimate and a likely range
    const hemmathagama = exceptions.getByRole("listitem").filter({ hasText: "Stop 3, Hemmathagama" });
    await expect(hemmathagama).toContainText("around 6:35");
    const aranayake = exceptions.getByRole("listitem").filter({ hasText: "Stop 4, Aranayake" });
    await expect(aranayake).toContainText("around 7:15");
    await expect(aranayake).toContainText("likely 6:45 to 7:45");
    await expect(exceptions.getByText("Aranayake's likely range already runs past its 7:30 AM close.")).toBeVisible();
    await expect(exceptions.getByText(/Relay can't tell a lost signal from a flat battery/)).toBeVisible();
  });

  await test.step("16. Nuwan sends VEH060 as a backup for Aranayake at 6:15 AM", async () => {
    await copy.jump("backup");
    await desk.goto("/dispatcher/live");
    await desk.getByRole("button", { name: "Move stop 4, Aranayake" }).click();
    const drawer = desk.getByRole("dialog", { name: "Move stop 4 to another vehicle" });
    await expect(drawer.getByText(/VEH060/).first()).toBeVisible();
    // the standby van arrives after the close, and Relay says why it is still worth sending
    await expect(drawer.getByText(/^Arrives around 8:0\d\sAM, after Aranayake's 7:30\sAM close/)).toBeVisible();
    await expect(
      drawer.getByText(
        "Still worth sending as a backup: if Kasun is stuck, a late delivery still stocks Aranayake's shelves this morning.",
      ),
    ).toBeVisible();
    await expect(drawer.getByText("Not suitable").first()).toBeVisible();
    await drawer.getByRole("textbox").fill("Kasun is out of contact and Aranayake closes at 7:30 AM");
    await drawer.getByRole("button", { name: "Move stop 4 to VEH060" }).click();
    await expect(desk.getByText(/Nimal, the Kandy hub dock and the store have been told/)).toBeVisible();
    await expect(desk.getByText(/Kasun hasn't seen this yet/).first()).toBeVisible();
  });

  await test.step("17. Dilani tracks the delivery and confirms receipt at 6:40 AM", async () => {
    await store.goto("/store");
    await expect(store.getByRole("heading", { name: "Arriving around 6:35 AM" })).toBeVisible();
    await store
      .getByRole("button", { name: "Track delivery" })
      .or(store.getByRole("link", { name: "Track delivery" }))
      .click();
    // the tracker keeps the planned and the expected time, says when Kasun was last heard and gives the likely range
    await expect(store.getByRole("heading", { name: "Your delivery" })).toBeVisible();
    await expect(store.getByText("Arriving around", { exact: true })).toBeVisible();
    await expect(store.getByText("6:35 AM", { exact: true })).toBeVisible();
    await expect(store.getByText("Planned 5:19 AM", { exact: true })).toBeVisible();
    await expect(store.getByText(/^Likely between \d{1,2}:\d{2} and \d{1,2}:\d{2}\sAM\.$/)).toBeVisible();
    await expect(store.getByText(/Last heard from Kasun 5:41\sAM/).first()).toBeVisible();

    const { played } = await copy.jump("receipt");
    expect(played, "Nuwan sent the backup in step 16").not.toContainEqual(expect.stringMatching(/^Nuwan sends/));
    await store.goto("/store");
    await store.getByRole("button", { name: "Confirm receipt" }).click();
    await expect(store.getByText(/6 short\. You were told at/).first()).toBeVisible();
    await store.getByRole("button", { name: "Everything arrived" }).click();
    await expect(store.getByText("Receipt confirmed").first()).toBeVisible();
    await expect(
      store.getByText(
        "Thanks, Dilani. The dispatcher can see your receipt, so they know Kasun has been to your store.",
      ),
    ).toBeVisible();
    await expect(store.getByText("Driver's proof: waiting for Kasun's phone")).toBeVisible();
  });

  await test.step("18. Nuwan keeps the backup after the receipt", async () => {
    await desk.goto("/dispatcher/live");
    const exceptions = desk.getByRole("region", { name: "Exceptions" });
    await expect(exceptions.getByText(/Hemmathagama confirmed receipt/).first()).toBeVisible();
    // Relay moves Aranayake's estimate from the receipt
    await expect(exceptions.getByText(/stop 4 estimated/).first()).toBeVisible();
    await expect(exceptions.getByText("The store confirmed receipt, so Kasun has been there.")).toBeVisible();
    await expect(exceptions.getByRole("button", { name: "Cancel backup" })).toBeVisible();
    await exceptions.getByRole("button", { name: "Keep backup" }).click();
    await expect(exceptions.getByText(/You kept the backup at 6:4\d\sAM\./).first()).toBeVisible();
    await expect(exceptions.getByRole("button", { name: "Keep backup" })).toBeHidden();
  });

  await test.step("19. The signal comes back at 7:14 AM and Kasun answers the one question", async () => {
    const { played } = await copy.jump("signal_back");
    expect(played, "Dilani confirmed receipt in step 17").not.toContain("Dilani confirms everything arrived");
    expect(played, "Nuwan kept the backup in step 18").not.toContain("Nuwan keeps the backup on its way");
    await phone.goto("/driver");
    const question = phone.getByRole("region", { name: "Question about stop 4" });
    await expect(question.getByRole("heading", { name: "Stop 4 was also given to Nimal" })).toBeVisible();
    await expect(question.getByRole("heading", { name: "Is your record right?" })).toBeVisible();
    await question.getByRole("button", { name: "Yes, I delivered it" }).click();
    await expect(phone.getByText("Stop 4 is settled")).toBeVisible();
    await phone.getByRole("button", { name: "Open trip summary" }).click();
    await expect(phone.getByText(/Saved offline, sent 7:1\d\sAM/).first()).toBeVisible();
    await phone.getByRole("button", { name: "Finish trip" }).click();
    await expect(phone.getByText(/Trip finished at/).first()).toBeVisible();
    // the phone's own offline record of stop 2 and the finish reach Relay before the clock moves on
    await expectAllSynced(phone);
  });

  await test.step("20. Everything is settled at 7:22 AM", async () => {
    const { played } = await copy.jump("settled");
    expect(played, "every step from 7:14 AM on was taken by hand").toEqual([]);
    await desk.goto("/dispatcher/live");
    const runs = desk.getByRole("region", { name: "Kandy hub Fresh runs" });
    const search = desk.getByRole("searchbox", { name: "Search vehicle, driver or outlet" });
    // one vehicle at a time, so each line read belongs to that vehicle's row
    await search.fill("VEH045");
    await expect(runs.getByRole("list", { name: /stops$/ })).toHaveCount(1);
    // the README calls VEH045's row "Run finished"; the row reads "Trip finished at" the time Kasun finished it
    await expect(runs.getByText(/Trip finished at 7:1\d\sAM/)).toBeVisible();
    await expect(runs.getByText(/Offline 5:41 to 7:14/)).toBeVisible();
    await expect(runs.getByText(/^\d+ records received$/)).toBeVisible();
    // stop 2 is the record Kasun's phone saved in the storm in step 14, at 5:41 AM, not the autopilot's at 5:59 AM
    await expect(
      runs
        .getByRole("list", { name: "VEH045 stops" })
        .getByRole("img", { name: /^Stop 2, Mawanella: Delivered 5:4\d$/ }),
    ).toBeVisible();
    await search.fill("VEH060");
    await expect(runs.getByRole("list", { name: /stops$/ })).toHaveCount(1);
    await expect(runs.getByText(/Turned back to the Kandy hub at 7:1\d\sAM/)).toBeVisible();
    await search.fill("");
    const exceptions = desk.getByRole("region", { name: "Exceptions" });
    await expect(exceptions.getByRole("button", { name: /^Kasun Bandara back in contact/ })).toBeVisible();
    await expect(exceptions.getByRole("button", { name: /^Stop 4 conflict resolved/ })).toBeVisible();

    await store.goto("/store");
    await store.getByRole("link", { name: "See the receipt and Kasun's proof" }).click();
    await expect(store.getByRole("heading", { name: "Proof of delivery from Kasun Bandara" })).toBeVisible();
    // the photo, the delivery time, the receiver's name and when it was saved and sent
    await expect(
      store.getByRole("button", { name: /^Delivery photo, \d{1,2}:\d{2}\sAM\. Tap to enlarge\.$/ }),
    ).toBeVisible();
    await expect(store.getByText(/^Delivered \d{1,2}:\d{2}\sAM, in your\swindow$/)).toBeVisible();
    await expect(store.getByText(/^Received by \S/)).toBeVisible();
    await expect(
      store.getByText(
        /^Saved on Kasun's phone at \d{1,2}:\d{2}\sAM and sent at 7:14\sAM,\swhen the phone reached us again\.$/,
      ),
    ).toBeVisible();
    // the 6 rice and dhal cases and the chilled order are listed for Thursday
    await expect(store.getByRole("heading", { name: "Still to come on Thursday 9 April" })).toBeVisible();
    await expect(store.getByText("Your chilled order, 92 cases")).toBeVisible();
    await expect(store.getByText("6 rice and dhal cases", { exact: true })).toBeVisible();
    await expect(store.getByText(/on ORD0098747, marked from Wednesday/)).toBeVisible();
  });

  await test.step("21. Nuwan reads the capacity outlook", async () => {
    await desk.goto("/dispatcher/outlook");
    await expect(
      desk.getByRole("heading", {
        name: "Wednesday 29 April is the heaviest of the 5 Wednesdays ahead, and like each of them it needs 6 of the 7 refrigerated vehicles.",
      }),
    ).toBeVisible();
    await expect(desk.getByRole("heading", { name: "What to arrange" })).toBeVisible();
    // the six weeks: forecast demand by brand, chilled space against the refrigerated fleet, and the vehicles needed
    // on each week's busiest day
    const weeks = desk.getByRole("region", { name: "Weeks ahead" });
    await expect(weeks.getByRole("button", { name: /^Week \d+ / })).toHaveCount(6);
    await expect(weeks.getByText("Forecast demand, m³ a week", { exact: true })).toBeVisible();
    for (const brand of ["Fresh chilled", "Fresh dry", "Style", "Tech", "All brands"]) {
      await expect(weeks.getByText(brand, { exact: true })).toBeVisible();
    }
    await expect(weeks.getByText("Chilled space, m³", { exact: true })).toBeVisible();
    await expect(weeks.getByRole("meter", { name: /^Chilled space, week \d+$/ })).toHaveCount(6);
    await expect(weeks.getByText("Refrigerated vehicles needed", { exact: true })).toBeVisible();
    await expect(weeks.getByRole("img", { name: /^6 needed, \d in service/ })).toHaveCount(6);
    await expect(weeks.getByText("23 orders, heaviest", { exact: true })).toBeVisible();
    await desk.getByRole("radio", { name: "Peliyagoda" }).click();
    await expect(
      desk.getByText(
        "No forecast is set up for Peliyagoda yet, so Relay can't tell which days ahead need every refrigerated vehicle there.",
      ),
    ).toBeVisible();
  });
});

test("22. try the engine: a rule-breaking drop, propose again, defer the protected order, plan Peliyagoda @desk", async ({
  copy,
  page: desk,
}) => {
  // step 22 starts another private copy: this test's own. Three proposals and a re-plan: 15 to 45 s on a warm engine
  // cache, about 1.5 minutes on a cold one
  test.setTimeout(4 * 60_000);
  await copy.signIn("dispatcher");
  await copy.jump("cutoff");
  await desk.goto("/dispatcher/plan");
  await desk.getByRole("radio", { name: "Kandy hub" }).click();
  await desk.getByRole("button", { name: "Propose plan" }).click();
  const proposed = desk.getByText("Kandy hub: 57 orders, 56 on 18 trips, 1 waits.");
  await expect(proposed).toBeVisible({ timeout: 120_000 });

  await test.step("the waiting chilled order dropped on a dry-box trip breaks the refrigeration rule", async () => {
    const card = desk.getByRole("button", { name: /^OUT117 Hemmathagama ORD0098596 · Fresh chilled/ });
    const veh045 = desk.getByRole("button", { name: /^Trip 1 · Kegalle .*leaves 3:29\sAM/ });
    await drag(desk, card, veh045, {
      whileHeld: async () => {
        // while the card is held, the dry-box trips say why they cannot take it
        await expect(desk.getByText("Needs a refrigerated vehicle").first()).toBeVisible();
      },
    });
    await expect(desk.getByText(/Chilled goods need a refrigerated vehicle/).first()).toBeVisible();
    await expect(desk.getByRole("button", { name: "Publish plan" }).first()).toBeDisabled();
  });

  await test.step("Propose again plans every order afresh, the move included", async () => {
    await desk.getByRole("button", { name: "Propose again" }).first().click();
    const dialog = desk.getByRole("dialog", { name: "Propose again?" });
    await expect(dialog.getByText(/the moves you made on this board are replaced/)).toBeVisible();
    await dialog.getByRole("button", { name: "Propose again" }).click();
    await expect(proposed).toBeVisible({ timeout: 120_000 });
    await expect(desk.getByRole("button", { name: /^OUT117 Hemmathagama ORD0098596 · Fresh chilled/ })).toBeVisible();
  });

  await test.step("Defer anyway on the protected OUT119 Kegalle: Kegalle waits with the reason, Hemmathagama rides", async () => {
    await desk.getByRole("button", { name: "Review deferral" }).first().click();
    const drawer = desk.getByRole("dialog", { name: "Deferrals for the Kandy hub" });
    await drawer.getByRole("button", { name: "Defer anyway" }).click();
    await expect(drawer.getByText(/Deferring this one too means two in a row/)).toBeVisible();
    await drawer
      .getByRole("textbox", { name: /Why is this needed/ })
      .fill("Kegalle asked to take its chilled order on Thursday");
    await drawer.getByRole("button", { name: "Defer OUT119" }).click();
    // Relay plans again with Kegalle waiting: the drawer now says what the override costs, with the note as the reason
    await expect(drawer.getByRole("heading", { name: "What the override costs" })).toBeVisible({ timeout: 120_000 });
    await expect(drawer.getByText("So Kegalle's order waits, by override", { exact: false })).toBeVisible();
    // what OUT119 will read: the note is the reason
    const notice = drawer.getByRole("complementary");
    await expect(notice.getByText("What OUT119 will see", { exact: true })).toBeVisible();
    await expect(
      notice.getByText("Kegalle asked to take its chilled order on Thursday", { exact: true }),
    ).toBeVisible();
    await drawer.getByRole("button", { name: "Close" }).first().click();
    await expect(desk.getByRole("button", { name: /^OUT119 Kegalle ORD0098599 · Fresh chilled/ })).toBeVisible({
      timeout: 120_000,
    });
    await expect(desk.getByRole("button", { name: /^OUT117 Hemmathagama ORD0098596/ })).toHaveCount(0);
  });

  await test.step("Peliyagoda: 79 orders on 26 trips, nothing waits", async () => {
    await desk.getByRole("radio", { name: "Peliyagoda" }).click();
    await desk.getByRole("button", { name: "Propose plan" }).click();
    await expect(desk.getByText("Peliyagoda: 79 orders, 79 on 26 trips.")).toBeVisible({ timeout: 180_000 });
    await expect(desk.getByRole("button", { name: "Placed 79" })).toBeVisible();
  });
});

/** A jump the demo bar makes: the POST that moves this copy's clock. */
function isJump(response: Response): boolean {
  return response.request().method() === "POST" && new URL(response.url()).pathname === "/api/demo/clock";
}

/** The story steps a jump played, from its answer. */
async function playedBy(jump: Promise<Response>): Promise<string[]> {
  const answer = await jump;
  expect(answer.ok()).toBe(true);
  return ((await answer.json()) as DemoState).played;
}
