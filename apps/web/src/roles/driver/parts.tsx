/** The driver's building blocks (spec-driver.md, Components needed): the phone header with its sync pill, the step
 *  progress, the next stop card, stop rows, the window status line, detail cells, choice chips and segments, the
 *  field stepper and text fields, the photo tile and the confirmation panel. Field density throughout: buttons 56
 *  and 48 high, rows at least 64, every target at least 48 by 48. */
import {
  ArrowLeft,
  Box,
  Building2,
  CalendarClock,
  Camera,
  Check,
  ChevronRight,
  CircleCheck,
  Clock,
  CloudOff,
  type LucideIcon,
  MapPin,
  Minus,
  Phone,
  Plus,
  RefreshCw,
  Store,
  Timer,
  TriangleAlert,
  Van,
  Warehouse,
  X,
} from "lucide-react";
import { type ChangeEvent, type ReactNode, type RefObject, useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button, IconButton } from "@/design/Button";
import { StatusChip } from "@/design/StatusChip";
import { type MarkerState, StopMarker } from "@/design/StopMarker";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { awaitingAnswer, type StopLocal, stopLocal, waitingForCall, windowState } from "./local";
import { useDriver } from "./sync";
import type { DriverRun, DriverStop, DriverTrip } from "./types";
import { useDriverText } from "./words";

/* ------------------------------------------------------------------------------------------- header and pill */

/** Sync pill, driver: status only, never a button. It counts stops, the way the driver thinks of the run. */
export function DriverPill() {
  const { pill } = useDriver();
  const { t } = useDriverText();
  let label = t("pill.synced");
  if (pill.state !== "synced") {
    const form = pill.stops
      ? (["Stops", pill.stops] as const)
      : pill.photos
        ? (["Photos", pill.photos] as const)
        : pill.updates
          ? (["Updates", pill.updates] as const)
          : null;
    if (!form) label = t("pill.offline");
    else if (pill.state === "sending") label = t(`pill.sending${form[0]}`, { count: form[1] });
    else label = t(`pill.${form[0].toLowerCase()}`, { count: form[1] });
  }
  const Icon = pill.state === "synced" ? CircleCheck : pill.state === "sending" ? RefreshCw : CloudOff;
  const spoken =
    pill.state === "offline" && label !== t("pill.offline") ? t("pill.offlineLabel", { what: label }) : label;
  return (
    <span
      role="status"
      aria-label={spoken}
      className={cx(
        // never cut short: a long Tamil label takes a second line inside its 180 rather than lose words
        "inline-flex min-h-8 max-w-[180px] shrink-0 items-center gap-1.5 rounded-chip px-2.5 py-1 t-label leading-tight",
        pill.state === "synced"
          ? "bg-done-soft text-done"
          : "border border-asphalt-300 bg-waiting-soft text-asphalt-700",
      )}
    >
      <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
      {label}
    </span>
  );
}

/** Top bar / phone header with sync pill / field: root (Heading 1), back, close (no title on DRV-04) or plain. */
export function DriverHeader({
  title,
  root,
  back,
  backLabel,
  close,
}: {
  title?: ReactNode;
  root?: boolean;
  back?: string | (() => void);
  backLabel?: string;
  close?: () => void;
}) {
  const { t } = useDriverText();
  const navigate = useNavigate();
  const lead =
    back !== undefined ? (
      <IconButton
        icon={ArrowLeft}
        label={backLabel ?? t("header.back")}
        density="field"
        onClick={() => (typeof back === "function" ? back() : navigate(back))}
      />
    ) : close ? (
      <IconButton icon={X} label={t("header.close")} density="field" onClick={close} />
    ) : null;
  return (
    <header
      className={cx(
        "flex min-h-16 items-center gap-2 border-b border-asphalt-200 bg-white py-2 pr-4",
        lead ? "pl-1" : "pl-4",
      )}
    >
      {lead}
      {/* a second line rather than lost words beside a two-line Tamil pill, so a stop's title keeps its number */}
      <h1 className={cx("min-w-0 flex-1 text-asphalt-900 [overflow-wrap:anywhere]", root ? "t-h1" : "t-h2")}>
        {title}
      </h1>
      <DriverPill />
    </header>
  );
}

