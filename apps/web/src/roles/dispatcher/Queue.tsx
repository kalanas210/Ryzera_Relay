import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Clock,
  Lock,
  Phone,
  Send,
  Snowflake,
  Warehouse,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { api } from "@/api/client";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { ErrorState } from "@/design/ErrorState";
import { StatusChip } from "@/design/StatusChip";
import { cx } from "@/lib/cx";
import {
  dayOf,
  formatDayLong,
  formatDuration,
  formatTime,
  formatWeekday,
  formatWindow,
  kg,
  kgValue,
  m3,
  m3Value,
} from "@/lib/time";
import { type Depot, DeskHeader, useDepot } from "./DispatcherShell";

type Flag = { kind: "waited" | "van_only" | "large_truck" | "truck_only" | "mall"; label: string };
type Row = {
  id: string;
  order_ref: string;
  outlet_id: string;
  outlet_name: string;
  short_name: string;
  depot: string;
  district: string;
  brand: string;
  temp: string;
  units: number;
  weight_kg: number;
  volume_m3: number;
  window_open: string;
  window_close: string;
  placed_at: string;
  status: string;
  flags: Flag[];
};
export type Queue = {
  run_date: string;
  now: string;
  cutoff: string;
  locked: boolean;
  orders: Row[];
  late: (Row & { moved_to: string; store_told_at: string | null })[];
  not_ordered: {
    outlet_id: string;
    outlet_name: string;
    short_name: string;
    depot: string;
    temps: string[];
    pattern: string;
    /** The last Remind for this run. */
    reminded_at: string | null;
    /** The store manager's number: Call shows only when the store's record has one. */
    phone: string | null;
  }[];
  fresh_outlets_expected: number;
  fresh_outlets_ordered: number;
  chilled: {
    depot: string;
    orders: number;
    weight_kg: number;
    volume_m3: number;
    reefers_free: number;
    reefers_total: number;
    in_workshop: string[];
  }[];
};

type Tab = "all" | "dry" | "chilled" | "style" | "tech";
const TABS: { key: Tab; label: string; match: (r: Row) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "dry", label: "Fresh dry", match: (r) => r.brand === "Fresh" && r.temp === "ambient" },
  { key: "chilled", label: "Fresh chilled", match: (r) => r.temp === "chilled" },
  { key: "style", label: "Style", match: (r) => r.brand === "Style" },
  { key: "tech", label: "Tech", match: (r) => r.brand === "Tech" },
];
const DEPOT_LABEL: Record<string, string> = { Peliyagoda: "Peliyagoda", Kandy: "Kandy hub" };
const FLAG_CHIP = {
  waited: "waited",
  van_only: "vanOnly",
  large_truck: "truck",
  truck_only: "truck",
  mall: "mall",
} as const;

export function useQueue() {
  return useQuery({
    queryKey: ["dispatch", "queue"],
    queryFn: ({ signal }) => api.get<Queue>("/api/dispatch/queue", { role: "dispatcher", signal }),
    refetchInterval: 10_000,
  });
}

/** Remind and Remind all: a notice in each store's Relay app with the cutoff. Answers with the stores reminded. */
function useRemind() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (outletIds: string[]) =>
      api.post<{ outlet_id: string; reminded_at: string }[]>(
        "/api/dispatch/reminders",
        { outlet_ids: outletIds },
        { role: "dispatcher" },
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: ["dispatch", "queue"] }),
  });
}

/** Relay sends a store one reminder in any 10 minutes; Remind again in that time would send nothing new. */
const REMIND_AGAIN_MS = 10 * 60_000;

// The spec's columns (Order 92, Outlet 176, Type 84, Cases 48, kg 64, m³ 60, Window 140), each with the 8 px gap
// before it, 16 px at the card's edge and an 8 px spacer before Window, so neighbouring numbers never touch.
const COL = {
  order: "w-[108px] pl-4",
  outlet: "w-[184px] pl-2",
  type: "w-[92px] pl-2",
  cases: "w-14 pl-2 text-right",
  kg: "w-[72px] pl-2 text-right",
  m3: "w-[68px] pl-2 text-right",
  window: "w-[156px] pl-4",
  flags: "pl-2 pr-4",
} as const;

