/** How the capacity outlook (DSP-05) writes its dates and counts. Pure, so they are tested on their own. */

import type { FleetState } from "./api";

/** A no-break space: a date range or a value and its unit stays on one line. */
export const NBSP = "\u00a0";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The calendar parts of a plain date ("2026-04-27"), with no time zone involved. */
function parts(isoDate: string): { day: number; month: string; weekday: string } {
  const [y = 0, m = 1, d = 1] = isoDate.split("-").map(Number);
  return { day: d, month: MONTHS[m - 1] ?? "", weekday: WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()] ?? "" };
}

/** "6 to 12 Apr" within a month, "27 Apr to 3 May" across two. */
export function weekRange(first: string, last: string): string {
  const a = parts(first);
  const b = parts(last);
  const start = a.month === b.month ? `${a.day}` : `${a.day}${NBSP}${a.month}`;
  return `${start}${NBSP}to${NBSP}${b.day}${NBSP}${b.month}`;
}

/** "Wed 8 Apr" */
export function shortDay(isoDate: string): string {
  const p = parts(isoDate);
  return `${p.weekday}${NBSP}${p.day}${NBSP}${p.month}`;
}

const oneDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "8,144.5" */
export function decimal(value: number): string {
  return oneDecimal.format(value);
}

/** "23 orders, 1 waits" or "23 orders, heaviest": what the chilled kg cell says under the number. */
export function ordersCaption(orders: number, waits: number, heaviest = false): string {
  const said = [`${orders} ${orders === 1 ? "order" : "orders"}`];
  if (waits) said.push(`${waits} ${waits === 1 ? "waits" : "wait"}`);
  if (heaviest) said.push("heaviest");
  return said.join(", ");
}

export const STATE_WORD: Record<FleetState, string> = {
  over: "Over",
  limit: "At the limit",
  within: "Within capacity",
};
