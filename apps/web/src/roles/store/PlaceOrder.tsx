import {
  Box,
  Boxes,
  Calendar,
  CalendarClock,
  Check,
  CircleCheck,
  ClipboardList,
  Clock,
  Package,
  Plus,
  RefreshCw,
  Route,
  Send,
  Snowflake,
  Timer,
  Weight,
  WifiOff,
} from "lucide-react";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { ApiError } from "@/api/client";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { BackHeader, Card, PhoneScreen } from "@/design/Phone";
import { Segmented } from "@/design/Segmented";
import { StatusChip } from "@/design/StatusChip";
import { Stepper } from "@/design/Stepper";
import { dayOf, formatDayLong, formatDuration, formatWeekday, formatWindow, kg, m3 } from "@/lib/time";
import {
  type CaseType,
  describeLines,
  plural,
  type StoreHome,
  type StoreOrder,
  useChangeOrder,
  usePlaceOrder,
  useStoreHome,
} from "./api";
import { clock, closesLine, dayWhen, defaultTemp, eveningOf, kindOf, type Temp } from "./words";

/** The order the form offers its types in, chilled first as STM-02 is drawn. */
const TEMPS: Temp[] = ["chilled", "ambient"];

/** STM-02 Place order: count standard cases; Relay works out weight and volume and keeps the cutoff in view. With
 *  ?change=ORD0098595 the same form changes that order until its cutoff. */
export function PlaceOrder() {
  const [params] = useSearchParams();
  const change = params.get("change");
  return change ? <ChangeOrder key={change} orderRef={change} /> : <NewOrder />;
}

