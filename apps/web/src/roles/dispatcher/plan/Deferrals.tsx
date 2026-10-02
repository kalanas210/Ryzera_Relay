import { useIsMutating, useQuery } from "@tanstack/react-query";
import {
  Boxes,
  Calendar,
  CircleAlert,
  CircleCheck,
  CircleDot,
  Eye,
  History,
  Info,
  ListChecks,
  Lock,
  Package,
  Weight,
} from "lucide-react";
import { type ReactNode, useEffect, useId, useState } from "react";
import { api } from "@/api/client";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { StatusChip } from "@/design/StatusChip";
import { cx } from "@/lib/cx";
import {
  dayOf,
  formatDay,
  formatDayLong,
  formatTime,
  formatWeekday,
  formatWindow,
  kg,
  kgValue,
  m3,
  m3Value,
} from "@/lib/time";
import { describeLines } from "@/roles/store/api";
import {
  type Board,
  type DepotName,
  type Drawer,
  type DrawerGroup,
  type DrawerWaiting,
  replanKey,
  useConfirm,
  useDrawer,
  useOverride,
} from "./api";

type Waiting = DrawerWaiting;
type Group = DrawerGroup;

const DEPOT_LABEL: Record<DepotName, string> = { Kandy: "Kandy hub", Peliyagoda: "Peliyagoda" };
const NUMBER = ["no", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
const count = (n: number) => NUMBER[n] ?? String(n);

/** What deferring a protected order anyway would change, asked as soon as Defer anyway opens: the engine keeps
 *  its answer, so the override itself is quick. */
function useOverridePreview(planId: string, orderRef: string, enabled: boolean) {
  return useQuery({
    queryKey: ["override-preview", planId, orderRef],
    queryFn: ({ signal }) =>
      api.get<{ order_ref: string; consequence: string; lines: string[] }>(
        `/api/dispatch/plan/${planId}/override/preview?order_ref=${encodeURIComponent(orderRef)}`,
        { role: "dispatcher", signal },
      ),
    enabled,
    staleTime: 60_000,
  });
}

/** DSP-03 Deferrals: what no plan could avoid, Relay's choice by rule, the pool, the cost, the protected store,
 *  the next-run check, and the exact words the store will read. */
export function DeferralsDrawer({
  open,
  onClose,
  board,
  depot,
  onReady,
}: {
  open: boolean;
  onClose: () => void;
  board: Board;
  depot: DepotName;
  onReady: () => void;
}) {
  const drawer = useDrawer(board.plan.id, open);
  const confirm = useConfirm(board.plan.id, depot);
  const data = drawer.data;
  const waiting = data?.waiting ?? [];
  const pending = waiting.filter((w) => !w.confirmed_at);
  const ready = waiting.length > 0 && pending.length === 0;
  const published = board.plan.status === "published";
  const many = waiting.length > 1;
  const chilled = waiting.length > 0 && waiting.every((w) => w.temp === "chilled");

  return (
    <Sheet
      open={open}
      onClose={onClose}
      variant="drawer"
      width={880}
      title={`Deferrals for the ${data?.depot_label ?? DEPOT_LABEL[depot]}`}
      meta={
        data
          ? `${formatDayLong(dayOf(data.run_date))} · ${waiting.length} ${chilled ? "chilled " : ""}order${many ? "s" : ""}${
              data.proposed_at ? ` · proposed ${formatTime(data.proposed_at)}` : ""
            }`
          : "Loading"
      }
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className={data ? undefined : "invisible"}>
            <p className={cx("flex items-center gap-1.5 t-label-strong", ready ? "text-done" : "text-problem")}>
              {ready ? (
                <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
              ) : (
                <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
              )}
              {published
                ? "Published"
                : ready
                  ? many
                    ? "Deferrals ready"
                    : "Deferral ready"
                  : pending.length > 1
                    ? `${pending.length} deferrals need a reason`
                    : "The deferral needs a reason"}
            </p>
            <p className="t-caption text-asphalt-500">
              {published
                ? "Stores were told when the plan was published."
                : "Stores are told when you publish the plan, not before."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button density="desk" variant="quiet" onClick={onClose}>
              Close
            </Button>
            {!published ? (
              <Button density="desk" variant="primary" disabled={!ready} onClick={onReady}>
                Confirm {many ? "deferrals" : "deferral"}
              </Button>
            ) : null}
          </div>
        </div>
      }
    >
      {!data ? (
        <p className="t-dense text-asphalt-500" role="status">
          Checking the next run for each waiting order
        </p>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_288px]">
          <div className="flex min-w-0 flex-col gap-3">
            {data.groups.map((g) => (
              <Unavoidable key={g.temp_class} group={g} />
            ))}
            {waiting.length ? (
              <div className="flex items-center gap-2">
                <h3 className="t-h3">{many ? "Orders to defer" : "Order to defer"}</h3>
                <span
                  className={cx(
                    "num inline-flex h-5 items-center rounded-chip px-1.5 t-label-strong",
                    pending.length ? "bg-attention-soft text-attention" : "bg-asphalt-100 text-asphalt-900",
                  )}
                >
                  {waiting.length}
                </span>
              </div>
            ) : null}
            {waiting.map((w) => (
              <WaitingRow
                key={w.order_ref}
                order={w}
                published={published}
                busy={confirm.isPending}
                onConfirm={(reason, note) => confirm.mutate({ order_ref: w.order_ref, reason, note })}
                runDate={data.run_date}
              />
            ))}
            {confirm.error ? <p className="t-dense text-problem">{confirm.error.message}</p> : null}
            {data.groups.map((g) => (
              <Choice key={`c-${g.temp_class}`} group={g} />
            ))}
            {waiting.map((w) =>
              w.costs.length ? (
                <section
                  key={`cost-${w.order_ref}`}
                  className="flex flex-col gap-2 rounded-card border border-asphalt-200 bg-white p-4"
                >
                  <CardTitle icon={<Weight size={16} strokeWidth={1.75} aria-hidden />} order={many ? w : null}>
                    {w.overridden ? "What the override costs" : "What the choice costs"}
                  </CardTitle>
                  <ul className="flex flex-col gap-1.5">
                    {w.costs.map((c) => (
                      <li key={c} className="flex items-start gap-2 t-dense">
                        <CircleDot
                          size={14}
                          strokeWidth={1.75}
                          aria-hidden
                          className="mt-1 shrink-0 text-asphalt-500"
                        />
                        {c}
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null,
            )}
            {data.groups.map((g) => (g.paper ? <OnPaper key={`paper-${g.temp_class}`} paper={g.paper} /> : null))}
            {waiting.map((w) => (w.next_run ? <NextRunCard key={`n-${w.order_ref}`} order={w} many={many} /> : null))}
          </div>
          <aside className="flex flex-col gap-3">
            {data.protected.length ? (
              <>
                <p className="t-label-strong text-asphalt-700">Protected</p>
                {data.protected.map((p) => (
                  <Protected key={p.order_ref} card={p} board={board} depot={depot} published={published} />
                ))}
              </>
            ) : null}
            {waiting.map((w) => (
              <Preview key={`p-${w.order_ref}`} order={w} data={data} published={published} />
            ))}
          </aside>
        </div>
      )}
    </Sheet>
  );
}

/** A card's heading, and the waiting store it is about when several orders wait. */
function CardTitle({
  icon,
  order,
  children,
}: {
  icon: ReactNode;
  order: Pick<Waiting, "outlet_id" | "short_name"> | null;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="flex items-center gap-2 t-h3">
        {icon}
        {children}
      </h3>
      {order ? (
        <p className="t-label text-asphalt-700">
          <span className="latin">{order.outlet_id}</span> {order.short_name}
        </p>
      ) : null}
    </div>
  );
}

function Unavoidable({ group }: { group: Group }) {
  const chilled = group.temp_class === "chilled";
  const kind = chilled ? "refrigerated" : "ambient";
  const n = group.unavoidable;
  return (
    <section className="flex flex-col gap-1.5 rounded-card border border-asphalt-200 border-l-4 border-l-attention bg-white p-4">
      <p className="flex items-center gap-1.5 t-label-strong text-attention">
        <Boxes size={16} strokeWidth={1.75} aria-hidden />
        Unavoidable: {count(n)} {chilled ? "chilled " : ""}order{n === 1 ? " waits" : "s wait"}
      </p>
      <h3 className="t-h3">
        {group.running} {kind} vehicles can serve {group.max_served} of the {group.orders} {chilled ? "chilled " : ""}
        orders
      </h3>
      <p className="t-dense text-asphalt-700">
        {group.limiting.length
          ? `${listed(group.limiting)} ${group.limiting.length > 1 ? "are" : "is"} in the workshop. `
          : ""}
        Relay searched every plan for the {count(group.running)} left, with each vehicle in one place at a time: at most{" "}
        {group.max_served} of the {group.orders} reach their stores inside their windows.
      </p>
      <table className="mt-1 w-full t-dense">
        <tbody>
          <tr className="h-6">
            <td className="text-asphalt-700">{chilled ? "Chilled orders" : "Orders"} for the run</td>
            <td className="num text-right">{group.orders}</td>
            <td className="num pl-4 text-right">
              {kg(group.total_kg)} · {m3(group.total_m3)}
            </td>
          </tr>
          <tr className="h-6">
            <td className="text-asphalt-700">
              Planned on {group.running} {kind} vehicles
            </td>
            <td className="num text-right">{group.planned}</td>
            <td className="num pl-4 text-right">
              {kg(group.planned_kg)} · {m3(group.planned_m3)}
            </td>
          </tr>
          <tr className="h-6 border-t border-asphalt-200 t-label-strong text-attention">
            <td>Waits</td>
            <td className="num text-right">{group.waits}</td>
            <td className="num pl-4 text-right">
              {kg(group.waits_kg)} · {m3(group.waits_m3)}
            </td>
          </tr>
        </tbody>
      </table>
      {group.by_override ? (
        <p className="t-caption text-asphalt-500">
          {group.by_override === group.waits
            ? `${group.waits === 1 ? "It waits" : "They wait"}`
            : `${group.by_override} of them ${group.by_override === 1 ? "waits" : "wait"}`}{" "}
          by override, in place of {group.by_override === 1 ? "an order" : "orders"} Relay would have deferred.
        </p>
      ) : null}
    </section>
  );
}

/** "A, B and C", as the API writes its lists. */
function listed(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items[items.length - 1]}`;
}

function WaitingRow({
  order,
  published,
  busy,
  onConfirm,
  runDate,
}: {
  order: Waiting;
  published: boolean;
  busy: boolean;
  onConfirm: (reason: string, note: string) => void;
  runDate: string;
}) {
  const suggested = order.reasons.find((r) => r.suggested);
  const [reason, setReason] = useState(order.reason_code ?? "");
  const [note, setNote] = useState(order.note ?? "");
  const noteId = useId();
  useEffect(() => {
    setReason(order.reason_code ?? "");
  }, [order.reason_code]);
  const missing = !order.confirmed_at && !reason;
  const kind = order.temp === "chilled" ? "Fresh chilled" : order.brand === "Fresh" ? "Fresh dry" : order.brand;
  const moves = dayOf(order.moves_to);
  const next = order.next_run;
  return (
    <section className="flex flex-col gap-2 rounded-card border border-asphalt-200 bg-white px-4 pt-2 pb-3">
      <div className="flex items-baseline justify-between gap-2">
        <p className="t-dense-strong">
          <span className="latin">{order.outlet_id}</span> {order.short_name}
        </p>
        <p className="num t-dense">
          {kg(order.weight_kg)} · {m3(order.volume_m3)}
        </p>
      </div>
      <p className="t-caption text-asphalt-500">
        <span className="latin num">{order.order_ref}</span> · {kind} · {order.units} cases
        {order.last_delivered
          ? ` · last ${order.temp === "chilled" ? "chilled" : "dry"} delivery ${formatDay(dayOf(order.last_delivered))}`
          : ""}
        {order.overridden ? " · deferred by override" : ""}
      </p>
      {order.sibling ? (
        <p className="flex items-center gap-1.5 t-caption text-asphalt-700">
          <Package size={16} strokeWidth={1.75} aria-hidden />
          {order.sibling.temp === "chilled" ? "Chilled" : "Dry"} order{" "}
          <span className="latin num">{order.sibling.order_ref}</span> still comes {formatWeekday(dayOf(runDate))} on{" "}
          <span className="latin">{order.sibling.vehicle_id}</span>
        </p>
      ) : null}
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1 t-caption text-asphalt-700">
          Moves to
          <span className="flex h-8 items-center gap-2 rounded-chip border border-asphalt-300 px-2.5 t-label text-asphalt-900">
            <Calendar size={16} strokeWidth={1.75} aria-hidden className="text-asphalt-500" />
            {formatDay(moves)}, {formatWindow(order.window_open, order.window_close)}
          </span>
        </div>
        <label className="flex min-w-[220px] flex-1 flex-col gap-1 t-caption text-asphalt-700">
          Reason
          <select
            value={reason}
            disabled={published}
            onChange={(e) => setReason(e.target.value)}
            className={cx(
              "h-8 rounded-chip border bg-white px-2 t-label text-asphalt-900",
              missing ? "border-[1.5px] border-problem" : "border-asphalt-300",
            )}
          >
            <option value="">Choose a reason</option>
            {order.reasons.map((r) => (
              <option key={r.code} value={r.code}>
                {r.label}
                {r.suggested ? " (suggested)" : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {reason === "other" && !published ? (
        <div className="flex flex-col gap-1">
          <label htmlFor={noteId} className="t-caption text-asphalt-700">
            Note for the record (the store reads it)
          </label>
          <textarea
            id={noteId}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write a note for the record"
            className="min-h-[72px] rounded-chip border border-asphalt-300 p-2 t-dense"
          />
        </div>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        {!published && missing ? (
          <span className="inline-flex items-center gap-1 t-caption text-problem">
            <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
            Add a reason. The store sees it.
          </span>
        ) : null}
        {!published && missing && suggested ? (
          <Button
            density="desk"
            compact
            disabled={busy}
            onClick={() => {
              setReason(suggested.code);
              onConfirm(suggested.code, "");
            }}
          >
            Use Relay's reason
          </Button>
        ) : null}
        {!published && reason && reason !== order.reason_code ? (
          <Button
            density="desk"
            compact
            variant="primary"
            disabled={busy || (reason === "other" && !note.trim())}
            onClick={() => onConfirm(reason, note)}
          >
            Save reason
          </Button>
        ) : null}
        {order.confirmed_at ? (
          <span className="inline-flex items-center gap-1 t-caption text-done">
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
            {order.reason} · {formatTime(order.confirmed_at)}
          </span>
        ) : null}
        {published ? <Seen order={order} /> : null}
      </div>
      {next ? (
        <p className={cx("flex items-center gap-1.5 t-caption", next.fits ? "text-done" : "text-problem")}>
          {next.fits ? (
            <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
          ) : (
            <CircleAlert size={16} strokeWidth={1.75} aria-hidden />
          )}
          {next.fits
            ? `${formatWeekday(dayOf(next.day))} checked: ${next.vehicle_id}'s ${next.district ? `${next.district} ` : ""}run has room, planned ${next.planned}.`
            : `${formatWeekday(dayOf(next.day))} checked: no vehicle has room yet. Relay keeps it at the front of that run.`}
        </p>
      ) : null}
    </section>
  );
}