/* ------------------------------------------------------------------------------------------------- words */

/** A place in the reader's script; Latin letters (and the Latin face) where Relay has no translation. */
export function PlaceName({ name, className }: { name: string; className?: string }) {
  const { place } = useDriverText();
  const p = place(name);
  return <span className={cx(p.latin && "latin", className)}>{p.text}</span>;
}

export function GoodsChip({ temp }: { temp: DriverTrip["temp"] }) {
  const { t } = useDriverText();
  return temp === "chilled" ? (
    <StatusChip kind="chilled">{t("chip.chilled")}</StatusChip>
  ) : (
    <StatusChip tone="muted" icon={Box}>
      {t("chip.dry")}
    </StatusChip>
  );
}

/** Status chip / waiting to send, or sending while it goes. */
export function SendChip({ local }: { local: Pick<StopLocal, "waiting" | "sending"> }) {
  const { t } = useDriverText();
  const { batch } = useDriver();
  if (!local.waiting) return null;
  return local.sending || batch ? (
    <StatusChip kind="sending">{t("chip.sending")}</StatusChip>
  ) : (
    <StatusChip kind="waitingToSend">{t("chip.waiting")}</StatusChip>
  );
}

export const ACCESS_ICON: Record<string, LucideIcon> = {
  rear_dock: Warehouse,
  street: Store,
  mall_bay: Building2,
  van_only: Van,
};

export function accessIcon(stop: Pick<DriverStop, "dock_type" | "van_only">): LucideIcon {
  return stop.van_only ? Van : (ACCESS_ICON[stop.dock_type] ?? Store);
}

/* ------------------------------------------------------------------------------------------- trip and stops */

/** Step progress: one square-ended segment per stop; delivered, then the next stop in signal yellow, then to come. */
export function StepProgress({ trip, next }: { trip: DriverTrip; next: DriverStop | null }) {
  return (
    <div aria-hidden className="flex h-2 gap-1">
      {trip.stops.map((s) => (
        <span
          key={s.stop_id}
          className={cx(
            "flex-1",
            s.status === "delivered"
              ? "bg-done"
              : s.status === "failed"
                ? "bg-problem"
                : next?.stop_id === s.stop_id
                  ? "bg-signal-400"
                  : "bg-asphalt-200",
          )}
        />
      ))}
    </div>
  );
}

/** Window status line: opens soon, open, closing soon (under 30 minutes) or closed, counted to the minute. */
export function WindowLine({
  stop,
  runDate,
  now,
  short,
}: {
  stop: DriverStop;
  runDate: string;
  now: Date;
  /** DRV-02's wording under "Receiving window"; DRV-01 says "Window ..." */
  short?: boolean;
}) {
  const { t, duration, left, clock } = useDriverText();
  const w = windowState(runDate, stop.window_open, stop.window_close, now);
  const suffix = short ? "Short" : "";
  const line = {
    soon: { Icon: Timer, tone: "text-asphalt-900", text: t(`window.soon${suffix}`, { d: duration(w.minutes) }) },
    open: { Icon: CircleCheck, tone: "text-done", text: t(`window.open${suffix}`, { left: left(w.minutes) }) },
    closing: { Icon: Clock, tone: "text-attention", text: t(`window.closing${suffix}`, { d: duration(w.minutes) }) },
    closed: {
      Icon: TriangleAlert,
      tone: "text-problem",
      text: t(`window.closed${suffix}`, { time: clock(w.closesAt), d: duration(w.minutes) }),
    },
  }[w.state];
  return (
    <p className={cx("flex items-center gap-1.5", line.tone, short && w.state === "soon" ? "t-h2" : "t-body-strong")}>
      <line.Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
      <span>{line.text}</span>
    </p>
  );
}

/** Detail row / stacked / field: icon and label on one line, the value in Field title below. */
export function Detail({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <dt className="flex items-center gap-1.5 t-label text-asphalt-500">
        <Icon size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
        {label}
      </dt>
      <dd className="t-field text-asphalt-900">{value}</dd>
    </div>
  );
}

