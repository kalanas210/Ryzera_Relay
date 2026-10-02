import type { Page } from "@playwright/test";
import { ACCOUNTS, DESK, expect, PASSWORD, PHONE, type Role, test } from "../support/relay";
import { expectNoSidewaysScroll, watchErrors } from "../support/screens";

/** Each role signs in on the sign-in page, as a judge does, and lands on its home screen at the README's size for
 *  it: the dispatcher at a desk, everyone else on a phone, where nothing may scroll sideways at 375 px. Every role
 *  works in a private copy of the day, so the shared walkthrough is never touched. */

type Case = {
  role: Role;
  card: RegExp;
  size: { width: number; height: number };
  tag: "@desk" | "@phone";
  home: (page: Page) => Promise<void>;
};

const CASES: Case[] = [
  {
    role: "store_manager",
    card: /^Store manager/,
    size: PHONE,
    tag: "@phone",
    home: async (page) => {
      await expect(page.getByRole("heading", { name: "My orders", level: 1 })).toBeVisible();
      await expect(page.getByText("Waypoint Fresh Hemmathagama, OUT117")).toBeVisible();
      await expect(page.getByRole("button", { name: "Place an order" })).toBeVisible();
    },
  },
  {
    role: "dispatcher",
    card: /^Dispatcher/,
    size: DESK,
    tag: "@desk",
    home: async (page) => {
      await expect(page.getByRole("heading", { name: "Order queue", level: 1 })).toBeVisible();
      // the desk's side rail, with keys 1 to 4, or the tab bar on a phone
      await expect(page.getByRole("navigation", { name: /^Dispatcher/ })).toBeVisible();
      for (const screen of ["Queue", "Plan", "Live", "Outlook"]) {
        await expect(page.getByRole("link", { name: new RegExp(`^${screen}( \\d)?$`) })).toBeVisible();
      }
    },
  },
  {
    role: "loader",
    card: /^Loader/,
    size: PHONE,
    tag: "@phone",
    home: async (page) => {
      await expect(page.getByRole("heading", { name: "Kandy hub", level: 1 })).toBeVisible();
      await expect(page.getByText("Mohamed Rizwan", { exact: true })).toBeVisible();
      // before the plan is published, the dock says so
      await expect(page.getByRole("heading", { name: "No plan yet" })).toBeVisible();
    },
  },
  {
    role: "driver",
    card: /^Driver/,
    size: PHONE,
    tag: "@phone",
    home: async (page) => {
      await expect(page.getByRole("heading", { name: "Today's run", level: 1 })).toBeVisible();
      await expect(page.getByRole("status", { name: "All synced" })).toBeVisible();
      await expect(page.getByText("Wednesday's plan isn't published yet")).toBeVisible();
    },
  },
];

for (const c of CASES) {
  test(`${ACCOUNTS[c.role].username} signs in as ${c.role.replace("_", " ")} and lands at home ${c.tag}`, async ({
    copy,
    page,
  }) => {
    const errors = watchErrors(page);
    await page.setViewportSize(c.size);
    await page.goto("/signin");
    await expect(page.getByRole("heading", { name: "Who is signing in?" })).toBeVisible();
    // the copy this test started, named in the demo bar on a desk, and in Demo controls everywhere
    if (c.size === DESK) await expect(page.getByText(`Walkthrough ${copy.code}`, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: c.card }).click();
    await expect(page.getByRole("button", { name: c.card })).toHaveAttribute("aria-pressed", "true");
    if (c.role === "loader") {
      // the dock tablet: tap a name, then the PIN
      await expect(page.getByRole("button", { name: "MR Rizwan", exact: true })).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      for (const digit of ACCOUNTS.loader.pin) await page.getByRole("button", { name: digit, exact: true }).click();
    } else {
      await expect(page.getByRole("textbox", { name: "Username" })).toHaveValue(ACCOUNTS[c.role].username);
      await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
      await page.getByRole("button", { name: "Sign in", exact: true }).click();
    }

    await expect(page).toHaveURL(new RegExp(`${ACCOUNTS[c.role].home}$`));
    await c.home(page);
    await expect(page.getByRole("button", { name: "Demo controls" })).toBeVisible();
    await expectNoSidewaysScroll(page);
    // the narrowest phone the design draws, for every role (the dispatcher's desk also opens on a phone on call):
    // nothing scrolls sideways at 375 px
    if (c.size !== PHONE) {
      await page.setViewportSize(PHONE);
      await c.home(page);
    }
    await expectNoSidewaysScroll(page);
    expect(errors, "console errors on the way in").toEqual([]);
  });
}

test("a wrong PIN on the dock tablet stays on the PIN pad @phone", async ({ copy: _copy, page }) => {
  const errors = watchErrors(page, { allow: [/status of 401/] });
  await page.setViewportSize(PHONE);
  await page.goto("/signin?role=loader");
  // a digit tapped before the names load is cleared with them, so wait for Rizwan's name to be picked
  await expect(page.getByRole("button", { name: "MR Rizwan", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const digit of "1111") await page.getByRole("button", { name: digit, exact: true }).click();
  await expect(page.getByText("That PIN did not match. Try again.")).toBeVisible();
  await expect(page).toHaveURL(/\/signin/);
  await expect(page.getByRole("button", { name: "2", exact: true })).toBeEnabled();
  expect(errors).toEqual([]);
});
