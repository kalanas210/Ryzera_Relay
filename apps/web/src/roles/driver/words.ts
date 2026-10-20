// Dates come from the strings table, not Intl, which does not write Sinhala dates reliably.
import { useTranslation } from "react-i18next";
import { clockIn, isLang, type Lang } from "@/i18n";
import { expectedPassed, onRunDate, round5 } from "./local";
import type { DriverStop, DriverTrip } from "./types";

function clockParts(lang: Lang, value: string | Date): { hm: string; part: string } {
  const text = clockIn(lang, value);
  if (lang === "en") {
    const [hm = "", part = ""] = text.split(" ");
    return { hm, part };
  }
  const at = text.lastIndexOf(" ");
  return { part: text.slice(0, at), hm: text.slice(at + 1) };
}

export type Place = { text: string; latin: boolean };

export function useDriverText() {
  const { t, i18n } = useTranslation("driver");
  const lang: Lang = isLang(i18n.language) ? i18n.language : "en";
  // A no-break space keeps a time on one line wherever a sentence wraps.
  const clock = (value: string | Date) => clockIn(lang, value).replace(" ", "\u00a0");

  const around = (value: string | Date) => {
    const rounded = round5(value);
    const { hm, part } = clockParts(lang, rounded);
    return t("time.around", { time: clock(rounded), hm, part });
  };

  // After the expected time has passed it says "now passed", because the phone never pushes it later.
  const expectedAt = (stop: Pick<DriverStop, "status" | "expected">, now: Date | null) => {
    if (!stop.expected) return "";
    const time = around(stop.expected);
    return now && expectedPassed(stop, now) ? t("time.passed", { time }) : time;
  };

  const duration = (minutes: number) => {
    const m = Math.max(0, Math.round(minutes));
    if (m < 60) return t("time.m", { m });
    const h = Math.floor(m / 60);
    return m % 60 ? t("time.hm", { h, m: m % 60 }) : t("time.h", { h });
  };

  const left = (minutes: number) => {
    const m = Math.max(0, Math.round(minutes));
    if (m < 60) return t("time.leftM", { m });
    const h = Math.floor(m / 60);
    return m % 60 ? t("time.leftHM", { h, m: m % 60 }) : t("time.leftH", { h });
  };

  const windowOf = (runDate: string, open: string, close: string) => {
    const a = onRunDate(runDate, open);
    const b = onRunDate(runDate, close);
    const pa = clockParts(lang, a);
    const pb = clockParts(lang, b);
    if (pa.part !== pb.part) return t("time.window", { open: clock(a), close: clock(b) });
    return lang === "en"
      ? t("time.window", { open: pa.hm, close: clock(b) })
      : t("time.window", { open: clock(a), close: pb.hm });
  };

  const date = (isoDate: string) => {
    const day = new Date(`${isoDate}T12:00:00+05:30`).getUTCDay();
    return t("time.date", {
      weekday: t(`weekday.${day}`),
      day: Number(isoDate.slice(8, 10)),
      month: t(`month.${Number(isoDate.slice(5, 7)) - 1}`),
    });
  };

  const weekday = (isoDate: string) => t(`weekday.${new Date(`${isoDate}T12:00:00+05:30`).getUTCDay()}`);

  const place = (name: string): Place => {
    const text = t(`places.${name}`, { defaultValue: name });
    return { text, latin: lang === "en" || text === name };
  };

  // Tamil and Sinhala write "to Aranayake" as one word where Relay knows the place.
  const placeTo = (name: string) => t(`placesTo.${name}`, { defaultValue: t("placeTo", { place: place(name).text }) });

  const storeName = (stop: Pick<DriverStop, "store_name" | "place">) => {
    const p = place(stop.place);
    return stop.store_name.endsWith(stop.place)
      ? `${stop.store_name.slice(0, -stop.place.length)}${p.text}`
      : stop.store_name;
  };

  const hub = (trip: Pick<DriverTrip, "depot" | "depot_label">) => ({
    hub: t(`hubs.${trip.depot}.name`, { defaultValue: trip.depot_label }),
    hubFrom: t(`hubs.${trip.depot}.from`, { defaultValue: trip.depot_label }),
    hubTo: t(`hubs.${trip.depot}.to`, { defaultValue: trip.depot_label }),
    hubSubject: t(`hubs.${trip.depot}.subject`, { defaultValue: trip.depot_label }),
  });

  const tripLine = (trip: DriverTrip) =>
    t("trip.line", {
      vehicle: trip.vehicle_id,
      n: trip.trip_no,
      kind: t(`kind.${trip.temp}`, { brand: trip.brand }),
      district: t(`districts.${trip.district}`, { defaultValue: trip.district }),
    });

  const access = (stop: Pick<DriverStop, "dock_type" | "van_only">) =>
    stop.van_only ? t("access.van_only") : t(`access.${stop.dock_type}`, { defaultValue: stop.dock_type });

  const cases = (count: number) => t("cases", { count });
  const caseItem = (code: string) => t(`caseItem.${code}`, { defaultValue: code });
  const caseLine = (code: string, fallback: string) => t(`caseLine.${code}`, { defaultValue: fallback });
  const caseShort = (code: string, fallback: string) => t(`caseShort.${code}`, { defaultValue: fallback });

  const list = (items: (string | number)[]) => {
    const words = items.map(String);
    if (words.length < 2) return words.join("");
    return `${words.slice(0, -1).join(", ")} ${t("summary.and")} ${words[words.length - 1]}`;
  };

  return {
    t,
    lang,
    clock,
    around,
    expectedAt,
    duration,
    left,
    windowOf,
    date,
    weekday,
    place,
    placeTo,
    storeName,
    hub,
    tripLine,
    access,
    cases,
    caseItem,
    caseLine,
    caseShort,
    list,
  };
}

export type DriverText = ReturnType<typeof useDriverText>;
