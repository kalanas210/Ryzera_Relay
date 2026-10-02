import {
  Check,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clock,
  CloudOff,
  type LucideIcon,
  Package,
  PackageX,
  Send,
  Store,
  TriangleAlert,
  Van,
} from "lucide-react";
import { createContext, type ReactNode, useContext, useState } from "react";
import { useMe } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { dayOf, formatDayLong, formatDuration, formatTime, formatWeekday, formatWindow } from "@/lib/time";
import {
  type Depot,
  type Feed,
  type FeedItem,
  type RunMarker,
  type RunRow,
  type ShortfallDetail,
  useBackupDecision,
  useDecide,
  useHandle,
  useReview,
  useSettle,
} from "./api";
import {
  awaitingReview,
  type Directory,
  driverName,
  isEstimated,
  itemRows,
  lastRecord,
  movedLive,
  overtaken,
  runLine,
  shortClock,
  shownInFeed,
} from "./model";
import { EstimateMark, moveFocus } from "./Runs";

type FeedEnv = {
  depot: Depot;
  depotLabel: string;
  /** The desk shows desk density and the Move drawer; the on-call phone shows the same items at phone size. */
  desk: boolean;
  rows: RunRow[];
  items: FeedItem[];
  dir: Directory;
  allInContact: boolean;
  onMove?: (row: RunRow, marker: RunMarker) => void;
};

const Env = createContext<FeedEnv | null>(null);
export const FeedEnvProvider = Env.Provider;

function useEnv(): FeedEnv {
  const env = useContext(Env);
  if (!env) throw new Error("Feed items need a FeedEnvProvider");
  return env;
}

/** "You" for the signed-in dispatcher, the name for anyone else. */
function useWho() {
  const me = useMe("dispatcher");
  return (name: string | null | undefined) =>
    name && name === me.data?.display_name ? "You" : (name ?? "The dispatcher");
}

function useMinutesSince(iso: string) {
  const now = useSimNow(15_000);
  return now ? Math.max(0, Math.round((now.getTime() - Date.parse(iso)) / 60_000)) : 0;
}

/** Items that ask for a decision open on their own; the rest open on a click. */
const DECISIONS = new Set(["shortfall", "receipt", "conflict"]);

/** The feed: open items under Now, handled ones under Earlier today, newest first. A stop sent with a backup stays
 *  under Now while the backup's copy is live and the driver silent, and gives way to the two-copy item; a two-copy
 *  stop settled meanwhile stays under Now until it is marked reviewed. */
export function FeedGroups({ feed }: { feed: Feed }) {
  const { desk, allInContact, rows } = useEnv();
  const all = [...feed.now, ...feed.earlier];
  const shown = (item: FeedItem) => shownInFeed(item) && !overtaken(item, all);
  const kept = (item: FeedItem) => movedLive(item, rows) || awaitingReview(item);
  const newest = (a: FeedItem, b: FeedItem) => Date.parse(b.created_at) - Date.parse(a.created_at);
  const now = [...feed.now, ...feed.earlier.filter(kept)].filter(shown).sort(newest);
  const earlier = feed.earlier.filter((i) => shown(i) && !kept(i));
  return (
    <>
      <h3 className="t-caption text-asphalt-500">Now</h3>
      {now.length ? (
        now.map((item, i) => (
          // the item on top opens; when another takes its place, each starts again in its new place
          <FeedEntry
            key={`${item.id}:${item.id === now[0]?.id}`}
            item={item}
            startOpen={!desk || i === 0 || DECISIONS.has(item.kind)}
          />
        ))
      ) : (
        <p className="flex items-center gap-2 rounded-button bg-asphalt-50 px-3 py-2.5 t-dense text-asphalt-900">
          <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-done" />
          {allInContact ? "Nothing needs you now. Every driver is in contact." : "Nothing needs you now."}
        </p>
      )}
      {earlier.length ? <h3 className="mt-2 t-caption text-asphalt-500">Earlier today</h3> : null}
      {earlier.map((item, i) => (
        <FeedEntry key={item.id} item={item} startOpen={desk && !now.length && i === 0} />
      ))}
    </>
  );
}

type EntryProps = { item: FeedItem; open: boolean; onToggle: () => void };

function FeedEntry({ item, startOpen }: { item: FeedItem; startOpen: boolean }) {
  const [open, setOpen] = useState(startOpen);
  const props: EntryProps = { item, open, onToggle: () => setOpen((v) => !v) };
  switch (item.kind) {
    case "shortfall":
      return item.shortfall ? <ShortfallEntry {...props} s={item.shortfall} /> : <ReportEntry {...props} />;
    case "silence":
      return <SilenceEntry {...props} />;
    case "receipt":
      return <ReceiptEntry {...props} />;
    case "conflict":
      return <ConflictEntry {...props} />;
    case "stop_moved":
      return <MovedEntry {...props} />;
    case "back_in_contact":
      return (
        <ItemShell {...props} tone="done" icon={CircleCheck} title={props.item.title} subtitle={props.item.body}>
          <p className="t-label text-asphalt-700">{props.item.body}</p>
        </ItemShell>
      );
    default:
      return <ReportEntry {...props} />;
  }
}

// ------------------------------------------------------------------------------------------------ the item
type ItemTone = "attention" | "waiting" | "problem" | "done";

const TONES: Record<ItemTone, { bar: string; icon: string; border: string }> = {
  attention: { bar: "bg-attention", icon: "text-attention", border: "border-asphalt-300" },
  // The Waiting rule: icons and text asphalt-700, never waiting-strong text, never problem red.
  waiting: { bar: "bg-waiting", icon: "text-asphalt-700", border: "border-asphalt-300" },
  problem: { bar: "bg-problem", icon: "text-problem", border: "border-asphalt-300" },
  done: { bar: "bg-done", icon: "text-done", border: "border-asphalt-200" },
};