export function markerState(stop: DriverStop, next: DriverStop | null): MarkerState {
  if (stop.status === "delivered") return "delivered";
  if (stop.status === "failed") return "undelivered";
  if (stop.status === "moved" || stop.status === "cancelled") return "moved";
  return next?.stop_id === stop.stop_id ? "next" : "pending";
}

/** Next stop card / full: the largest thing on the run list, with the stop's window, both named times and the way
 *  in. Its main button is the screen's one primary unless something else (leaving the hub) is. */
export function NextStopCard({
  run,
  trip,
  stop,
  now,
  primary,
}: {
  run: DriverRun;
  trip: DriverTrip;
  stop: DriverStop;
  now: Date;
  primary: boolean;
}) {
  const { t, cases, storeName, windowOf, access, clock, expectedAt } = useDriverText();
  const navigate = useNavigate();
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-4 rounded-card border border-asphalt-300 bg-white p-5"
    >
      <div className="flex items-center gap-3">
        <StopMarker n={stop.seq} state="next" size={40} />
        <div className="min-w-0 flex-1">
          <p id={titleId} className="t-h3 text-asphalt-900">
            {t("card.next")}
          </p>
          <p className="t-label text-asphalt-500">
            {t("card.stopOf", { n: stop.seq, total: trip.stops.length, cases: cases(stop.cases) })}
          </p>
        </div>
        <GoodsChip temp={trip.temp} />
      </div>
      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1">
          <h2 className="t-display text-asphalt-900">
            <PlaceName name={stop.place} />
          </h2>
          <p className="t-body text-asphalt-700">
            {storeName(stop)} · <span className="latin">{stop.outlet_id}</span>
          </p>
        </div>
        <WindowLine stop={stop} runDate={run.run_date} now={now} />
      </div>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-4">
        <Detail
          icon={Clock}
          label={t("card.window")}
          value={windowOf(run.run_date, stop.window_open, stop.window_close)}
        />
        <Detail icon={accessIcon(stop)} label={t("card.unloadAt")} value={access(stop)} />
        <Detail icon={CalendarClock} label={t("card.planned")} value={clock(stop.planned)} />
        {stop.status === "arrived" && stop.arrived_at ? (
          <Detail icon={MapPin} label={t("card.arrived")} value={clock(stop.arrived_at)} />
        ) : stop.expected ? (
          <Detail icon={Timer} label={t("card.expected")} value={expectedAt(stop, now)} />
        ) : null}
      </dl>
      <div className="flex flex-col gap-2">
        <Button
          variant={primary ? "primary" : "secondary"}
          density="field"
          full
          iconAfter={ChevronRight}
          onClick={() => navigate(`/driver/stops/${stop.stop_id}`)}
        >
          {t("card.open", { n: stop.seq })}
        </Button>
        <Button
          variant="quiet"
          density="field"
          full
          icon={TriangleAlert}
          onClick={() => navigate(`/driver/report?stop=${stop.stop_id}`)}
        >
          {t("card.report")}
        </Button>
      </div>
    </section>
  );
}

/** The short chip for a stop with cases the dispatcher decided to send short: "6 rice and dhal cases short, store
 *  told". It grows in height rather than cut its words. */
export function ShortChip({ stop, long }: { stop: DriverStop; long?: boolean }) {
  const { t, caseItem } = useDriverText();
  const shortLines = stop.lines.filter((l) => l.short > 0);
  if (!shortLines.length) return null;
  return (
    <>
      {shortLines.map((l) => (
        <StatusChip key={l.case_type} kind="short" className="w-fit">
          {long
            ? t("chip.shortLong", { count: l.short, item: caseItem(l.case_type) })
            : t("chip.shortTold", { count: l.short })}
        </StatusChip>
      ))}
    </>
  );
}

/** Stop row / field on the run list: marker, place, what is known about it, and a way in. Stops after the next one
 *  show both named times; the next stop's times are on its card. */
