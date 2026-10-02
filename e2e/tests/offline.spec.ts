import type { Page } from "@playwright/test";
import { type Copy, expect, test } from "../support/relay";
import { expectAllSynced } from "../support/screens";

/** The driver's phone with no signal, at phone size: what Kasun saves waits on the phone (IndexedDB), the run and
 *  the waiting record survive a reload with no network (the service worker's app shell), and both reach Relay when
 *  the signal comes back. The demo bar's "no signal" switch does the same for a judge on a desktop browser. */

/** Kasun on the road at 5:20 AM, between Kegalle (delivered) and Mawanella (next), before the storm. */
async function onTheRoad(copy: Copy, page: Page): Promise<void> {
  await copy.signIn("driver");
  const state = await copy.jump("on_the_road");
  expect(state.played).toContain("Kasun delivers to Kegalle");
  await page.goto("/driver");
  await expect(page.getByRole("heading", { name: "VEH045 · Trip 1 · Fresh dry, Kegalle district" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Stop 1, Kegalle, Delivered/ })).toBeVisible();
  await expectAllSynced(page);
}

/** Records Kasun's arrival at stop 2, Mawanella, on the stop's own screen. */
async function arriveAtMawanella(page: Page): Promise<void> {
  await page.getByRole("button", { name: "Open stop 2" }).click();
  await expect(page.getByRole("heading", { name: "Mawanella" }).first()).toBeVisible();
  await page.getByRole("button", { name: /^Arrived/ }).click();
  await expect(page.getByRole("button", { name: "Record delivery" })).toBeVisible();
}

/** What the dispatcher's Live screen shows for stop 2, in a desk-size tab of the same browser. */
async function officeSeesArrival(copy: Copy): Promise<void> {
  await copy.signIn("dispatcher");
  const desk = await copy.open("dispatcher", "/dispatcher/live");
  await expect(desk.getByRole("img", { name: /^Stop 2, Mawanella: Arrived \d{1,2}:\d{2}$/ })).toBeVisible();
  await desk.close();
}

test("a stop saved with no network survives a reload and sends when the network is back @phone", async ({
  copy,
  context,
  page,
}) => {
  await onTheRoad(copy, page);
  // the app shell must be cached before the network goes: the service worker is active once its precache is in
  const cached = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker?.getRegistration();
    if (!registration) return false;
    const timeout = new Promise<false>((resolve) => setTimeout(() => resolve(false), 30_000));
    return Promise.race([navigator.serviceWorker.ready.then(() => true), timeout]);
  });
  // CI runs the build, which must register the service worker: there a missing one fails the test instead of
  // skipping the README's offline reload
  if (process.env.CI) expect(cached, "the build registers the service worker and caches the app").toBe(true);
  test.skip(
    !cached,
    "No service worker is registered: the Vite dev server does not register one. Run against a build " +
      "(docker compose, or vite preview) to reload with no network.",
  );

  await context.setOffline(true);
  await expect(page.getByRole("status", { name: "Offline" })).toBeVisible();
  await arriveAtMawanella(page);
  await page.getByRole("button", { name: "Back to today's run" }).click();
  const waiting = page.getByRole("status", { name: /^Offline, 1 (update|stop) to send$/ });
  await expect(waiting).toBeVisible();
  await expect(page.getByRole("link", { name: /^Stop 2, Mawanella, Arrived .*Waiting to send/ })).toBeVisible();

  // a reload with no network: the app comes from the service worker, the run and the record from the phone
  await page.reload();
  await expect(page.getByRole("heading", { name: "VEH045 · Trip 1 · Fresh dry, Kegalle district" })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Stop 1, Kegalle, Delivered/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Stop 2, Mawanella, Arrived .*Waiting to send/ })).toBeVisible();
  await expect(waiting).toBeVisible();

  // back in coverage: the phone sends what it saved, and the pill says so
  await context.setOffline(false);
  await expectAllSynced(page);
  await expect(page.getByRole("link", { name: /^Stop 2, Mawanella, Arrived/ })).not.toContainText("Waiting to send");
  await officeSeesArrival(copy);
});

test("the demo bar's no signal switch keeps records on the phone until it is turned off @phone", async ({
  copy,
  page,
}) => {
  await onTheRoad(copy, page);
  const signal = page.getByRole("switch", { name: "Kasun's phone: no signal" });
  await expect(signal).not.toBeChecked();
  await signal.click();
  await expect(signal).toBeChecked();
  await expect(page.getByRole("status", { name: "Offline" })).toBeVisible();

  await arriveAtMawanella(page);
  await page.getByRole("button", { name: "Back to today's run" }).click();
  const waiting = page.getByRole("status", { name: /^Offline, 1 (update|stop) to send$/ });
  await expect(waiting).toBeVisible();

  // the switch holds across a reload, and the run and the waiting record come back from the phone
  await page.reload();
  await expect(signal).toBeChecked();
  await expect(page.getByRole("link", { name: /^Stop 2, Mawanella, Arrived .*Waiting to send/ })).toBeVisible();
  await expect(waiting).toBeVisible();

  // outside the storm (5:41 to 7:14 AM), turning the switch off sends what waited
  await signal.click();
  await expect(signal).not.toBeChecked();
  await expectAllSynced(page);
  await officeSeesArrival(copy);
});

test("in the storm the switch is held on and the phone reads no signal until 7:14 AM @phone", async ({
  copy,
  page,
}) => {
  await copy.signIn("driver");
  await copy.jump("signal_lost");
  await page.goto("/driver");
  const storm = page.getByRole("switch", { name: "Kasun's phone: storm until 7:14 AM" });
  await expect(storm).toBeChecked();
  await expect(storm).toBeDisabled();
  await expect(page.getByText("No signal since 5:41 AM")).toBeVisible();
  await expect(page.getByRole("status", { name: "Offline" })).toBeVisible();
  // the office, meanwhile, keeps the last record and the time of last contact
  await copy.jump("silence");
  await copy.signIn("dispatcher");
  const desk = await copy.open("dispatcher", "/dispatcher/live");
  await expect(desk.getByRole("button", { name: /^No contact from Kasun since 5:41\sAM/ })).toBeVisible();
});