/** Exception item: a tone bar, its icon and title, the minutes or the time at the right, and, opened, what happened
 *  and the decision it asks for. Collapsed, it keeps one line. There is never a call button on a driver's item. */
function ItemShell({
  open,
  onToggle,
  tone,
  icon: Icon,
  title,
  subtitle,
  right,
  children,
}: EntryProps & {
  tone: ItemTone;
  icon: LucideIcon;
  title: ReactNode;
  subtitle?: ReactNode;
  right?: ReactNode;
  children: ReactNode;
}) {
  const t = TONES[tone];
  return (
    <article className={cx("relative overflow-hidden rounded-card border bg-white", t.border)}>
      <span aria-hidden className={cx("absolute inset-y-0 left-0 w-1", t.bar)} />
      <button
        type="button"
        data-feed-item
        aria-expanded={open}
        onClick={onToggle}
        onKeyDown={(event) => moveFocus(event, "[data-feed-item]")}
        className="flex w-full items-start gap-3 p-4 pl-5 text-left hover:bg-asphalt-50"
      >
        <Icon size={open ? 24 : 20} strokeWidth={1.75} aria-hidden className={cx("mt-0.5 shrink-0", t.icon)} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t-h3">{title}</span>
          {!open && subtitle ? <span className="t-label text-asphalt-700">{subtitle}</span> : null}
        </span>
        {right ? <span className="num shrink-0 t-label text-asphalt-500">{right}</span> : null}
        <ChevronDown
          size={20}
          strokeWidth={1.75}
          aria-hidden
          className={cx("mt-0.5 shrink-0 text-asphalt-500", open && "rotate-180")}
        />
      </button>
      {open ? <div className="flex flex-col gap-3 px-4 pb-4 pl-5">{children}</div> : null}
    </article>
  );
}

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <p className="t-label text-asphalt-500">{label}</p>
      {children}
    </div>
  );
}

function Quote({ children }: { children: ReactNode }) {
  return (
    <blockquote className="rounded-button border border-asphalt-200 bg-asphalt-50 p-3 t-dense text-asphalt-900">
      {children}
    </blockquote>
  );
}

function Line({
  icon: Icon,
  tone = "plain",
  children,
}: {
  icon: LucideIcon;
  tone?: "plain" | "attention" | "problem";
  children: ReactNode;
}) {
  return (
    <p className="flex items-start gap-2 t-dense text-asphalt-900">
      <Icon
        size={16}
        strokeWidth={1.75}
        aria-hidden
        className={cx(
          "mt-0.5 shrink-0",
          tone === "attention" ? "text-attention" : tone === "problem" ? "text-problem" : "text-asphalt-700",
        )}
      />
      <span>{children}</span>
    </p>
  );
}

type TimelineEvent = { at: string; text: string; photo?: { id: string; label: string } | null };

