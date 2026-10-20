import { Languages } from "lucide-react";
import { createContext, useContext, useEffect, useState } from "react";
import { Outlet } from "react-router";
import { useMe } from "@/app/session";
import { Button } from "@/design/Button";
import { LanguageSheet } from "@/design/LanguageSheet";
import { i18n, isLang, LANGUAGES, type Lang } from "@/i18n";
import { useWakeLock } from "./device";
import { DriverSync, useDriver } from "./sync";
import { useDriverText } from "./words";

const LANG_KEY = "relay.driver.lang";

function keptLanguage(): Lang | null {
  try {
    const value = localStorage.getItem(LANG_KEY);
    return isLang(value) ? value : null;
  } catch {
    return null;
  }
}

function keepLanguage(lang: Lang) {
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // Private mode blocks storage, so the choice lasts for this page only.
  }
}

const LanguageContext = createContext<(() => void) | null>(null);

export function DriverShell() {
  return (
    <DriverSync>
      <Phone />
    </DriverSync>
  );
}

function Phone() {
  const me = useMe("driver");
  const { run } = useDriver();
  const { lang, t } = useDriverText();
  const [languageOpen, setLanguageOpen] = useState(false);

  // The choice stays on this phone. The account's language is only where a new phone starts.
  const locale = me.data?.locale;
  useEffect(() => {
    const start = keptLanguage() ?? (isLang(locale) ? locale : "en");
    if (i18n.language !== start) void i18n.changeLanguage(start);
  }, [locale]);

  // Night colours follow the phone's dark setting. On the root, so sheets and the scrim switch too.
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("night-capable");
    return () => root.classList.remove("night-capable");
  }, []);

  const trip = run?.trip;
  useWakeLock(Boolean(trip && trip.load === "accepted" && !trip.finished_at));

  return (
    <LanguageContext.Provider value={() => setLanguageOpen(true)}>
      <div lang={lang} className="min-h-dvh bg-asphalt-50 text-asphalt-900">
        <Outlet />
        <LanguageSheet
          open={languageOpen}
          onClose={() => setLanguageOpen(false)}
          value={lang}
          onChange={(next) => {
            keepLanguage(next);
            void i18n.changeLanguage(next);
          }}
          title={t("language.title")}
          helper={t("language.helper")}
          closeLabel={t("header.close")}
        />
      </div>
    </LanguageContext.Provider>
  );
}

export function LanguageRow() {
  const open = useContext(LanguageContext);
  const { t, lang } = useDriverText();
  const name = LANGUAGES.find((l) => l.code === lang)?.native ?? "English";
  return (
    <Button variant="quiet" density="field" full icon={Languages} className="justify-start" onClick={() => open?.()}>
      {t("run.language", { name })}
    </Button>
  );
}
