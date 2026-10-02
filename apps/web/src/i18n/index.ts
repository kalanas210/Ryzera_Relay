/** The field roles read Relay in Sinhala, Tamil or English. Each person's choice is kept on the server and comes
 *  back when they sign in, on the dock tablet or on a phone. Place names, IDs, people's names and numbers stay in
 *  Latin letters and Western digits in every language. */
import i18next from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";
import { driver } from "./driver";
import { loader } from "./loader";

export type Lang = "en" | "si" | "ta";

export const LANGUAGES: { code: Lang; native: string; english: string }[] = [
  { code: "si", native: "සිංහල", english: "Sinhala" },
  { code: "ta", native: "தமிழ்", english: "Tamil" },
  { code: "en", native: "English", english: "English" },
];

void i18next.use(initReactI18next).init({
  lng: "en",
  fallbackLng: "en",
  resources: {
    en: { loader: loader.en, driver: driver.en },
    si: { loader: loader.si, driver: driver.si },
    ta: { loader: loader.ta, driver: driver.ta },
  },
  interpolation: { escapeValue: false },
  returnNull: false,
});

export const i18n = i18next;

export function isLang(value: string | null | undefined): value is Lang {
  return value === "en" || value === "si" || value === "ta";
}

const ZONE = "Asia/Colombo";
const hourMinute = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  hour: "numeric",
  minute: "2-digit",
  hour12: false,
});

function parts(value: string | Date): { h: number; m: number } {
  const [h = "0", m = "0"] = hourMinute.format(typeof value === "string" ? new Date(value) : value).split(":");
  return { h: Number(h), m: Number(m) };
}

/** A clock time the way each language writes it: "3:40 AM", "පෙ.ව. 3:40", "காலை 3:40". */
export function clockIn(lang: Lang, value: string | Date): string {
  const { h, m } = parts(value);
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const time = `${h12}:${String(m).padStart(2, "0")}`;
  if (lang === "si") return `${h < 12 ? "පෙ.ව." : "ප.ව."} ${time}`;
  if (lang === "ta") {
    const part = h < 12 ? "காலை" : h < 16 ? "மதியம்" : h < 19 ? "மாலை" : "இரவு";
    return `${part} ${time}`;
  }
  return `${time} ${h < 12 ? "AM" : "PM"}`;
}

const LOCALE: Record<Lang, string> = { en: "en-GB", si: "si-LK", ta: "ta-LK" };

/** "Thursday", "බ්‍රහස්පතින්දා", "வியாழன்" */
export function weekdayIn(lang: Lang, value: string | Date): string {
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value) : value;
  return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: ZONE, weekday: "long" }).format(date);
}

/** "Wed 8 Apr" in each language. */
export function shortDayIn(lang: Lang, value: string | Date): string {
  const date = typeof value === "string" ? new Date(value.length === 10 ? `${value}T12:00:00+05:30` : value) : value;
  return new Intl.DateTimeFormat(LOCALE[lang], { timeZone: ZONE, weekday: "short", day: "numeric", month: "short" })
    .format(date)
    .replace(",", "");
}

/** The loader namespace, with the current language and its clock. */
export function useLoaderText() {
  const { t, i18n: instance } = useTranslation("loader");
  const lang = (isLang(instance.language) ? instance.language : "en") as Lang;
  return { t, lang, clock: (value: string | Date) => clockIn(lang, value) };
}
