import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Languages, Lock, Users } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { api } from "@/api/client";
import type { Me } from "@/api/types";
import { useMe, useSignIn } from "@/app/session";
import { Button, IconButton } from "@/design/Button";
import { LanguageSheet } from "@/design/LanguageSheet";
import { RelayMark } from "@/design/Logo";
import { PinPad } from "@/design/PinPad";
import { Sheet } from "@/design/Sheet";
import { SyncPill } from "@/design/SyncPill";
import { i18n, isLang, type Lang, shortDayIn, useLoaderText } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { type Person, useTonight } from "./api";

const IDLE_LOCK_MS = 15 * 60 * 1000;
const LOCK_KEY = "relay.dock.locked";

type Dock = {
  openSwitch: () => void;
  lock: () => void;
  openLanguage: () => void;
};

const DockContext = createContext<Dock | null>(null);

export function useDock(): Dock {
  const dock = useContext(DockContext);
  if (!dock) throw new Error("useDock outside the loader shell");
  return dock;
}

function readLocked(): boolean {
  try {
    return localStorage.getItem(LOCK_KEY) === "1";
  } catch {
    return false;
  }
}

function writeLocked(locked: boolean) {
  try {
    if (locked) localStorage.setItem(LOCK_KEY, "1");
    else localStorage.removeItem(LOCK_KEY);
  } catch {
    // private mode: the lock lasts for this page only
  }
}

/** The shared dock tablet: the signed-in loader's language, the PIN switch, and the lock after 15 idle minutes. */
export function LoaderShell() {
  const me = useMe("loader");
  const { lang } = useLoaderText();
  const [switching, setSwitching] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [locked, setLockedState] = useState(readLocked);
  const client = useQueryClient();

  const setLocked = useCallback((value: boolean) => {
    writeLocked(value);
    setLockedState(value);
  }, []);

  // Each loader's language comes back when they sign in.
  const userId = me.data?.id;
  const locale = me.data?.locale;
  useEffect(() => {
    if (userId && isLang(locale)) void i18n.changeLanguage(locale);
  }, [userId, locale]);

  // Lock after 15 minutes with no taps; the sheet then opens with the last person selected.
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => {
    const arm = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setLocked(true), IDLE_LOCK_MS);
    };
    arm();
    window.addEventListener("pointerdown", arm);
    window.addEventListener("keydown", arm);
    return () => {
      window.clearTimeout(timer.current);
      window.removeEventListener("pointerdown", arm);
      window.removeEventListener("keydown", arm);
    };
  }, [setLocked]);

  const saveLanguage = useMutation({
    mutationFn: (next: Lang) => api.patch<Me>("/api/auth/me", { locale: next }, { role: "loader" }),
    onSuccess: (updated) => client.setQueryData(["me", "loader"], updated),
  });

  const dock: Dock = {
    openSwitch: () => setSwitching(true),
    lock: () => setLocked(true),
    openLanguage: () => setLanguageOpen(true),
  };
  const { t } = useLoaderText();

  return (
    <DockContext.Provider value={dock}>
      <div lang={lang} className="min-h-dvh bg-asphalt-50">
        <Outlet />
      </div>
      <SwitchSheet
        open={switching || locked}
        locked={locked}
        current={me.data?.username}
        onClose={() => setSwitching(false)}
        onSignedIn={(next) => {
          setSwitching(false);
          setLocked(false);
          if (isLang(next.locale)) void i18n.changeLanguage(next.locale);
          void client.invalidateQueries({ queryKey: ["dock"] });
        }}
      />
      <LanguageSheet
        open={languageOpen}
        onClose={() => setLanguageOpen(false)}
        value={lang}
        onChange={(next) => {
          void i18n.changeLanguage(next);
          saveLanguage.mutate(next);
        }}
        title={t("language.title")}
        helper={t("language.helper")}
        note={t("language.note")}
      />
    </DockContext.Provider>
  );
}

