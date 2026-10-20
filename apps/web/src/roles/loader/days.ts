import type { useLoaderText } from "@/i18n";

type Text = ReturnType<typeof useLoaderText>["t"];

// Sri Lanka keeps +05:30 all year, with no summer time.
const COLOMBO_OFFSET_MS = 330 * 60_000;

// By hand, because some browsers have no Sinhala or Tamil day names and would answer in English.
// A plain date ("2026-04-09") reads as that day in Colombo.
export function colomboDay(value: string | Date): { weekday: number; day: number; month: number } {
  const time =
    typeof value === "string" ? Date.parse(value.length === 10 ? `${value}T12:00:00+05:30` : value) : value.getTime();
  const local = new Date(time + COLOMBO_OFFSET_MS);
  return { weekday: local.getUTCDay(), day: local.getUTCDate(), month: local.getUTCMonth() };
}

export function weekdayName(t: Text, value: string | Date): string {
  return t(`dates.weekdays.${colomboDay(value).weekday}`);
}

export function shortDate(t: Text, value: string | Date): string {
  const { weekday, day, month } = colomboDay(value);
  return t("dates.short", {
    weekday: t(`dates.weekdaysShort.${weekday}`),
    day,
    month: t(`dates.months.${month}`),
  });
}
