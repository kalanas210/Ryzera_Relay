import type { useLoaderText } from "@/i18n";

type Text = ReturnType<typeof useLoaderText>["t"];

/** Sri Lanka keeps +05:30 all year, with no summer time. */
const COLOMBO_OFFSET_MS = 330 * 60_000;

/** The day in Colombo, worked out without the browser's calendar data: some browsers carry no Sinhala or Tamil
 *  day names at all and would answer in English, the way the clock is written by hand for the same reason. A plain
 *  date ("2026-04-09") reads as that day. */
export function colomboDay(value: string | Date): { weekday: number; day: number; month: number } {
  const time =
    typeof value === "string" ? Date.parse(value.length === 10 ? `${value}T12:00:00+05:30` : value) : value.getTime();
  const local = new Date(time + COLOMBO_OFFSET_MS);
  return { weekday: local.getUTCDay(), day: local.getUTCDate(), month: local.getUTCMonth() };
}

/** "Thursday", "බ්‍රහස්පතින්දා", "வியாழன்", from the loader's own strings. */
export function weekdayName(t: Text, value: string | Date): string {
  return t(`dates.weekdays.${colomboDay(value).weekday}`);
}

/** "Wed 8 Apr", "අප්‍රේල් 8, බදාදා", "புதன், 8 ஏப்ரல்". */
export function shortDate(t: Text, value: string | Date): string {
  const { weekday, day, month } = colomboDay(value);
  return t("dates.short", {
    weekday: t(`dates.weekdaysShort.${weekday}`),
    day,
    month: t(`dates.months.${month}`),
  });
}
