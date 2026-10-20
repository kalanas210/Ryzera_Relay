// Always Sri Lanka time.

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

export function formatTime(value: string | Date): string {
  return clock.format(toDate(value));
}

export function formatDay(value: string | Date): string {
  return dayShort.format(toDate(value)).replace(",", "");
}

export function formatDayLong(value: string | Date): string {
  return dayLong.format(toDate(value)).replace(",", "");
}

export function formatWeekday(value: string | Date): string {
  return weekday.format(toDate(value));
}

export function formatStamp(value: string | Date): string {
  return `${formatDay(value)} · ${formatTime(value)}`;
}

const isoFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function isoDay(value: string | Date): string {
  return isoFormat.format(toDate(value));
}

export function daysBetween(from: string | Date, to: string | Date): number {
  return Math.round((Date.parse(`${isoDay(to)}T00:00:00Z`) - Date.parse(`${isoDay(from)}T00:00:00Z`)) / 86_400_000);
}

export function dayOf(isoDate: string): Date {
  return new Date(`${isoDate}T12:00:00+05:30`);
}

export function formatDuration(minutes: number): string {
  const m = Math.round(minutes);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

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

// Driver and store screens show Expected times to the nearest 5 minutes.
export function roundTo5(value: string | Date): Date {
  const ms = toDate(value).getTime();
  const five = 5 * 60 * 1000;
  return new Date(Math.round(ms / five) * five);
}

export const numberFormat = new Intl.NumberFormat("en-US");
const oneDecimal = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const threeDecimals = new Intl.NumberFormat("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 });

export const kgValue = (value: number) => oneDecimal.format(value);
// three decimals, so to the litre
export const m3Value = (value: number) => threeDecimals.format(value);
export const tenths = (value: number) => oneDecimal.format(value);
export const kg = (value: number) => `${kgValue(value)} kg`;
export const m3 = (value: number) => `${m3Value(value)} m³`;