function NewOrder() {
  const home = useStoreHome();
  const now = useSimNow(15_000);
  const navigate = useNavigate();
  const place = usePlaceOrder();
  const [temp, setTemp] = useState<Temp | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  // one id per attempt, kept across "Try again", so a retry can never create a second order
  const [clientRefs, setClientRefs] = useState<Record<Temp, string>>(() => ({
    ambient: crypto.randomUUID(),
    chilled: crypto.randomUUID(),
  }));
  const [sent, setSent] = useState<StoreOrder | null>(null);

  const data = home.data;
  const types = data?.case_types ?? [];
  const forDay = data?.ordering_for ?? null;
  // what the store already sent for that day, dry before chilled as Waypoint numbers them
  const already = useMemo(
    () =>
      (data?.orders ?? [])
        .filter((o) => o.requested_date === forDay)
        .sort((a, b) => (a.temp === b.temp ? a.order_ref.localeCompare(b.order_ref) : a.temp === "ambient" ? -1 : 1)),
    [data, forDay],
  );
  const temps = TEMPS.filter((t) => types.some((c) => c.temp === t));
  const selected: Temp = temp ?? defaultTemp(temps, already);
  const rows = types.filter((t) => t.temp === selected);
  const totals = useMemo(() => total(rows, counts), [rows, counts]);
  const unsent = (t: Temp) => types.filter((c) => c.temp === t).reduce((n, c) => n + (counts[c.code] ?? 0), 0);

  // the countdown ran out before the next answer: ask again, so the form moves on to the next run at once
  const expired = Boolean(data && now && !data.closed_for && Date.parse(data.cutoff) <= now.getTime());
  const refetch = home.refetch;
  useEffect(() => {
    if (expired) void refetch();
  }, [expired, refetch]);

  if (!data || !now || !forDay) {
    return <PhoneScreen header={<BackHeader title="Place an order" back="/store" />}>{null}</PhoneScreen>;
  }

  const window = formatWindow(data.outlet.window_open, data.outlet.window_close);
  const minutesLeft = (Date.parse(data.cutoff) - now.getTime()) / 60_000;
  const day = formatWeekday(dayOf(forDay));
  const offline = place.error instanceof ApiError && place.error.offline;
  const closed = data.closed_for && data.closed_at ? { day: data.closed_for, at: data.closed_at } : null;
  // orders moved onto this day's run from an earlier one: they are coming, so the store orders only what else it needs
  const movedIn = data.orders.filter((o) => o.run_date === forDay && o.requested_date !== o.run_date);
  const second = already.find((o) => o.temp === selected);

  if (sent) {
    return (
      <Received
        order={sent}
        home={data}
        now={now}
        window={window}
        onDone={() => navigate("/store")}
        canOrderDry={sent.temp === "chilled" && temps.includes("ambient") && !already.some((o) => o.temp === "ambient")}
        onAnother={(next) => {
          setSent(null);
          setTemp(next);
          place.reset();
        }}
      />
    );
  }

  const send = () => {
    const lines = rows
      .filter((t) => (counts[t.code] ?? 0) > 0)
      .map((t) => ({ case_type: t.code, qty: counts[t.code] ?? 0 }));
    place.mutate(
      { temp: selected, lines, client_ref: clientRefs[selected], for_date: forDay },
      {
        onSuccess: (order) => {
          setSent(order);
          setCounts((c) =>
            Object.fromEntries(Object.entries(c).filter(([code]) => !rows.some((r) => r.code === code))),
          );
          setClientRefs((r) => ({ ...r, [selected]: crypto.randomUUID() }));
        },
      },
    );
  };

  return (
    <PhoneScreen
      header={<BackHeader title="Place an order" back="/store" />}
      bar={
        <>
          <SendNotice error={place.error} saved="Your counts are saved here." />
          <Totals cases={totals.cases} kgs={totals.kg} m3s={totals.m3} />
          <Button
            variant="primary"
            full
            icon={offline ? RefreshCw : Send}
            disabled={totals.cases === 0 || place.isPending}
            onClick={send}
          >
            {offline ? "Try again" : closed ? `Send for ${day}'s run` : "Send order"}
          </Button>
          {totals.cases === 0 ? (
            <p className="t-caption text-center text-asphalt-500">Add at least one case to send.</p>
          ) : null}
        </>
      }
    >
      {closed ? (
        <ClosedLine day={formatWeekday(dayOf(closed.day))} at={closed.at} next={`${day}'s run`} />
      ) : expired ? (
        <ClosedLine day={day} at={data.cutoff} next="the next run" />
      ) : minutesLeft <= 240 ? (
        <Countdown day={day} cutoff={data.cutoff} minutesLeft={minutesLeft} />
      ) : null}

      <div className="flex flex-col gap-2">
        <Detail icon={Calendar} label="Delivery">
          {formatDayLong(dayOf(forDay))}, {window}
        </Detail>
        {closed || (!expired && minutesLeft > 240) ? (
          <p className="flex items-start gap-3 t-label text-asphalt-700">
            <Timer size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="pt-0.5">
              Orders for {day} close {dayWhen(data.cutoff, now)} at {clock(data.cutoff)}
            </span>
          </p>
        ) : null}
        {already.length ? (
          <p className="flex items-start gap-2 t-label text-asphalt-700">
            <ClipboardList size={16} strokeWidth={1.75} aria-hidden className="mt-px shrink-0" />
            <span>
              Already sent for {day}:{" "}
              {already.map((o, i) => (
                <span key={o.id}>
                  {i === 0 ? "" : i === already.length - 1 ? " and " : ", "}
                  {kindOf(o.temp)} order <span className="latin num whitespace-nowrap">{o.order_ref}</span>
                </span>
              ))}
            </span>
          </p>
        ) : null}
      </div>

      {movedIn.map((o) => (
        <Notice key={o.id} tone="info" field>
          Your {kindOf(o.temp)} order <span className="latin num">{o.order_ref}</span> has already moved to {day}. Those{" "}
          {o.units} cases are coming, so order only what else you need.
        </Notice>
      ))}

      <div className="flex flex-col gap-2">
        <p className="t-label text-asphalt-700">Order type</p>
        <Segmented
          label="Order type"
          value={selected}
          onChange={(t) => {
            setTemp(t);
            place.reset();
          }}
          segments={[
            {
              value: "ambient",
              label: "Dry",
              icon: Package,
              iconClass: "text-asphalt-900",
              badge: selected !== "ambient" ? unsent("ambient") : 0,
            },
            {
              value: "chilled",
              label: "Chilled",
              icon: Snowflake,
              iconClass: "text-chilled",
              badge: selected !== "chilled" ? unsent("chilled") : 0,
            },
          ]}
        />
        <p className="t-label text-asphalt-700">{helperFor(selected)}</p>
      </div>

      {second ? (
        <Notice tone="info" compact field>
          You already sent a {kindOf(selected)} order for {day},{" "}
          <span className="latin num whitespace-nowrap">{second.order_ref}</span>. This adds a second order.
        </Notice>
      ) : null}

      <CasesCard
        rows={rows}
        counts={counts}
        onChange={(code, v) => {
          // once counted, the type stays put: a later answer (the cutoff passing, an order arriving) never hides them
          setTemp(selected);
          setCounts((c) => ({ ...c, [code]: v }));
        }}
      />
    </PhoneScreen>
  );
}

