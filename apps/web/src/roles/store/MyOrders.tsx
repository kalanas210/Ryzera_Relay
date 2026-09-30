import { ChevronRight, Clock, LogOut, Plus, Timer, User } from "lucide-react";
import { Link, useNavigate } from "react-router";
import { useMe, useSignOut } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { Card, HomeHeader, PhoneScreen } from "@/design/Phone";
import { StatusChip } from "@/design/StatusChip";
import {
  dayOf,
  daysBetween,
  formatDayLong,
  formatDuration,
  formatTime,
  formatWeekday,
  formatWindow,
  isoDay,
} from "@/lib/time";
import { describeLines, type StoreHome, type StoreOrder, useStoreHome } from "./api";

/** STM-01 My orders: "is it coming, and when?", one card per order. */
export function MyOrders() {
  const home = useStoreHome();
  const me = useMe("store_manager");
  const signOut = useSignOut("store_manager");
  const navigate = useNavigate();
  const now = useSimNow(15_000);

  if (!home.data || !now) {
    return <PhoneScreen header={<HomeHeader title="My orders" />}>{null}</PhoneScreen>;
  }
  const data = home.data;
  const focus = data.next_run;
  const focusOrders = data.orders.filter((o) => o.requested_date === focus);
  const isToday = isoDay(now) === focus;
  const dayLabel = `${isToday ? "Today" : "Tomorrow"}, ${formatDayLong(dayOf(focus))}`;
  const moved = focusOrders.filter((o) => o.run_date !== o.requested_date);
  const coming = focusOrders.length - moved.length;

  let summary = "No orders yet";
  if (focusOrders.length) {
    const parts: string[] = [];
    if (coming) {
      const allReceived = focusOrders.every((o) => o.status === "received" && o.run_date === o.requested_date);
      parts.push(allReceived && coming > 1 ? "Both orders received" : `${coming} order${coming > 1 ? "s" : ""} coming`);
    }
    if (moved.length) parts.push(`${moved.length} moved to ${formatWeekday(dayOf(moved[0]!.run_date))}`);
    summary = parts.join(", ");
  }

  return (
    <PhoneScreen header={<HomeHeader title="My orders" meta={`${data.outlet.name}, ${data.outlet.outlet_id}`} />}>
      <div className="flex flex-col gap-0.5">
        <p className="t-label text-asphalt-700">{dayLabel}</p>
        <h2 className="t-h2">{summary}</h2>
      </div>

      {focusOrders.length === 0 ? (
        <p className="t-body text-asphalt-700">
          Orders for {formatWeekday(dayOf(data.ordering_for))} close at 4:00 PM. Place one now and you'll get a
          confirmation straight away.
        </p>
      ) : null}

      {focusOrders.map((order) => (
        <OrderCard key={order.id} order={order} home={data} />
      ))}

      <div className="flex flex-col gap-3">
        <CutoffLine home={data} now={now} />
        <Button
          variant={focusOrders.length === 0 ? "primary" : "secondary"}
          icon={Plus}
          full
          onClick={() => navigate("/store/order")}
        >
          Place an order
        </Button>
      </div>

      <footer className="mt-2 flex items-center justify-between border-t border-asphalt-200 pt-2">
        <span className="inline-flex items-center gap-2 t-label text-asphalt-700">
          <User size={20} strokeWidth={1.75} aria-hidden />
          <span className="latin">{me.data?.display_name}</span>
        </span>
        <Button
          variant="quiet"
          icon={LogOut}
          className="h-11"
          onClick={() => signOut.mutate(undefined, { onSuccess: () => navigate("/signin?role=store_manager") })}
        >
          Sign out
        </Button>
      </footer>
    </PhoneScreen>
  );
}

function OrderCard({ order, home }: { order: StoreOrder; home: StoreHome }) {
  const chilled = order.temp === "chilled";
  const window = formatWindow(home.outlet.window_open, home.outlet.window_close);
  const movedTo = order.run_date !== order.requested_date ? dayOf(order.run_date) : null;
  const placed = `Placed ${formatTime(order.placed_at)}`;

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        <StatusChip kind={chilled ? "chilled" : "dry"} />
        {movedTo ? (
          <StatusChip kind="deferred">Moved to {formatWeekday(movedTo)}</StatusChip>
        ) : (
          <StatusChip kind="received" />
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        {movedTo ? (
          <>
            <h3 className="t-h2">Now {formatDayLong(movedTo)}</h3>
            <p className="t-body text-asphalt-700">Same window, {window}</p>
          </>
        ) : (
          <>
            <h3 className="t-h2">
              {formatWeekday(dayOf(order.run_date))}, {window}
            </h3>
            <p className="t-body text-asphalt-700">Delivery time shows here this evening</p>
          </>
        )}
      </div>
      {movedTo && order.deferral ? (
        <Notice tone="attention" compact field>
          {order.deferral.kind === "cutoff"
            ? "It reached Waypoint after 4:00 PM, so it goes on the next run."
            : order.deferral.store_notice}
        </Notice>
      ) : null}
      <div className="h-px bg-asphalt-200" />
      <div className="flex flex-col gap-1">
        <p className="t-body">{describeLines(order.lines)}</p>
        <p className="t-label text-asphalt-500">
          <span className="latin num">{order.order_ref}</span>. {placed}
          {order.locked ? ". Locked at 4:00 PM." : ""}
        </p>
      </div>
      {movedTo && order.deferral ? (
        <Link
          to={`/store/notice/${order.deferral.id}`}
          className="-mx-4 -mb-4 flex h-11 items-center justify-between border-t border-asphalt-200 px-4 t-label-strong text-petrol-700"
        >
          Read the notice
          <ChevronRight size={20} strokeWidth={1.75} aria-hidden />
        </Link>
      ) : null}
    </Card>
  );
}

function CutoffLine({ home, now }: { home: StoreHome; now: Date }) {
  const cutoff = new Date(home.cutoff);
  const minutesLeft = (cutoff.getTime() - now.getTime()) / 60_000;
  const day = formatWeekday(dayOf(home.ordering_for));
  const closedFor = home.orders.some((o) => o.requested_date !== home.ordering_for && o.locked);

  if (minutesLeft > 0 && minutesLeft <= 240) {
    const urgent = minutesLeft < 60;
    return (
      <div
        className={`flex items-start gap-3 rounded-card px-4 py-3 ${urgent ? "bg-attention-soft" : "border border-asphalt-200 bg-white"}`}
      >
        <Timer size={20} strokeWidth={1.75} aria-hidden className={urgent ? "text-attention" : "text-asphalt-700"} />
        <div>
          <p className="t-label">Orders for {day} close at 4:00 PM</p>
          <p className="t-h3 num">{formatDuration(minutesLeft)} left</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-card border border-asphalt-200 bg-white px-4 py-3">
      {closedFor ? (
        <Clock size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
      ) : (
        <Timer size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />
      )}
      <div>
        <p className="t-label">New orders now go on {day}'s run</p>
        <p className="t-body text-asphalt-700">
          Orders for {day} close {cutoffWhen(cutoff, now)} at 4:00 PM
        </p>
      </div>
    </div>
  );
}

function cutoffWhen(cutoff: Date, now: Date): string {
  const days = daysBetween(now, cutoff);
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `on ${formatWeekday(cutoff)}`;
}