/** DSP-01 Order queue: every order for tomorrow as it arrives, with the facts that limit how it travels. */
export function QueuePage() {
  const { data, errorUpdateCount, refetch, isFetching } = useQueue();
  const [depot, setDepot] = useDepot();
  const [tab, setTab] = useState<Tab>("all");
  const now = useSimNow(15_000);
  const navigate = useNavigate();

  const visible = useMemo(
    () => (data?.orders ?? []).filter((r) => depot === "All" || r.depot === depot),
    [data, depot],
  );

  // once a load has failed, the error stays until the queue arrives: a query with no data goes back to pending each
  // time it fetches again, so the error alone would flash away on every try
  if (!data && errorUpdateCount > 0) {
    return (
      <>
        <DeskHeader title="Order queue" depot={depot} onDepot={setDepot} />
        <div className="p-4 md:px-6">
          <ErrorState
            title="Relay could not load the order queue."
            onRetry={() => void refetch()}
            retrying={isFetching}
          >
            Relay tries again every 10 seconds.
          </ErrorState>
        </div>
      </>
    );
  }
  if (!data || !now) return <DeskHeader title="Order queue" />;

  const day = dayOf(data.run_date);
  const weekday = formatWeekday(day);
  const locked = now >= new Date(data.cutoff);
  const minutesLeft = (new Date(data.cutoff).getTime() - now.getTime()) / 60_000;
  const byDepot = (d: string) => data.orders.filter((o) => o.depot === d).length;
  const count = (t: Tab) => visible.filter(TABS.find((x) => x.key === t)!.match).length;
  const rows = visible.filter(TABS.find((x) => x.key === tab)!.match);
  const workshop = data.chilled.filter((c) => c.in_workshop.length);

  return (
    <>
      <DeskHeader
        title="Order queue"
        meta={
          locked ? (
            <>
              <Lock size={16} strokeWidth={1.75} aria-hidden />
              Orders for {formatDayLong(day)} · Locked at 4:00 PM
            </>
          ) : (
            <>Orders for {formatDayLong(day)}</>
          )
        }
        depot={depot}
        onDepot={setDepot}
      />
      <div className="flex flex-col gap-4 p-4 md:px-6 md:pt-4 md:pb-6">
        {locked ? (
          <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-card border border-asphalt-200 border-l-4 border-l-asphalt-700 bg-white py-3 pr-5 pl-6">
            <div className="flex items-center gap-3">
              <Lock size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
              <div>
                <p className="t-label text-asphalt-700">Orders for {weekday} closed at 4:00 PM</p>
                <p className="flex items-baseline gap-2">
                  <span className="t-display num">{data.orders.length}</span>
                  <span className="t-label text-asphalt-700">orders locked</span>
                </p>
              </div>
            </div>
            <div className="min-w-[260px] flex-1">
              <p className="t-label text-asphalt-700">By type</p>
              <p className="t-h3 num">
                {count("dry")} Fresh dry · {count("chilled")} Fresh chilled · {count("style")} Style · {count("tech")}{" "}
                Tech
              </p>
              <p className="t-caption text-asphalt-500">Late orders go on the next run by themselves.</p>
            </div>
            <Button
              density="desk"
              variant="primary"
              iconAfter={ArrowRight}
              onClick={() => navigate("/dispatcher/plan")}
            >
              Go to plan board
            </Button>
          </section>
        ) : (
          <section className="flex flex-wrap items-center gap-x-8 gap-y-3 rounded-card border border-asphalt-200 border-l-4 border-l-petrol-700 bg-white py-3 pr-5 pl-6">
            <div className="flex items-center gap-3">
              <Clock size={20} strokeWidth={1.75} aria-hidden className="text-petrol-700" />
              <div>
                <p className="t-label text-asphalt-700">Orders for {weekday} close at 4:00 PM</p>
                <p className="t-display num">{formatDuration(minutesLeft)}</p>
              </div>
            </div>
            <div className="h-14 w-px bg-asphalt-200 max-md:hidden" />
            <div className="min-w-[240px] flex-1">
              <div className="flex items-baseline justify-between">
                <p className="t-label text-asphalt-700">Fresh outlets ordered</p>
                <p className="t-h3 num">
                  {data.fresh_outlets_ordered} of {data.fresh_outlets_expected}
                </p>
              </div>
              <div className="my-1.5 h-2 overflow-hidden rounded-full bg-asphalt-100">
                <div
                  className="h-full rounded-full bg-petrol-700"
                  style={{
                    width: `${(100 * data.fresh_outlets_ordered) / Math.max(1, data.fresh_outlets_expected)}%`,
                  }}
                />
              </div>
              <p className="t-caption text-asphalt-500">
                Style and Tech order on their own schedule, so only Fresh outlets are counted.
              </p>
            </div>
            <div className="h-14 w-px bg-asphalt-200 max-md:hidden" />
            <div className="w-[200px]">
              <p className="t-label text-asphalt-700">Orders in</p>
              <p className="t-h2 num">{data.orders.length}</p>
              <p className="t-caption num text-asphalt-500">
                Peliyagoda {byDepot("Peliyagoda")} · Kandy hub {byDepot("Kandy")}
              </p>
            </div>
          </section>
        )}

        <div className="flex flex-col gap-4 xl:flex-row xl:items-start">
          <div className="flex min-w-0 flex-1 flex-col gap-4">
            {locked && data.late.length ? <LateOrders late={data.late} weekday={weekday} /> : null}
            <section className="min-w-0 overflow-hidden rounded-card border border-asphalt-200 bg-white">
              <div className="flex flex-wrap items-center gap-1 border-b border-asphalt-200 px-4 py-2">
                {TABS.map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    aria-pressed={tab === t.key}
                    onClick={() => setTab(t.key)}
                    className={cx(
                      "inline-flex h-8 items-center gap-1.5 rounded-chip px-3 t-label",
                      tab === t.key ? "bg-petrol-50 text-petrol-700" : "text-asphalt-700 hover:bg-asphalt-50",
                    )}
                  >
                    {t.label} <span className="num t-label-strong">{count(t.key)}</span>
                  </button>
                ))}
                <span className="ml-auto t-caption text-asphalt-500">Needs attention first</span>
              </div>
              <QueueTable rows={rows} depot={depot} workshop={workshop} />
            </section>
          </div>
          <aside className="w-full shrink-0 xl:w-[368px]">
            {locked ? (
              <CutoffSummary data={data} depot={depot} count={count} />
            ) : (
              <NotOrdered data={data} depot={depot} weekday={weekday} now={now} />
            )}
          </aside>
        </div>
      </div>
    </>
  );
}

