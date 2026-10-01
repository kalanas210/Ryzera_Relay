import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleAlert,
  CircleDot,
  Clock,
  Handshake,
  Layers,
  PackageX,
  RefreshCw,
  User,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMe } from "@/app/session";
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
  useSetLine,
  useTripLoad,
  vehicleKindKey,
} from "./api";
import { FlagSheet } from "./FlagSheet";
import { DockHeader } from "./LoaderShell";
import { CountSheet, LoadLineRow, LoadProgress } from "./parts";

const SEEN_KEY = "relay.dock.answers-seen";
const COLLAPSE_AFTER_MS = 10_000;

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
  const setLine = useSetLine(load.trip_id);
  const [flagFor, setFlagFor] = useState<{ group: StopGroup; line: LoadLine } | null>(null);
  const [countFor, setCountFor] = useState<LoadLine | null>(null);
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const [touched, setTouched] = useState<{ stop: string; at: number } | null>(null);
  const [seen, setSeen] = useState<string[]>(readSeen);
  const [, tick] = useState(0);
  const sections = useRef<Record<string, HTMLElement | null>>({});

  // Re-render once the collapse delay has passed, so a finished stop folds away by itself.
  useEffect(() => {
    if (!touched) return;
    const timer = window.setTimeout(() => tick((n) => n + 1), COLLAPSE_AFTER_MS + 50);
    return () => window.clearTimeout(timer);
  }, [touched]);

  const kind = t(`kinds.${loadKindKey(load.brand, load.temp)}`);
  const chilled = load.temp === "chilled";
  const groups = load.groups;
  const firstSeq = groups[0]?.seq;
  const lastSeq = groups[groups.length - 1]?.seq;
  const allDone = load.lines_done === load.lines_total && load.lines_total > 0;
  const complete = Boolean(load.handover.completed_at);
  const current = groups.find((g) => g.state !== "done");

  const answers = useMemo(
    () =>
      groups.flatMap((g) =>
        g.lines
          .filter((l) => l.shortfall?.decision && !seen.includes(l.shortfall.id))
          .map((l) => ({ group: g, line: l })),
      ),
    [groups, seen],
  );
  const markSeen = (id: string) => {
    const next = [...seen, id];
    setSeen(next);
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next.slice(-100)));
    } catch {
      // the alert shows again next time
    }
  };

  const isOpen = (g: StopGroup) => {
    const chosen = opened[g.stop_id];
    if (chosen !== undefined) return chosen;
    if (g.state !== "done" || g.short || g.lines.some((l) => l.status === "flag_waiting")) return true;
    // a stop just finished stays open under the loader's hand until they move on or 10 seconds pass
    return touched?.stop === g.stop_id && Date.now() - touched.at < COLLAPSE_AFTER_MS;
  };

  const touch = (g: StopGroup) => setTouched({ stop: g.stop_id, at: Date.now() });

  const toggle = (g: StopGroup, line: LoadLine) => {
    if (complete) return;
    touch(g);
    setLine.mutate({ lineId: line.id, loaded: line.status === "checked" ? 0 : line.qty });
  };

  const scrollTo = (stopId: string) => sections.current[stopId]?.scrollIntoView({ behavior: "smooth", block: "start" });

  const meta = load.driver
    ? t("load.meta", {
        driver: load.driver,
        kind: t(`vehicles.${vehicleKindKey(load.vehicle_kind)}`),
        time: clock(load.planned_depart),
      })
    : t("load.metaNoDriver", {
        kind: t(`vehicles.${vehicleKindKey(load.vehicle_kind)}`),
        time: clock(load.planned_depart),
      });

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

  const progress = (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <span className="num t-body-strong text-asphalt-900">
          {t("load.progress", { loaded: load.loaded, total: load.cases })}
        </span>
        {load.short ? (
          <span className="inline-flex items-center gap-1 t-label-strong text-attention">
            <PackageX size={16} strokeWidth={1.75} aria-hidden />
            {t("chips.short", { count: load.short })}
          </span>
        ) : null}
        <span className="ml-auto inline-flex items-center gap-1 t-caption text-asphalt-700">
          <User size={16} strokeWidth={1.75} aria-hidden />
          <span className="latin">{calledName(me.data?.display_name)}</span>
        </span>
      </div>
      <LoadProgress loaded={load.loaded} total={load.cases} short={load.short} complete={allDone} />
    </div>
  );

  const answer = answers[0];
  const alert = answer ? (
    <div className="-mx-4 -mt-3 mb-1 flex min-h-14 items-center gap-3 border-t border-attention bg-attention-soft py-1 pr-2 pl-4">
      <CircleAlert size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-attention" />
      <p className="min-w-0 flex-1 t-body-strong text-asphalt-900">
        {t("load.answered", { name: calledName(answer.line.shortfall?.decided_by) })}{" "}
        <span className="font-normal">
          {t("load.answeredWhat", {
            n: answer.group.seq,
            item: t(`casesLower.${answer.line.case_type}`, { defaultValue: answer.line.case_type }),
          })}
        </span>
      </p>
      <Button
        density="field"
        compact
        onClick={() => {
          if (answer.line.shortfall) markSeen(answer.line.shortfall.id);
          setFlagFor(answer);
        }}
      >
        {t("load.seeAnswer")}
      </Button>
    </div>
  ) : null;

  const hint = allDone ? (
    <p className="flex items-start gap-3 t-body text-asphalt-700">
      <Check size={24} strokeWidth={1.75} aria-hidden className="shrink-0 text-done" />
      {t("load.hintDone", { count: load.lines_total, driver: calledName(load.driver) })}
    </p>
  ) : (
    <p className="flex items-start gap-3 t-body text-asphalt-700">
      <Layers size={24} strokeWidth={1.75} aria-hidden className="shrink-0" />
      {groups.length > 1 ? t("load.hint", { first: firstSeq, last: lastSeq }) : t("load.hintSingle")}
    </p>
  );

  const lines = (large: boolean) =>
    groups.map((g, index) => (
      <StopSection
        key={g.stop_id}
        ref={(el) => {
          sections.current[g.stop_id] = el;
        }}
        group={g}
        position={groups.length > 1 ? (index === 0 ? "first" : index === groups.length - 1 ? "last" : null) : null}
        loadingNow={current?.stop_id === g.stop_id && !complete}
        open={isOpen(g)}
        onOpen={(value) => setOpened((o) => ({ ...o, [g.stop_id]: value }))}
        large={large}
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
            onToggle={() => toggle(g, line)}
            onCount={() => {
              if (complete) return;
              touch(g);
              setCountFor(line);
            }}
            onFlag={() => {
              touch(g);
              if (line.shortfall) markSeen(line.shortfall.id);
              if (!complete || line.shortfall) setFlagFor({ group: g, line });
            }}
          />
        ))}
      </StopSection>
    ));

  const handoverButton = allDone ? (
    <Button
      variant="primary"
      density="field"
      full
      icon={Handshake}
      onClick={() => navigate(`/loader/trips/${load.trip_id}/handover`)}
    >
      {t("load.goToHandover")}
    </Button>
  ) : null;

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1100px] flex-col">
      <div className="sticky top-0 z-30">
        <DockHeader title={<span className="">{title}</span>} back="/loader" />
      </div>

      {/* phone: one column with a fixed bottom bar */}
      <div className="flex flex-1 flex-col md:hidden">
        <div className="flex flex-col gap-2 border-b border-asphalt-200 bg-white px-4 pt-3 pb-4">
          <p className="t-body text-asphalt-700">{meta}</p>
          {chips}
        </div>
        <div className="px-4 py-3">{hint}</div>
        <div className="flex flex-col gap-4 px-4 pb-6">{lines(false)}</div>
        <div className="sticky bottom-0 z-20 mt-auto flex flex-col gap-2 border-t border-asphalt-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          {alert}
          {progress}
          {handoverButton}
        </div>
      </div>

      {/* dock tablet: a control column with the load map, and the lines set larger */}
      <div className="hidden flex-1 gap-6 p-6 md:flex">
        <aside className="sticky top-24 flex h-[calc(100dvh-120px)] w-80 shrink-0 flex-col gap-4 rounded-card border border-asphalt-200 bg-white p-4">
          {alert ? <div className="-mx-4 -mt-4 px-4 pt-3">{alert}</div> : null}
          <p className="t-body text-asphalt-700">{meta}</p>
          {chips}
          <div className="flex flex-col gap-1">
            <h2 className="t-h3">{t("load.loadMap")}</h2>
            <p className="t-caption text-asphalt-500">{t("load.loadMapHelp")}</p>
          </div>
          <LoadMap groups={groups} current={current?.stop_id} onPick={scrollTo} />
          <div className="mt-auto flex flex-col gap-2">
            {progress}
            <p className="num t-caption text-asphalt-700">
              {t("load.linesDone", { done: load.lines_done, total: load.lines_total })}
            </p>
            {handoverButton}
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-4">
          {hint}
          {lines(true)}
        </div>
      </div>

      <FlagSheet
        load={load}
        group={flagFor?.group ?? null}
        line={flagFor ? findLine(load, flagFor.line.id) : null}
        onClose={() => setFlagFor(null)}
      />
      <CountSheet
        line={countFor}
        onClose={() => setCountFor(null)}
        onSave={(loaded) => countFor && setLine.mutate({ lineId: countFor.id, loaded })}
      />
      {setLine.error ? (
        <p
          role="alert"
          className="fixed inset-x-4 bottom-28 z-40 rounded-button bg-problem-soft px-4 py-3 t-body-strong text-problem"
        >
          {t("load.notSaved", { message: setLine.error.message })}
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

type SectionProps = {
  group: StopGroup;
  position: "first" | "last" | null;
  loadingNow: boolean;
  open: boolean;
  onOpen: (open: boolean) => void;
  large: boolean;
  children: ReactNode;
  ref: (el: HTMLElement | null) => void;
};

function StopSection({ group, position, loadingNow, open, onOpen, large, children, ref }: SectionProps) {
  const { t, clock } = useLoaderText();
  const title = t("load.stop", { n: group.seq, place: group.place });
  const moved =
    group.moved_from && group.moved_at ? (
      <span className="inline-flex items-center gap-1 t-caption text-attention">
        <RefreshCw size={16} strokeWidth={1.75} aria-hidden />
        {t("load.moved", { n: group.moved_from, time: clock(group.moved_at) })}
      </span>
    ) : null;

  if (!open) {
    return (
      <section
        ref={ref}
        className="scroll-mt-20 flex items-center gap-3 rounded-card border border-asphalt-200 bg-white py-3 pr-1 pl-3"
      >
        <StopMarker n={group.seq} state={markerState(group)} />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className={large ? "t-h1" : "t-h2"}>{title}</h3>
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
    <section ref={ref} className="scroll-mt-20 flex flex-col gap-2">
      <div className="sticky top-16 z-10 -mx-4 flex min-h-12 items-center gap-3 border-b border-transparent bg-asphalt-50 px-4 py-2 md:mx-0 md:px-0">
        <StopMarker n={group.seq} state={markerState(group)} />
        <h3 className={cx("min-w-0 flex-1", large ? "t-h1" : "t-h2")}>{title}</h3>
        <span className="num shrink-0 t-body-strong text-asphalt-900">
          {t("load.count", { loaded: group.loaded, total: group.cases })}
        </span>
        {group.state === "done" && !group.short ? (
          <IconButton icon={ChevronUp} label={t("load.collapse")} density="field" onClick={() => onOpen(false)} />
        ) : null}
      </div>
      <div className="-mt-1 flex flex-col gap-1 pl-11">
        <p className="latin t-label text-asphalt-700">
          {t("load.stopMeta", {
            outlet: group.outlet_id,
            order: group.order_ref,
            cases: t("tonight.cases", { count: group.cases }),
          })}
        </p>
        {loadingNow || moved || position ? (
          <div className="flex flex-wrap items-center gap-2">
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

/** The truck drawn from cab to doors, one band per stop in loading order. */
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
    <div className="flex flex-col gap-1 rounded-card border-2 border-asphalt-300 p-2">
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
                  ? "border border-attention bg-attention-soft"
                  : "border border-done bg-done-soft"
                : now
                  ? "border-2 border-signal-400 bg-white"
                  : "bg-asphalt-100",
            )}
          >
            <StopMarker n={g.seq} state={markerState(g)} />
            <span className="latin min-w-0 truncate t-dense-strong">{g.place}</span>
            {g.moved_at ? (
              <RefreshCw
                size={20}
                strokeWidth={1.75}
                className="shrink-0 text-attention"
                aria-label={t("load.movedLabel", { time: clock(g.moved_at) })}
              />
            ) : null}
            <span className="num ml-auto shrink-0 pl-2 t-label">
              {t("load.count", { loaded: g.loaded, total: g.cases })}
            </span>
          </button>
        );
      })}
      <span className="px-2 t-caption text-asphalt-500">{t("load.doors")}</span>
    </div>
  );
}