export function StopRow({ run, stop, next }: { run: DriverRun; stop: DriverStop; next: DriverStop | null }) {
  const { t, clock, expectedAt, windowOf, access, place, caseItem } = useDriverText();
  const { items, batch, now } = useDriver();
  const local = stopLocal(items, stop.stop_id);
  const question = awaitingAnswer(run, items, stop.stop_id);
  const call = waitingForCall(run, items, stop.stop_id);
  const isNext = next?.stop_id === stop.stop_id;
  const toCome = stop.status === "pending" || stop.status === "arrived";
  const window = windowOf(run.run_date, stop.window_open, stop.window_close);
  const parked = toCome && (local.problem === "outlet_closed" || local.problem === "access_blocked");

  let meta = t("row.meta", { window, access: access(stop) });
  let tone = "t-body text-asphalt-700";
  let Icon: LucideIcon | null = null;
  const lines: string[] = [];
  if (stop.status === "delivered" && stop.completed_at) {
    meta = t("row.delivered", { time: clock(stop.completed_at) });
    tone = "t-body-strong text-done";
    Icon = Check;
  } else if (stop.status === "failed") {
    meta = t("row.failed");
    tone = "t-body-strong text-problem";
    Icon = X;
  } else if (stop.status === "cancelled") {
    meta = t("row.cancelled");
  } else if (stop.status === "arrived" && stop.arrived_at) {
    meta = t("row.arrived", { time: clock(stop.arrived_at), access: access(stop) });
    tone = "t-body-strong text-asphalt-900";
  } else if (isNext) {
    meta = t("row.next", { window, access: access(stop) });
    tone = "t-body-strong text-asphalt-900";
  } else if (stop.status === "pending") {
    lines.push(t("row.planned", { time: clock(stop.planned) }));
    if (stop.expected) lines.push(t("row.expected", { time: expectedAt(stop, now) }));
  }

  const chips: { key: string; text: string; node: ReactNode }[] = [];
  if (toCome) {
    for (const l of stop.lines.filter((x) => x.short > 0)) {
      const text = t("chip.shortLong", { count: l.short, item: caseItem(l.case_type) });
      chips.push({ key: `short-${l.case_type}`, text, node: <StatusChip kind="short">{text}</StatusChip> });
    }
  }
  if (stop.status === "moved" && stop.moved_to) {
    const text = t("chip.movedTo", { vehicle: stop.moved_to });
    chips.push({
      key: "moved",
      text,
      node: (
        <StatusChip tone="neutral" icon={Van}>
          {text}
        </StatusChip>
      ),
    });
  }
  if (parked) {
    const text = t("chip.problem");
    chips.push({ key: "problem", text, node: <StatusChip kind="edited">{text}</StatusChip> });
  }
  if (question) {
    const text = t("chip.needsAnswer");
    chips.push({ key: "question", text, node: <StatusChip kind="needsAnswer">{text}</StatusChip> });
  }
  if (call) {
    const name = calledName(run.dispatcher);
    const text = name ? t("chip.waitingFor", { name }) : t("chip.waitingForNoName");
    chips.push({
      key: "call",
      text,
      node: (
        <StatusChip tone="attention" icon={Phone}>
          {text}
        </StatusChip>
      ),
    });
  }
  if (local.waiting) {
    const text = local.sending || batch ? t("chip.sending") : t("chip.waiting");
    chips.push({ key: "send", text, node: <SendChip local={local} /> });
  }
  // read aloud as one sentence: the dots between the parts become pauses, not words
  const label = [t("row.label", { n: stop.seq, place: place(stop.place).text }), meta, ...lines]
    .concat(chips.map((c) => c.text))
    .join(", ")
    .replaceAll(" · ", ", ");

  return (
    <Link
      to={`/driver/stops/${stop.stop_id}`}
      aria-label={label}
      className="flex min-h-16 items-center gap-3 px-4 py-2.5 hover:bg-asphalt-50"
    >
      <StopMarker n={stop.seq} state={markerState(stop, next)} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <PlaceName name={stop.place} className="t-field text-asphalt-900" />
        <span className={cx("flex items-center gap-1", tone)}>
          {Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden className="shrink-0" /> : null}
          {meta}
        </span>
        {lines.map((line) => (
          <span key={line} className="t-label text-asphalt-500">
            {line}
          </span>
        ))}
        {chips.length ? (
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {chips.map((c) => (
              <span key={c.key} className="max-w-full">
                {c.node}
              </span>
            ))}
          </span>
        ) : null}
      </div>
      <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-500" />
    </Link>
  );
}

