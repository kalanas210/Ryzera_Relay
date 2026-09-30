import {
  Box,
  Boxes,
  Calendar,
  CalendarClock,
  CircleCheck,
  ClipboardList,
  Clock,
  Package,
  RefreshCw,
  Route,
  Send,
  Snowflake,
  Timer,
  Weight,
  WifiOff,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { BackHeader, Card, PhoneScreen } from "@/design/Phone";
import { Segmented } from "@/design/Segmented";
import { StatusChip } from "@/design/StatusChip";
import { Stepper } from "@/design/Stepper";
import { dayOf, formatDayLong, formatDuration, formatTime, formatWeekday, formatWindow, kg, m3 } from "@/lib/time";
import { type CaseType, describeLines, plural, type StoreOrder, usePlaceOrder, useStoreHome } from "./api";

type Temp = "ambient" | "chilled";

/** STM-02 Place order: count standard cases; Relay works out weight and volume and keeps the cutoff in view. */
export function PlaceOrder() {
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
  const forDay = data ? data.ordering_for : null;
  const already = useMemo(
    () => (data && forDay ? data.orders.filter((o) => o.requested_date === forDay) : []),
    [data, forDay],
  );
  const selected: Temp = temp ?? (already.some((o) => o.temp === "chilled") ? "ambient" : "chilled");
  const rows = types.filter((t) => t.temp === selected);
  const totals = useMemo(() => total(rows, counts), [rows, counts]);
  const unsent = (t: Temp) => types.filter((c) => c.temp === t).reduce((n, c) => n + (counts[c.code] ?? 0), 0);

  if (!data || !now || !forDay) {
    return <PhoneScreen header={<BackHeader title="Place an order" back="/store" />}>{null}</PhoneScreen>;
  }

  const window = formatWindow(data.outlet.window_open, data.outlet.window_close);
  const cutoff = new Date(data.cutoff);
  const minutesLeft = (cutoff.getTime() - now.getTime()) / 60_000;
  const day = dayOf(forDay);
  const offline = place.error instanceof ApiError && place.error.offline;

  if (sent) {
    return (
      <Received
        order={sent}
        window={window}
        onDone={() => navigate("/store")}
        onDry={() => {
          setSent(null);
          setTemp("ambient");
        }}
        canOrderDry={!already.some((o) => o.temp === "ambient") && sent.temp === "chilled"}
      />
    );
  }

  const send = () => {
    const lines = rows
      .filter((t) => (counts[t.code] ?? 0) > 0)
      .map((t) => ({ case_type: t.code, qty: counts[t.code]! }));
    place.mutate(
      { temp: selected, lines, client_ref: clientRefs[selected] },
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

  const otherSent = already.find((o) => o.temp !== selected);

  return (
    <PhoneScreen
      header={<BackHeader title="Place an order" back="/store" />}
      bar={
        <>
          {offline ? (
            <Notice tone="waiting" compact field icon={WifiOff}>
              Not sent. Your phone is offline. Your counts are saved here.
            </Notice>
          ) : place.error ? (
            <Notice tone="problem" compact field>
              {place.error.message}
            </Notice>
          ) : null}
          <Totals cases={totals.cases} kgs={totals.kg} m3s={totals.m3} />
          <Button
            variant="primary"
            full
            icon={offline ? RefreshCw : Send}
            disabled={totals.cases === 0 || place.isPending}
            onClick={send}
          >
            {offline ? "Try again" : minutesLeft <= 0 ? `Send for ${formatWeekday(day)}'s run` : "Send order"}
          </Button>
          {totals.cases === 0 ? (
            <p className="t-caption text-center text-asphalt-500">Add at least one case to send.</p>
          ) : null}
        </>
      }
    >
      {minutesLeft > 0 && minutesLeft <= 240 ? (
        <div
          className={`flex items-start gap-3 rounded-card px-4 py-3 ${minutesLeft < 60 ? "bg-attention-soft" : "border border-asphalt-200 bg-white"}`}
        >
          <Timer
            size={20}
            strokeWidth={1.75}
            aria-hidden
            className={minutesLeft < 60 ? "text-attention" : "text-asphalt-700"}
          />
          <div>
            <p className="t-label">Orders for {formatWeekday(day)} close at 4:00 PM</p>
            <p className="t-h3 num">{formatDuration(minutesLeft)} left</p>
          </div>
        </div>
      ) : null}

      <div className="flex items-start gap-3">
        <Calendar size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 text-asphalt-700" />
        <div>
          <p className="t-caption text-asphalt-500">Delivery</p>
          <p className="t-body">
            {formatDayLong(day)}, {window}
          </p>
        </div>
      </div>
      {otherSent ? (
        <p className="-mt-2 flex items-center gap-2 t-label text-asphalt-700">
          <ClipboardList size={16} strokeWidth={1.75} aria-hidden />
          Already sent for {formatWeekday(day)}: {otherSent.temp === "chilled" ? "chilled" : "dry"} order{" "}
          <span className="latin num">{otherSent.order_ref}</span>
        </p>
      ) : null}

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
        <p className="t-label text-asphalt-700">
          {selected === "chilled"
            ? "Chilled goods need a refrigerated vehicle. Send dry goods as their own order."
            : "Dry goods only. Chilled goods go as their own order."}
        </p>
      </div>

      <Card className="flex flex-col px-4 pt-4 pb-1">
        <div className="flex items-baseline justify-between pb-1">
          <h2 className="t-h3">Cases</h2>
          <span className="t-caption text-asphalt-500">Tap or type a number</span>
        </div>
        {rows.map((t, i) => (
          <div
            key={t.code}
            className={`flex min-h-[72px] items-center justify-between gap-3 ${i < rows.length - 1 ? "border-b border-asphalt-200" : ""}`}
          >
            <div className="min-w-0">
              <p className="t-h3">{t.name}</p>
              <p className="t-label num text-asphalt-500">
                {t.kg.toFixed(1)} kg, {t.m3.toFixed(3)} m³ each
              </p>
            </div>
            <Stepper
              value={counts[t.code] ?? 0}
              onChange={(v) => setCounts((c) => ({ ...c, [t.code]: v }))}
              label={t.name}
              unit={plural(t.name, 2)}
            />
          </div>
        ))}
      </Card>
    </PhoneScreen>
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

function Received({
  order,
  window,
  onDone,
  onDry,
  canOrderDry,
}: {
  order: StoreOrder;
  window: string;
  onDone: () => void;
  onDry: () => void;
  canOrderDry: boolean;
}) {
  const chilled = order.temp === "chilled";
  const run = dayOf(order.run_date);
  const late = order.run_date !== order.requested_date;
  return (
    <PhoneScreen
      header={<BackHeader title="Order sent" back={null} />}
      bar={
        canOrderDry ? (
          <>
            <Button full onClick={onDone}>
              Back to my orders
            </Button>
            <Button variant="primary" full icon={Package} onClick={onDry}>
              Place your dry order
            </Button>
          </>
        ) : (
          <Button variant="primary" full onClick={onDone}>
            Back to my orders
          </Button>
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
            ? `Orders for ${formatWeekday(dayOf(order.requested_date))} closed at 4:00 PM, so this one goes on ${formatWeekday(run)}'s run.`
            : `Your ${chilled ? "chilled" : "dry"} order is in the queue for ${formatWeekday(run)}.`}
        </p>
        <p className="latin t-h3 num">{order.order_ref}</p>
        <p className="t-label text-asphalt-500">
          Received {formatTime(order.placed_at)}, {formatDayLong(order.placed_at)}
        </p>
      </Card>
      <Card className="flex flex-col gap-2 p-4">
        <div>
          <StatusChip kind={chilled ? "chilled" : "dry"} />
        </div>
        <Detail icon={Boxes}>{describeLines(order.lines)}</Detail>
        <Detail icon={Weight}>
          {kg(order.weight_kg)}, {m3(order.volume_m3)}
        </Detail>
        <Detail icon={Calendar}>
          {formatDayLong(run)}, {window}
        </Detail>
      </Card>
      <Card className="flex flex-col gap-3 p-4">
        <h2 className="t-h3">What happens next</h2>
        <Detail icon={Clock}>Orders for {formatWeekday(run)} close at 4:00 PM.</Detail>
        <Detail icon={Route}>The dispatcher then plans {formatWeekday(run)}'s runs.</Detail>
        <Detail icon={CalendarClock}>Your delivery time shows in My orders this evening.</Detail>
      </Card>
    </PhoneScreen>
  );
}

function Detail({ icon: Icon, children }: { icon: typeof Clock; children: React.ReactNode }) {
  return (
    <p className="flex items-start gap-3 t-body">
      <Icon size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-700" />
      <span>{children}</span>
    </p>
  );
}