/** STM-01 Change this order: the order's own counts, filled in, until the cutoff for its day. */
function ChangeOrder({ orderRef }: { orderRef: string }) {
  const home = useStoreHome();
  const now = useSimNow(15_000);
  const navigate = useNavigate();
  const save = useChangeOrder(orderRef);
  const [edited, setEdited] = useState<Record<string, number> | null>(null);
  const header = <BackHeader title={`Change ${orderRef}`} back="/store" />;
  const data = home.data;
  const order = data?.orders.find((o) => o.order_ref === orderRef);

  if (!data || !now) return <PhoneScreen header={header}>{null}</PhoneScreen>;
  const back = (
    <Button variant="primary" full onClick={() => navigate("/store")}>
      Back to my orders
    </Button>
  );
  if (!order) {
    return (
      <PhoneScreen header={header} bar={back}>
        <Notice tone="info" field>
          This order is not at your store.
        </Notice>
      </PhoneScreen>
    );
  }

  const run = formatWeekday(dayOf(order.requested_date));
  const minutesLeft = (Date.parse(order.locks_at) - now.getTime()) / 60_000;
  const locked = order.locked || minutesLeft <= 0;
  if (locked || order.status !== "received" || order.run_date !== order.requested_date) {
    return (
      <PhoneScreen header={header} bar={back}>
        <Notice tone="info" icon={Clock} field>
          {locked
            ? `Orders for ${run} closed at ${clock(order.locks_at)}, so this order can't be changed now.`
            : "The dispatcher is already planning this order, so it can't be changed now."}
        </Notice>
      </PhoneScreen>
    );
  }

  const rows = data.case_types.filter((t) => t.temp === order.temp);
  // the store's own counts: cases Waypoint carried onto the order from a short delivery stay on top of them
  const own = Object.fromEntries(order.lines.map((l) => [l.case_type, l.qty - l.carried_qty]));
  const carried = order.lines.filter((l) => l.carried_qty > 0);
  const counts = edited ?? own;
  const ownCases = rows.reduce((n, t) => n + (counts[t.code] ?? 0), 0);
  const totals = total(
    rows,
    Object.fromEntries(
      rows.map((t) => [
        t.code,
        (counts[t.code] ?? 0) + (carried.find((l) => l.case_type === t.code)?.carried_qty ?? 0),
      ]),
    ),
  );
  const unchanged = rows.every((t) => (counts[t.code] ?? 0) === (own[t.code] ?? 0));
  const offline = save.error instanceof ApiError && save.error.offline;

  const submit = () =>
    save.mutate(
      {
        lines: rows
          .filter((t) => (counts[t.code] ?? 0) > 0)
          .map((t) => ({ case_type: t.code, qty: counts[t.code] ?? 0 })),
      },
      { onSuccess: () => navigate("/store") },
    );

  return (
    <PhoneScreen
      header={header}
      bar={
        <>
          <SendNotice error={save.error} saved="Your changes are saved here." />
          <Totals cases={totals.cases} kgs={totals.kg} m3s={totals.m3} />
          <Button
            variant="primary"
            full
            icon={offline ? RefreshCw : Check}
            disabled={ownCases === 0 || unchanged || save.isPending}
            onClick={submit}
          >
            {offline ? "Try again" : "Save changes"}
          </Button>
          {ownCases === 0 ? (
            <p className="t-caption text-center text-asphalt-500">An order needs at least one case.</p>
          ) : null}
        </>
      }
    >
      {minutesLeft <= 240 ? <Countdown day={run} cutoff={order.locks_at} minutesLeft={minutesLeft} /> : null}
      <div className="flex flex-col gap-2">
        <Detail icon={Calendar} label="Delivery">
          {formatDayLong(dayOf(order.requested_date))},{" "}
          {formatWindow(data.outlet.window_open, data.outlet.window_close)}
        </Detail>
        {minutesLeft > 240 ? (
          <p className="flex items-start gap-3 t-label text-asphalt-700">
            <Timer size={20} strokeWidth={1.75} aria-hidden className="shrink-0" />
            <span className="pt-0.5">
              You can change it until {clock(order.locks_at)} {dayWhen(order.locks_at, now)}
            </span>
          </p>
        ) : null}
      </div>
      <div className="flex flex-col items-start gap-2">
        <StatusChip kind={order.temp === "chilled" ? "chilled" : "dry"} />
        <p className="t-label text-asphalt-700">{helperFor(order.temp)}</p>
      </div>
      <CasesCard
        rows={rows}
        counts={counts}
        onChange={(code, v) => setEdited({ ...counts, [code]: v })}
        notes={Object.fromEntries(
          carried.map((l) => [
            l.case_type,
            <>
              Plus {l.carried_qty} short from <span className="latin num">{l.carried_from ?? "an earlier order"}</span>,
              added by Waypoint
            </>,
          ]),
        )}
      />
    </PhoneScreen>
  );
}

