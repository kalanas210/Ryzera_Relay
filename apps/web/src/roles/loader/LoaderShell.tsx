import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ChevronDown, Languages, Lock, User, Users } from "lucide-react";
import { createContext, type ReactNode, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Outlet, useNavigate } from "react-router";
import { ApiError, api } from "@/api/client";
import type { Account, Me } from "@/api/types";
import { useAccounts, useDemoState, useMe, useSignIn } from "@/app/session";
import { Button, IconButton } from "@/design/Button";
import { LanguageSheet } from "@/design/LanguageSheet";
import { RelayMark } from "@/design/Logo";
import { PinPad } from "@/design/PinPad";
import { Sheet } from "@/design/Sheet";
import { SyncPill } from "@/design/SyncPill";
import { i18n, isLang, type Lang, useLoaderText } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { type Person, useLinesToSend, useTonight } from "./api";
import { shortDate } from "./days";
import { Swap } from "./parts";

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
      {/* Everything the dock shows sits in here, its sheets included (a <dialog> keeps its place in the page), so
          Sinhala and Tamil get their fonts and taller ramp and screen readers the right voice. The demo bar above
          stays English. */}
      <div lang={lang} className="min-h-dvh bg-asphalt-50">
        <Outlet />
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
          closeLabel={t("who.close")}
        />
      </div>
    </DockContext.Provider>
  );
}

/** What a failed PIN entry says. `shown` goes false at the next digit, and the text stays, laid out unseen, so the
 *  message line keeps its height until the sheet closes. */
export type PinFailure = { text: string; wrongPin: boolean; shown: boolean };

/** What a failed PIN entry says: a wrong PIN only when the server said so, never for a dropped connection. */
export function pinError(
  t: ReturnType<typeof useLoaderText>["t"],
  error: Error,
  otherwise: (message: string) => string,
): PinFailure {
  if (error instanceof ApiError && error.status === 401)
    return { text: t("who.wrongPin"), wrongPin: true, shown: true };
  if (error instanceof ApiError && error.offline) return { text: t("who.noConnection"), wrongPin: false, shown: true };
  return { text: otherwise(error.message), wrongPin: false, shown: true };
}

/** The line between the PIN dots and the keys: a note, or what went wrong. It is sized for the longest of them in
 *  the reader's language, so a wrong PIN, and the next digit that clears it, never move the keys under a finger. */
export function PinMessage({ note, error }: { note?: ReactNode; error: PinFailure | null }) {
  const { t } = useLoaderText();
  const problem = (text: string) => <p className="t-body-strong text-center text-problem">{text}</p>;
  const options: Record<string, ReactNode> = {
    note: <p className="t-caption text-center text-asphalt-500">{note}</p>,
    wrong: problem(t("who.wrongPin")),
    offline: problem(t("who.noConnection")),
  };
  if (error) options.error = problem(error.text);
  return (
    <div aria-live="assertive" className="w-full">
      <Swap as="div" shown={error?.shown ? "error" : "note"} options={options} />
    </div>
  );
}

/** "Password relay2026 · PIN 2580" gives "2580". */
export function pinFromHint(hint: string | undefined): string | undefined {
  return hint?.match(/\bPIN (\d+)/)?.[1];
}

/** A demo account's PIN, for the dock's PIN sheets to show the way the sign-in screen does, and only in a
 *  walkthrough. The account's username comes too, for a sheet that only knows the person's name. */
