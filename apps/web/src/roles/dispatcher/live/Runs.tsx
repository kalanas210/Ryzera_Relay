import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  CircleDot,
  Clock,
  CloudOff,
  Ellipsis,
  type LucideIcon,
  PackageCheck,
  Snowflake,
  TriangleAlert,
  Truck,
  Van,
  Warehouse,
  X,
} from "lucide-react";
import { type KeyboardEvent, useState } from "react";
import { Button, IconButton } from "@/design/Button";
import { StatusChip } from "@/design/StatusChip";
import { cx } from "@/lib/cx";
import { formatDuration, formatTime } from "@/lib/time";
import type { FeedItem, RunMarker, RunRow, RunsPanel } from "./api";
import {
  type Directory,
  FOLDED,
  isRecorded,
  itemRows,
  type Links,
  markerStatus,
  onTheRoadTo,
  rank,
  runLine,
  shortClock,
  silentCaption,
  type Tone,
  type VehicleRun,
  vehicleWords,
} from "./model";

/** Key figure tiles: what is on the road right now. An icon takes its status tone only when its count is above 0. */
export function Tiles({ panel }: { panel: RunsPanel }) {
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);
  const tiles: { icon: LucideIcon; value: string; label: string; tone: string }[] = [
    {
      icon: Truck,
      value: String(panel.running),
      label: plural(panel.running, "vehicle running", "vehicles running"),
      tone: panel.running ? "text-asphalt-700" : "text-asphalt-500",
    },
    {
      icon: PackageCheck,
      value: `${panel.delivered} of ${panel.stops}`,
      label: "stops delivered",
      tone: panel.delivered ? "text-done" : "text-asphalt-500",
    },
    {
      icon: CloudOff,
      value: String(panel.out_of_contact),
      label: plural(panel.out_of_contact, "driver out of contact", "drivers out of contact"),
      // Silence takes the waiting tone, never problem red.
      tone: panel.out_of_contact ? "text-asphalt-700" : "text-asphalt-500",
    },
    {
      icon: Van,
      value: String(panel.standby_free),
      label: plural(panel.standby_free, "standby vehicle free", "standby vehicles free"),
      tone: panel.standby_free ? "text-asphalt-700" : "text-asphalt-500",
    },
  ];
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {tiles.map(({ icon: Icon, value, label, tone }) => (
        <li
          key={label}
          className="flex min-h-14 items-center gap-3 rounded-card border border-asphalt-200 bg-white px-4 py-2"
        >
          <Icon size={20} strokeWidth={1.75} aria-hidden className={cx("shrink-0", tone)} />
          <span className="num t-h2">{value}</span>
          <span className="t-label text-asphalt-700">{label}</span>
        </li>
      ))}
    </ul>
  );
}

type PanelProps = {
  panel: RunsPanel;
  vehicles: VehicleRun[];
  links: Links;
  items: FeedItem[];
  dir: Directory;
  selected: string | null;
  onSelect: (vehicleId: string) => void;
  query: string;
  onMove: (row: RunRow, marker: RunMarker) => void;
};

/** Runs panel: every Fresh run of the depot's published plan, stop by stop, needing attention first. Progress comes
 *  only from the drivers' records and the stores' receipts. */