/* --------------------------------------------------------------------------------------------------- inputs */

/** Choice chip / 48 or 56: single or multiple choice, with a check on the chosen one. */
export function ChoiceChip({
  selected,
  onClick,
  children,
  tall,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  tall?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center gap-2 rounded-button px-3 text-center",
        tall ? "min-h-14 t-field-button" : "min-h-12 t-body-strong",
        selected
          ? "border-2 border-petrol-700 bg-petrol-50 text-petrol-700"
          : "border border-asphalt-300 bg-white text-asphalt-900",
        className,
      )}
    >
      {selected ? <Check size={20} strokeWidth={1.75} aria-hidden className="shrink-0" /> : null}
      {children}
    </button>
  );
}

/** Input / segmented control / field: two separate segments, 48 high, 8 apart. Named by the heading above it when
 *  there is one (`labelledBy`), so the name is not read twice. */
export function TwoSegments<T extends string>({
  value,
  options,
  onChange,
  label,
  labelledBy,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
  labelledBy?: string;
}) {
  return (
    <fieldset aria-labelledby={labelledBy} className="m-0 grid min-w-0 grid-cols-2 gap-2 border-0 p-0">
      {labelledBy ? null : <legend className="sr-only">{label}</legend>}
      {options.map((o) => {
        const selected = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={cx(
              "flex min-h-12 items-center justify-center gap-2 rounded-button px-3 text-center t-field-button",
              selected
                ? "border-[1.5px] border-petrol-700 bg-petrol-50 text-petrol-700"
                : "border border-asphalt-300 bg-white text-asphalt-900",
            )}
          >
            {selected ? <Check size={20} strokeWidth={1.75} aria-hidden className="shrink-0" /> : null}
            {o.label}
          </button>
        );
      })}
    </fieldset>
  );
}

/** Input / number stepper / field, 152 by 48: plus stops at what was on the truck. */
export function FieldStepper({
  value,
  max,
  onChange,
  fewer,
  more,
}: {
  value: number;
  max: number;
  onChange: (value: number) => void;
  fewer: string;
  more: string;
}) {
  const side =
    "flex w-12 shrink-0 items-center justify-center bg-white text-asphalt-900 disabled:bg-asphalt-100 disabled:text-asphalt-500";
  return (
    <div className="inline-flex h-12 w-[152px] shrink-0 items-stretch overflow-hidden rounded-button outline outline-1 -outline-offset-1 outline-asphalt-300">
      <button
        type="button"
        aria-label={fewer}
        disabled={value <= 0}
        onClick={() => onChange(value - 1)}
        className={side}
      >
        <Minus size={24} strokeWidth={1.75} aria-hidden />
      </button>
      <output aria-live="polite" className="num flex flex-1 items-center justify-center bg-white t-h1">
        {value}
      </output>
      <button
        type="button"
        aria-label={more}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        className={side}
      >
        <Plus size={24} strokeWidth={1.75} aria-hidden />
      </button>
    </div>
  );
}

/** Input / text / field (56 high) or multiline (96 high), with its label above. */
export function TextField({
  label,
  value,
  onChange,
  placeholder,
  multiline,
  latin,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  /** People's names are typed in Latin letters. */
  latin?: boolean;
}) {
  const id = useId();
  const box =
    "w-full rounded-chip border border-asphalt-300 bg-white px-4 text-asphalt-900 placeholder:text-asphalt-500";
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="t-label text-asphalt-700">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          rows={3}
          maxLength={500}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cx(box, "min-h-24 py-3 t-body")}
        />
      ) : (
        <input
          id={id}
          value={value}
          maxLength={64}
          autoComplete="off"
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          className={cx(box, "h-14 t-field", latin && "latin")}
        />
      )}
    </div>
  );
}

