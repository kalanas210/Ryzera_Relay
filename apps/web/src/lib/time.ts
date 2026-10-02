/** Times as the design writes them: "5:20 AM", "Wed 8 Apr", "4:00 to 7:45 AM". Always Sri Lanka time. */

const ZONE = "Asia/Colombo";

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const dayShort = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
});
const dayLong = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});
const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "long" });

const toDate = (value: string | Date) => (typeof value === "string" ? new Date(value) : value);

/** "5:20 AM" */
export function formatTime(value: string | Date): string {
  return clock.format(toDate(value));
}

/** "Wed 8 Apr" */
export function formatDay(value: string | Date): string {
  return dayShort.format(toDate(value)).replace(",", "");
}

/** "Wednesday 8 April" */
export function formatDayLong(value: string | Date): string {
  return dayLong.format(toDate(value)).replace(",", "");
}

/** "Wednesday" */
export function formatWeekday(value: string | Date): string {
  return weekday.format(toDate(value));
}

/** "Wed 8 Apr · 6:05 AM" */
export function formatStamp(value: string | Date): string {
  return `${formatDay(value)} · ${formatTime(value)}`;
}

const isoFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The Sri Lanka calendar day of an instant, as "2026-04-08". */
export function isoDay(value: string | Date): string {
  return isoFormat.format(toDate(value));
}

/** Whole days from one Sri Lanka calendar day to another. */
export function daysBetween(from: string | Date, to: string | Date): number {
  return Math.round((Date.parse(`${isoDay(to)}T00:00:00Z`) - Date.parse(`${isoDay(from)}T00:00:00Z`)) / 86_400_000);
}

/** A plain date ("2026-04-08") read as that day in Sri Lanka. */
export function dayOf(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00+05:30`);
}

/** "8 min", "1 h 9 min" */
export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/** "4:00 to 7:45 AM" from "04:00" and "07:45"; keeps both halves' AM or PM when they differ. */
export function formatWindow(open: string, close: string): string {
  const a = hhmm(open);
  const b = hhmm(close);
  if (a.suffix === b.suffix) return `${a.text} to ${b.text} ${b.suffix}`;
  return `${a.text} ${a.suffix} to ${b.text} ${b.suffix}`;
}

function hhmm(value: string): { text: string; suffix: "AM" | "PM" } {
  const [h = 0, m = 0] = value.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return { text: `${h12}:${String(m).padStart(2, "0")}`, suffix };
}

/** Round to the nearest 5 minutes, as driver and store screens show Expected times. */
export function roundTo5(value: string | Date): Date {
  const ms = toDate(value).getTime();
  const five = 5 * 60 * 1000;
  return new Date(Math.round(ms / five) * five);
}

/** Whole numbers with thousands: a vehicle's weight limit, "6,180"; minutes, "270". */
export const numberFormat = new Intl.NumberFormat("en-US");
const oneDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const threeDecimals = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

/** A weight as the data gives it, to a tenth of a kilo, with no unit: "1,171.0" (tables and meters). */
export const kgValue = (value: number) => oneDecimal.format(value);
/** A volume as the data gives it, to the litre, with no unit: "4.212". */
export const m3Value = (value: number) => threeDecimals.format(value);
/** One decimal: a vehicle's volume limit "7.0", litres of fuel "159.9". */
export const tenths = (value: number) => oneDecimal.format(value);
export const kg = (value: number) => `${kgValue(value)} kg`;
export const m3 = (value: number) => `${m3Value(value)} m³`;