export function RunsPanelView({ panel, vehicles, links, items, dir, selected, onSelect, query, onMove }: PanelProps) {
  const [unfolded, setUnfolded] = useState(false);
  const q = query.trim().toLowerCase();
  const matches = (v: VehicleRun) =>
    v.vehicle_id.toLowerCase().includes(q) ||
    v.trips.some(
      (t) =>
        (t.driver ?? "").toLowerCase().includes(q) ||
        t.markers.some((m) => m.outlet_id.toLowerCase().includes(q) || m.place.toLowerCase().includes(q)),
    );
  const shown = q ? vehicles.filter(matches) : vehicles;
  const ranked = [...shown].sort((a, b) => rank(a, links) - rank(b, links));
  const featured = q ? ranked : ranked.filter((v) => rank(v, links) < FOLDED || v.vehicle_id === selected);
  const folded = q ? [] : ranked.filter((v) => !featured.includes(v));
  const withTrips = new Set(vehicles.map((v) => v.vehicle_id));
  const standby = q ? [] : panel.standby.filter((id) => !withTrips.has(id)).map((id) => ({ id, lane: dir.lane(id) }));
  const workshop = q ? [] : dir.workshop();

  return (
    <section
      data-runs
      className="min-w-0 overflow-hidden rounded-card border border-asphalt-200 bg-white"
      aria-label={`${panel.depot_label} Fresh runs`}
    >
      <header className="flex min-h-12 flex-wrap items-center gap-x-6 gap-y-1 border-b border-asphalt-200 px-4 py-2">
        <h2 className="t-h3">{panel.depot_label} · Fresh runs</h2>
        <Legend />
        <span className="ml-auto t-caption text-asphalt-500">Needs attention first</span>
      </header>
      <div className="grid h-8 grid-cols-[200px_minmax(0,1fr)_128px_32px] items-center gap-x-4 bg-asphalt-50 px-4 t-caption text-asphalt-500 max-lg:hidden">
        <span>Vehicle and driver</span>
        <span>Stops</span>
        <span>Last synced</span>
        <span />
      </div>
      {featured.map((v) => (
        <RunRowView
          key={v.vehicle_id}
          vehicle={v}
          selected={v.vehicle_id === selected}
          onSelect={onSelect}
          items={items}
          dir={dir}
          onMove={onMove}
          depotLabel={panel.depot_label}
          now={panel.now}
        />
      ))}
      {q && !featured.length ? (
        <p className="px-4 py-6 t-dense text-asphalt-500">No vehicle, driver or outlet matches "{query.trim()}".</p>
      ) : null}
      {standby.map(({ id, lane }) => (
        <StandbyRow key={id} vehicleId={id} lane={lane} depotLabel={panel.depot_label} />
      ))}
      {folded.length ? (
        <>
          <button
            type="button"
            aria-expanded={unfolded}
            onClick={() => setUnfolded((v) => !v)}
            className="flex min-h-12 w-full items-center gap-3 border-b border-asphalt-200 px-4 py-2 text-left hover:bg-asphalt-50"
          >
            {unfolded ? (
              <ChevronDown size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-500" />
            ) : (
              <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-500" />
            )}
            <span className="t-dense-strong">{foldedTitle(folded)}</span>
            <span className="t-label text-asphalt-500">{foldedNote(folded)}</span>
          </button>
          {unfolded
            ? folded.map((v) => (
                <RunRowView
                  key={v.vehicle_id}
                  vehicle={v}
                  compact
                  selected={false}
                  onSelect={onSelect}
                  items={items}
                  dir={dir}
                  onMove={onMove}
                  depotLabel={panel.depot_label}
                  now={panel.now}
                />
              ))
            : null}
        </>
      ) : null}
      {workshop.length ? (
        <div className="flex flex-col gap-1 bg-asphalt-50 px-4 py-3">
          {workshop.map((lane) => (
            <p key={lane.vehicle_id} className="flex items-center gap-2 t-label text-asphalt-500">
              <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
              <span className="latin">{lane.vehicle_id}</span> · {vehicleWords(lane.type, lane.temp)} ·{" "}
              {lane.note || "In the workshop"}
            </p>
          ))}
        </div>
      ) : null}
      <p className="border-t border-asphalt-200 px-4 py-3 t-caption text-asphalt-500">
        Progress comes from each driver's stop records, not from tracking. When a phone stops reaching Relay, its row
        keeps the last record and the time of last contact, and every time after that is an estimate.
      </p>
    </section>
  );
}