export function useDemoPin(pick: (account: Account) => boolean): { pin?: string; username?: string } {
  const accounts = useAccounts();
  const demo = useDemoState();
  const account = accounts.data?.find(pick);
  return { username: account?.username, pin: demo.data?.demo_mode ? pinFromHint(account?.hint) : undefined };
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
  const [error, setError] = useState<PinFailure | null>(null);

  // Every open starts from whoever is signed in, so a pick left from a cancelled switch never carries over.
  useEffect(() => {
    if (open) {
      setPicked(current);
      setPin("");
      setError(null);
    }
  }, [open, current]);

  const person = loaders.find((l) => l.username === picked);
  const demo = useDemoPin((a) => a.role === "loader" && a.username === picked);
  const enter = (next: string) => {
    setError((was) => was && { ...was, shown: false });
    setPin(next);
    if (next.length === 4 && picked) {
      signIn.mutate(
        { username: picked, pin: next },
        {
          onSuccess: (me) => {
            setPin("");
            onSignedIn(me);
          },
          onError: (failure) => {
            setPin("");
            setError(pinError(t, failure, (message) => t("who.signInFailed", { message })));
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
            <div className="flex flex-col items-center gap-1">
              <p className="t-h3 text-center">{t("who.enterPin", { name: calledName(person.display_name) })}</p>
              {demo.pin ? (
                <p className="t-caption text-center text-asphalt-500">{t("who.demoPin", { pin: demo.pin })}</p>
              ) : null}
            </div>
            <PinPad
              value={pin}
              onChange={enter}
              error={Boolean(error?.shown && error.wrongPin)}
              disabled={signIn.isPending}
              deleteLabel={t("who.deleteDigit")}
              progressLabel={(entered, total) => t("who.pinProgress", { entered, total })}
              message={<PinMessage note={t("who.pinNote")} error={error} />}
            />
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}

/** Loader picker / person button. The driver's tablet acceptance shows a single one, already selected. */
export function PersonButton({
  person,
  selected,
  onPick,
}: {
  person: Person;
  selected: boolean;
  onPick?: (username: string) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={() => onPick?.(person.username)}
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

/** Top bar / phone header with sync pill: the root version (Relay mark, depot and date) or the back version. With
 *  `tablet`, from 768 px up it becomes Top bar / tablet header: a Heading 1 title over its meta, and the loader
 *  button that opens the PIN switch. */
export function DockHeader({
  title,
  meta,
  back,
  backLabel,
  tablet,
}: {
  title: ReactNode;
  meta?: ReactNode;
  back?: string;
  /** The back button's name, when it goes somewhere other than tonight's loads. */
  backLabel?: string;
  tablet?: { meta: ReactNode };
}) {
  const { t } = useLoaderText();
  const dock = useDock();
  const me = useMe("loader");
  const navigate = useNavigate();
  const waiting = useLinesToSend();
  const name = calledName(me.data?.display_name);
  const lead = back ? (
    <IconButton icon={ArrowLeft} label={backLabel ?? t("bar.back")} density="field" onClick={() => navigate(back)} />
  ) : (
    <RelayMark size={24} />
  );
  const status = (
    <>
      {/* The pill is as wide as its longest label in the reader's language, so going from All synced to Sending
          and back never moves the buttons beside it. The unseen copies match SyncPill's box. */}
      <span className="inline-grid shrink-0 justify-items-end">
        <span className="col-start-1 row-start-1 inline-flex">
          <SyncPill
            synced={t("bar.synced")}
            sending={t("bar.sending")}
            offline={t("bar.offline")}
            waiting={waiting}
            toSend={(count) => t("bar.toSend", { count })}
          />
        </span>
        {[t("bar.synced"), t("bar.sending"), t("bar.offline"), t("bar.toSend", { count: 10 })].map((label) => (
          <span
            key={label}
            aria-hidden
            className="invisible col-start-1 row-start-1 inline-flex h-8 max-w-[140px] items-center gap-1 rounded-chip border px-2 t-label"
          >
            <span className="size-4 shrink-0" />
            <span className="min-w-0 leading-tight">{label}</span>
          </span>
        ))}
      </span>
      <IconButton icon={Languages} label={t("bar.language")} density="field" onClick={dock.openLanguage} />
    </>
  );
  return (
    <>
      <header
        className={cx(
          "flex min-h-16 items-center gap-2 border-b border-asphalt-200 bg-white py-2 pr-2",
          back ? "pl-1" : "pl-4",
          tablet && "md:hidden",
        )}
      >
        {lead}
        <div className="min-w-0 flex-1">
          <h1 className="t-h3 text-asphalt-900">{title}</h1>
          {meta ? <p className="t-caption text-asphalt-500">{meta}</p> : null}
        </div>
        {status}
      </header>
      {tablet ? (
        <header className="hidden min-h-16 items-center gap-3 border-b border-asphalt-200 bg-white py-1.5 pr-6 pl-3 md:flex">
          {lead}
          <div className="min-w-0 flex-1">
            <h1 className="t-h1 text-asphalt-900">{title}</h1>
            <p className="t-label text-asphalt-700">{tablet.meta}</p>
          </div>
          <Button
            density="field"
            compact
            icon={User}
            iconAfter={ChevronDown}
            aria-label={t("who.switchFrom", { name })}
            onClick={dock.openSwitch}
          >
            <span className="latin">{name}</span>
          </Button>
          {status}
        </header>
      ) : null}
    </>
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
        <p className="latin t-h3 [overflow-wrap:anywhere] text-asphalt-900">{me.data?.display_name}</p>
      </div>
      <Button density="field" compact icon={Users} onClick={dock.openSwitch}>
        {t("who.switch")}
      </Button>
      <IconButton icon={Lock} label={t("who.lock")} density="field" onClick={dock.lock} />
    </div>
  );
}

export function useDepotDay(depot: string | undefined, runDate: string | undefined) {
  const { t } = useLoaderText();
  return {
    depot: depot ? t(`depot.${depot}`, { defaultValue: depot }) : "",
    day: runDate ? shortDate(t, runDate) : "",
  };
}
