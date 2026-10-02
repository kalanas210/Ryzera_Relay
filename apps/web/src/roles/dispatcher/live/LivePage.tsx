import { CircleCheck, Search, WifiOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ApiError } from "@/api/client";
import { RelayMark } from "@/design/Logo";
import { Notice } from "@/design/Notice";
import { dayOf, formatDayLong, formatTime } from "@/lib/time";
import { DeskHeader, useDepot } from "../DispatcherShell";
import {
  type Depot,
  type Feed,
  type RunMarker,
  type RunRow,
  type RunsPanel,
  useFeed,
  usePlanDirectory,
  useRuns,
} from "./api";
import { FeedEnvProvider, FeedGroups } from "./Feed";
import { MoveDrawer, type MoveTarget } from "./MoveDrawer";
import { Directory, defaultSelection, FRESH_WINDOW, feedLinks, itemRows, vehicleRuns } from "./model";
import { RunsPanelView, Tiles } from "./Runs";

const WIDE = "(min-width: 768px)";

function useWide(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(WIDE);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(WIDE).matches,
    () => true,
  );
}

/** DSP-04 Live runs. On the desk: the tiles, every run stop by stop, and the exceptions feed beside them. At phone
 *  width only the feed, so a flag from the dock at night reaches the dispatcher on call at home with the decision it
 *  needs. */
export function LivePage() {
  const [depotChoice, setDepot] = useDepot("Kandy");
  const depot: Depot = depotChoice === "Peliyagoda" ? "Peliyagoda" : "Kandy";
  return useWide() ? <DeskLive depot={depot} onDepot={setDepot} /> : <PhoneLive depot={depot} />;
}

/** What the last fetch knew, when the connection is gone. The decisions stay on screen; the server refuses them
 *  until the phone is back, and says so. */
function Offline({ feed, runs }: { feed: ReturnType<typeof useFeed>; runs: RunsPanel | undefined }) {
  if (!(feed.error instanceof ApiError && feed.error.offline) || !feed.data) return null;
  return (
    <Notice tone="info" icon={WifiOff} role="status">
      You're offline. Showing what we knew at {runs ? formatTime(runs.now) : "the last update"}.
    </Notice>
  );
}

function PhoneLive({ depot }: { depot: Depot }) {
  const feed = useFeed(depot);
  const runs = useRuns(depot);
  const plan = usePlanDirectory(depot);
  const dir = useMemo(() => new Directory(plan.data), [plan.data]);
  const data = feed.data;
  const meta = data ? `${data.depot_label} · ${formatDayLong(dayOf(data.run_date))}` : undefined;
  return (
    <div className="flex flex-col">
      <header className="flex min-h-20 items-center gap-3 border-b border-asphalt-200 bg-white px-4 py-3">
        <RelayMark size={24} />
        <div className="min-w-0">
          <h1 className="t-h1">Live runs</h1>
          {meta ? <p className="t-label text-asphalt-700">{meta}</p> : null}
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-4 py-4">
        <Offline feed={feed} runs={runs.data} />
        {data ? (
          <FeedEnvProvider
            value={{
              depot,
              depotLabel: data.depot_label,
              desk: false,
              rows: runs.data?.rows ?? [],
              items: [...data.now, ...data.earlier],
              dir,
              allInContact: !runs.data?.out_of_contact,
            }}
          >
            <FeedGroups feed={data} />
          </FeedEnvProvider>
        ) : null}
      </main>
    </div>
  );
}