function foldedTitle(folded: VehicleRun[]) {
  const n = folded.length;
  const running = folded.every((v) => v.current.departed_at && !v.current.finished_at);
  return `${n} more ${n === 1 ? "vehicle" : "vehicles"}${running ? " running" : " on today's runs"}`;
}

function foldedNote(folded: VehicleRun[]) {
  const inContact = folded.every(
    (v) => !v.current.departed_at || (v.current.last_contact_at && !v.current.out_of_contact),
  );
  return inContact ? "All in contact, nothing to act on" : "Nothing to act on";
}

/** Marker legend: recorded is solid, estimated is dashed, on every screen. */
function Legend() {
  return (
    <span className="flex items-center gap-4 t-caption text-asphalt-700">
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-4 rounded-full border-[1.5px] border-asphalt-900" />
        Recorded
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span aria-hidden className="size-4 rounded-full border-[1.5px] border-dashed border-asphalt-500" />
        Estimated
      </span>
    </span>
  );
}

/** Up and Down move between rows (and between feed items), Enter opens. */
export function moveFocus(event: KeyboardEvent<HTMLElement>, selector: string) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const all = [...document.querySelectorAll<HTMLElement>(selector)];
  const at = all.indexOf(event.currentTarget);
  const next = all[at + (event.key === "ArrowDown" ? 1 : -1)];
  if (next) {
    event.preventDefault();
    next.focus();
  }
}