/** After publishing: when the store was told, and whether it pressed Got it on STM-03. */
function Seen({ order }: { order: Waiting }) {
  if (!order.notified_at) return null;
  return (
    <span className="inline-flex items-center gap-1 t-caption text-asphalt-700">
      <Eye size={16} strokeWidth={1.75} aria-hidden />
      Told {formatTime(order.notified_at)} ·{" "}
      {order.acknowledged_at ? (
        <span className="t-label-strong text-done">Seen {formatTime(order.acknowledged_at)}</span>
      ) : (
        "Not seen yet"
      )}
    </span>
  );
}

function Choice({ group }: { group: Group }) {
  const districts = Object.entries(group.pool.by_district);
  return (
    <>
      <section className="flex flex-col gap-2.5 rounded-card border border-asphalt-200 bg-white p-4">
        <h3 className="flex items-center gap-2 t-h3">
          <ListChecks size={16} strokeWidth={1.75} aria-hidden />
          Relay's choice: which {group.waits > 1 ? "orders wait" : "order waits"}
        </h3>
        <p className="t-dense text-asphalt-700">Relay applies three rules, in order.</p>
        <ol className="flex flex-col gap-2">
          {group.rules.map((r) => (
            <li key={r.n} className="flex gap-2">
              <span
                className={cx(
                  "num flex size-5 shrink-0 items-center justify-center rounded-full t-caption",
                  group.picked_by_rule === r.n ? "bg-petrol-700 text-white" : "bg-asphalt-100 text-asphalt-900",
                )}
              >
                {r.n}
              </span>
              <div className="min-w-0">
                <p className="t-dense-strong">{r.title}</p>
                <p className="t-dense text-asphalt-700">{r.reason}</p>
                {r.lines?.length ? (
                  <ul className="mt-1 flex flex-col gap-1">
                    {r.lines.map((line) => (
                      <li key={line} className="flex items-start gap-2 t-dense text-asphalt-700">
                        <CircleDot size={14} strokeWidth={1.75} aria-hidden className="mt-1 shrink-0" />
                        {line}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
        {group.result ? (
          <p className="flex items-start gap-2 rounded-button bg-asphalt-50 px-3 py-2 t-dense">
            <CircleDot size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0" />
            {group.result}
          </p>
        ) : null}
      </section>
      {districts.length ? (
        <section className="flex flex-col gap-2 rounded-card border border-asphalt-200 bg-white p-4">
          <h3 className="flex items-center gap-2 t-h3">
            <Boxes size={16} strokeWidth={1.75} aria-hidden />
            The pool: {group.pool.count} of the {group.orders} could have waited
          </h3>
          <dl className="flex flex-col gap-1 t-dense">
            {districts.map(([district, outlets]) => (
              <div key={district} className="flex gap-3">
                <dt className="w-28 shrink-0 text-asphalt-700">{district}</dt>
                <dd className="latin num">{outlets.join(", ")}</dd>
              </div>
            ))}
          </dl>
          {group.pool.summary ? <p className="t-dense">{group.pool.summary}</p> : null}
        </section>
      ) : null}
    </>
  );
}

/** On paper, all 23 fit: the trips a check by the published minutes alone would pass, and the clock's answer. */
function OnPaper({ paper }: { paper: NonNullable<Group["paper"]> }) {
  return (
    <section className="flex flex-col gap-2 rounded-card bg-asphalt-50 p-4">
      <h3 className="flex items-center gap-2 t-h3">
        <Info size={16} strokeWidth={1.75} aria-hidden />
        On paper, all {paper.orders} fit
      </h3>
      <p className="t-dense text-asphalt-700">
        The published standard adds up minutes only. It does not check store windows, departure times or the drive back
        to the hub, so a check by minutes alone would pass this plan:
      </p>
      <table className="w-full t-dense">
        <thead className="t-caption text-asphalt-500">
          <tr className="h-7 text-left">
            <th className="w-20 font-medium">Vehicle</th>
            <th className="font-medium">Takes</th>
            <th className="w-[136px] text-right font-medium">Standard min</th>
          </tr>
        </thead>
        <tbody>
          {paper.rows.map((r) => (
            <tr key={r.vehicle_id} className="border-t border-asphalt-200 align-top">
              <td className="latin py-1">{r.vehicle_id}</td>
              <td className="py-1 pr-3">{r.takes}</td>
              <td className="num py-1 text-right whitespace-nowrap">{r.minutes}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="t-dense">
        <span className="t-dense-strong">On the clock it fails.</span> {paper.fails.join(" ")}
      </p>
    </section>
  );
}

function NextRunCard({ order, many }: { order: Waiting; many: boolean }) {
  const n = order.next_run!;
  const day = formatWeekday(dayOf(n.day));
  const temp = order.temp === "chilled" ? "chilled" : "dry";
  if (!n.fits) {
    return (
      <section className="flex flex-col gap-1 rounded-card bg-attention-soft p-4">
        <CardTitle
          icon={<CircleAlert size={16} strokeWidth={1.75} aria-hidden className="text-attention" />}
          order={many ? order : null}
        >
          {day} checked: no room yet
        </CardTitle>
        <p className="t-dense">
          {day}'s orders as they stand fill every vehicle that can take it. Relay protects it on {day}.
        </p>
      </section>
    );
  }
  const riders = n.with ?? [];
  const others = riders.filter((r) => !r.waiting);
  const waitingToo = riders.filter((r) => r.waiting);
  const otherTrip = n.other_trip;
  const vehicles = n.vehicle_kind?.startsWith("refrigerated") ? "refrigerated vehicles" : "vehicles";
  return (
    <section className="flex flex-col gap-2 rounded-card bg-done-soft p-4">
      <CardTitle
        icon={<CircleCheck size={16} strokeWidth={1.75} aria-hidden className="text-done" />}
        order={many ? order : null}
      >
        {day} checked: the next run can carry it
      </CardTitle>
      <p className="t-dense">
        {n.back_from_workshop ? (
          <>
            <span className="latin">{n.vehicle_id}</span> is back from the workshop.{" "}
          </>
        ) : null}
        {n.back_from_workshop ? "Its" : <span className="latin">{n.vehicle_id}'s</span>} {n.usual ? "usual " : ""}
        {n.district ?? ""} trip carries this order
        {others.length
          ? ` with ${day}'s ${temp} orders from ${listed(others.map((r) => `${r.short_name} (${r.order_ref})`))}`
          : " on its own"}
        {waitingToo.length ? `, and ${listed(waitingToo.map((r) => r.short_name))}'s waiting order too` : ""}.{" "}
        {n.inside_windows === false
          ? "Not every store on it is served inside its window yet."
          : "Every store on it is served inside its window"}
        {n.inside_windows !== false && otherTrip
          ? `, and its ${otherTrip.district} trip ${otherTrip.trip_no > (n.trip_no ?? 1) ? "still follows" : "comes first"}.`
          : n.inside_windows !== false
            ? "."
            : ""}
      </p>
      <dl className="grid grid-cols-[120px_1fr] gap-y-1 t-dense">
        <dt className="text-asphalt-700">Load</dt>
        <dd className="num">
          {kgValue(n.weight_kg ?? 0)} of {n.weight_cap?.toLocaleString("en-US")} kg · {m3Value(n.volume_m3 ?? 0)} of{" "}
          {n.volume_cap?.toFixed(1)} m³
        </dd>
        {n.trip_minutes ? (
          <>
            <dt className="text-asphalt-700">Fresh time</dt>
            <dd className="num">
              {n.trip_minutes} of {n.fresh_budget ?? 270} min
              {n.fresh_minutes && n.fresh_minutes !== n.trip_minutes ? `, ${n.fresh_minutes} for the day` : ""}
            </dd>
          </>
        ) : null}
        <dt className="text-asphalt-700">Leaves the hub</dt>
        <dd className="num">
          {n.depart}, back {n.back}
        </dd>
        <dt className="text-asphalt-700">At {order.short_name}</dt>
        <dd className="num">
          Planned {n.planned}
          {n.arrives ? <span className="text-asphalt-700"> (arrives {n.arrives}, unloads when it opens)</span> : null}
        </dd>
      </dl>
      {n.needed && n.fleet ? (
        <p className="t-dense">
          {day} needs {n.needed} of the {n.fleet} {vehicles}
          {n.standby?.length ? ", so the standby stays free" : ""}. A store never waits twice in a row without an
          override, so this order is protected on that run.
        </p>
      ) : null}
    </section>
  );
}

function Protected({
  card,
  board,
  depot,
  published,
}: {
  card: Drawer["protected"][number];
  board: Board;
  depot: DepotName;
  published: boolean;
}) {
  const override = useOverride(depot, board.plan.id);
  // a proposal from the plan bar sends the engine searching too; the override waits for it
  const replanning = useIsMutating({ mutationKey: replanKey(depot) }) > 0;
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const noteId = useId();
  const preview = useOverridePreview(board.plan.id, card.order_ref, open && !published);
  const temp = card.temp === "chilled" ? "chilled" : "dry";
  return (
    <section
      className={cx(
        "flex flex-col gap-2 rounded-card px-4 py-3",
        open ? "border-[1.5px] border-attention bg-white" : "bg-asphalt-50",
      )}
    >
      <p className="flex items-center gap-1.5 t-dense-strong">
        <Lock size={16} strokeWidth={1.75} aria-hidden />
        <span className="latin">{card.outlet_id}</span> {card.short_name}
      </p>
      <div>
        <StatusChip kind="waited" density="desk">
          Waited {card.waited_on}
        </StatusChip>
      </div>
      <p className="t-caption text-asphalt-500">
        <span className="latin num">{card.order_ref}</span> · {card.temp === "chilled" ? "Fresh chilled" : "Fresh dry"}{" "}
        · {card.units} cases
        <br />
        <span className="num">
          {kg(card.weight_kg)} · {m3(card.volume_m3)}
        </span>
      </p>
      <p className="t-caption text-asphalt-700">
        Its {card.waited_on} {temp} order waited a day, so it rides <span className="latin">{card.vehicle_id}</span>{" "}
        trip {card.trip_no}.{" "}
        {card.late_by > 0
          ? `Relay expects it at ${card.expected}, after its ${card.closes} close, but the same morning.`
          : `Relay expects it at ${card.expected}.`}
      </p>
      {open ? (
        <div className="flex flex-col gap-2">
          <p className="flex items-start gap-1.5 rounded-button bg-attention-soft px-2 py-1.5 t-caption">
            <History size={16} strokeWidth={1.75} aria-hidden className="shrink-0 text-attention" />
            {card.outlet_id}'s {card.waited_on} {temp} order waited a day. Deferring this one too means two in a row.
          </p>
          <p className="t-caption text-asphalt-700" role="status">
            {preview.data
              ? preview.data.consequence
              : preview.error
                ? `Relay could not check what changes: ${preview.error.message}`
                : "Checking what changes on the plan if you defer it"}
          </p>
          <label htmlFor={noteId} className="t-label text-asphalt-900">
            Why is this needed? (required)
          </label>
          <textarea
            id={noteId}
            autoFocus // the form opens because the dispatcher asked to write this note
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Write a note for the record"
            className="min-h-[72px] rounded-chip border-2 border-petrol-700 p-2 t-dense"
          />
          <p className="t-caption text-asphalt-500">
            Your name, the time and this note are kept with the order. The store reads the note as the reason until you
            pick another.
          </p>
          <div className="flex justify-end gap-2">
            <Button density="desk" variant="quiet" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              density="desk"
              variant="danger"
              disabled={note.trim().length < 3 || replanning}
              onClick={() => override.mutate({ order_ref: card.order_ref, note })}
            >
              {override.isPending ? "Re-planning" : `Defer ${card.outlet_id}`}
            </Button>
          </div>
          {replanning ? (
            <p className="t-caption text-asphalt-500" role="status">
              {override.isPending
                ? "Relay is planning the other orders again. This can take up to a minute."
                : "Relay is proposing the plan again. Defer it once that is done."}
            </p>
          ) : null}
          {override.error ? <p className="t-caption text-problem">{override.error.message}</p> : null}
        </div>
      ) : !published ? (
        <div className="flex justify-end">
          <Button density="desk" variant="quiet" onClick={() => setOpen(true)}>
            Defer anyway
          </Button>
        </div>
      ) : null}
    </section>
  );
}

function Preview({ order, data, published }: { order: Waiting; data: Drawer; published: boolean }) {
  const moves = dayOf(order.moves_to);
  const was = dayOf(data.run_date);
  const window = formatWindow(order.window_open, order.window_close);
  const paragraphs = order.store_notice.split("\n\n").filter(Boolean);
  return (
    <>
      <div>
        <p className="t-label-strong text-asphalt-700">What {order.outlet_id} will see</p>
        <p className="t-caption text-asphalt-500">
          {published && order.notified_at
            ? `Sent ${formatTime(order.notified_at)}. ${
                order.acknowledged_at ? `Seen ${formatTime(order.acknowledged_at)}.` : "Not seen yet."
              }`
            : "Sent to the store when you publish"}
        </p>
      </div>
      <section className="flex flex-col gap-2 rounded-card border border-asphalt-200 bg-white p-4">
        <div>
          <StatusChip kind="deferred" density="desk">
            Moved to {formatWeekday(moves)}
          </StatusChip>
        </div>
        <h4 className="t-h3">
          Your {order.temp === "chilled" ? "chilled" : "dry"} order now comes {formatWeekday(moves)}
        </h4>
        <p className="t-dense">{describeLines(order.lines)}</p>
        <p className="t-caption text-asphalt-500">
          <span className="latin num">{order.order_ref}</span>. Placed {formatTime(order.placed_at)}
        </p>
        <dl className="grid grid-cols-[48px_1fr] gap-y-1 t-dense">
          <dt className="t-label text-asphalt-700">Was</dt>
          <dd className="text-asphalt-500 line-through">
            {formatDayLong(was)}, {window}
          </dd>
          <dt className="t-label-strong text-attention">Now</dt>
          <dd className="t-dense-strong">
            {formatDayLong(moves)}, {window}
          </dd>
        </dl>
        <p className="flex items-start gap-1.5 t-caption text-asphalt-700">
          <Lock size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          This order won't be moved again unless the dispatcher approves it.
        </p>
        {order.sibling ? (
          <p className="flex items-start gap-1.5 t-caption text-asphalt-700">
            <Package size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            Your {order.sibling.temp === "chilled" ? "chilled" : "dry"} order still comes {formatWeekday(was)}, expected
            around {order.sibling.expected}.
          </p>
        ) : null}
        {paragraphs.length ? (
          <>
            <p className="t-label-strong">Why it moved</p>
            {paragraphs.map((p) => (
              <p key={p} className="t-dense text-asphalt-700">
                {p}
              </p>
            ))}
          </>
        ) : (
          <p className="flex items-start gap-1.5 t-caption text-asphalt-500">
            <Info size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
            The reason you choose becomes the words the store reads.
          </p>
        )}
        <Button density="store" disabled full>
          Got it
        </Button>
      </section>
    </>
  );
}