function QueueTable({ rows, depot, workshop }: { rows: Row[]; depot: Depot; workshop: Queue["chilled"] }) {
  const [folded, setFolded] = useState<Record<string, boolean>>({});
  const depots = depot === "All" ? ["Peliyagoda", "Kandy"] : [depot];
  return (
    <div className="max-h-[640px] overflow-auto">
      <table className="w-full min-w-[860px] border-collapse t-dense">
        <thead className="sticky top-0 z-10 bg-asphalt-50 t-caption text-asphalt-500">
          <tr className="h-9 text-left">
            <th className={cx(COL.order, "font-medium")}>Order</th>
            <th className={cx(COL.outlet, "font-medium")}>Outlet</th>
            <th className={cx(COL.type, "font-medium")}>Type</th>
            <th className={cx(COL.cases, "font-medium")}>Cases</th>
            <th className={cx(COL.kg, "font-medium")}>kg</th>
            <th className={cx(COL.m3, "font-medium")}>m³</th>
            <th className={cx(COL.window, "font-medium")}>Window</th>
            <th className={cx(COL.flags, "font-medium")}>Flags</th>
          </tr>
        </thead>
        {depots.map((d) => {
          const group = rows.filter((r) => r.depot === d);
          const isFolded = folded[d] ?? false;
          const out = workshop.find((w) => w.depot === d);
          return (
            <tbody key={d}>
              <tr className="h-8 border-b border-asphalt-200 bg-white">
                <td colSpan={8} className="px-4">
                  <button
                    type="button"
                    aria-expanded={!isFolded}
                    onClick={() => setFolded((f) => ({ ...f, [d]: !isFolded }))}
                    className="flex w-full items-center gap-2 text-left"
                  >
                    {isFolded ? <ChevronRight size={16} aria-hidden /> : <ChevronDown size={16} aria-hidden />}
                    <Warehouse size={16} strokeWidth={1.75} aria-hidden className="text-asphalt-500" />
                    <span className="t-label-strong">{DEPOT_LABEL[d]}</span>
                    <span className="num t-label text-asphalt-500">{group.length}</span>
                    {out ? (
                      <span className="ml-auto t-caption text-asphalt-500">
                        {out.in_workshop.join(" and ")} {out.in_workshop.length > 1 ? "are" : "is"} in the workshop
                      </span>
                    ) : null}
                  </button>
                </td>
              </tr>
              {isFolded
                ? null
                : group.map((r) => (
                    <tr key={r.id} className="h-10 border-b border-asphalt-100 hover:bg-asphalt-100">
                      <td className={cx(COL.order, "latin num whitespace-nowrap")}>{r.order_ref}</td>
                      <td className={cx(COL.outlet, "whitespace-nowrap")}>
                        <span className="latin t-dense-strong">{r.outlet_id}</span> {r.short_name}
                      </td>
                      <td className={COL.type}>
                        {r.temp === "chilled" ? (
                          <StatusChip kind="chilled" density="desk" />
                        ) : (
                          <span className="text-asphalt-700">{r.brand === "Fresh" ? "Dry" : r.brand}</span>
                        )}
                      </td>
                      <td className={cx(COL.cases, "num")}>{r.units}</td>
                      <td className={cx(COL.kg, "num")}>{kgValue(r.weight_kg)}</td>
                      <td className={cx(COL.m3, "num")}>{m3Value(r.volume_m3)}</td>
                      <td className={cx(COL.window, "num whitespace-nowrap")}>
                        {formatWindow(r.window_open, r.window_close)}
                      </td>
                      <td className={COL.flags}>
                        <span className="flex flex-wrap gap-1 py-1">
                          {r.flags.map((f) => (
                            <StatusChip key={f.kind} density="desk" kind={FLAG_CHIP[f.kind]}>
                              {f.label}
                            </StatusChip>
                          ))}
                        </span>
                      </td>
                    </tr>
                  ))}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}

function LateOrders({ late, weekday }: { late: Queue["late"]; weekday: string }) {
  const next = formatWeekday(dayOf(late[0]!.moved_to));
  return (
    <section className="rounded-card border border-asphalt-200 border-l-4 border-l-attention bg-white py-3 pr-4 pl-5">
      <div className="flex items-start gap-2">
        <Clock size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 text-attention" />
        <div>
          <h2 className="t-h3">
            {late.length} order{late.length > 1 ? "s" : ""} came in after 4:00 PM
          </h2>
          <p className="t-caption text-asphalt-500">
            Moved to {next}'s run. The store was told the minute each arrived.
          </p>
        </div>
      </div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[760px] t-dense">
          <tbody>
            {late.map((r) => (
              <tr key={r.id} className="h-9 border-t border-asphalt-100">
                <td className="latin num">{r.order_ref}</td>
                <td>
                  <span className="latin t-dense-strong">{r.outlet_id}</span> {r.short_name}
                </td>
                <td className="text-asphalt-700">{DEPOT_LABEL[r.depot]}</td>
                <td>{r.temp === "chilled" ? "Chilled" : "Dry"}</td>
                <td className="num text-right">{kg(r.weight_kg)}</td>
                <td className="num text-right">{m3(r.volume_m3)}</td>
                <td className="num pl-3">{formatTime(r.placed_at)}</td>
                <td>
                  <StatusChip kind="deferred" density="desk">
                    Moved to {next}
                  </StatusChip>
                </td>
                <td className="num t-caption text-asphalt-500">
                  {r.store_told_at ? `Told ${formatTime(r.store_told_at)}` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="sr-only">These were orders for {weekday}.</p>
    </section>
  );
}

/** The Not ordered panel: Remind, Remind all and Call before the cutoff. */
export function NotOrdered({ data, depot, weekday, now }: { data: Queue; depot: Depot; weekday: string; now: Date }) {
  const list = data.not_ordered.filter((n) => depot === "All" || n.depot === depot);
  const remind = useRemind();
  const [toast, setToast] = useState<string | null>(null);
  const recent = (n: Queue["not_ordered"][number]) =>
    n.reminded_at !== null && now.getTime() - new Date(n.reminded_at).getTime() < REMIND_AGAIN_MS;
  const due = list.filter((n) => !recent(n));
  const anyPhone = list.some((n) => n.phone);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(() => setToast(null), 6_000);
    return () => window.clearTimeout(id);
  }, [toast]);

  const send = (ids: string[]) =>
    remind.mutate(ids, {
      onSuccess: (sent) => {
        const first = list.find((n) => n.outlet_id === sent[0]?.outlet_id);
        setToast(
          sent.length === 0
            ? "Every store on the list has ordered since. Nothing was sent."
            : sent.length === 1 && first
              ? `Reminder sent to ${first.outlet_id} ${first.short_name}.`
              : `Reminders sent to ${sent.length} stores.`,
        );
      },
    });

  return (
    <section className="flex flex-col gap-3 rounded-card border border-asphalt-200 bg-white p-4">
      <div className="flex items-center gap-2">
        <h2 className="t-h3">Not ordered yet</h2>
        <span className="num inline-flex h-5 items-center rounded-chip bg-attention-soft px-1.5 t-label-strong text-attention">
          {list.length}
        </span>
      </div>
      <p className="t-caption text-asphalt-500">Fresh outlets with no order for {weekday} yet.</p>
      <ul className="flex flex-col">
        {list.map((n) => (
          <li key={n.outlet_id} className="flex flex-col gap-1 border-b border-asphalt-200 py-2.5">
            <div className="flex items-center gap-2">
              <span className="min-w-0 flex-1 t-dense">
                <span className="latin t-dense-strong">{n.outlet_id}</span> {n.short_name}
              </span>
              {recent(n) ? (
                <span className="num inline-flex h-8 items-center gap-1 px-1 t-caption text-done">
                  <Check size={16} strokeWidth={1.75} aria-hidden />
                  Reminded {formatTime(n.reminded_at!)}
                </span>
              ) : (
                <Button
                  density="desk"
                  compact
                  icon={Send}
                  className="h-8 px-2.5"
                  title="Send a reminder to the store's Relay app"
                  aria-label={`${n.reminded_at ? "Remind again" : "Remind"} ${n.outlet_id} ${n.short_name}`}
                  disabled={remind.isPending}
                  onClick={() => send([n.outlet_id])}
                >
                  {n.reminded_at ? "Remind again" : "Remind"}
                </Button>
              )}
              {n.phone ? (
                <a
                  href={`tel:${n.phone}`}
                  aria-label={`Call ${n.outlet_id} ${n.short_name}`}
                  className="inline-flex h-8 items-center gap-2 rounded-button px-2.5 t-dense-strong text-asphalt-900 hover:bg-asphalt-100"
                >
                  <Phone size={20} strokeWidth={1.75} aria-hidden />
                  Call
                </a>
              ) : null}
            </div>
            <p className="t-caption text-asphalt-500">
              {DEPOT_LABEL[n.depot]} · {n.pattern}
              {n.reminded_at && !recent(n) ? (
                <span className="num"> · Reminded {formatTime(n.reminded_at)}</span>
              ) : null}
            </p>
          </li>
        ))}
      </ul>
      {list.length ? (
        <>
          <Button
            density="desk"
            variant="primary"
            icon={Send}
            full
            disabled={remind.isPending || due.length === 0}
            onClick={() => send(due.map((n) => n.outlet_id))}
          >
            {due.length === 0
              ? `All ${list.length} reminded`
              : due.length === list.length
                ? `Remind all ${list.length}`
                : `Remind the other ${due.length}`}
          </Button>
          {remind.error ? (
            <p className="t-caption text-problem" role="alert">
              {remind.error.message}
            </p>
          ) : null}
          <p className="t-caption text-asphalt-500">
            A reminder appears in the store's Relay app with the 4:00 PM cutoff.
            {anyPhone ? " Call uses the number on the store's record." : ""}
          </p>
        </>
      ) : (
        <p className="t-dense text-asphalt-700">Every Fresh outlet has ordered.</p>
      )}
      {toast ? (
        <p
          role="status"
          className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-2rem)] -translate-x-1/2 items-center gap-2 rounded-button bg-asphalt-900 px-4 py-3 t-dense text-white shadow-float"
        >
          <CircleCheck size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {toast}
        </p>
      ) : null}
    </section>
  );
}

function CutoffSummary({ data, depot, count }: { data: Queue; depot: Depot; count: (t: Tab) => number }) {
  const day = dayOf(data.run_date);
  const kandy = data.chilled.find((c) => c.depot === (depot === "All" ? "Kandy" : depot));
  return (
    <section className="flex flex-col gap-3 rounded-card border border-asphalt-200 bg-white p-4">
      <div>
        <h2 className="t-h3">{formatDayLong(day)}</h2>
        <p className="t-label text-asphalt-700">Locked at 4:00 PM</p>
      </div>
      <dl className="flex flex-col t-dense">
        {(
          [
            ["Fresh dry", count("dry")],
            ["Fresh chilled", count("chilled")],
            ["Style", count("style")],
            ["Tech", count("tech")],
          ] as const
        ).map(([label, n]) => (
          <div key={label} className="flex h-7 items-center justify-between">
            <dt className="text-asphalt-700">{label}</dt>
            <dd className="num">{n}</dd>
          </div>
        ))}
        <div className="flex h-7 items-center justify-between border-t border-asphalt-200 t-label-strong">
          <dt>Total</dt>
          <dd className="num">{count("all")}</dd>
        </div>
      </dl>
      <div className="h-px bg-asphalt-200" />
      <div>
        <p className="t-label-strong">
          {data.fresh_outlets_ordered} of {data.fresh_outlets_expected} Fresh outlets ordered in time
        </p>
        {data.late.length ? (
          <p className="t-caption text-asphalt-500">
            {data.late[0]!.outlet_id} {data.late[0]!.short_name}'s {data.late.length === 2 ? "two orders" : "order"}{" "}
            came after 4:00 PM. {data.late.length === 2 ? "They ride" : "It rides"}{" "}
            {formatWeekday(dayOf(data.late[0]!.moved_to))}
            's run.
          </p>
        ) : null}
      </div>
      {kandy ? (
        <>
          <div className="h-px bg-asphalt-200" />
          <div className="flex flex-col gap-1">
            <p className="flex items-center gap-2 t-label-strong">
              <Snowflake size={16} strokeWidth={1.75} aria-hidden className="text-chilled" />
              {DEPOT_LABEL[kandy.depot]} chilled for {formatWeekday(day)}
            </p>
            <dl className="t-dense">
              {(
                [
                  ["Chilled orders", String(kandy.orders)],
                  ["Weight", kg(kandy.weight_kg)],
                  ["Volume", m3(kandy.volume_m3)],
                  ["Refrigerated vehicles free", `${kandy.reefers_free} of ${kandy.reefers_total}`],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="flex h-7 items-center justify-between">
                  <dt className="text-asphalt-700">{label}</dt>
                  <dd className="num">{value}</dd>
                </div>
              ))}
            </dl>
            {kandy.in_workshop.length ? (
              <p className="t-caption text-asphalt-500">
                {kandy.in_workshop.join(" and ")} {kandy.in_workshop.length > 1 ? "are" : "is"} in the workshop.
              </p>
            ) : null}
          </div>
        </>
      ) : null}
    </section>
  );
}