/** Event timeline: time, a dot on the rail, what happened, and the photo taken then. The last dot is the outcome. */
function Timeline({ events }: { events: TimelineEvent[] }) {
  return (
    <ol className="flex flex-col">
      {events.map((e, i) => {
        const last = i === events.length - 1;
        return (
          <li key={`${e.at}-${e.text}`} className="grid grid-cols-[64px_16px_minmax(0,1fr)] gap-x-2 pb-3 last:pb-0">
            <span className="num t-label-strong">{formatTime(e.at)}</span>
            <span className="relative flex justify-center">
              {last ? null : <span aria-hidden className="absolute top-3 -bottom-3 w-0.5 bg-asphalt-200" />}
              <span
                aria-hidden
                className={cx("relative mt-1.5 size-2 rounded-full", last ? "bg-done" : "bg-asphalt-300")}
              />
            </span>
            <span className="flex min-w-0 flex-col gap-2">
              <span className="t-dense">{e.text}</span>
              {e.photo ? <RecordPhoto id={e.photo.id} label={e.photo.label} /> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** A photo from the driver's phone, 56 px; it shows once the photo itself has reached Relay. */
function RecordPhoto({ id, label }: { id: string; label: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return null;
  const src = `/api/photos/${id}?as=dispatcher`;
  return (
    <a href={src} target="_blank" rel="noreferrer" className="shrink-0 self-start">
      <img
        src={src}
        alt={label}
        onError={() => setMissing(true)}
        className="size-14 rounded-button border border-asphalt-200 object-cover"
      />
    </a>
  );
}

/** "stop 4", "stops 3 and 4", "stops 2, 3 and 4" */
function stopsWords(markers: RunMarker[]): string {
  const seqs = markers.map((m) => m.seq);
  if (seqs.length === 1) return `stop ${seqs[0]}`;
  return `stops ${seqs.slice(0, -1).join(", ")} and ${seqs[seqs.length - 1]}`;
}

function windowOf(dir: Directory, row: RunRow, m: RunMarker): string {
  const stop = dir.stop(row, m.outlet_id);
  return stop ? `Window ${formatWindow(stop.window_open, stop.window_close)}` : `Closes ${formatTime(m.closes)}`;
}

function rangePastClose(m: RunMarker): boolean {
  return !!m.range && Date.parse(m.range[1]) > Date.parse(m.closes);
}

/** Estimate row: the stop, its window, Relay's time and, while the phone is silent, the likely range. A range that
 *  runs past the close is in attention; an estimate past the close is late risk. */
function EstimateRow({
  row,
  m,
  label,
  detail = "range",
  move = false,
}: {
  row: RunRow;
  m: RunMarker;
  label?: string;
  detail?: "range" | "planned";
  move?: boolean;
}) {
  const env = useEnv();
  const time = m.estimate ? shortClock(m.estimate) : "";
  return (
    <li className="flex min-h-10 items-center gap-3">
      <EstimateMark n={m.seq} size={24} />
      <span className="flex min-w-0 flex-1 flex-col">
        {/* the mark beside it already shows the stop's number: the name keeps the narrow column to itself */}
        <span className="t-dense-strong">
          <span className="sr-only">Stop {m.seq}, </span>
          {label ?? m.place}
        </span>
        <span className="t-caption text-asphalt-500">{windowOf(env.dir, row, m)}</span>
      </span>
      <span className="flex shrink-0 flex-col items-end">
        {m.state === "moved" && m.moved_to ? (
          <span className="t-dense-strong text-attention">Also on {m.moved_to}</span>
        ) : (
          <span className={cx("num t-dense-strong", m.late_risk && "text-problem")}>
            {detail === "range" ? `around ${time}` : time}
          </span>
        )}
        {detail === "planned" ? (
          <span className="num t-caption text-asphalt-500">planned {shortClock(m.planned)}</span>
        ) : m.range ? (
          <span className={cx("num t-caption", rangePastClose(m) ? "text-attention" : "text-asphalt-500")}>
            likely {shortClock(m.range[0])} to {shortClock(m.range[1])}
          </span>
        ) : null}
      </span>
      {move && env.desk && env.onMove && m.state !== "moved" ? (
        <Button
          density="desk"
          variant="quiet"
          compact
          aria-label={`Move stop ${m.seq}, ${m.place}`}
          onClick={() => env.onMove?.(row, m)}
        >
          Move
        </Button>
      ) : null}
    </li>
  );
}

/** Late risk only when an estimate crosses a close; a range that runs past it is said in attention. */
function RiskLines({ markers }: { markers: RunMarker[] }) {
  return (
    <>
      {markers.map((m) =>
        m.late_risk ? (
          <Line key={m.stop_id} icon={TriangleAlert} tone="problem">
            {m.place} is expected after its {formatTime(m.closes)} close.
          </Line>
        ) : rangePastClose(m) ? (
          <Line key={m.stop_id} icon={Clock} tone="attention">
            {m.place}'s likely range already runs past its {formatTime(m.closes)} close.
          </Line>
        ) : null,
      )}
    </>
  );
}

// ------------------------------------------------------------------------------------------------ silence
/** DEG-03: a phone gone quiet on a running trip. It says what is known and never why, shows each store still to come
 *  with Relay's estimate and likely range, and resolves itself when the phone is back. */
function SilenceEntry(props: EntryProps) {
  const { item } = props;
  const env = useEnv();
  const row = itemRows(item, env.rows)[0];
  const since = useMinutesSince(item.ref?.since ?? item.created_at);
  if (item.handled_at || !row?.last_contact_at) {
    return (
      <ItemShell
        {...props}
        tone={item.handled_at ? "done" : "waiting"}
        icon={CloudOff}
        title={item.title}
        subtitle={item.outcome || item.body}
      >
        <p className="t-label text-asphalt-700">{item.outcome || item.body}</p>
      </ItemShell>
    );
  }
  const first = driverName(row);
  const contact = formatTime(row.last_contact_at);
  const estimated = row.markers.filter(isEstimated);
  const last = lastRecord(row);
  const lastStop = last ? env.dir.stop(row, last.marker.outlet_id) : undefined;
  const nextStore = estimated.find((m) => m.state !== "moved");
  return (
    <ItemShell
      {...props}
      tone="waiting"
      icon={CloudOff}
      title={props.open ? item.title : `No contact from ${first}`}
      subtitle={`Since ${contact}${estimated.length ? ` · ${stopsWords(estimated)} estimated` : ""}`}
      right={formatDuration(row.silent_minutes || since)}
    >
      <p className="t-label text-asphalt-700">
        <span className="latin">{row.vehicle_id}</span> · {runLine(row)} · {estimated.length}{" "}
        {estimated.length === 1 ? "stop" : "stops"} to go
      </p>
      <Section label="Last record">
        {last ? (
          <>
            <p className="t-dense">
              Stop {last.marker.seq}, {lastStop?.name ?? last.marker.place} (
              <span className="latin">{last.marker.outlet_id}</span>).{" "}
              {last.kind === "arrived" ? "Arrived" : "Delivered"} {formatTime(last.at)}.
            </p>
            {last.kind === "arrived" ? (
              <p className="t-caption text-asphalt-500">Not marked delivered before {contact}.</p>
            ) : null}
          </>
        ) : (
          <p className="t-dense">
            Left the hub at {formatTime(row.departed_at ?? row.planned_depart)}. No stop recorded yet.
          </p>
        )}
      </Section>
      <Section label="Estimated, not tracked">
        {row.position ? (
          <p className="flex items-center gap-2 t-dense">
            <EstimateMark size={16} />
            {row.position}
          </p>
        ) : null}
        <ul className="flex flex-col gap-1">
          {estimated.map((m) => (
            <EstimateRow key={m.stop_id} row={row} m={m} move />
          ))}
        </ul>
        <p className="t-caption text-asphalt-500">
          From the last record, each store's usual unloading time and the expected time for each leg. The range widens
          while there is no contact.
        </p>
      </Section>
      <RiskLines markers={estimated} />
      <p className="t-caption text-asphalt-500">
        Relay can't tell a lost signal from a flat battery, so it shows only what it last heard and estimates from
        there.
      </p>
      {nextStore?.estimate ? (
        <Line icon={Store}>
          {nextStore.passed
            ? `${storeWho(nextStore)} sees: The estimate has passed. No word from ${first} since ${contact}.`
            : `${storeWho(nextStore)} sees: Arriving around ${formatTime(nextStore.estimate)}. Last heard from ${first} ${contact}.`}
        </Line>
      ) : null}
    </ItemShell>
  );
}

/** The person at the store who reads the same estimate, by the name they are called, or the store. */
function storeWho(m: RunMarker): string {
  return calledName(m.store_contact) || m.place;
}

// ------------------------------------------------------------------------------------------------ backup
/** DEG-03 / stop moved: the dispatcher sent a stop with a backup while its driver was silent. While the backup's copy
 *  is live and the driver silent it is in attention under Now; after that it is the record. */
function MovedEntry(props: EntryProps) {
  const { item } = props;
  const env = useEnv();
  const who = useWho();
  const seq = Number(item.title.match(/^Stop (\d+)/)?.[1]);
  const backup = item.title.match(/VEH\d{3}/)?.[0] ?? "the backup";
  const row = itemRows(item, env.rows).find((r) => !r.is_backup);
  const marker = row?.markers.find((m) => (item.ref?.stop_id ? m.stop_id === item.ref.stop_id : m.seq === seq));
  const copy = env.rows.flatMap((r) => r.markers).find((m) => (marker ? m.backup_of === marker.stop_id : false));
  const backupRow = env.rows.find((r) => r.markers.some((m) => m === copy));
  const actor = item.body.split(" moved ")[0] ?? null;
  const by = who(actor);
  const reason = item.body.includes(": ") ? item.body.slice(item.body.indexOf(": ") + 2) : "";
  const order = row && marker ? env.dir.stop(row, marker.outlet_id)?.order_ref : undefined;
  const first = row ? driverName(row) : "The driver";
  const live = movedLive(item, env.rows);
  // where the backup is now, not where it was when the stop moved
  const now =
    copy?.state === "cancelled"
      ? `${backup}'s copy was cancelled.`
      : backupRow?.departed_at
        ? `${backup} left the hub at ${formatTime(backupRow.departed_at)}.`
        : backupRow
          ? `${backup} is loading at the dock.`
          : item.outcome;
  return (
    <ItemShell
      {...props}
      tone={live ? "attention" : "done"}
      icon={live ? Clock : Van}
      title={item.title}
      subtitle={`${formatTime(item.created_at)}, by ${by === "You" ? "you" : by}. ${now}`}
      right={formatTime(item.created_at)}
    >
      {row && marker ? (
        <p className="t-label text-asphalt-700">
          <span className="latin">
            {row.vehicle_id} stop {marker.seq} · {marker.outlet_id}
            {order ? ` · ${order}` : ""}
          </span>{" "}
          · by {by === "You" ? "you" : by}
        </p>
      ) : null}
      {reason ? (
        <Section label="Reason">
          <Quote>{reason}</Quote>
        </Section>
      ) : null}
      {row?.out_of_contact && marker ? (
        <>
          <p className="t-dense">{first} hasn't seen this yet. The phone gets it when it reconnects.</p>
          <p className="t-dense">
            If {first} delivers stop {marker.seq} first, Relay asks {first} to confirm and cancels {backup}'s copy.
          </p>
        </>
      ) : null}
      {copy?.state === "cancelled" ? (
        <p className="t-caption text-asphalt-500">{backup}'s copy was cancelled.</p>
      ) : copy?.estimate && marker ? (
        <p className={cx("t-caption", copy.late_risk ? "text-problem" : "text-asphalt-500")}>
          {backup} arrives around {shortClock(copy.estimate)}, {copy.late_risk ? "after" : "before"} {marker.place}'s{" "}
          {formatTime(marker.closes)} close.
        </p>
      ) : (
        <p className="t-caption text-asphalt-500">{now}</p>
      )}
    </ItemShell>
  );
}

/** DEG-03 / receipt in: a store confirmed receipt from a silent run while a backup is on its way to a later stop.
 *  The receipt moves the estimate; it never settles the driver's records. Keep the backup, or call it off. */
function ReceiptEntry(props: EntryProps) {
  const { item } = props;
  const env = useEnv();
  const decide = useBackupDecision(env.depot);
  const [note, setNote] = useState("");
  const row = itemRows(item, env.rows).find((r) => !r.is_backup);
  const place = item.title.replace(/ confirmed receipt$/, "");
  const receipted =
    row?.markers.find((m) => m.place === place && m.receipt_at) ?? row?.markers.find((m) => m.receipt_at);
  const later = row && receipted ? row.markers.filter((m) => m.seq > receipted.seq && isEstimated(m)) : [];
  const copy = env.rows.flatMap((r) => r.markers).find((m) => later.some((l) => l.stop_id === m.backup_of));
  const backupRow = env.rows.find((r) => r.markers.some((m) => m === copy));
  const order = row && receipted ? env.dir.stop(row, receipted.outlet_id)?.order_ref : undefined;
  const first = row ? driverName(row) : "The driver";
  if (item.handled_at) {
    return (
      <ItemShell
        {...props}
        tone="done"
        icon={CircleCheck}
        title={item.title}
        subtitle={`${formatTime(item.created_at)}. ${item.outcome}`}
      >
        <p className="t-label text-asphalt-700">
          {formatTime(item.created_at)} · {item.outcome}
        </p>
      </ItemShell>
    );
  }
  const density = env.desk ? "desk" : "store";
  const outOfRange = later.filter(rangePastClose);
  return (
    <ItemShell {...props} tone="attention" icon={Clock} title={item.title} right={formatTime(item.created_at)}>
      {row && receipted ? (
        <p className="latin t-label text-asphalt-700">
          {formatTime(item.created_at)} · {row.vehicle_id} stop {receipted.seq} · {receipted.outlet_id}
          {order ? ` · ${order}` : ""}
        </p>
      ) : null}
      <p className="t-dense">
        The store confirmed receipt, so {first} has been there.
        {later.length
          ? ` Relay has moved the estimate for ${later.map((m) => m.place).join(" and ")} from this receipt.`
          : ""}
      </p>
      {row && later.length ? (
        <ul className="flex flex-col gap-1">
          {later.map((m) => (
            <EstimateRow key={m.stop_id} row={row} m={{ ...m, state: "pending" }} label={`${m.place}, now`} />
          ))}
        </ul>
      ) : null}
      {backupRow && copy?.estimate ? (
        <Line icon={Van}>
          {backupRow.departed_at
            ? `${backupRow.vehicle_id} is on its way, around ${formatTime(copy.estimate)}.`
            : `${backupRow.vehicle_id} leaves the hub ${formatTime(backupRow.planned_depart)}, around ${formatTime(copy.estimate)} at ${copy.place}.`}
        </Line>
      ) : (
        <p className="t-dense">{item.body}</p>
      )}
      {outOfRange.map((m) => (
        <Line key={m.stop_id} icon={Clock} tone="attention">
          The range still runs past {m.place}'s {formatTime(m.closes)} close
          {row?.out_of_contact ? `, and there is still no contact from ${first}` : ""}.
        </Line>
      ))}
      <p className="t-dense-strong">Keep the backup on its way?</p>
      <label className="flex flex-col gap-1 t-label text-asphalt-700">
        Note for the record
        <input
          type="text"
          value={note}
          maxLength={300}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Optional"
          className={cx(
            "rounded-button border border-asphalt-300 bg-white px-3 t-dense text-asphalt-900",
            env.desk ? "h-9" : "h-12",
          )}
        />
      </label>
      <div className={cx("flex gap-2", env.desk ? "justify-end" : "flex-col")}>
        <Button
          density={density}
          full={!env.desk}
          disabled={decide.isPending}
          onClick={() => decide.mutate({ itemId: item.id, action: "cancel", note })}
        >
          Cancel backup
        </Button>
        <Button
          density={density}
          variant="primary"
          full={!env.desk}
          disabled={decide.isPending}
          onClick={() => decide.mutate({ itemId: item.id, action: "keep", note })}
        >
          Keep backup
        </Button>
      </div>
      {decide.error ? <p className="t-dense text-problem">{decide.error.message}</p> : null}
    </ItemShell>
  );
}

// ------------------------------------------------------------------------------------------------ two copies
/** DEG-05: records from a phone that was silent clash with a move made meanwhile. Kasun has been asked; whichever
 *  answer comes first, the driver's or the dispatcher's, settles it. */
function ConflictEntry(props: EntryProps) {
  const { item } = props;
  const env = useEnv();
  const who = useWho();
  const settle = useSettle(env.depot);
  const review = useReview(env.depot);
  const seq = Number(item.title.match(/^Stop (\d+)/)?.[1]);
  const row = itemRows(item, env.rows).find((r) => !r.is_backup);
  const marker = row?.markers.find((m) => m.seq === seq);
  const moved = env.items.find(
    (i) =>
      i.kind === "stop_moved" &&
      (i.ref?.stop_id
        ? i.ref.stop_id === marker?.stop_id
        : i.title.startsWith(`Stop ${seq} moved to`) && !!row && i.body.includes(row.vehicle_id)),
  );
  const backup = moved?.title.match(/VEH\d{3}/)?.[0] ?? item.body.match(/VEH\d{3}/)?.[0] ?? "the backup";
  const copy = env.rows.flatMap((r) => r.markers).find((m) => !!marker && m.backup_of === marker.stop_id);
  const backupRow = env.rows.find((r) => r.markers.some((m) => m === copy));
  const order = row && marker ? env.dir.stop(row, marker.outlet_id)?.order_ref : undefined;
  const first = row ? driverName(row) : "The driver";
  const meta =
    row && marker ? (
      <p className="latin t-label text-asphalt-700">
        {row.vehicle_id} stop {marker.seq} · {marker.outlet_id}
        {order ? ` · ${order}` : ""}
      </p>
    ) : null;

  if (item.handled_at) {
    const byDriver = item.outcome.startsWith("The driver answered yes");
    // settled the other way: the backup carries the stop and the driver's records for it are set aside
    const keptBackup = item.ref?.resolution === "backup";
    const outcome =
      marker?.state === "delivered" && marker.recorded
        ? `${first} delivered it at ${formatTime(marker.recorded)}. ${backup}'s copy is cancelled.`
        : item.outcome;
    const events: TimelineEvent[] = [];
    if (moved) {
      const reason = moved.body.includes(": ") ? moved.body.slice(moved.body.indexOf(": ") + 2) : "";
      const actor = who(moved.body.split(" moved ")[0]);
      events.push({
        at: moved.created_at,
        text: `${actor} moved stop ${seq} to ${backup}${reason ? `: ${reason}` : "."}`,
      });
    }
    for (const kept of env.items.filter(
      (i) =>
        i.kind === "receipt" && i.handled_at && i.outcome.startsWith("You kept") && itemRows(i, env.rows)[0] === row,
    )) {
      events.push({
        at: kept.handled_at!,
        text: `${who(kept.handled_by)} kept the backup after ${kept.title.replace(/ confirmed receipt$/, "")}'s receipt.`,
      });
    }
    const delivered = item.ref?.delivered_at ?? marker?.recorded;
    if (delivered) {
      const cases = item.ref?.cases ? `${item.ref.cases} cases` : `stop ${seq}`;
      const receiver = item.ref?.receiver ? `, received by ${item.ref.receiver}` : `, ${marker?.place ?? ""}`;
      const photo = item.ref?.photo_id
        ? { id: item.ref.photo_id, label: `${first}'s photo, ${formatTime(delivered)}` }
        : null;
      events.push({
        at: delivered,
        text: keptBackup
          ? `${first}'s phone saved a delivery of ${cases}${receiver}.`
          : `${first} delivered ${cases}${receiver}.`,
        photo,
      });
    }
    const turned =
      backupRow?.status === "returning" && backupRow.driver ? ` and ${calledName(backupRow.driver)} turned back` : "";
    events.push({
      at: item.handled_at,
      text: keptBackup
        ? `${who(item.handled_by)} kept ${backup}'s copy. ${first}'s records for stop ${seq} are set aside.`
        : byDriver
          ? `${first} confirmed. ${backup}'s copy was cancelled${turned}.`
          : `${who(item.handled_by)} cancelled ${backup}'s copy. ${first}'s delivery stands.`,
    });
    events.sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    return (
      <ItemShell
        {...props}
        tone="done"
        icon={CircleCheck}
        title={item.title}
        subtitle={item.reviewed_at ? `Reviewed ${formatTime(item.reviewed_at)}` : outcome}
        right={formatTime(item.handled_at)}
      >
        {meta}
        <p className="t-dense-strong">{outcome}</p>
        <Section label="What happened">
          <Timeline events={events} />
        </Section>
        {item.reviewed_at ? (
          <p className="flex items-center gap-2 t-label text-asphalt-700">
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-done" />
            {who(item.reviewed_by)} marked it reviewed at {formatTime(item.reviewed_at)}.
          </p>
        ) : (
          <>
            <Button
              density={env.desk ? "desk" : "store"}
              variant="primary"
              full
              icon={Check}
              disabled={review.isPending}
              onClick={() => review.mutate({ itemId: item.id })}
            >
              Mark reviewed
            </Button>
            {review.error ? <p className="t-dense text-problem">{review.error.message}</p> : null}
          </>
        )}
      </ItemShell>
    );
  }

  const conflictId = item.ref?.conflict_id ?? null;
  const escalated = item.body.includes("until you settle it");
  const deliveredAt = item.ref?.delivered_at ?? marker?.held ?? null;
  const arrivedAt = item.ref?.arrived_at ?? null;
  const mover = moved ? who(moved.body.split(" moved ")[0]) : null;
  const backupDriver = backupRow?.driver ? calledName(backupRow.driver) : backup;
  return (
    <ItemShell {...props} tone="attention" icon={Clock} title={item.title} right={formatTime(item.created_at)}>
      {meta}
      <p className="t-dense">
        {deliveredAt
          ? `${first}'s phone says stop ${seq} was delivered at ${formatTime(deliveredAt)}.`
          : `${first}'s phone recorded stop ${seq} while ${backup} still has it.`}
        {moved && mover
          ? ` ${mover} moved it to ${backup} at ${formatTime(moved.created_at)}, while there was no contact from ${first}.`
          : ""}
      </p>
      {arrivedAt || deliveredAt ? (
        <Section label={`${first}'s records`}>
          <div className="flex items-start gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 t-dense">
              {arrivedAt ? <p>Arrived {formatTime(arrivedAt)}</p> : null}
              {deliveredAt ? (
                <p>
                  Delivered {formatTime(deliveredAt)}
                  {item.ref?.receiver ? ` · received by ${item.ref.receiver}` : ""}
                </p>
              ) : null}
            </div>
            {item.ref?.photo_id ? <RecordPhoto id={item.ref.photo_id} label={`${first}'s photo`} /> : null}
          </div>
        </Section>
      ) : null}
      {backupRow && copy ? (
        <Line icon={Van}>
          {copy.state === "cancelled"
            ? `${backup}'s copy is already cancelled.`
            : backupRow.departed_at && copy.estimate
              ? `${backupDriver} is on the way to ${copy.place} with ${backup}, around ${shortClock(copy.estimate)}.`
              : `${backup} has not left the hub yet.`}
        </Line>
      ) : null}
      {escalated ? (
        <p className="t-dense">{item.body}</p>
      ) : (
        <p className="t-caption text-asphalt-500">
          {first} has been asked too. Whichever answer comes first settles it.
        </p>
      )}
      {/* the driver's "no" makes keeping the backup's copy the answer that fits; cancelling it stays possible */}
      {(marker?.denied ? (["backup", "driver"] as const) : (["driver", "backup"] as const)).map((keep, i) =>
        keep === "backup" && (!copy || copy.state === "cancelled") ? null : (
          <Button
            key={keep}
            density={env.desk ? "desk" : "store"}
            variant={i === 0 ? "primary" : "secondary"}
            full
            icon={i === 0 ? Check : undefined}
            disabled={settle.isPending || !conflictId}
            onClick={() => conflictId && settle.mutate({ conflictId, keep })}
          >
            {keep === "backup" ? `Keep ${backup}'s copy` : `Cancel ${backup}'s copy`}
          </Button>
        ),
      )}
      {settle.error ? <p className="t-dense text-problem">{settle.error.message}</p> : null}
    </ItemShell>
  );
}

// ------------------------------------------------------------------------------------------------ reports
const REPORT_ICON: Record<string, LucideIcon> = {
  delay: Clock,
  failed_stop: TriangleAlert,
  problem: TriangleAlert,
  dispute: CircleAlert,
};

/** A driver's report (delay, a stop not delivered, a problem) or a store's receipt issue. Handled with one action,
 *  which moves it to Earlier today with the time and who handled it. */
function ReportEntry(props: EntryProps) {
  const { item } = props;
  const env = useEnv();
  const who = useWho();
  const handle = useHandle(env.depot);
  const minutes = useMinutesSince(item.created_at);
  const row = itemRows(item, env.rows)[0];
  const icon = REPORT_ICON[item.kind] ?? CircleAlert;
  const delayMin = item.kind === "delay" ? item.title.match(/Delayed, (\d+) min/)?.[1] : undefined;
  const title = delayMin && row ? `${row.vehicle_id} running about ${delayMin} min late` : item.title;
  const stop = row?.markers.find((m) => m.stop_id === item.ref?.stop_id);
  const fromStore = item.kind === "dispute";

  const ahead = row && item.kind === "delay" ? row.markers.filter(isEstimated) : [];
  // what the report said and what it changed, both while it is open and once it is the record
  const story = (
    <>
      {row && !fromStore ? (
        <p className="t-label text-asphalt-700">
          {row.driver ?? row.vehicle_id} reported it at {formatTime(item.created_at)}
          {stop ? `, at stop ${stop.seq}, ${stop.place}` : ""}
        </p>
      ) : (
        <p className="t-label text-asphalt-700">{formatTime(item.created_at)}</p>
      )}
      {item.body ? (
        <Section label={fromStore ? "From the store" : "Note from the driver"}>
          <Quote>{item.body}</Quote>
        </Section>
      ) : null}
      {row && ahead.length ? (
        <Section label="What changed">
          <ul className="flex flex-col gap-1">
            {ahead.map((m) => (
              <EstimateRow key={m.stop_id} row={row} m={m} detail="planned" />
            ))}
          </ul>
          {ahead.some((m) => m.late_risk) ? (
            <RiskLines markers={ahead} />
          ) : (
            <p className="t-caption text-asphalt-500">
              {ahead.length === 1 ? "It stays" : ahead.length === 2 ? "Both stay" : "All stay"} inside{" "}
              {ahead.length === 1 ? "its window" : "their windows"}.
            </p>
          )}
        </Section>
      ) : null}
    </>
  );

  if (item.handled_at) {
    const plain = item.outcome.startsWith("Marked as handled");
    return (
      <ItemShell
        {...props}
        tone="done"
        icon={icon}
        title={title}
        subtitle={
          plain
            ? `Reported ${formatTime(item.created_at)}. Marked as handled ${formatTime(item.handled_at)}.`
            : item.outcome
        }
      >
        {story}
        <p className="flex items-center gap-2 t-label text-asphalt-700">
          <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-done" />
          {who(item.handled_by)} marked it handled at {formatTime(item.handled_at)}.{plain ? "" : ` ${item.outcome}`}
        </p>
      </ItemShell>
    );
  }

  return (
    <ItemShell {...props} tone="attention" icon={icon} title={title} right={formatDuration(minutes)}>
      {story}
      <Button
        density={env.desk ? "desk" : "store"}
        full={!env.desk}
        icon={Check}
        disabled={handle.isPending}
        onClick={() => handle.mutate({ itemId: item.id })}
        className={env.desk ? "self-start" : undefined}
      >
        Mark as handled
      </Button>
      {handle.error ? <p className="t-dense text-problem">{handle.error.message}</p> : null}
    </ItemShell>
  );
}

// ------------------------------------------------------------------------------------------------ shortfall
/** "1 rice and dhal case", "6 rice and dhal cases" */
function casesOf(count: number, name = "") {
  return `${count} ${name ? `${name} ` : ""}${count === 1 ? "case" : "cases"}`;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

/** A flag from the dock: open, the decision it needs; handled, the record of what happened. */
function ShortfallEntry({ s, ...props }: EntryProps & { s: ShortfallDetail }) {
  const { item } = props;
  const minutes = useMinutesSince(item.created_at);
  const Icon = s.kind === "damaged" ? TriangleAlert : PackageX;
  if (item.handled_at) {
    return (
      <ItemShell
        {...props}
        tone="done"
        icon={Icon}
        title={item.title}
        subtitle={s.decided_at ? decidedLine(s) : item.outcome || item.body}
      >
        {s.decided_at ? (
          <ShortfallRecord item={item} s={s} />
        ) : (
          <p className="t-label text-asphalt-700">
            {formatTime(item.handled_at)} · {item.outcome || item.body}
          </p>
        )}
      </ItemShell>
    );
  }
  return (
    <ItemShell {...props} tone="attention" icon={Icon} title={item.title} right={formatDuration(minutes)}>
      <ShortfallDecision item={item} s={s} />
    </ItemShell>
  );
}

function ShortfallDecision({ item, s }: { item: FeedItem; s: ShortfallDetail }) {
  const env = useEnv();
  const decide = useDecide(env.depot);
  const density = env.desk ? "desk" : "store";
  const place = `${s.outlet_id} ${s.place} · ${s.order_ref}`;
  const nextDay = s.next_day ? formatWeekday(dayOf(s.next_day)) : null;
  const store = calledName(s.store_contact);
  const driver = calledName(s.driver);
  const cases = lowerFirst(s.case_name);
  const kept =
    s.kind === "missing"
      ? "None left on the shelf."
      : `The damaged ${s.qty === 1 ? "case stays" : "cases stay"} at the hub.`;
  // What the hub holds decides whether holding the truck could help: a spare, or a delivery before it leaves.
  // Where Relay does not know the hub's stock of this case type, the box says what holding the truck costs.
  const hold = `Holding ${s.vehicle_id} past ${formatTime(s.departs)} delays ${s.trip_stops === 1 ? "its only stop" : `all ${s.trip_stops} stops`}.`;
  const spare =
    s.hub_spare === null
      ? null
      : s.hub_spare > 0
        ? `${s.hub_spare} spare ${cases} ${s.hub_spare === 1 ? "case" : "cases"} at the hub.`
        : "No spare at the hub.";
  const delivery = s.next_delivery_at
    ? ` The next ${cases} delivery comes at ${formatTime(s.next_delivery_at)}, ${Date.parse(s.next_delivery_at) > Date.parse(s.departs) ? "after" : "before"} ${s.vehicle_id} leaves.`
    : "";
  const stock = spare === null ? null : `${spare}${delivery}`;
  const situation = s.kind === "missing" ? (stock ?? `${kept} ${hold}`) : `${kept} ${stock ?? hold}`;
  const join = s.qty === 1 ? `The ${s.kind} case joins` : `The ${s.qty} ${s.kind} cases join`;
  return (
    <>
      <div className="flex flex-col gap-0.5 t-label text-asphalt-700">
        <p>
          {s.flagged_by ?? "The dock"}, {env.depotLabel} dock, {formatTime(s.flagged_at)}
        </p>
        <p>
          <span className="latin">{s.vehicle_id}</span> leaves {formatTime(s.departs)}
        </p>
      </div>
      <div className="flex flex-col gap-1 rounded-button border border-asphalt-200 bg-asphalt-50 p-3">
        <p className="latin t-body-strong">{place}</p>
        <p className="flex items-center gap-1.5 t-body">
          <Package size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {s.kind === "missing"
            ? `${s.temp_label} · ${s.planned - s.qty} of ${casesOf(s.planned, cases)} on the shelf`
            : `${s.temp_label} · ${s.qty} of ${casesOf(s.planned, cases)} damaged, kept off the truck`}
        </p>
        <p className="t-body text-asphalt-700">{situation}</p>
        {s.photo_id ? (
          <a href={`/api/photos/${s.photo_id}?as=dispatcher`} target="_blank" rel="noreferrer" className="self-start">
            <img
              src={`/api/photos/${s.photo_id}?as=dispatcher`}
              alt={`The damaged ${cases} ${s.qty === 1 ? "case" : "cases"}, from the dock`}
              className="mt-1 h-28 w-auto rounded-button border border-asphalt-200 object-cover"
            />
          </a>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        <p className="t-label text-asphalt-500">Your decision</p>
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            density={density}
            full
            icon={Send}
            disabled={decide.isPending}
            onClick={() => decide.mutate({ shortfallId: s.id, decision: "send_short" })}
          >
            Send short, add to {nextDay ?? "the next order"}
          </Button>
          <p className="t-dense text-asphalt-700">
            {driver ? `${driver} takes ${casesOf(s.stop_cases - s.qty)} to stop ${s.stop_seq}. ` : ""}
            {s.next_order_ref
              ? `${join} ${store ? `${store}'s` : "the store's"} ${nextDay} ${s.temp_label.toLowerCase()} order, ${s.next_order_ref}, marked from ${formatWeekday(dayOf(s.run_date))}: ${formatDayLong(dayOf(s.next_day ?? ""))}, ${s.window}.`
              : "The store has no next order yet. Relay opens one for the next run."}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            density={density}
            full
            disabled={decide.isPending}
            onClick={() => decide.mutate({ shortfallId: s.id, decision: "no_replacement" })}
          >
            Send short, no replacement
          </Button>
          <p className="t-dense text-asphalt-500">{s.store_contact ?? "The store"} is told either way.</p>
        </div>
        {decide.error ? <p className="t-dense text-problem">{decide.error.message}</p> : null}
        {env.desk ? null : (
          <p className="text-center t-caption text-asphalt-500">
            Sent to your phone at {formatTime(item.created_at)} because you are on call tonight.
          </p>
        )}
      </div>
    </>
  );
}

/** "6 rice and dhal cases short. Decided 2:52 AM: send short, add to Thursday." */
function decidedLine(s: ShortfallDetail) {
  const answer =
    s.decision === "send_short"
      ? `send short, add to ${s.next_day ? formatWeekday(dayOf(s.next_day)) : "the next order"}`
      : "send short, no replacement";
  return `${casesOf(s.qty, lowerFirst(s.case_name))} short. Decided ${formatTime(s.decided_at ?? "")}: ${answer}.`;
}

/** The shortfall's record, in the order it happened: the flag, the answer, the store told, the load handed over. */
function ShortfallRecord({ item, s }: { item: FeedItem; s: ShortfallDetail }) {
  const who = useWho();
  const flagged = `${casesOf(s.qty, lowerFirst(s.case_name))} ${s.kind} on ${s.vehicle_id}, stop ${s.stop_seq}`;
  const found = s.kind === "missing" ? `${s.planned - s.qty} of ${s.planned} on the shelf.` : "Kept off the truck.";
  const decided = s.decided_at ?? item.created_at;
  const photo = s.photo_id
    ? {
        id: s.photo_id,
        label: `The damaged ${lowerFirst(s.case_name)} ${s.qty === 1 ? "case" : "cases"}, from the dock`,
      }
    : null;
  const events: TimelineEvent[] = [
    { at: s.flagged_at, text: `${s.flagged_by ?? "The dock"} flagged ${flagged}. ${found}`, photo },
    { at: decided, text: `${who(s.decided_by)} decided: ${lowerFirst(item.outcome)}` },
    {
      at: decided,
      text: `${s.store_contact ?? "The store"} was told${s.store_seen_at ? `, and read it at ${formatTime(s.store_seen_at)}.` : "."}`,
    },
  ];
  if (s.completed_at) {
    events.push({
      at: s.completed_at,
      text: `Load complete: ${s.loaded_cases} of ${casesOf(s.planned_cases)}.${s.accepted_by ? ` ${calledName(s.accepted_by)} accepted the load${s.accepted_at && formatTime(s.accepted_at) !== formatTime(s.completed_at) ? ` at ${formatTime(s.accepted_at)}` : ""}.` : ""}`,
    });
  }
  return <Timeline events={events} />;
}
