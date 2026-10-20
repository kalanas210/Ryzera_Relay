import { crc32, deflateSync } from "node:zlib";
import { expect, type Locator, type Page } from "@playwright/test";

// Helpers that find things the way a person does, by role and visible text, never by CSS class or test id.

// Moves in small steps, because dnd-kit starts a drag only after 6 px of movement.
// whileHeld runs with the card held over the target, before it is let go.
export async function drag(
  page: Page,
  from: Locator,
  to: Locator,
  { whileHeld }: { whileHeld?: () => Promise<void> } = {},
): Promise<void> {
  await to.scrollIntoViewIfNeeded();
  await from.scrollIntoViewIfNeeded();
  const start = await from.boundingBox();
  const end = await to.boundingBox();
  if (!start || !end) throw new Error("Both ends of the drag must be on screen");
  const x = start.x + start.width / 2;
  const y = start.y + start.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y + 12, { steps: 4 });
  await page.mouse.move(end.x + end.width / 2, end.y + end.height / 2, { steps: 24 });
  try {
    await expect(page.getByRole("tooltip")).toBeVisible();
    await whileHeld?.();
  } finally {
    await page.mouse.up();
  }
}

export async function sign(page: Page, box: Locator): Promise<void> {
  const area = await box.boundingBox();
  if (!area) throw new Error("The signature box is not on screen");
  const y = area.y + area.height / 2;
  await page.mouse.move(area.x + area.width * 0.15, y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(area.x + area.width * (0.15 + i * 0.09), y + (i % 2 ? -20 : 20), { steps: 3 });
  }
  await page.mouse.up();
}

// The phone shrinks and re-encodes whatever the camera gives it, so this has to be a real PNG that decodes.
export function photo(): { name: string; mimeType: string; buffer: Buffer } {
  const width = 64;
  const height = 48;
  const rows: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    for (let x = 0; x < width; x++) {
      const parcel = x > 16 && x < 48 && y > 10 && y < 38;
      row.set(parcel ? [150, 110, 60] : [200, 205, 210], 1 + x * 3);
    }
    rows.push(row);
  }
  const chunk = (kind: string, data: Buffer) => {
    const body = Buffer.concat([Buffer.from(kind, "ascii"), data]);
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8); // 8 bits per channel, RGB, no interlace
  const buffer = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.concat(rows))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
  return { name: "delivery.png", mimeType: "image/png", buffer };
}

// Uses the root's client width, which leaves out a visible scroll bar, so a headed run cannot hide
// an overflow behind one.
export async function expectNoSidewaysScroll(page: Page): Promise<void> {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow, "the page scrolls sideways").toBeLessThanOrEqual(0);
}

// allow names the errors a test causes on purpose, such as the 401 a wrong PIN answers,
// which Chromium logs as a console error.
export function watchErrors(page: Page, { allow = [] }: { allow?: RegExp[] } = {}): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    const text = message.text();
    if (message.type() === "error" && !allow.some((pattern) => pattern.test(text))) errors.push(`console: ${text}`);
  });
  page.on("pageerror", (error) => errors.push(`page: ${error.message}`));
  return errors;
}

// The scenario clock shows minutes, and real seconds pass while a test acts, so a time the test
// caused can land on the next minute. "6:39 PM" also accepts "6:40 PM".
// Store screens put a no-break space between the time and AM or PM, so any space matches.
export function minuteOrNext(time: string): RegExp {
  const match = /^(\d{1,2}):(\d{2}) (AM|PM)$/.exec(time);
  if (!match) throw new Error(`Not a clock time: ${time}`);
  const [, h = "", m = "", half = ""] = match;
  let next = `${h}:${String(Number(m) + 1).padStart(2, "0")}\\s${half}`;
  if (m === "59") {
    // 11:59 AM turns to 12:00 PM, and 12:59 PM to 1:00 PM
    const hour = (Number(h) % 12) + 1;
    const turned = hour === 12 ? (half === "AM" ? "PM" : "AM") : half;
    next = `${hour}:00\\s${turned}`;
  }
  return new RegExp(`(${h}:${m}\\s${half}|${next})`);
}

// The pill usually turns within seconds, because a record saved during a send goes in that same send.
// A failed send waits for the next trigger, at the latest the minute check-in, so allow a little over a minute.
export const SYNC_TIMEOUT_MS = 75_000;

export async function expectAllSynced(page: Page): Promise<void> {
  await expect(page.getByRole("status", { name: "All synced" })).toBeVisible({ timeout: SYNC_TIMEOUT_MS });
}

// Dock buttons take a tap only after half a second on screen (SETTLE_MS on the loader's screens).
// A tap that came too early did nothing, so it is made again until the next screen shows.
// A button that saves is disabled while it saves, so a second tap never sends twice.
export async function dockTap(button: Locator, next: Locator): Promise<void> {
  await expect(button).toBeVisible();
  await expect(async () => {
    if (await next.isVisible()) return;
    await button.click({ timeout: 2_000 });
    await expect(next).toBeVisible({ timeout: 2_000 });
  }).toPass({ timeout: 30_000 });
}