function DeskLive({ depot, onDepot }: { depot: Depot; onDepot: (d: "Kandy" | "Peliyagoda" | "All") => void }) {
  const runs = useRuns(depot);
  const feed = useFeed(depot);
  const plan = usePlanDirectory(depot);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [moving, setMoving] = useState<MoveTarget | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const search = useRef<HTMLInputElement>(null);

  // "/" searches, Shift P and Shift K switch the depot; never while typing.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.closest("input, textarea, select, [contenteditable]") ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey
      )
        return;
      if (event.key === "/") {
        event.preventDefault();
        search.current?.focus();
      } else if (event.shiftKey && (event.key === "P" || event.key === "K")) {
        event.preventDefault();
        onDepot(event.key === "P" ? "Peliyagoda" : "Kandy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDepot]);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6_000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const panel = runs.data;
  const data = feed.data;
  const dir = useMemo(() => new Directory(plan.data), [plan.data]);
  const items = useMemo(() => (data ? [...data.now, ...data.earlier] : []), [data]);
  const rows = useMemo(() => panel?.rows ?? [], [panel]);
  const vehicles = useMemo(() => vehicleRuns(rows), [rows]);
  const links = useMemo(() => feedLinks(items, rows), [items, rows]);

  // A new exception brings its run into view; handling one never moves the selection under the dispatcher's eyes.
  const newest = data?.now[0];
  const seen = useRef(0);
  useEffect(() => {
    if (!newest || !panel || Date.parse(newest.created_at) <= seen.current) return;
    seen.current = Date.parse(newest.created_at);
    const row = itemRows(newest, panel.rows)[0];
    if (row) setPicked(row.vehicle_id);
  }, [newest, panel]);

  const selected =
    picked && vehicles.some((v) => v.vehicle_id === picked) ? picked : defaultSelection(vehicles, items, links, rows);
  // Once the runs and the feed are in, the run the desk opened on stays picked: marking an item reviewed or a new
  // estimate changes what needs attention first, never the run in front of the dispatcher.
  const loaded = !!panel && !!data;
  useEffect(() => {
    if (loaded && selected && selected !== picked) setPicked(selected);
  }, [loaded, selected, picked]);
  const closeDrawer = useCallback(() => setMoving(null), []);
  // The drawer has no scrim, so a click outside it closes it. It opens after the click that asked for it has
  // finished, or that same click, made outside the drawer, would close it again at once.
  const openMove = useCallback((row: RunRow, marker: RunMarker) => {
    window.setTimeout(() => setMoving({ row, marker }), 0);
  }, []);
  const runDate = panel?.run_date ?? data?.run_date;

  return (
    <>
      <DeskHeader
        title="Live runs"
        meta={runDate ? `${formatDayLong(dayOf(runDate))} · Fresh window ${FRESH_WINDOW}` : undefined}
        depot={depot}
        onDepot={onDepot}
        allowAll={false}
        allTitle="Live runs follow one depot at a time, so each hub's silent runs and backups stay in view."
      >
        <label className="relative flex items-center" title="Search (/)">
          <Search
            size={16}
            strokeWidth={1.75}
            aria-hidden
            className="pointer-events-none absolute left-2.5 text-asphalt-500"
          />
          <input
            ref={search}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                setQuery("");
                event.currentTarget.blur();
              }
            }}
            placeholder="Search vehicle, driver or outlet"
            aria-label="Search vehicle, driver or outlet"
            className="h-9 w-[280px] rounded-button border border-asphalt-300 bg-white pr-3 pl-8 t-dense text-asphalt-900 placeholder:text-asphalt-500"
          />
        </label>
      </DeskHeader>
      <div className="flex min-w-0 flex-col gap-4 px-6 pt-4 pb-6">
        <Offline feed={feed} runs={panel} />
        {panel ? <Tiles panel={panel} /> : null}
        <div className="grid min-w-0 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_400px]">
          {!panel ? (
            <p className="t-dense text-asphalt-500" role="status">
              Loading the runs
            </p>
          ) : !panel.published ? (
            <section className="flex items-start gap-3 rounded-card border border-asphalt-200 bg-white p-6">
              <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-500" />
              <p className="t-dense text-asphalt-700">
                The {panel.depot_label} plan for {formatDayLong(dayOf(panel.run_date))} is not published yet. Its runs
                appear here once it is.
              </p>
            </section>
          ) : (
            <RunsPanelView
              panel={panel}
              vehicles={vehicles}
              links={links}
              items={items}
              dir={dir}
              selected={selected}
              onSelect={setPicked}
              query={query}
              onMove={openMove}
              toast={toast}
            />
          )}
          <Exceptions feed={data} depot={depot} panel={panel} dir={dir} onMove={openMove} />
        </div>
      </div>
      <MoveDrawer
        target={moving}
        depot={depot}
        depotLabel={panel?.depot_label ?? depot}
        dir={dir}
        onClose={closeDrawer}
        onMoved={setToast}
      />
    </>
  );
}

/** Exceptions panel: the same feed as the phone, beside the runs; its body scrolls on its own. */
function Exceptions({
  feed,
  depot,
  panel,
  dir,
  onMove,
}: {
  feed: Feed | undefined;
  depot: Depot;
  panel: RunsPanel | undefined;
  dir: Directory;
  onMove: (row: RunRow, marker: RunMarker) => void;
}) {
  const label = feed?.depot_label ?? panel?.depot_label ?? depot;
  return (
    <section
      aria-label="Exceptions"
      className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-card border border-asphalt-200 bg-white max-xl:order-first max-xl:max-h-[560px] xl:sticky xl:top-4 xl:max-h-[calc(var(--desk-h,100dvh)_-_2rem)]"
    >
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-3 border-b border-asphalt-200 px-4 py-2">
        <h2 className="t-h3">Exceptions</h2>
        <span className="t-caption text-asphalt-500">{label} · today</span>
      </header>
      <div className="grid min-h-0 flex-1 auto-rows-max content-start gap-3 overflow-y-auto p-4">
        {feed ? (
          <FeedEnvProvider
            value={{
              depot,
              depotLabel: label,
              desk: true,
              rows: panel?.rows ?? [],
              items: [...feed.now, ...feed.earlier],
              dir,
              allInContact: !panel?.out_of_contact,
              onMove,
            }}
          >
            <FeedGroups feed={feed} />
          </FeedEnvProvider>
        ) : (
          <p className="t-dense text-asphalt-500" role="status">
            Loading the feed
          </p>
        )}
      </div>
    </section>
  );
}
