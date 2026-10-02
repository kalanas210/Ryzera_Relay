import {
  Calendar,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Info,
  ListChecks,
  Lock,
  type LucideIcon,
  Package,
  Snowflake,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { meterState } from "@/design/Meter";
import { Notice } from "@/design/Notice";
import { StatusChip } from "@/design/StatusChip";
import { cx } from "@/lib/cx";
import { DeskHeader, useDepot } from "../DispatcherShell";
import {
  type BusiestDay,
  type FleetState,
  type KeyFigure,
  type Outlook,
  type OutlookDay,
  type OutlookDepot,
  type OutlookWeek,
  useOutlook,
} from "./api";
import { decimal, ordersCaption, STATE_WORD, shortDay, weekRange } from "./format";

const STATE_TEXT: Record<FleetState, string> = {
  over: "text-problem",
  limit: "text-attention",
  within: "text-petrol-700",
};
const STATE_FILL: Record<FleetState, string> = { over: "bg-problem", limit: "bg-attention", within: "bg-petrol-700" };
const STATE_EDGE: Record<FleetState, string> = {
  over: "border-problem",
  limit: "border-attention",
  within: "border-petrol-700",
};
const TONE_BAR: Record<FleetState, string> = {
  over: "border-l-problem",
  limit: "border-l-attention",
  within: "border-l-petrol-700",
};
const FIGURE_TEXT: Record<KeyFigure["tone"], string> = {
  attention: "text-attention",
  problem: "text-problem",
  neutral: "text-asphalt-900",
};
const SPACE_BAR = { normal: "bg-petrol-700", near: "bg-attention", over: "bg-problem" };
const SPACE_TEXT = { normal: "text-asphalt-900", near: "text-attention", over: "text-problem" };
/**
 * The frame's columns are 290 and six of 169. A desk with a classic scrollbar first takes 2.5 from each week, which
 * keeps every row label on one line; past that the label column gives way, down to 200, before the weeks narrow.
 */
const WEEK_KEEP = 166.5;

/** DSP-05 Capacity outlook: six weeks ahead, when the depot will need every refrigerated vehicle it has. */
export function OutlookPage() {
  const [depotParam, setDepot] = useDepot("Kandy");
  const depot: OutlookDepot = depotParam === "Peliyagoda" ? "Peliyagoda" : "Kandy";
  const { data, isError } = useOutlook(depot);

  useEffect(() => {
    if (depotParam === "All") setDepot("Kandy");
  }, [depotParam, setDepot]);

  const header = (meta?: ReactNode) => (
    <DeskHeader
      title="Capacity outlook"
      meta={meta}
      depot={depot}
      onDepot={setDepot}
      allowAll={false}
      allTitle="The outlook is made one depot at a time, because each vehicle serves only its home depot."
    />
  );

  if (!data) {
    return (
      <>
        {header()}
        <div className="p-4 md:px-6">
          {isError ? (
            <Notice tone="info" role="status">
              Relay can't reach the outlook right now. It tries again every 30 seconds.
            </Notice>
          ) : (
            <p className="t-dense text-asphalt-500">Loading the outlook</p>
          )}
        </div>
      </>
    );
  }
  if (data.empty || !data.labels) {
    return (
      <>
        {header(`${data.depot_label} · no forecast yet`)}
        <div className="p-4 md:px-6">
          <Notice tone="info">{data.empty}</Notice>
        </div>
      </>
    );
  }

  const first = data.weeks[0]!;
  const last = data.weeks.at(-1)!;
  const updated = data.forecast_updated ? ` · forecast updated ${shortDay(data.forecast_updated)}` : "";
  return (
    <>
      {header(`${data.depot_label} · weeks ${first.iso_week} to ${last.iso_week}${updated}`)}
      <div className="flex min-w-0 flex-col gap-3 p-4 md:px-6 md:pt-4 md:pb-6">
        <AnswerCard data={data} />
        <OutlookGrid data={data} className="max-xl:hidden" />
        <WeekList data={data} className="xl:hidden" />
        <ArrangeCard data={data} />
        <Method paragraphs={data.method} />
      </div>
    </>
  );
}

function AnswerCard({ data }: { data: Outlook }) {
  const headline = data.headline;
  if (!headline) return null;
  const Icon = headline.state === "within" ? CircleCheck : CircleAlert;
  return (
    <section
      aria-label="Answer"
      className={cx(
        "flex flex-wrap items-center gap-x-6 gap-y-3 rounded-card border border-asphalt-200 border-l-4 bg-white py-3 pr-5 pl-6",
        TONE_BAR[headline.state],
      )}
    >
      <div className="flex min-w-0 flex-[1_1_420px] items-start gap-3 xl:max-w-[760px]">
        <Icon size={20} strokeWidth={1.75} aria-hidden className={cx("mt-1 shrink-0", STATE_TEXT[headline.state])} />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="t-h2">{headline.title}</h2>
          <p className="t-dense">{headline.detail}</p>
          <p className="num t-dense text-asphalt-700">{headline.support}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-6">
        {data.key_figures.map((f) => (
          <div key={f.label} className="w-[196px] max-sm:w-full">
            <p className={cx("num t-h2", FIGURE_TEXT[f.tone])}>{f.value}</p>
            <p className="t-label text-asphalt-700">{f.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------------------------------------ the grid
export function OutlookGrid({ data, className }: { data: Outlook; className?: string }) {
  const weeks = data.weeks;
  const labels = data.labels!;
  const columns = weeks.length;
  const lead = weeks.findIndex((w) => w.busiest?.headline);
  // one week's days at a time: the pointer's week, else the focused one, until Escape puts them away
  const [hovered, setHovered] = useState<number | null>(null);
  const [focused, setFocused] = useState<number | null>(null);
  const [shut, setShut] = useState(false);
  const open = shut ? null : (hovered ?? focused);

  useEffect(() => {
    if (open === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShut(true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <section
      aria-label="Weeks ahead"
      className={cx("relative grid rounded-card border border-asphalt-200 bg-white", className)}
      style={{
        gridTemplateColumns: `clamp(200px, calc(100% - ${columns * WEEK_KEEP}px), 290px) repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      <div className="flex min-h-[120px] items-end border-b border-asphalt-200 px-4 py-2">
        <Legend />
      </div>
      {weeks.map((w, i) => (
        <WeekHeader
          key={w.iso_week}
          week={w}
          data={data}
          open={open === w.iso_week}
          alignEnd={i >= columns - 2}
          onHover={(on) => {
            setHovered(on ? w.iso_week : null);
            if (on) setShut(false);
          }}
          onFocus={(on) => {
            setFocused((was) => (on ? w.iso_week : was === w.iso_week ? null : was));
            if (on) setShut(false);
          }}
        />
      ))}

      <GroupRow>Forecast demand, m³ a week</GroupRow>
      <DemandRow
        label="Fresh chilled"
        icon={Snowflake}
        iconClass="text-chilled"
        values={weeks.map((w) => w.demand?.chilled)}
      />
      <DemandRow label="Fresh dry" icon={Package} values={weeks.map((w) => w.demand?.dry)} />
      <DemandRow label="Style" values={weeks.map((w) => w.demand?.style)} />
      <RowLabel title="Tech" sub={labels.tech} className="min-h-[38px]" />
      {weeks.map((w, i) => (
        <TechValue key={w.iso_week} value={w.demand?.tech} first={i === 0} last={i === columns - 1} />
      ))}
      <DemandRow label="All brands" strong values={weeks.map((w) => w.demand?.all)} />

      <GroupRow>{labels.fleet}</GroupRow>
      <RowLabel title="Chilled space, m³" sub="One load per refrigerated vehicle per open day" className="min-h-12" />
      {weeks.map((w) => (
        <div key={w.iso_week} className="flex min-h-12 items-center px-2.5">
          <SpaceMeter week={w} />
        </div>
      ))}
      <RowLabel title="Refrigerated vehicles needed" sub={labels.vehicles} className="min-h-20 justify-start pt-2.5" />
      {weeks.map((w) => (
        <div key={w.iso_week} className="min-h-20 px-2.5 pt-2.5">
          {w.busiest ? <VehiclesMeter day={w.busiest} /> : <Missing />}
        </div>
      ))}
      <RowLabel title="Chilled on that day, kg" sub={labels.day} className="min-h-12" />
      {weeks.map((w) => (
        <div key={w.iso_week} className="flex min-h-12 flex-col items-end justify-center px-3 py-1">
          {w.busiest ? <ChilledKg day={w.busiest} /> : <Missing />}
        </div>
      ))}

      {lead >= 0 && data.headline ? (
        // placed by its column only: with no row lines an absolutely placed item spans the grid's full height
        <div
          aria-hidden
          className={cx(
            "pointer-events-none absolute inset-0.5 rounded-[8px] border-[1.5px]",
            STATE_EDGE[data.headline.state],
          )}
          style={{ gridColumn: `${lead + 2} / span 1` }}
        />
      ) : null}
    </section>
  );
}

function Legend() {
  const items: [string, string][] = [
    ["bg-petrol-700", "Within capacity"],
    ["bg-attention", "At the limit"],
    ["bg-problem", "Over capacity"],
  ];
  return (
    <ul aria-label="Legend" className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map(([swatch, label]) => (
        <li key={label} className="inline-flex items-center gap-1.5 t-caption text-asphalt-700">
          <span aria-hidden className={cx("h-1.5 w-4 rounded-full", swatch)} />
          {label}
        </li>
      ))}
    </ul>
  );
}

/** A week's header. Hovering or focusing it shows the week's open days; the grid keeps one open at a time. */
function WeekHeader({
  week,
  data,
  open,
  alignEnd,
  onHover,
  onFocus,
}: {
  week: OutlookWeek;
  data: Outlook;
  open: boolean;
  alignEnd: boolean;
  onHover: (on: boolean) => void;
  onFocus: (on: boolean) => void;
}) {
  const id = useId();
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: hover only widens what focus on the button already shows
    <div
      className="relative border-b border-asphalt-200"
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <button
        type="button"
        aria-describedby={id}
        onFocus={() => onFocus(true)}
        onBlur={() => onFocus(false)}
        onClick={() => onFocus(true)}
        className="flex h-full w-full flex-col items-start gap-0.5 px-2.5 py-2 text-left hover:bg-asphalt-50 focus-visible:bg-asphalt-50"
      >
        <WeekTitle week={week} hint />
      </button>
      <div
        id={id}
        role="tooltip"
        hidden={!open}
        className={cx("absolute top-full z-20 w-[340px] pt-1", alignEnd ? "right-0" : "left-0")}
      >
        <div className="rounded-card border border-asphalt-200 bg-white p-3 shadow-float">
          <p className="t-label-strong">Week {week.iso_week}, chilled by open day</p>
          <DaysTable week={week} data={data} />
        </div>
      </div>
    </div>
  );
}

/** A week's name, dates and calendar. `hint` marks the name as the way to the week's days, as on the grid. */
function WeekTitle({ week, hint }: { week: OutlookWeek; hint?: boolean }) {
  return (
    <>
      <span className="flex w-full flex-wrap items-baseline justify-between gap-x-1.5">
        <span
          className={cx(
            "t-h3 whitespace-nowrap",
            hint && "underline decoration-asphalt-300 decoration-dotted underline-offset-4",
          )}
        >
          Week {week.iso_week}
        </span>
        <span className="num t-caption whitespace-nowrap text-asphalt-500">{week.open_days} open days</span>
      </span>
      <span className="num t-caption text-asphalt-500">{weekRange(week.first_day, week.last_day)}</span>
      {week.chip ? (
        <StatusChip
          density="desk"
          tone={week.chip.tone === "attention" ? "attention" : "muted"}
          icon={week.chip.tone === "attention" ? Calendar : Lock}
          className="whitespace-nowrap"
        >
          {week.chip.label}
        </StatusChip>
      ) : null}
      {week.lines.map((line) => (
        <span key={line} className="num t-caption text-asphalt-700">
          {line}
        </span>
      ))}
    </>
  );
}

/** Each open day of a week: chilled orders, kg, and refrigerated vehicles needed of those in service. */
function DaysTable({ week, data }: { week: OutlookWeek; data: Outlook }) {
  return (
    <table className="mt-2 w-full t-label">
      <thead className="t-caption text-asphalt-500">
        <tr className="text-left">
          <th className="pb-1 font-medium">Day</th>
          <th className="pb-1 text-right font-medium">Orders</th>
          <th className="pb-1 text-right font-medium">kg</th>
          <th className="pb-1 pl-3 font-medium">Needed</th>
        </tr>
      </thead>
      <tbody>
        {week.days.map((d) => (
          <DayRow key={d.date} day={d} busiest={week.busiest?.date === d.date} before={d.date < data.run_date} />
        ))}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={4} className="pt-2 t-caption text-asphalt-500">
            {week.days.some((d) => d.from_order_book) ? `${data.labels?.day}.` : "Forecast."}{" "}
            {week.busiest ? "The busiest day is in bold." : ""}
          </td>
        </tr>
      </tfoot>
    </table>
  );
}

function DayRow({ day, busiest, before }: { day: OutlookDay; busiest: boolean; before: boolean }) {
  const state = day.state === "within" ? "" : `, ${STATE_WORD[day.state].toLowerCase()}`;
  const most = busiest ? ", the busiest day this week" : "";
  return (
    <tr
      aria-label={`${shortDay(day.date)}: ${day.chilled_orders} chilled orders, ${decimal(day.chilled_kg)} kg, needs ${day.needed} of ${day.available}${state}${most}.`}
      className={cx("h-7 border-t border-asphalt-100", busiest && "t-label-strong", before && "text-asphalt-500")}
    >
      <td className="num whitespace-nowrap">{shortDay(day.date)}</td>
      <td className="num text-right">{day.chilled_orders}</td>
      <td className="num text-right">{decimal(day.chilled_kg)}</td>
      <td className="num pl-3 whitespace-nowrap">
        {day.needed} of {day.available}
        {day.state === "within" ? null : <span className={STATE_TEXT[day.state]}> {STATE_WORD[day.state]}</span>}
      </td>
    </tr>
  );
}

function GroupRow({ children }: { children: ReactNode }) {
  return (
    <div className="col-span-full flex h-[26px] items-center bg-asphalt-50 px-4 t-caption font-semibold text-asphalt-700">
      {children}
    </div>
  );
}

function RowLabel({ title, sub, className }: { title: string; sub?: string; className?: string }) {
  return (
    <div className={cx("flex flex-col justify-center px-4", className)}>
      <span className="t-dense">{title}</span>
      {sub ? <span className="t-caption text-asphalt-500">{sub}</span> : null}
    </div>
  );
}

function DemandRow({
  label,
  icon: Icon,
  iconClass,
  values,
  strong,
}: {
  label: string;
  icon?: LucideIcon;
  iconClass?: string;
  values: (number | undefined)[];
  strong?: boolean;
}) {
  const line = strong ? "border-t border-asphalt-300 t-dense-strong" : "t-dense";
  return (
    <>
      <div className={cx("flex h-7 items-center gap-2 px-4", line)}>
        {Icon ? <Icon size={16} strokeWidth={1.75} aria-hidden className={iconClass ?? "text-asphalt-500"} /> : null}
        {label}
      </div>
      {values.map((v, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: one cell per week, in week order
        <Value key={i} value={v} className={cx("h-7", line)} />
      ))}
    </>
  );
}

function Value({ value, className }: { value: number | undefined; className?: string }) {
  return (
    <div className={cx("num flex items-center justify-end px-3 t-dense", className)}>
      {value === undefined ? <Missing /> : decimal(value)}
    </div>
  );
}

/** The Tech values sit on one band across the weeks: a single Tech order can be most of a week's volume. */
function TechValue({ value, first, last }: { value: number | undefined; first: boolean; last: boolean }) {
  return (
    <div className="relative">
      <span
        aria-hidden
        className={cx(
          "absolute inset-y-[7px] bg-asphalt-100",
          first ? "left-2 rounded-l-chip" : "left-0",
          last ? "right-2 rounded-r-chip" : "right-0",
        )}
      />
      <Value value={value} className="relative min-h-[38px]" />
    </div>
  );
}

function Missing() {
  return <span className="t-caption text-asphalt-500">No forecast</span>;
}

/** Capacity meter / compact vertical: chilled m³ against one load per refrigerated vehicle per open day. */
function SpaceMeter({ week }: { week: OutlookWeek }) {
  const limit = week.chilled_limit_m3;
  if (!week.demand || limit === null || week.chilled_pct === null) return <Missing />;
  const state = meterState(week.demand.chilled, limit, "volume");
  return (
    <div className="w-full max-w-[136px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-1">
        <span className={cx("num t-label-strong whitespace-nowrap", SPACE_TEXT[state])}>
          {decimal(week.demand.chilled)} of {decimal(limit)}
        </span>
        <span className="num t-caption text-asphalt-500">{decimal(week.chilled_pct)}%</span>
      </div>
      {/* biome-ignore lint/a11y/useSemanticElements: the native meter can't take the design's three states reliably */}
      <div
        role="meter"
        aria-valuenow={week.demand.chilled}
        aria-valuemin={0}
        aria-valuemax={limit}
        aria-label={`Chilled space, week ${week.iso_week}`}
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-asphalt-100"
      >
        <div
          className={cx("h-full rounded-full", SPACE_BAR[state])}
          style={{ width: `${Math.min(100, week.chilled_pct)}%` }}
        />
      </div>
    </div>
  );
}

/** Capacity meter / vehicles: one segment per refrigerated vehicle at the depot. */
function VehiclesMeter({ day }: { day: BusiestDay }) {
  const s = day.segments;
  const segments = [
    ...Array<string>(s.filled).fill(STATE_FILL[day.state]),
    ...Array<string>(s.short).fill("border border-problem bg-problem-soft"),
    ...Array<string>(s.standby).fill(cx("border bg-white", STATE_EDGE[day.state])),
    ...Array<string>(s.workshop).fill("bg-asphalt-100"),
  ];
  // the vehicles, not the segments: a workshop segment stands only for the vehicles nobody needs
  const said = [
    `${day.needed} needed`,
    `${day.available} in service`,
    s.short ? `${s.short} short` : "",
    s.standby ? `${s.standby} on standby` : "",
    day.in_workshop.length ? `${day.in_workshop.length} in the workshop` : "",
  ].filter(Boolean);
  return (
    <div className="w-full max-w-[136px]">
      <div className="flex flex-wrap items-baseline justify-between gap-x-1">
        <span className="num t-label-strong">
          {day.needed} of {day.available}
        </span>
        <span className={cx("t-caption", STATE_TEXT[day.state])}>{STATE_WORD[day.state]}</span>
      </div>
      <div role="img" aria-label={said.join(", ")} className="mt-1.5 flex gap-1">
        {segments.map((segment, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: segments have no identity beyond their place
          <span key={i} className={cx("h-1.5 w-4 rounded-full", segment)} />
        ))}
      </div>
      <p className="num mt-1.5 t-caption text-asphalt-700">{shortDay(day.date)}</p>
      {day.in_workshop.length ? (
        <p className="num t-caption text-asphalt-500">{day.in_workshop.length} in the workshop</p>
      ) : null}
    </div>
  );
}

function ChilledKg({ day }: { day: BusiestDay }) {
  return (
    <>
      <span className="num t-dense">{decimal(day.chilled_kg)}</span>
      <span className="num t-caption text-asphalt-500">
        {ordersCaption(day.chilled_orders, day.waits, day.headline)}
      </span>
    </>
  );
}

// ------------------------------------------------------------------------------------------------ narrow screens
/** Below the desk width the weeks stack, each with its own numbers and its days a tap away. */
function WeekList({ data, className }: { data: Outlook; className?: string }) {
  return (
    <section aria-label="Weeks ahead" className={cx("grid gap-3 md:grid-cols-2 lg:grid-cols-3", className)}>
      {data.weeks.map((w) => (
        <WeekCard key={w.iso_week} week={w} data={data} />
      ))}
    </section>
  );
}

function WeekCard({ week, data }: { week: OutlookWeek; data: Outlook }) {
  const busiest = week.busiest;
  const demand = week.demand;
  const rows: [string, number | undefined][] = [
    ["Fresh chilled", demand?.chilled],
    ["Fresh dry", demand?.dry],
    ["Style", demand?.style],
    ["Tech", demand?.tech],
  ];
  return (
    <article
      className={cx(
        "flex flex-col gap-3 rounded-card bg-white p-4",
        busiest?.headline && data.headline
          ? cx("border-[1.5px]", STATE_EDGE[data.headline.state])
          : "border border-asphalt-200",
      )}
    >
      <div className="flex flex-col items-start gap-1">
        <WeekTitle week={week} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="t-caption text-asphalt-500">Refrigerated vehicles needed</p>
          {busiest ? <VehiclesMeter day={busiest} /> : <Missing />}
        </div>
        <div>
          <p className="t-caption text-asphalt-500">Chilled on that day, kg</p>
          {busiest ? (
            <div className="flex flex-col">
              <ChilledKg day={busiest} />
            </div>
          ) : (
            <Missing />
          )}
        </div>
      </div>
      <div>
        <p className="t-caption text-asphalt-500">Chilled space, m³</p>
        <SpaceMeter week={week} />
      </div>
      <dl className="t-dense">
        <p className="t-caption text-asphalt-500">Forecast demand, m³ a week</p>
        {rows.map(([label, value]) => (
          <div key={label} className="flex h-7 items-center justify-between">
            <dt className="text-asphalt-700">{label}</dt>
            <dd className="num">{value === undefined ? <Missing /> : decimal(value)}</dd>
          </div>
        ))}
        <div className="flex h-7 items-center justify-between border-t border-asphalt-300 t-dense-strong">
          <dt>All brands</dt>
          <dd className="num">{demand ? decimal(demand.all) : <Missing />}</dd>
        </div>
      </dl>
      {week.days.length ? (
        <details className="group">
          <summary className="flex cursor-pointer list-none items-center gap-1.5 t-label-strong text-petrol-700 [&::-webkit-details-marker]:hidden">
            <ChevronDown
              size={16}
              strokeWidth={1.75}
              aria-hidden
              className="transition-transform group-open:rotate-180"
            />
            Open days
          </summary>
          <DaysTable week={week} data={data} />
        </details>
      ) : null}
    </article>
  );
}

// ------------------------------------------------------------------------------------------------ below the grid
function ArrangeCard({ data }: { data: Outlook }) {
  return (
    <section className="flex flex-wrap gap-x-8 gap-y-4 rounded-card border border-asphalt-200 bg-white px-5 py-3">
      <div className="min-w-0 flex-[1_1_420px] xl:grow-0 xl:basis-[700px]">
        <h2 className="flex items-center gap-2 t-h3">
          <ListChecks size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
          What to arrange
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {data.arrange.map((line) => (
            <li key={line} className="flex items-start gap-2 t-dense">
              <CircleDot size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-700" />
              {line}
            </li>
          ))}
        </ul>
      </div>
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-2">
        {data.notes.map((note) => (
          <p key={note} className="flex items-start gap-2 t-caption text-asphalt-700">
            <Info size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-500" />
            <span className="num">{note}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

function Method({ paragraphs }: { paragraphs: string[] }) {
  if (!paragraphs.length) return null;
  return (
    <details className="group rounded-card border border-asphalt-200 bg-white">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-card px-5 py-3 t-label-strong text-asphalt-900 [&::-webkit-details-marker]:hidden">
        <ChevronDown size={16} strokeWidth={1.75} aria-hidden className="transition-transform group-open:rotate-180" />
        How these numbers are made
      </summary>
      <div className="flex max-w-[960px] flex-col gap-2 px-5 pb-4 t-dense text-asphalt-700">
        {paragraphs.map((p) => (
          <p key={p} className="num">
            {p}
          </p>
        ))}
        <p className="max-xl:hidden">Hovering a week shows its days.</p>
      </div>
    </details>
  );
}