function RunRowView({
  vehicle,
  selected,
  onSelect,
  compact = false,
  items,
  dir,
  onMove,
  depotLabel,
  now,
}: {
  vehicle: VehicleRun;
  selected: boolean;
  onSelect: (vehicleId: string) => void;
  compact?: boolean;
  items: FeedItem[];
  dir: Directory;
  onMove: (row: RunRow, marker: RunMarker) => void;
  depotLabel: string;
  now: string;
}) {
  const [menu, setMenu] = useState(false);
  const row = vehicle.current;
  const silent = row.out_of_contact;
  const movable =
    row.departed_at && !row.finished_at && !row.is_backup
      ? row.markers.filter((m) => m.state === "next" || m.state === "pending")
      : [];
  // the chip is about the trip on the road; a later trip's risk is said in the caption
  const late = row.markers.some((m) => m.late_risk);
  const kind = dir.vehicle(row.vehicle_id, row.vehicle_kind);
  const KindIcon = row.temp === "chilled" ? Snowflake : kind.endsWith("van") ? Van : Truck;
  const laterRisk = vehicle.later?.markers.find((m) => m.late_risk);
  const caption = captionOf(row, silent, vehicle.later, laterRisk);

  return (
    <div
      className={cx(
        "relative grid grid-cols-[minmax(0,1fr)_32px] gap-x-4 border-b border-asphalt-200 px-4 lg:grid-cols-[200px_minmax(0,1fr)_128px_32px]",
        compact ? "py-2" : "py-3",
        selected && "bg-petrol-50",
      )}
    >
      {selected ? <span aria-hidden className="absolute inset-y-0 left-0 w-[3px] bg-petrol-700" /> : null}
      <button
        type="button"
        data-run-row
        aria-pressed={selected}
        onClick={() => onSelect(row.vehicle_id)}
        onKeyDown={(event) => moveFocus(event, "[data-run-row]")}
        className="grid min-w-0 grid-cols-subgrid gap-x-4 gap-y-2 text-left max-lg:col-span-1 max-lg:grid-cols-1 lg:col-span-3"
      >
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="latin t-h3">{row.vehicle_id}</span>
          {compact ? null : (
            <>
              {row.driver ? <span className="latin truncate t-dense">{row.driver}</span> : null}
              <span className="flex items-center gap-1.5 t-label text-asphalt-700">
                <KindIcon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                {kind} · {row.is_backup ? "Backup" : `Trip ${row.trip_no}`}
              </span>
              <span className="t-label text-asphalt-500">
                {row.is_backup
                  ? `${row.district}, ${row.markers.length} ${row.markers.length === 1 ? "stop" : "stops"}`
                  : runLine(row)}
              </span>
              {late && !row.is_backup ? (
                <span className="mt-1">
                  <StatusChip kind="lateRisk" density="desk" />
                </span>
              ) : null}
            </>
          )}
        </span>
        <span className="flex min-w-0 flex-col gap-2">
          <Track vehicle={vehicle} size={selected ? 28 : 24} compact={compact} depotLabel={depotLabel} now={now} />
          {compact ? null : <span className="t-label text-asphalt-700">{caption}</span>}
        </span>
        <LastSynced row={row} items={items} compact={compact} />
      </button>
      <div className="flex justify-end pt-0.5">
        {movable.length && !compact ? (
          <IconButton
            icon={Ellipsis}
            density="desk"
            label={`More for ${row.vehicle_id}`}
            aria-expanded={menu}
            onClick={() => setMenu((v) => !v)}
          />
        ) : null}
      </div>
      {menu && movable.length ? (
        <div className="col-span-full mt-2 flex flex-wrap items-center gap-2 rounded-button border border-asphalt-200 bg-white px-3 py-2">
          <span className="t-label text-asphalt-700">Move a stop to another vehicle:</span>
          {movable.map((m) => (
            <Button
              key={m.stop_id}
              density="desk"
              variant="quiet"
              onClick={() => {
                setMenu(false);
                onMove(row, m);
              }}
            >
              Stop {m.seq}, {m.place}
            </Button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/** The row's caption. A later trip's late stop is said apart from this trip's windows, so the two never read as one
 *  contradiction ("every stop is inside its window" next to "expected after its close"). */
function captionOf(row: RunRow, silent: boolean, later: RunRow | null, laterRisk: RunMarker | undefined): string {
  if (silent) return silentCaption(row);
  if (!later || !laterRisk) return row.caption;
  const own = row.caption.replace(
    "Every stop still to come is expected inside its window.",
    `Trip ${row.trip_no} stops are inside their windows.`,
  );
  return `${own} Trip ${later.trip_no}: ${laterRisk.place} is expected after its ${formatTime(laterRisk.closes)} close.`;
}

/** Last synced: the last time the phone reached Relay, which is not the last stop event. While a phone is silent it
 *  says so and for how long, and never why. */
function LastSynced({ row, items, compact }: { row: RunRow; items: FeedItem[]; compact: boolean }) {
  if (row.out_of_contact && row.last_contact_at) {
    return (
      <span className="flex min-w-0 flex-col text-asphalt-700">
        <span className="inline-flex items-center gap-1.5 t-label-strong">
          <CloudOff size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          No contact
        </span>
        <span className="t-caption">since {formatTime(row.last_contact_at)}</span>
        <span className="num t-caption">{formatDuration(row.silent_minutes)}</span>
      </span>
    );
  }
  const notes = compact ? [] : syncNotes(row, items);
  if (row.last_contact_at) {
    return (
      <span className="flex min-w-0 flex-col">
        <span className="inline-flex items-center gap-1.5 t-label">
          <Check size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-done" />
          Synced {formatTime(row.last_contact_at)}
        </span>
        {notes.map((n) => (
          <span key={n} className="t-caption text-asphalt-500">
            {n}
          </span>
        ))}
      </span>
    );
  }
  return (
    <span className="flex min-w-0 flex-col t-label text-asphalt-500">
      {row.departed_at || row.is_backup ? "No check-in yet" : `Leaves ${formatTime(row.planned_depart)}`}
      {notes.map((n) => (
        <span key={n} className="t-caption">
          {n}
        </span>
      ))}
    </span>
  );
}

/** What the feed adds under Last synced: what came in when the phone was back, and the offline span ("7 records
 *  received", "Offline 5:41 to 7:14"), or a reported delay. */
function syncNotes(row: RunRow, items: FeedItem[]): string[] {
  const mine = items.filter((i) => itemRows(i, [row]).some((r) => r.trip_id === row.trip_id));
  const back = mine.find((i) => i.kind === "back_in_contact");
  if (back) {
    const count = Number(back.ref?.received ?? Number.NaN);
    const received = Number.isNaN(count) ? null : `${count} ${count === 1 ? "record" : "records"} received`;
    const span = back.ref?.since ? `Offline ${shortClock(back.ref.since)} to ${shortClock(back.created_at)}` : null;
    return [received, span].filter((n): n is string => !!n);
  }
  const delay = mine.find((i) => i.kind === "delay");
  return delay ? [`Delay at ${formatTime(delay.created_at)}`] : [];
}

type Station = { kind: "stop"; marker: RunMarker } | { kind: "hub"; label: string; status: string; recorded: boolean };

function stations(vehicle: VehicleRun, depotLabel: string, now: string): Station[] {
  const row = vehicle.current;
  const out: Station[] = [];
  if (row.is_backup) {
    out.push({
      kind: "hub",
      label: depotLabel,
      status: row.departed_at ? `Left ${shortClock(row.departed_at)}` : "Loading at the dock",
      recorded: !!row.departed_at,
    });
  }
  for (const marker of row.markers) out.push({ kind: "stop", marker });
  // A stop moved to a backup is still the driver's until someone settles it, so the hub is not next yet.
  const allDone = row.markers.every((m) => isRecorded(m) || m.receipt_at);
  if (vehicle.later) {
    // a planned time already gone by is not a promise: the second trip leaves once the first is back
    const due = Date.parse(vehicle.later.planned_depart) <= Date.parse(now);
    out.push({
      kind: "hub",
      label: `Then trip ${vehicle.later.trip_no}`,
      status: due ? "Leaves after this trip" : `Leaves ${shortClock(vehicle.later.planned_depart)}`,
      recorded: false,
    });
  } else if (row.finished_at) {
    out.push({ kind: "hub", label: "Back at the hub", status: shortClock(row.finished_at), recorded: true });
  } else if (row.status === "returning") {
    out.push({ kind: "hub", label: "Back to the hub", status: "Turned back", recorded: false });
  } else if (row.departed_at && allDone) {
    out.push({ kind: "hub", label: "Hub next", status: "", recorded: false });
  }
  return out;
}

/** Stop track: recorded stops solid, with a solid line into them; estimates dashed, with a dashed line. While a phone
 *  is silent, the estimated vehicle sits on the line to the stop Relay thinks it is driving to. */
function Track({
  vehicle,
  size,
  compact,
  depotLabel,
  now,
}: {
  vehicle: VehicleRun;
  size: 24 | 28;
  compact: boolean;
  depotLabel: string;
  now: string;
}) {
  const row = vehicle.current;
  const list = stations(vehicle, depotLabel, now);
  const silent = row.out_of_contact;
  const roadTo = silent ? onTheRoadTo(row) : null;
  const solid = (s: Station) => (s.kind === "hub" ? s.recorded : isRecorded(s.marker) || !!s.marker.receipt_at);
  const line = size === 28 ? "top-[13px]" : "top-[11px]";
  return (
    <ol className="flex min-w-0 items-start" aria-label={`${row.vehicle_id} stops`}>
      {list.map((s, i) => {
        const next = list[i + 1];
        const full = s.kind === "stop" ? markerStatus(s.marker, silent) : { text: s.status, tone: "muted" as Tone };
        // On a long track the green check already says delivered, so the label keeps only the time.
        const status =
          s.kind === "stop" && list.length >= 5 && s.marker.state === "delivered" && s.marker.recorded
            ? { ...full, text: shortClock(s.marker.recorded) }
            : full;
        const conflict = s.kind === "stop" && s.marker.state === "conflict";
        const backupRisk = s.kind === "stop" && row.is_backup && s.marker.late_risk;
        return (
          <li
            key={s.kind === "stop" ? s.marker.stop_id : `hub-${i}`}
            // a hub takes a narrow fixed column, and each stop a share of the rest as long as its name, so
            // "Hemmathagama" is read in full beside "Kegalle"
            className={cx("relative flex min-w-0 flex-col items-center gap-1", s.kind === "hub" && "w-20 flex-none")}
            style={s.kind === "stop" ? { flex: `${Math.max(6, s.marker.place.length)} 1 0%` } : undefined}
          >
            {i > 0 ? (
              <span
                aria-hidden
                className={cx(
                  "absolute right-1/2 left-0 border-t-2 border-asphalt-300",
                  line,
                  !solid(s) && "border-dashed",
                )}
              />
            ) : null}
            {next ? (
              <span
                aria-hidden
                className={cx(
                  "absolute right-0 left-1/2 border-t-2 border-asphalt-300",
                  line,
                  !solid(next) && "border-dashed",
                )}
              />
            ) : null}
            <span className={cx("relative z-10 flex items-center justify-center", size === 28 ? "h-7" : "h-6")}>
              {s.kind === "stop" ? <DeskMarker m={s.marker} size={size} silent={silent} /> : <HubMarker />}
            </span>
            {s.kind === "stop" && roadTo === s.marker.place ? <EstimatedVehicle size={size} /> : null}
            {compact ? null : (
              <span
                className={cx(
                  "max-w-full px-1 t-caption text-asphalt-900",
                  s.kind === "hub" ? "text-center leading-tight" : "truncate",
                )}
                title={s.kind === "stop" ? s.marker.place : s.label}
              >
                {s.kind === "stop" ? s.marker.place : s.label}
              </span>
            )}
            {conflict && s.marker.held ? (
              <span className="num px-1 t-caption text-asphalt-700">Delivered {shortClock(s.marker.held)}</span>
            ) : null}
            {conflict ? (
              <StatusChip kind="twoCopies" density="desk" />
            ) : status.text ? (
              <span className={cx("num max-w-full truncate px-1 t-caption", TONE_TEXT[status.tone])} title={full.text}>
                {status.text}
              </span>
            ) : null}
            {backupRisk && !compact ? <StatusChip kind="lateRisk" density="desk" /> : null}
          </li>
        );
      })}
    </ol>
  );
}

const TONE_TEXT: Record<Tone, string> = {
  plain: "text-asphalt-700",
  muted: "text-asphalt-500",
  attention: "text-attention",
  problem: "text-problem",
};

/** Stop marker, desk sizes: delivered, arrived, next, estimated, late risk, moved, two copies, cancelled. */
export function DeskMarker({ m, size, silent }: { m: RunMarker; size: 24 | 28; silent: boolean }) {
  const box = size === 28 ? "size-7" : "size-6";
  const icon = 14;
  const base = cx("num inline-flex shrink-0 items-center justify-center rounded-full t-caption", box);
  const label = `Stop ${m.seq}, ${m.place}: ${markerStatus(m, silent).text || m.state}`;
  switch (m.state) {
    case "delivered":
      return (
        <span className={cx(base, "bg-done text-white")} role="img" aria-label={label}>
          <Check size={icon} strokeWidth={2.5} aria-hidden />
        </span>
      );
    case "arrived":
      return (
        <span
          className={cx(base, "border-2 border-asphalt-900 bg-white text-asphalt-900")}
          role="img"
          aria-label={label}
        >
          <CircleDot size={icon} strokeWidth={2} aria-hidden />
        </span>
      );
    case "failed":
      return (
        <span className={cx(base, "bg-problem text-white")} role="img" aria-label={label}>
          <X size={icon} strokeWidth={2.5} aria-hidden />
        </span>
      );
    case "cancelled":
      return (
        <span className={cx(base, "bg-asphalt-100 text-asphalt-500")} role="img" aria-label={label}>
          <X size={icon} strokeWidth={2} aria-hidden />
        </span>
      );
    case "conflict":
      return (
        <span
          className={cx(base, "border-[1.5px] border-attention bg-attention-soft text-attention")}
          role="img"
          aria-label={label}
        >
          <Clock size={icon} strokeWidth={2} aria-hidden />
        </span>
      );
    case "moved":
      return (
        <span
          className={cx(base, "border-[1.5px] border-attention bg-attention-soft font-semibold text-attention")}
          role="img"
          aria-label={label}
        >
          {m.seq}
        </span>
      );
    default:
      if (m.late_risk) {
        return (
          <span
            className={cx(base, "border-[1.5px] border-problem bg-problem-soft text-problem")}
            role="img"
            aria-label={label}
          >
            <TriangleAlert size={icon} strokeWidth={2} aria-hidden />
          </span>
        );
      }
      if (m.state === "next" && !silent && !m.passed) {
        return (
          <span
            className={cx(base, "border-[1.5px] border-signal-ink bg-signal-400 font-semibold text-signal-ink")}
            role="img"
            aria-label={label}
          >
            {m.seq}
          </span>
        );
      }
      return <EstimateMark n={m.seq} size={size} label={label} />;
  }
}

/** The estimate mark: a white circle with a dashed ring. Never drawn in a record's style. */
export function EstimateMark({ n, size, label }: { n?: number; size: 16 | 20 | 24 | 28; label?: string }) {
  const className = cx(
    "num inline-flex shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-asphalt-500 bg-white t-caption font-semibold text-asphalt-700",
    { 16: "size-4", 20: "size-5", 24: "size-6", 28: "size-7" }[size],
  );
  return label ? (
    <span className={className} role="img" aria-label={label}>
      {n}
    </span>
  ) : (
    <span className={className} aria-hidden>
      {n}
    </span>
  );
}

function HubMarker() {
  return (
    <span className="inline-flex size-6 shrink-0 items-center justify-center rounded-[6px] bg-asphalt-100 text-asphalt-700">
      <Warehouse size={16} strokeWidth={1.75} aria-hidden />
    </span>
  );
}

/** Where Relay estimates a silent vehicle is: on the line before the stop it is probably driving to. */
function EstimatedVehicle({ size }: { size: 24 | 28 }) {
  return (
    <span
      role="img"
      aria-label="Estimated position"
      title="Estimated position, not tracked"
      className={cx(
        "absolute top-0 left-0 z-20 inline-flex -translate-x-1/2 items-center justify-center rounded-full border-[1.5px] border-dashed border-asphalt-500 bg-white text-asphalt-700",
        size === 28 ? "size-7" : "size-6",
      )}
    >
      <Truck size={16} strokeWidth={1.75} aria-hidden />
    </span>
  );
}

/** A standby vehicle: at the hub, free for problems like a silent run. */
function StandbyRow({
  vehicleId,
  lane,
  depotLabel,
}: {
  vehicleId: string;
  lane: ReturnType<Directory["lane"]>;
  depotLabel: string;
}) {
  const kind = lane ? vehicleWords(lane.type, lane.temp) : "Standby vehicle";
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_32px] gap-x-4 border-b border-asphalt-200 px-4 py-3 lg:grid-cols-[200px_minmax(0,1fr)_128px_32px]">
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="latin t-h3">{vehicleId}</span>
        {lane?.driver ? <span className="latin truncate t-dense">{lane.driver}</span> : null}
        <span className="flex items-center gap-1.5 t-label text-asphalt-700">
          <Van size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {kind} · Standby
        </span>
        {lane?.note ? <span className="t-label text-asphalt-500">{lane.note}</span> : null}
      </span>
      <span className="flex items-start max-lg:hidden">
        <span className="flex flex-col items-center gap-1">
          <HubMarker />
          <span className="t-caption text-asphalt-700">At the {depotLabel}</span>
        </span>
      </span>
      <span className="t-label text-asphalt-500 max-lg:hidden">Not on a run</span>
      <span />
    </div>
  );
}