/** A photo kept as a Blob, shown from an object URL that is let go when it changes. */
export function useBlobUrl(blob: Blob | null | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!blob) {
      setUrl(null);
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}

/** Photo capture tile: empty (dashed, "Take a photo") or captured (the photo with its time). The camera opens from a
 *  file input with capture="environment"; the photo is shrunk on the phone before it is kept. */
export function PhotoTile({
  blob,
  time,
  alt,
  take,
  help,
  onFile,
  inputRef,
}: {
  blob: Blob | null;
  time: string | null;
  alt: string;
  take: string;
  help: string;
  onFile: (file: File) => void;
  inputRef?: RefObject<HTMLInputElement | null>;
}) {
  const own = useRef<HTMLInputElement>(null);
  const ref = inputRef ?? own;
  const url = useBlobUrl(blob);
  const id = useId();
  const pick = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) onFile(file);
  };
  const input = (
    <input ref={ref} id={id} type="file" accept="image/*" capture="environment" className="sr-only" onChange={pick} />
  );
  if (url) {
    return (
      <div className="relative h-[200px] overflow-hidden rounded-card border border-asphalt-200 bg-asphalt-100">
        <img src={url} alt={alt} className="size-full object-cover" />
        {time ? (
          <span className="num absolute bottom-3 left-3 rounded-chip bg-asphalt-900 px-2 py-1 t-label text-white">
            {time}
          </span>
        ) : null}
        {input}
      </div>
    );
  }
  return (
    <label
      htmlFor={id}
      className="flex h-40 cursor-pointer flex-col items-center justify-center gap-2 rounded-card border-[1.5px] border-dashed border-asphalt-300 bg-white px-4 text-center hover:bg-asphalt-50"
    >
      <Camera size={32} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
      <span className="t-field text-asphalt-900">{take}</span>
      <span className="t-label text-asphalt-500">{help}</span>
      {input}
    </label>
  );
}

/** Confirmation panel: the big check, a title and what happens next. */
export function ConfirmPanel({ title, children }: { title: ReactNode; children: ReactNode }) {
  return (
    <section
      role="status"
      className="flex flex-col items-center gap-2 rounded-card border border-asphalt-200 bg-white p-6 text-center"
    >
      <span className="mb-1 flex size-16 items-center justify-center rounded-full bg-done-soft">
        <CircleCheck size={32} strokeWidth={1.75} aria-hidden className="text-done" />
      </span>
      <h1 className="t-h1 text-asphalt-900">{title}</h1>
      <p className="t-body text-asphalt-700">{children}</p>
    </section>
  );
}

/** "081 000 2145" as a number to dial: digits only, with a leading + kept for an international number. */
function telLink(phone: string): string {
  return `tel:${phone.trim().replace(/(?!^\+)[^\d]/g, "")}`;
}

/** "Call Nuwan at dispatch": a tel: link drawn as a field button. Quiet and left-aligned under the report list, the
 *  primary when the truck cannot move. */
export function CallButton({ phone, primary, children }: { phone: string; primary?: boolean; children: ReactNode }) {
  return (
    <a
      href={telLink(phone)}
      className={cx(
        "inline-flex w-full items-center gap-2 rounded-button px-4 t-field-button transition-colors select-none",
        primary
          ? "min-h-14 justify-center bg-petrol-700 py-2 text-center text-white hover:bg-petrol-800 active:bg-petrol-800"
          : "min-h-12 justify-start py-1.5 text-asphalt-900 hover:bg-asphalt-100",
      )}
    >
      <Phone size={24} strokeWidth={1.75} aria-hidden className="shrink-0" />
      {children}
    </a>
  );
}

/** One helper line beside the main button, in place of a banner on task screens. */
export function Helper({ icon: Icon, children }: { icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 t-label text-asphalt-700">
      <Icon size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** Section title row: Heading 2 with an optional thing on the right. */
export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2 className="t-h2 text-asphalt-900">{children}</h2>
      {right}
    </div>
  );
}
