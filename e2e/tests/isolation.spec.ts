import type { Page } from "@playwright/test";
import { Copy, DESK, expect, PASSWORD, test } from "../support/relay";

/** Private copies of the day are separate worlds: two copies in two browsers never see each other's orders, a jump in
 *  one leaves the other's clock where it was, a reset touches only its own copy, a phone that joins a copy by its
 *  code works in that copy, and the shared walkthrough (MAIN) stays at the start of the story through all of it. */

/** Dilani's My orders, fresh from the server. */
async function myOrders(copy: Copy): Promise<Page> {
  await copy.signIn("store_manager");
  const page = await copy.open("store_manager");
  await expect(page.getByRole("heading", { name: "My orders", level: 1 })).toBeVisible();
  return page;
}

const minutes = (iso: string) => {
  const t = new Date(iso);
  return t.getUTCHours() * 60 + t.getUTCMinutes();
};
// the story starts on Tuesday 7 April 2026 at 2:05 PM in Colombo (08:35 UTC)
const START = 8 * 60 + 35;

test("two copies never see each other's changes, and a jump or a reset in one leaves the other alone @desk", async ({
  another,
  copy: first,
}) => {
  const second = await Copy.start(await another());
  expect(second.code).not.toBe(first.code);

  // Dilani orders in the first copy only
  const firstStore = await myOrders(first);
  const secondStore = await myOrders(second);
  await expect(firstStore.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  await firstStore.getByRole("button", { name: "Place an order" }).click();
  await firstStore.getByRole("textbox", { name: "Dairy crate" }).fill("12");
  await firstStore.getByRole("button", { name: "Send order" }).click();
  await expect(firstStore.getByRole("heading", { name: "Received by Waypoint" })).toBeVisible();
  const ref = (await firstStore.getByText(/^ORD\d{7}$/).textContent()) ?? "";
  expect(ref).toMatch(/^ORD\d{7}$/);

  await secondStore.reload();
  await expect(secondStore.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  await expect(secondStore.getByText(ref)).toHaveCount(0);

  // the first copy jumps to the cutoff; the second copy's clock stays at the start of the story
  const jumped = await first.jump("cutoff");
  expect(jumped.workspace.code).toBe(first.code);
  expect(jumped.moments.find((m) => m.key === "cutoff")?.passed).toBe(true);
  const still = await second.state();
  expect(still.workspace.code).toBe(second.code);
  expect(minutes(still.now) - START, "the second copy's clock runs only in real time").toBeLessThan(10);
  expect(still.moments.filter((m) => m.passed).map((m) => m.key)).toEqual(["orders"]);

  await secondStore.reload();
  await expect(secondStore.getByRole("button", { name: "Jump to 3:12 PM: Chasing the last orders" })).toBeVisible();
  await expect(secondStore.getByText("Orders for Wednesday close at 4:00 PM").first()).toBeVisible();
  await firstStore.goto("/store");
  await expect(firstStore.getByRole("button", { name: "Jump to 4:35 PM: Planning the Kandy hub" })).toBeVisible();
  await expect(firstStore.getByText(new RegExp(`^${ref}\\. Placed`))).toBeVisible();

  // the second copy jumps too: its autopilot plays its own Dilani, and the first copy's order is still not there
  const secondJump = await second.jump("queue");
  expect(secondJump.played).toContain("Dilani places the chilled and dry orders");
  expect((await first.state()).moments.find((m) => m.key === "cutoff")?.passed).toBe(true);

  // a reset puts the first copy back to Tuesday 2:05 PM and leaves the second where it is
  await first.reset();
  const reset = await first.state();
  expect(minutes(reset.now) - START).toBeLessThan(2);
  const afterReset = await second.state();
  expect(afterReset.moments.find((m) => m.key === "queue")?.passed).toBe(true);
  await firstStore.reload();
  await expect(firstStore.getByRole("heading", { name: "No orders yet" })).toBeVisible();
  await secondStore.reload();
  // the second copy keeps the orders its own Dilani placed when it jumped
  await expect(secondStore.getByText(/^ORD0098596\. Placed/)).toBeVisible();

  // a browser that never started a copy is in the shared walkthrough, still held at the start of the story
  const visitor = await (await another(DESK)).newPage();
  await visitor.goto("/signin");
  await expect(visitor.getByText("Shared walkthrough, clock held")).toBeVisible();
  await expect(visitor.getByText("Tue 7 Apr · 2:05 PM", { exact: true })).toBeVisible();
});

test("a phone that joins a copy by its code works in that copy, with its orders and its clock @phone", async ({
  another,
  copy,
}) => {
  // Dilani orders in the copy this test started, and its clock moves to the cutoff
  const store = await myOrders(copy);
  await store.getByRole("button", { name: "Place an order" }).click();
  await store.getByRole("textbox", { name: "Dairy crate" }).fill("12");
  await store.getByRole("button", { name: "Send order" }).click();
  await expect(store.getByRole("heading", { name: "Received by Waypoint" })).toBeVisible();
  const ref = (await store.getByText(/^ORD\d{7}$/).textContent()) ?? "";
  expect(ref).toMatch(/^ORD\d{7}$/);
  await copy.jump("cutoff");

  // another phone, in the shared walkthrough until it joins: Demo controls, the code, Join
  const phone = await (await another()).newPage();
  await phone.goto("/signin");
  await phone.getByRole("button", { name: "Demo controls" }).click();
  const controls = phone.getByRole("dialog", { name: "Demo controls" });
  await expect(controls.getByText(/^You are in the shared walkthrough/)).toBeVisible();
  await controls.getByRole("textbox", { name: "Walkthrough code" }).fill(copy.code);
  await controls.getByRole("button", { name: "Join" }).click();
  await expect(
    controls.getByText(`This is a private copy of the day, walkthrough ${copy.code}.`, { exact: false }),
  ).toBeVisible();
  await controls.getByRole("button", { name: "Close" }).click();

  // the joined phone signs Dilani in on the sign-in page and sees the order placed in the copy, after its cutoff
  await phone.getByRole("button", { name: /^Store manager/ }).click();
  await phone.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await phone.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(phone.getByRole("heading", { name: "My orders", level: 1 })).toBeVisible();
  await expect(phone.getByText(new RegExp(`^${ref}\\. Placed`))).toBeVisible();
  await expect(phone.getByRole("button", { name: "Jump to 4:35 PM: Planning the Kandy hub" })).toBeVisible();
});
