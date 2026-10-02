import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleDot,
  Clock,
  Handshake,
  Layers,
  LockKeyhole,
  PackageX,
  RefreshCw,
  User,
} from "lucide-react";
import {
  type CSSProperties,
  type ReactNode,
  type RefObject,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { flushSync } from "react-dom";
import { useNavigate, useParams } from "react-router";
import { useMe } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { Button, IconButton } from "@/design/Button";
import { StatusChip } from "@/design/StatusChip";
import { type MarkerState, StopMarker } from "@/design/StopMarker";
import { useLoaderText } from "@/i18n";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import {
  type LoadLine,
  loadKindKey,
  type StopGroup,
  type TripLoad,
  useFlag,
  useFlagPhoto,
  useSetLine,
  useTripLoad,
  useUnsentFlags,
  vehicleKindKey,
} from "./api";
import { CallSheet, FlagSheet, type SendFlag } from "./FlagSheet";
import { DockHeader } from "./LoaderShell";
import { CountSheet, LoadLineRow, LoadProgress, StopTitle, useSettledTap } from "./parts";

const SEEN_KEY = "relay.dock.answers-seen";
const COLLAPSE_AFTER_MS = 10_000;
/** A folded stop's card, at its shortest. */
const FOLDED_HEIGHT = 72;
/** A flag still waiting this long before departure turns into a problem: the loader should call. */
const NO_ANSWER_BEFORE_MS = 15 * 60_000;

function readSeen(): string[] {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function markerState(group: StopGroup): MarkerState {
  if (group.state === "done") return group.short ? "short" : "done";
  if (group.state === "loading") return "next";
  return "pending";
}

const isFlagged = (line: LoadLine) => line.status === "flag_waiting" || line.status === "decided";
const isChanged = (line: LoadLine) => line.changed_by_plan && !isFlagged(line);

/** The copy of an element that is on screen: the phone and tablet layouts both render the lines. */
function shown(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    if (el.getClientRects().length) return el;
  }
  return null;
}

/** How long a tapped line is held in place: the fold, the tick and the server's answer all land within it. */
const HOLD_MS = 1500;

/** `gap` is how far above the phone's bottom bar the element ended (Infinity on the tablet, which has none). */
type Anchor = { el: Element; top: number; until: number; gap: number };

/** The phone's bottom bar, when it is on screen. */
function onScreen(el: HTMLElement | null): HTMLElement | null {
  return el?.getClientRects().length ? el : null;
}

/** Where an element sits on screen now, so it can be put back there while the list changes height above it. */
function measure(el: Element | null | undefined, foot: HTMLElement | null): Anchor | null {
  if (!el) return null;
  const box = el.getBoundingClientRect();
  const bar = onScreen(foot);
  const gap = bar ? bar.getBoundingClientRect().top - box.bottom : Number.POSITIVE_INFINITY;
  return { el, top: box.top, until: Date.now() + HOLD_MS, gap };
}

/** The first line or stop showing under the app bar, outside the stop about to fold: what the loader is looking
 *  at when a stop folds by itself, with no hand on the screen to anchor to. */
function firstInView(below: number, folding: Element | null): Element | null {
  for (const el of document.querySelectorAll("[data-stop], [data-line]")) {
    if (!el.getClientRects().length || folding?.contains(el)) continue;
    if (el.getBoundingClientRect().bottom > below) return el;
  }
  return null;
}

/** The stop being loaded now, by its header or else its first line, when that starts on screen between the app bar
 *  and the bottom bar: where the loader's eyes go when a finished stop folds by itself. */
function loadingNowInView(stopId: string | undefined, below: number, foot: HTMLElement | null): Element | null {
  if (!stopId) return null;
  const above = onScreen(foot)?.getBoundingClientRect().top ?? window.innerHeight;
  const candidates = [shown(`[data-stop="${stopId}"]`), shown(`[data-stop="${stopId}"] [data-line]`)];
  return (
    candidates.find((el) => {
      const top = el?.getBoundingClientRect().top;
      return top !== undefined && top >= below && top < above;
    }) ?? null
  );
}

/** Scrolls up by about what a stop above `el` loses when it folds, before it folds. Near the end of the list the
 *  page would otherwise get shorter than the scroll, the browser would clamp it, and `el` would move after all.
 *  A stop below `el` takes nothing from above it, so the list is left where it is. */
function makeRoomToFold(stopId: string, el: Element | null | undefined) {
  const section = shown(`[data-stop="${stopId}"]`);
  if (!section || !el) return;
  const box = section.getBoundingClientRect();
  if (box.top < el.getBoundingClientRect().top) window.scrollBy(0, -Math.max(0, box.height - FOLDED_HEIGHT));
}

/** An element's height, kept up to date: the app bar grows when a Tamil or Sinhala title wraps, and a pinned stop
 *  copy when its place takes its own line. */
function useHeight(el: HTMLElement | null, fallback: number): number {
  const [height, setHeight] = useState(fallback);
  useLayoutEffect(() => {
    if (!el || typeof ResizeObserver === "undefined") return;
    const read = () => setHeight(Math.round(el.getBoundingClientRect().height));
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [el]);
  return height;
}

type Alert = {
  tone: "attention" | "problem";
  who: string;
  what: string;
  action?: { label: string; onClick: () => void };
};

/** LDR-02 Load vehicle: the trip in the order it goes on (the last stop first, heaviest case type first), one tap
 *  a line. From 768 px wide the dock tablet adds a load map of the truck beside the lines. */
export function LoadVehiclePage() {
  const { tripId = "" } = useParams();
  const trip = useTripLoad(tripId);
  const { t } = useLoaderText();
  const load = trip.data;
  if (!load) {
    return (
      <div className="mx-auto flex min-h-dvh w-full max-w-[1024px] flex-col">
        <DockHeader title="" back="/loader" />
        {trip.error ? <p className="p-4 t-body text-problem">{trip.error.message}</p> : null}
      </div>
    );
  }
  return (
    <LoadVehicle
      load={load}
      key={load.trip_id}
      title={t("load.title", { vehicle: load.vehicle_id, n: load.trip_no })}
    />
  );
}

function LoadVehicle({ load, title }: { load: TripLoad; title: string }) {
  const { t, clock } = useLoaderText();
  const navigate = useNavigate();
  const me = useMe("loader");
  const now = useSimNow(30_000);
  const setLine = useSetLine(load.trip_id);
  const flag = useFlag(load.trip_id);
  const flagPhoto = useFlagPhoto(load.trip_id);
  const [flagFor, setFlagFor] = useState<{ group: StopGroup; line: LoadLine } | null>(null);
  const [countFor, setCountFor] = useState<LoadLine | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState<{ stop: string; at: number } | null>(null);
  const [seen, setSeen] = useState<string[]>(readSeen);
  const [calling, setCalling] = useState(false);
  const unsent = useUnsentFlags(load.trip_id);
  const groups = load.groups;
  const sections = useRef<Record<string, HTMLElement | null>>({});
  const root = useRef<HTMLDivElement>(null);
  const [bar, setBar] = useState<HTMLDivElement | null>(null);
  const [foot, setFoot] = useState<HTMLDivElement | null>(null);
  const barHeight = useHeight(bar, 64);

  // Folding a finished stop must not move the list under a gloved finger. Whatever the loader is working at is
  // measured before the fold and put back in the same place after it, before the browser paints. When the bottom
  // bar grows over it (Go to handover appears as the last line is checked, or an alert slides in), the list moves
  // up just enough to keep it in view above the bar, with the room it had, and holds it there.
  const anchor = useRef<Anchor | null>(null);
  useLayoutEffect(() => {
    const held = anchor.current;
    if (!held) return;
    if (!held.el.isConnected || Date.now() > held.until) {
      anchor.current = null;
      return;
    }
    const box = held.el.getBoundingClientRect();
    const shift = box.top - held.top;
    const bottomBar = onScreen(foot);
    // a line the loader tapped while it sat half under the bar is left where it is
    const covered =
      bottomBar && held.gap >= 0
        ? held.top + box.height - (bottomBar.getBoundingClientRect().top - Math.min(held.gap, 8))
        : 0;
    const lift = Math.max(0, covered);
    if (Math.abs(shift + lift) >= 1) window.scrollBy(0, shift + lift);
    held.top -= lift;
  });

  // The tablet's control column fills the screen below its own top. Until the page scrolls the demo bar away, that
  // top sits lower than the app bar's, so the column is sized from where the app bar is now, not from its height.
  useEffect(() => {
    const el = root.current;
    if (!el || !bar) return;
    const update = () =>
      el.style.setProperty("--above", `${Math.max(0, Math.round(bar.getBoundingClientRect().top))}px`);
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
    observer?.observe(document.body);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      observer?.disconnect();
    };
  }, [bar]);
  // The loader scrolling, or pressing anything, lets go at once: the list never fights a hand.
  useEffect(() => {
    const letGo = () => {
      anchor.current = null;
    };
    const events = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    for (const type of events) window.addEventListener(type, letGo, { passive: true });
    return () => {
      for (const type of events) window.removeEventListener(type, letGo);
    };
  }, []);

  // Whether a stop folds once the loader's hand leaves it: finished, whole, and not opened or closed by hand.
  const foldsOnLeave = (g: StopGroup | undefined): boolean =>
    !!g &&
    g.state === "done" &&
    !g.short &&
    opened[g.stop_id] === undefined &&
    !g.lines.some((l) => l.status === "flag_waiting" || isChanged(l));
  const touchedFolds = foldsOnLeave(groups.find((g) => g.stop_id === touched?.stop));

  const complete = Boolean(load.handover.completed_at);
  // The server names the one stop being loaded now; the screen never works it out for itself.
  const current = complete ? undefined : groups.find((g) => g.state === "loading");
  // read when the fold comes, without starting its 10 seconds again each time a poll lands
  const loadingNow = useRef(current?.stop_id);
  loadingNow.current = current?.stop_id;

  // A stop just finished stays open under the loader's hand until they touch another stop or 10 seconds pass. Then
  // what the loader is looking at stays where it is: the stop being loaded now, if it is on screen, or else
  // whatever shows first under the app bar, as they may have scrolled anywhere in those 10 seconds.
  useEffect(() => {
    if (!touched) return;
    const timer = window.setTimeout(() => {
      if (touchedFolds) {
        const below = bar?.getBoundingClientRect().bottom ?? 0;
        const view =
          loadingNowInView(loadingNow.current, below, foot) ??
          firstInView(below, shown(`[data-stop="${touched.stop}"]`));
        anchor.current = measure(view, foot);
        makeRoomToFold(touched.stop, view);
      }
      // fold, and put the list back, before the browser paints
      flushSync(() => setTouched(null));
    }, COLLAPSE_AFTER_MS);
    return () => window.clearTimeout(timer);
  }, [touched, touchedFolds, bar, foot]);

  const kind = t(`kinds.${loadKindKey(load.brand, load.temp)}`);
  const chilled = load.temp === "chilled";
  const firstSeq = groups[0]?.seq;
  const lastSeq = groups[groups.length - 1]?.seq;
  const allDone = load.lines_done === load.lines_total && load.lines_total > 0;
  const departed = Boolean(now && now.getTime() >= Date.parse(load.planned_depart));
  const late = Boolean(now && now.getTime() >= Date.parse(load.planned_depart) - NO_ANSWER_BEFORE_MS) && !complete;

  const answers = useMemo(
    () =>
      groups.flatMap((g) =>
        g.lines
          .filter((l) => l.shortfall?.decision && !seen.includes(l.shortfall.id))
          .map((l) => ({ group: g, line: l })),
      ),
    [groups, seen],
  );
  const changedLines = groups.flatMap((g) => g.lines.filter(isChanged).map((l) => ({ group: g, line: l })));
  const changedKey = `changed:${load.trip_id}:${load.plan_changed_at ?? ""}`;
  const markSeen = (id: string) => {
    const next = [...seen, id];
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next.slice(-100)));
    } catch {
      // the alert shows again next time
    }
  };

  // A stop with a flag, a short or a changed line never folds by itself.
  const isOpen = (g: StopGroup) => opened[g.stop_id] ?? (!foldsOnLeave(g) || touched?.stop === g.stop_id);

  const touch = (g: StopGroup, line: LoadLine) => {
    const row = shown(`[data-line="${line.id}"]`);
    anchor.current = measure(row, foot);
    if (touched && touched.stop !== g.stop_id && touchedFolds) makeRoomToFold(touched.stop, row);
    setTouched({ stop: g.stop_id, at: Date.now() });
  };

  const toggle = (g: StopGroup, line: LoadLine) => {
    if (complete) return;
    touch(g, line);
    // a changed line is confirmed where it sits, with the count it already has
    const loaded = line.changed_by_plan ? line.loaded : line.status === "checked" ? 0 : line.qty;
    setLine.mutate({ lineId: line.id, loaded });
  };

  const closeFlag = useCallback(() => setFlagFor(null), []);
  const sendFlag: SendFlag = (input, photo) => {
    flag.mutate({ ...input, at: (now ?? new Date()).toISOString(), by: me.data?.display_name ?? null });
    // queued behind the flag, so it reaches Relay after it even when both wait for the connection
    if (photo) flagPhoto.mutate({ lineId: input.lineId, photo });
  };
  const failed = setLine.error ?? flag.error ?? flagPhoto.error;

  const scrollTo = (stopId: string) => sections.current[stopId]?.scrollIntoView({ behavior: "smooth", block: "start" });

  const showChanged = () => {
    markSeen(changedKey);
    const first = changedLines[0];
    if (!first) return;
    setOpened((o) => ({ ...o, [first.group.stop_id]: true }));
    window.requestAnimationFrame(() =>
      shown(`[data-line="${first.line.id}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
    );
  };

  const vehicleKind = t(`vehicles.${vehicleKindKey(load.vehicle_kind)}`);
  const meta = load.driver
    ? t("load.meta", { driver: load.driver, kind: vehicleKind, time: clock(load.planned_depart) })
    : t("load.metaNoDriver", { kind: vehicleKind, time: clock(load.planned_depart) });

  const chips = (
    <div className="flex flex-wrap gap-2">
      {load.plan_changed_at ? (
        <StatusChip icon={RefreshCw} tone="attention">
          {t("chips.planChanged", { time: clock(load.plan_changed_at) })}
        </StatusChip>
      ) : null}
      {load.flags_waiting ? (
        <StatusChip icon={Clock} tone="attention">
          {t("chips.flagsWaiting", { count: load.flags_waiting })}
        </StatusChip>
      ) : null}
      {load.short ? (
        <StatusChip icon={PackageX} tone="attention">
          {t("chips.short", { count: load.short })}
        </StatusChip>
      ) : null}
    </div>
  );

  const progressText = t("load.progress", { loaded: load.loaded, total: load.cases });
  // The tablet's app bar already names the loader, so its progress row counts lines instead.
  const progress = (large: boolean) => (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="num t-body-strong text-asphalt-900">{progressText}</span>
        {load.short ? (
          <span className="inline-flex shrink-0 items-center gap-1 t-label-strong whitespace-nowrap text-attention">
            <PackageX size={16} strokeWidth={1.75} aria-hidden />
            {t("chips.short", { count: load.short })}
          </span>
        ) : null}
        {large ? (
          <span className="num ml-auto t-caption text-asphalt-700">
            {t("load.linesDone", { done: load.lines_done, total: load.lines_total })}
          </span>
        ) : (
          <span className="ml-auto inline-flex items-center gap-1 t-caption text-asphalt-700">
            <User size={16} strokeWidth={1.75} aria-hidden />
            <span className="latin">{calledName(me.data?.display_name)}</span>
          </span>
        )}
      </div>
      <LoadProgress
        loaded={load.loaded}
        total={load.cases}
        short={load.short}
        complete={allDone}
        label={progressText}
      />
    </div>
  );

  // One alert at a time, the most pressing first: a flag nobody has answered close to departure, then an answer,
  // then lines a plan change moved.
  const waiting = groups.flatMap((g) => g.lines).some((l) => l.status === "flag_waiting");
  const answer = answers[0];
  let alert: Alert | null = null;
  if (late && waiting) {
    alert = {
      tone: "problem",
      who: t("load.noAnswerFrom", { name: calledName(load.dispatcher) }),
      // once the time to leave has gone, there is no "before" left to call by
      what: departed
        ? t("load.dueToLeave", {
            vehicle: load.vehicle_id,
            time: clock(load.planned_depart),
            name: calledName(load.dispatcher),
          })
        : t("load.callBefore", { time: clock(load.planned_depart) }),
      action: load.dispatcher_phone
        ? { label: t("load.call", { name: calledName(load.dispatcher) }), onClick: () => setCalling(true) }
        : undefined,
    };
  } else if (answer) {
    alert = {
      tone: "attention",
      who: t("load.answered", { name: calledName(answer.line.shortfall?.decided_by) }),
      what: t("load.answeredWhat", {
        n: answer.group.seq,
        item: t(`casesLower.${answer.line.case_type}`, { defaultValue: answer.line.case_type }),
      }),
      action: {
        label: t("load.seeAnswer"),
        onClick: () => {
          if (answer.line.shortfall) markSeen(answer.line.shortfall.id);
          setFlagFor(answer);
        },
      },
    };
  } else if (changedLines.length && !complete && !seen.includes(changedKey)) {
    alert = {
      tone: "attention",
      who: load.plan_changed_by
        ? t("load.changedBy", { name: calledName(load.plan_changed_by) })
        : load.plan_changed_at
          ? t("chips.planChanged", { time: clock(load.plan_changed_at) })
          : "",
      what: t("load.toCheck", { count: changedLines.length }),
      action: { label: t("load.showMe"), onClick: showChanged },
    };
  }

  // The action sits beside the words while both fit and drops under them before it would squeeze them to a word a
  // line, as a Sinhala or Tamil label can. In the tablet's control column it always takes its own full-width line.
  const alertRow = (large: boolean) =>
    alert ? (
      <div
        role="status"
        className={cx(
          "-mx-4 flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-t pl-4",
          large ? "-mt-4 shrink-0 pt-3 pr-4 pb-4" : "-mt-3 mb-1 py-1 pr-2",
          alert.tone === "problem" ? "border-problem bg-problem-soft" : "border-attention bg-attention-soft",
        )}
      >
        <CircleAlert
          size={24}
          strokeWidth={1.75}
          aria-hidden
          className={cx("shrink-0", alert.tone === "problem" ? "text-problem" : "text-attention")}
        />
        <p className="min-w-44 flex-1 t-body-strong text-asphalt-900">
          {alert.who ? <span className="block">{alert.who}</span> : null}
          <span className="block">{alert.what}</span>
        </p>
        {alert.action ? (
          <Button
            density="field"
            compact
            full={large}
            className={large ? undefined : "ml-auto"}
            onClick={alert.action.onClick}
          >
            {alert.action.label}
          </Button>
        ) : null}
      </div>
    ) : null;

  // Once the load is marked complete the page is its record: the lines no longer check or flag, and it says so.
  const hint =
    complete && load.handover.completed_at ? (
      <section
        role="status"
        className="flex items-start gap-3 rounded-card border border-asphalt-300 bg-waiting-soft p-4"
      >
        <LockKeyhole size={24} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-700" />
        <div className="flex min-w-0 flex-col gap-2">
          <h2 className="t-h3">{t("load.completeTitle", { time: clock(load.handover.completed_at) })}</h2>
          <p className="t-body text-asphalt-900">
            {load.dispatcher
              ? t("load.completeBody", { name: calledName(load.dispatcher) })
              : t("load.completeBodyNoName")}
          </p>
        </div>
      </section>
    ) : allDone ? (
      <p className="flex items-start gap-3 t-body text-asphalt-700">
        <Check size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-done" />
        {t("load.hintDone", { count: load.lines_total, driver: calledName(load.driver) })}
      </p>
    ) : (
      <p className="flex items-start gap-3 t-body text-asphalt-700">
        <Layers size={24} strokeWidth={1.75} aria-hidden className="shrink-0" />
        {/* press and hold has no other cue on screen, so the hint names it */}
        {`${groups.length > 1 ? t("load.hint", { first: firstSeq, last: lastSeq }) : t("load.hintSingle")} ${t("load.holdHint")}`}
      </p>
    );

  const lines = (large: boolean) =>
    groups.map((g, index) => (
      <StopSection
        key={g.stop_id}
        ref={(el) => {
          if (large) sections.current[g.stop_id] = el;
        }}
        group={g}
        position={groups.length > 1 ? (index === 0 ? "first" : index === groups.length - 1 ? "last" : null) : null}
        loadingNow={current?.stop_id === g.stop_id}
        open={isOpen(g)}
        onOpen={(value) => setOpened((o) => ({ ...o, [g.stop_id]: value }))}
        large={large}
        barHeight={barHeight}
      >
        {g.lines.map((line) => (
          <LoadLineRow
            key={line.id}
            line={line}
            stop={g.seq}
            kind={kind}
            chilled={chilled}
            dispatcher={load.dispatcher}
            large={large}
            noAnswer={late && line.status === "flag_waiting"}
            unsent={unsent.has(line.id)}
            readOnly={complete}
            onToggle={() => toggle(g, line)}
            onCount={() => {
              if (complete) return;
              touch(g, line);
              setCountFor(line);
            }}
            onFlag={() => {
              touch(g, line);
              // only an answer can be seen; looking at a flag still waiting must not hide the answer to come
              if (line.shortfall?.decision) markSeen(line.shortfall.id);
              if (!complete || line.shortfall) setFlagFor({ group: g, line });
            }}
          />
        ))}
      </StopSection>
    ));

  // It appears under the finger that checked the last line, and the handover's Load complete takes its place on
  // the next page: it waits a moment before it takes a tap, so a double tap never skips the totals.
  const settled = useSettledTap(allDone);
  const handoverButton = allDone ? (
    <Button
      variant="primary"
      density="field"
      full
      icon={Handshake}
      onClick={settled(() => navigate(`/loader/trips/${load.trip_id}/handover`))}
    >
      {complete ? t("load.seeHandover") : t("load.goToHandover")}
    </Button>
  ) : null;

  return (
    <div
      ref={root}
      className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col"
      style={{ "--bar": `${barHeight}px` } as CSSProperties}
    >
      <div ref={setBar} className="sticky top-0 z-30">
        <DockHeader title={title} back="/loader" tablet={{ meta }} />
      </div>

      {/* phone: one column with a fixed bottom bar */}
      <div className="flex flex-1 flex-col md:hidden">
        <div className="flex flex-col gap-2 border-b border-asphalt-200 bg-white px-4 pt-3 pb-4">
          <p className="t-body text-asphalt-700">{meta}</p>
          {chips}
        </div>
        <div className="px-4 py-3">{hint}</div>
        <div className="flex flex-col gap-4 px-4 pb-6 [overflow-anchor:none]">{lines(false)}</div>
        <div
          ref={setFoot}
          className="sticky bottom-0 z-20 mt-auto flex flex-col gap-2 border-t border-asphalt-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]"
        >
          {alertRow(false)}
          {progress(false)}
          {handoverButton}
        </div>
      </div>

      {/* dock tablet: a control column with the load map, and the lines set larger */}
      <div className="hidden flex-1 gap-6 p-6 md:flex">
        {/* The column fills the screen below its own top, so the progress and Go to handover always sit at its foot,
            in view. When an alert, three chips and the map need more room than is left (Sinhala and Tamil on a 768
            high tablet), only they scroll, on their own, and nothing in the column is squeezed. */}
        <aside className="sticky top-[calc(var(--bar)_+_24px)] flex h-[calc(100dvh_-_var(--bar)_-_var(--above,0px)_-_48px)] w-80 shrink-0 flex-col overflow-hidden rounded-card border border-asphalt-200 bg-white">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain p-4">
            {alertRow(true)}
            {chips}
            <div className="flex flex-col gap-1">
              <h2 className="t-h3">{t("load.loadMap")}</h2>
              <p className="t-caption text-asphalt-500">{t("load.loadMapHelp")}</p>
            </div>
            <LoadMap groups={groups} current={current?.stop_id} onPick={scrollTo} />
          </div>
          <div className="flex shrink-0 flex-col gap-2 px-4 pt-2 pb-4">
            {progress(true)}
            {handoverButton}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4 [overflow-anchor:none]">
          {hint}
          {lines(true)}
        </div>
      </div>

      <FlagSheet
        load={load}
        group={flagFor?.group ?? null}
        line={flagFor ? findLine(load, flagFor.line.id) : null}
        unsent={flagFor ? unsent.has(flagFor.line.id) : false}
        onSend={sendFlag}
        onClose={closeFlag}
      />
      <CallSheet open={calling} onClose={() => setCalling(false)} load={load} />
      <CountSheet
        line={countFor}
        onClose={() => setCountFor(null)}
        onSave={(loaded) => countFor && setLine.mutate({ lineId: countFor.id, loaded })}
      />
      {failed ? (
        <p
          role="alert"
          className="fixed inset-x-4 bottom-28 z-40 rounded-button bg-problem-soft px-4 py-3 t-body-strong text-problem"
        >
          {t("load.notSaved", { message: failed.message })}
        </p>
      ) : null}
    </div>
  );
}

function findLine(load: TripLoad, id: string): LoadLine | null {
  for (const g of load.groups) {
    const line = g.lines.find((l) => l.id === id);
    if (line) return line;
  }
  return null;
}

/** True while the stop's header is pinned under the app bar, so the pinned copy can take its compact form. */
function useStuck(sentinel: RefObject<HTMLElement | null>, offset: number, open: boolean): boolean {
  const [stuck, setStuck] = useState(false);
  useEffect(() => {
    const el = sentinel.current;
    if (!open) setStuck(false);
    if (!open || !el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry) return;
        const top = entry.rootBounds?.top ?? offset;
        setStuck(!entry.isIntersecting && entry.boundingClientRect.top < top);
      },
      { rootMargin: `-${offset}px 0px 0px 0px`, threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [sentinel, offset, open]);
  return stuck;
}

type SectionProps = {
  group: StopGroup;
  position: "first" | "last" | null;
  loadingNow: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  large: boolean;
  barHeight: number;
  children: ReactNode;
  ref: (el: HTMLElement | null) => void;
};

function StopSection({ group, position, loadingNow, open, onOpen, large, barHeight, children, ref }: SectionProps) {
  const { t, clock } = useLoaderText();
  const sentinel = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState<HTMLDivElement | null>(null);
  const stuck = useStuck(sentinel, barHeight, open);
  const compactHeight = useHeight(compact, large ? 56 : 48);
  const moved =
    group.moved_from && group.moved_at ? (
      <span className="inline-flex items-center gap-1 t-caption text-attention">
        <RefreshCw size={16} strokeWidth={1.75} aria-hidden />
        {t("load.moved", { n: group.moved_from, time: clock(group.moved_at) })}
      </span>
    ) : null;

  const count = t("load.count", { loaded: group.loaded, total: group.cases });
  if (!open) {
    return (
      <section
        ref={ref}
        data-stop={group.stop_id}
        className="flex scroll-mt-[calc(var(--bar)_+_16px)] items-center gap-3 rounded-card border border-asphalt-200 bg-white py-3 pr-1 pl-3"
      >
        <StopMarker n={group.seq} state={markerState(group)} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className={large ? "t-h1" : "t-h2"}>
            <StopTitle seq={group.seq} place={group.place} />
          </h3>
          {group.short ? (
            <span className="inline-flex items-center gap-1 t-label text-attention">
              <PackageX size={16} strokeWidth={1.75} aria-hidden />
              {t("load.loadedShort", { loaded: group.loaded, total: group.cases, short: group.short })}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 t-label text-done">
              <Check size={16} strokeWidth={1.75} aria-hidden />
              {t("load.allLoaded", { count: group.cases })}
            </span>
          )}
          {moved}
        </div>
        <IconButton icon={ChevronDown} label={t("load.expand")} density="field" onClick={() => onOpen(true)} />
      </section>
    );
  }

  return (
    <section
      ref={ref}
      data-stop={group.stop_id}
      className="relative flex scroll-mt-[calc(var(--bar)_+_16px)] flex-col gap-2"
    >
      <div ref={sentinel} aria-hidden className="-mb-2 h-0" />
      {/* The compact copy that pins under the app bar is drawn over the list, never in it, so pinning or letting go
          moves no line under a gloved finger. Its track ends one copy's height before the stop does, so the next
          stop's header pushes it up. It is a picture of the header, not a control. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 z-10" style={{ bottom: compactHeight }}>
        <div className="sticky top-(--bar) h-0">
          <div
            ref={setCompact}
            className={cx(
              "pointer-events-auto absolute inset-x-0 top-0 -mx-4 flex items-center gap-3 border-b border-asphalt-200 bg-white px-4 py-1.5 md:mx-0 md:px-3",
              large ? "min-h-14" : "min-h-12",
              !stuck && "invisible",
            )}
          >
            <StopMarker n={group.seq} state={markerState(group)} />
            <span className={cx("min-w-0 flex-1", large ? "t-h2" : "t-h3")}>
              <StopTitle seq={group.seq} place={group.place} />
            </span>
            <span className={cx("num shrink-0 text-asphalt-900", large ? "t-h3" : "t-body-strong")}>{count}</span>
          </div>
        </div>
      </div>
      {group.state === "done" && !group.short ? (
        // a finished stop opened again: its header folds it, as the design's stop group does, so nothing is added
        // beside the title to squeeze it onto a second line
        <h3>
          <button
            type="button"
            aria-expanded
            onClick={() => onOpen(false)}
            className="flex min-h-12 w-full items-center gap-3 py-2 text-left"
          >
            <StopMarker n={group.seq} state={markerState(group)} />
            <span className={cx("min-w-0 flex-1", large ? "t-h1" : "t-h2")}>
              <StopTitle seq={group.seq} place={group.place} />
            </span>
            <span className={cx("num shrink-0 text-asphalt-900", large ? "t-h3" : "t-body-strong")}>{count}</span>
            <span className="sr-only">{t("load.collapse")}</span>
          </button>
        </h3>
      ) : (
        <div className="flex min-h-12 items-center gap-3 py-2">
          <StopMarker n={group.seq} state={markerState(group)} />
          <h3 className={cx("min-w-0 flex-1", large ? "t-h1" : "t-h2")}>
            <StopTitle seq={group.seq} place={group.place} />
          </h3>
          <span className={cx("num shrink-0 text-asphalt-900", large ? "t-h3" : "t-body-strong")}>{count}</span>
        </div>
      )}
      <div className="-mt-1 flex flex-col gap-1 pl-11">
        <p className={cx("latin text-asphalt-700", large ? "t-body" : "t-label")}>
          {t("load.stopMeta", {
            outlet: group.outlet_id,
            order: group.order_ref,
            cases: t("tonight.cases", { count: group.cases }),
          })}
        </p>
        {loadingNow || moved || position ? (
          // as high as the Loading now chip, so the chip coming or going never moves the lines below
          <div className="flex min-h-7 flex-wrap items-center gap-2">
            {loadingNow ? (
              <StatusChip icon={CircleDot} tone="petrol">
                {t("chips.loadingNow")}
              </StatusChip>
            ) : null}
            {moved}
            {position ? (
              <span className="t-caption text-asphalt-700">
                {position === "first" ? t("load.loadFirst") : t("load.loadLast")}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

/** The truck drawn from cab to doors, one band per stop in loading order. Strokes are inset rings, kept out of the
 *  layout as the design draws them, so a band never shifts when its state changes and the places keep their room. */
function LoadMap({
  groups,
  current,
  onPick,
}: {
  groups: StopGroup[];
  current: string | undefined;
  onPick: (stopId: string) => void;
}) {
  const { t, clock } = useLoaderText();
  return (
    <div className="flex flex-col gap-1 rounded-card p-2 ring-2 ring-asphalt-300 ring-inset">
      <span className="px-2 t-caption text-asphalt-500">{t("load.cabEnd")}</span>
      {groups.map((g) => {
        const done = g.state === "done";
        const now = g.stop_id === current;
        return (
          <button
            key={g.stop_id}
            type="button"
            onClick={() => onPick(g.stop_id)}
            className={cx(
              "flex h-14 items-center gap-2 rounded-button px-2 text-left",
              done
                ? g.short
                  ? "bg-attention-soft ring-1 ring-attention ring-inset"
                  : "bg-done-soft ring-1 ring-done ring-inset"
                : now
                  ? "bg-white ring-2 ring-signal-400 ring-inset"
                  : "bg-asphalt-100",
            )}
          >
            <StopMarker n={g.seq} state={markerState(g)} />
            <span className="latin min-w-0 truncate t-body-strong">{g.place}</span>
            {g.moved_at ? (
              <RefreshCw
                size={20}
                strokeWidth={1.75}
                className="shrink-0 text-attention"
                aria-label={t("load.movedLabel", { time: clock(g.moved_at) })}
              />
            ) : null}
            <span className="ml-auto flex shrink-0 items-center gap-1">
              {done && !g.short ? <Check size={20} strokeWidth={1.75} aria-hidden className="text-done" /> : null}
              <span className="num t-label">{t("load.count", { loaded: g.loaded, total: g.cases })}</span>
            </span>
          </button>
        );
      })}
      <span className="px-2 t-caption text-asphalt-500">{t("load.doors")}</span>
    </div>
  );
}