function SwitchSheet({
  open,
  locked,
  current,
  onClose,
  onSignedIn,
}: {
  open: boolean;
  locked: boolean;
  current: string | undefined;
  onClose: () => void;
  onSignedIn: (me: Me) => void;
}) {
  const { t } = useLoaderText();
  const tonight = useTonight();
  const signIn = useSignIn();
  const loaders = tonight.data?.loaders ?? [];
  const [picked, setPicked] = useState<string | undefined>(current);
  const [pin, setPin] = useState("");
  const [error, setError] = useState(false);

  useEffect(() => {
    if (open) {
      setPicked((p) => p ?? current);
      setPin("");
      setError(false);
    }
  }, [open, current]);

  const person = loaders.find((l) => l.username === picked);
  const enter = (next: string) => {
    setError(false);
    setPin(next);
    if (next.length === 4 && picked) {
      signIn.mutate(
        { username: picked, pin: next },
        {
          onSuccess: (me) => {
            setPin("");
            onSignedIn(me);
          },
          onError: () => {
            setPin("");
            setError(true);
          },
        },
      );
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      dismissible={!locked}
      title={locked ? t("who.lockedTitle") : t("who.title")}
      meta={locked ? t("who.lockedBody") : undefined}
      closeLabel={t("who.close")}
    >
      <div className="flex flex-col gap-5 pb-2">
        <div className="grid grid-cols-3 gap-2">
          {loaders.map((l) => (
            <PersonButton key={l.username} person={l} selected={l.username === picked} onPick={setPicked} />
          ))}
        </div>
        {person ? (
          <div className="flex flex-col items-center gap-3">
            <p className="t-h3 text-center">{t("who.enterPin", { name: calledName(person.display_name) })}</p>
            <PinPad value={pin} onChange={enter} error={error} disabled={signIn.isPending} />
            {error ? (
              <p role="alert" className="t-body-strong text-problem">
                {t("who.wrongPin")}
              </p>
            ) : (
              <p className="t-caption text-center text-asphalt-500">{t("who.pinNote")}</p>
            )}
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

function PersonButton({
  person,
  selected,
  onPick,
}: {
  person: Person;
  selected: boolean;
  onPick: (username: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onPick(person.username)}
      className={cx(
        "flex h-16 flex-col items-center justify-center gap-1 rounded-button",
        selected ? "border-2 border-petrol-700 bg-petrol-50" : "border border-asphalt-200 bg-white",
      )}
    >
      <span
        className={cx(
          "latin inline-flex size-7 items-center justify-center rounded-full t-label-strong",
          selected ? "bg-white text-petrol-700" : "bg-asphalt-100 text-asphalt-900",
        )}
      >
        {person.initials}
      </span>
      <span className={cx("latin t-label-strong", selected ? "text-petrol-700" : "text-asphalt-900")}>
        {calledName(person.display_name)}
      </span>
    </button>
  );
}

/** Top bar / phone header with sync pill: the root version (Relay mark, depot and date) or the back version. */
export function DockHeader({ title, meta, back }: { title: ReactNode; meta?: ReactNode; back?: string }) {
  const { t } = useLoaderText();
  const dock = useDock();
  const navigate = useNavigate();
  return (
    <header
      className={cx(
        "flex min-h-16 items-center gap-2 border-b border-asphalt-200 bg-white py-2 pr-2",
        back ? "pl-1" : "pl-4",
      )}
    >
      {back ? (
        <IconButton icon={ArrowLeft} label={t("bar.back")} density="field" onClick={() => navigate(back)} />
      ) : (
        <RelayMark size={24} />
      )}
      <div className="min-w-0 flex-1">
        <h1 className="t-h3 text-asphalt-900">{title}</h1>
        {meta ? <p className="t-caption text-asphalt-500">{meta}</p> : null}
      </div>
      <SyncPill synced={t("bar.synced")} offline={t("bar.notSent", { count: 1 })} />
      <IconButton icon={Languages} label={t("bar.language")} density="field" onClick={dock.openLanguage} />
    </header>
  );
}

/** The loader bar under LDR-01's header: who is signed in on the tablet, Switch and Lock. */
export function LoaderBar() {
  const { t } = useLoaderText();
  const me = useMe("loader");
  const dock = useDock();
  return (
    <div className="flex min-h-14 items-center gap-2 border-b border-asphalt-200 bg-white px-4 py-1">
      <div className="min-w-0 flex-1">
        <p className="t-caption text-asphalt-500">{t("who.signedInAs")}</p>
        <p className="latin t-h3 truncate text-asphalt-900">{me.data?.display_name}</p>
      </div>
      <Button density="field" compact icon={Users} onClick={dock.openSwitch}>
        {t("who.switch")}
      </Button>
      <IconButton icon={Lock} label={t("who.lock")} density="field" onClick={dock.lock} />
    </div>
  );
}

export function useDepotDay(depot: string | undefined, runDate: string | undefined) {
  const { t, lang } = useLoaderText();
  return {
    depot: depot ? t(`depot.${depot}`, { defaultValue: depot }) : "",
    day: runDate ? shortDayIn(lang, runDate) : "",
  };
}