function helperFor(temp: Temp): string {
  return temp === "chilled"
    ? "Chilled goods need a refrigerated vehicle. Send dry goods as their own order."
    : "Dry goods only. Chilled goods go as their own order.";
}

/** Not sent: offline is a wait, never red; anything else is the server's own words. */
function SendNotice({ error, saved }: { error: Error | null; saved: string }) {
  if (error instanceof ApiError && error.offline) {
    return (
      <Notice tone="waiting" compact field icon={WifiOff} role="status">
        Not sent. Your phone is offline. {saved}
      </Notice>
    );
  }
  return error ? (
    <Notice tone="problem" compact field role="alert">
      {error.message}
    </Notice>
  ) : null;
}

/** Cutoff line / countdown, under 4 hours left; amber in the last hour. */
function Countdown({ day, cutoff, minutesLeft }: { day: string; cutoff: string; minutesLeft: number }) {
  const urgent = minutesLeft < 60;
  return (
    <div
      className={`flex items-start gap-3 rounded-card px-4 py-3 ${urgent ? "bg-attention-soft" : "border border-asphalt-200 bg-white"}`}
    >
      <Timer
        size={20}
        strokeWidth={1.75}
        aria-hidden
        className={`shrink-0 ${urgent ? "text-attention" : "text-asphalt-700"}`}
      />
      <div>
        <p className="t-label">
          Orders for {day} close at {clock(cutoff)}
        </p>
        <p className="t-h3 num">{formatDuration(Math.max(minutesLeft, 0))} left</p>
      </div>
    </div>
  );
}

/** Cutoff line / closed: "Orders for Wednesday closed at 4:00 PM. Anything you send now goes on Thursday's run." */
function ClosedLine({ day, at, next }: { day: string; at: string; next: string }) {
  return (
    <div className="flex items-start gap-3 rounded-card bg-attention-soft px-4 py-3">
      <Clock size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-attention" />
      <div>
        <p className="t-label-strong text-asphalt-900">
          Orders for {day} closed at {clock(at)}
        </p>
        <p className="t-body text-asphalt-900">Anything you send now goes on {next}.</p>
      </div>
    </div>
  );
}

function CasesCard({
  rows,
  counts,
  onChange,
  notes = {},
}: {
  rows: CaseType[];
  counts: Record<string, number>;
  onChange: (code: string, value: number) => void;
  notes?: Record<string, ReactNode>;
}) {
  return (
    <Card className="flex flex-col px-4 pt-4 pb-1">
      <div className="flex items-baseline justify-between pb-1">
        <h2 className="t-h3">Cases</h2>
        <span className="t-caption text-asphalt-500">Tap or type a number</span>
      </div>
      {rows.map((t, i) => (
        <div
          key={t.code}
          className={`flex min-h-[72px] items-center justify-between gap-3 py-2 ${i < rows.length - 1 ? "border-b border-asphalt-200" : ""}`}
        >
          <div className="min-w-0">
            <p className="t-h3">{t.name}</p>
            <p className="t-label num text-asphalt-500">
              {t.kg.toFixed(1)} kg, {t.m3.toFixed(3)} m³ each
            </p>
            {notes[t.code] ? <p className="t-label text-asphalt-700">{notes[t.code]}</p> : null}
          </div>
          <Stepper
            value={counts[t.code] ?? 0}
            onChange={(v) => onChange(t.code, v)}
            label={t.name}
            unit={plural(t.name, 2)}
          />
        </div>
      ))}
    </Card>
  );
}

function total(rows: CaseType[], counts: Record<string, number>) {
  let cases = 0;
  let weight = 0;
  let volume = 0;
  for (const t of rows) {
    const n = counts[t.code] ?? 0;
    cases += n;
    weight += n * t.kg;
    volume += n * t.m3;
  }
  return { cases, kg: Math.round(weight * 10) / 10, m3: Math.round(volume * 1000) / 1000 };
}

function Totals({ cases, kgs, m3s }: { cases: number; kgs: number; m3s: number }) {
  return (
    <div className="flex flex-wrap items-center gap-4 t-label-strong num">
      <span className="inline-flex items-center gap-1.5">
        <Boxes size={16} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
        {cases} cases
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Weight size={16} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
        {kg(kgs)}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Box size={16} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
        {m3(m3s)}
      </span>
    </div>
  );
}

/** STM-02 / received: only once Relay has the order. An order Relay received after a cutoff says which run it joins;
 *  what happens next is said from now. */
function Received({
  order,
  home,
  now,
  window,
  onDone,
  canOrderDry,
  onAnother,
}: {
  order: StoreOrder;
  home: StoreHome;
  now: Date;
  window: string;
  onDone: () => void;
  canOrderDry: boolean;
  onAnother: (temp: Temp | null) => void;
}) {
  const run = formatWeekday(dayOf(order.run_date));
  const late = order.run_date !== order.requested_date;
  // sent from a form opened after today's cutoff: the day that closed is the one to name
  const closed =
    late || !home.closed_for || !home.closed_at || order.requested_date !== home.ordering_for
      ? null
      : { day: formatWeekday(dayOf(home.closed_for)), at: home.closed_at };
  // the cutoff of the run it joined: its own, or the one taking orders now for an order moved past its cutoff
  const runCloses = !late ? order.locks_at : order.run_date === home.ordering_for ? home.cutoff : null;
  return (
    <PhoneScreen
      header={<BackHeader title="Order sent" back={null} />}
      bar={
        canOrderDry ? (
          <>
            <Button full onClick={onDone}>
              Back to my orders
            </Button>
            <Button variant="primary" full icon={Package} onClick={() => onAnother("ambient")}>
              Place your dry order
            </Button>
          </>
        ) : (
          <>
            <Button full icon={Plus} onClick={() => onAnother(null)}>
              Place another order
            </Button>
            <Button variant="primary" full onClick={onDone}>
              Back to my orders
            </Button>
          </>
        )
      }
    >
      <Card className="flex flex-col items-center gap-2 p-6 text-center">
        <span className="flex size-16 items-center justify-center rounded-full bg-done-soft">
          <CircleCheck size={32} strokeWidth={1.75} aria-hidden className="text-done" />
        </span>
        <h2 className="t-h1">Received by Waypoint</h2>
        <p className="t-body text-asphalt-700">
          {late
            ? `Orders for ${formatWeekday(dayOf(order.requested_date))} closed at ${clock(order.locks_at)}, so this one goes on ${run}'s run.`
            : closed
              ? `Orders for ${closed.day} closed at ${clock(closed.at)}, so this one goes on ${run}'s run.`
              : `Your ${kindOf(order.temp)} order is in the queue for ${run}.`}
        </p>
        <p className="latin t-h3 num">{order.order_ref}</p>
        <p className="t-label text-asphalt-500">
          Received {clock(order.placed_at)}, {formatDayLong(order.placed_at)}
        </p>
      </Card>
      <Card className="flex flex-col gap-2 p-4">
        <div>
          <StatusChip kind={order.temp === "chilled" ? "chilled" : "dry"} />
        </div>
        <Detail icon={Boxes}>{describeLines(order.lines)}</Detail>
        <Detail icon={Weight}>
          {kg(order.weight_kg)}, {m3(order.volume_m3)}
        </Detail>
        <Detail icon={Calendar}>
          {formatDayLong(dayOf(order.run_date))}, {window}
        </Detail>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="t-h3">What happens next</h2>
        <Detail icon={Clock}>
          {runCloses ? closesLine(order.run_date, runCloses, now) : `Orders for ${run} close at ${clock(home.cutoff)}.`}
        </Detail>
        <Detail icon={Route}>The dispatcher then plans {run}'s runs.</Detail>
        <Detail icon={CalendarClock}>
          Your delivery time shows in My orders {runCloses ? eveningOf(runCloses, now) : "the evening before"}.
        </Detail>
      </Card>
    </PhoneScreen>
  );
}

function Detail({ icon: Icon, label, children }: { icon: typeof Clock; label?: string; children: ReactNode }) {
  return label ? (
    <div className="flex items-start gap-3">
      <Icon size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-700" />
      <div>
        <p className="t-caption text-asphalt-500">{label}</p>
        <p className="t-body">{children}</p>
      </div>
    </div>
  ) : (
    <p className="flex items-start gap-3 t-body">
      <Icon size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-700" />
      <span>{children}</span>
    </p>
  );
}
