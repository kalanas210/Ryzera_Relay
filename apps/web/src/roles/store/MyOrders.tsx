import {
  Bell,
  ChevronRight,
  CircleAlert,
  LogOut,
  MapPin,
  Navigation,
  PackageCheck,
  Plus,
  Timer,
  Truck,
  User,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { ApiError } from "@/api/client";
import { useMe, useSignOut } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { Card, HomeHeader, PhoneScreen } from "@/design/Phone";
import { Sheet } from "@/design/Sheet";
import { StatusChip } from "@/design/StatusChip";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { dayOf, daysBetween, formatDayLong, formatDuration, formatWeekday, isoDay } from "@/lib/time";
import {
  type StoreHome,
  type Notice as StoreNotice,
  type StoreOrder,
  type Tracker,
  useStoreHome,
  useStoreNotices,
  useTrackers,
} from "./api";
import { AttentionRow, Contents, InfoNote, LinkRow, OfflineNotice } from "./parts";
import {
  around,
  type CardState,
  cardState,
  clock,
  contents,
  daySummary,
  dayWhen,
  eveningOf,
  hubName,
  issueSentAt,
  issuesSentence,
  lastHeard,
  noticeFor,
  noticeLine,
  openReminder,
  placedLine,
  shortLines,
  shortRow,
  stopsBefore,
  windowOf,
} from "./words";

/** STM-01 My orders: "is it coming, and when?", one card per order. */
export function MyOrders() {
  const home = useStoreHome();
  const notices = useStoreNotices();
  const me = useMe("store_manager");
  const signOut = useSignOut("store_manager");
  const navigate = useNavigate();
  const now = useSimNow(15_000);
  const data = home.data;
  const focus = data?.next_run;
  // The day's orders: those on its run, and one asked for that day but moved to a later run. Waypoint's order
  // numbers, dry before chilled, so a moved order never hides behind one on time.
  const focusOrders = (data?.orders ?? [])
    .filter((o) => o.run_date === focus || o.requested_date === focus)
    .sort((a, b) => (a.temp === b.temp ? a.order_ref.localeCompare(b.order_ref) : a.temp === "ambient" ? -1 : 1));
  const {
    trackers,
    waiting,
    failed: trackerFailed,
  } = useTrackers(focusOrders.filter((o) => o.run_date === focus).map((o) => o.order_ref));

  // until every card knows its state, none is shown, so a card never flashes an earlier one
  if (!data || !now || !focus || waiting) {
    return <PhoneScreen header={<HomeHeader title="My orders" />}>{null}</PhoneScreen>;
  }
  const isToday = isoDay(now) === focus;
  const dayLabel = `${isToday ? "Today" : "Tomorrow"}, ${formatDayLong(dayOf(focus))}`;
  const states = focusOrders.map((o) => cardState(o, trackers[o.order_ref], focus));
  const movedTo = focusOrders.find((o) => o.run_date !== o.requested_date && o.requested_date === focus);
  const summary = daySummary(states, movedTo ? formatWeekday(dayOf(movedTo.run_date)) : null);
  const failed = (home.isRefetchError && home.error instanceof ApiError && home.error.offline) || trackerFailed;
  const reminder = openReminder(notices.data ?? [], data, now);

  return (
    <PhoneScreen header={<HomeHeader title="My orders" meta={`${data.outlet.name}, ${data.outlet.outlet_id}`} />}>
      <OfflineNotice failed={failed} knownAt={data.now} />
      {reminder ? (
        <AttentionRow to={`/store/notices/${reminder.id}`}>
          {reminder.title}. Orders for {formatWeekday(dayOf(data.ordering_for))} close at {clock(data.cutoff)}.
        </AttentionRow>
      ) : null}
      <Updates home={data} notices={notices.data ?? []} />
      <div className="flex flex-col gap-0.5">
        <p className="t-label text-asphalt-700">{dayLabel}</p>
        <h2 className="t-h2">{summary}</h2>
      </div>

      {focusOrders.length === 0 ? (
        <p className="t-body text-asphalt-700">
          Orders for {formatWeekday(dayOf(data.ordering_for))} close at {clock(data.cutoff)}. Place one now and you'll
          get a confirmation straight away.
        </p>
      ) : null}

      {focusOrders.map((order, i) => (
        <OrderCard
          key={order.id}
          order={order}
          state={states[i] ?? "received"}
          tracker={trackers[order.order_ref]}
          home={data}
          notices={notices.data ?? []}
          now={now}
        />
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

function OrderCard({
  order,
  state,
  tracker,
  home,
  notices,
  now,
}: {
  order: StoreOrder;
  state: CardState;
  tracker: Tracker | undefined;
  home: StoreHome;
  notices: StoreNotice[];
  now: Date;
}) {
  const navigate = useNavigate();
  const chilled = order.temp === "chilled";
  const window = windowOf(home.outlet);
  const names = Object.fromEntries(home.case_types.map((c) => [c.code, c.name]));
  const movedTo = state === "deferred" ? dayOf(order.run_date) : null;
  // an order moved here from its first day says so, once, on the day it runs
  const movedFrom = order.run_date !== order.requested_date && !movedTo ? dayOf(order.requested_date) : null;
  const driver = calledName(tracker?.driver);
  const after = state === "arrived" || state === "delivered" || state === "confirmed" || state === "disputed";
  const shorts = state === "received" || state === "deferred" ? [] : shortLines(tracker, home, notices);
  const moved = state === "scheduled" ? noticeFor(notices, "order_moved", order.order_ref) : undefined;
  const deferralNotice = order.deferral
    ? notices.find((n) => n.kind === "order_deferred" && n.data.deferral_id === order.deferral?.id)
    : undefined;
  const track = `/store/orders/${order.order_ref}/track`;
  // until its cutoff a received order can still be changed; at 4:00 PM the row goes and the meta says Locked
  const changeable =
    state === "received" &&
    !order.locked &&
    order.status === "received" &&
    order.run_date === order.requested_date &&
    Date.parse(order.locks_at) > now.getTime();
  const receipt = `/store/orders/${order.order_ref}/receipt`;
  const proof = tracker?.proof;

  let chip = <StatusChip kind="received" />;
  let headline = `${formatWeekday(dayOf(order.run_date))}, ${window}`;
  let subline = `Delivery time shows here ${eveningOf(order.locks_at, now)}`;
  if (movedTo) {
    chip = <StatusChip kind="deferred">Moved to {formatWeekday(movedTo)}</StatusChip>;
    headline = `Now ${formatDayLong(movedTo)}`;
    subline = `Same window, ${window}`;
  } else if (tracker) {
    const expected = tracker.expected ? around(tracker.expected) : "";
    switch (state) {
      case "scheduled":
        chip = <StatusChip kind="scheduled" />;
        headline = `Expected around ${expected}`;
        subline = `Your window is ${window}`;
        break;
      case "on_the_way": {
        chip = <StatusChip kind="onTheWay" />;
        headline = `Arriving around ${expected}`;
        const heard = lastHeard(tracker);
        subline = heard ? `${stopsBefore(tracker.stops_before)}. ${heard}` : stopsBefore(tracker.stops_before);
        break;
      }
      case "passed":
        chip = <StatusChip kind="estimatePassed" />;
        headline = "The estimate has passed";
        subline = !tracker.last_heard
          ? `No word from ${driver} on the road yet.`
          : tracker.out_of_contact
            ? `No word from ${driver} since ${clock(tracker.last_heard)}.`
            : `${lastHeard(tracker)}.`;
        break;
      case "arrived":
        chip = (
          <StatusChip tone="done" icon={MapPin}>
            Arrived
          </StatusChip>
        );
        headline = `${driver} is at your store`;
        subline = "Check the goods at your dock, then confirm receipt.";
        break;
      case "delivered":
        chip = <StatusChip kind="delivered" />;
        headline = proof ? `Delivered ${clock(proof.delivered_at)}` : "Delivered";
        subline = proof?.receiver
          ? `Received by ${proof.receiver}. Check the goods, then confirm receipt.`
          : "Check the goods, then confirm receipt.";
        break;
      case "confirmed":
      case "disputed": {
        const r = tracker.receipt;
        chip =
          state === "confirmed" ? (
            <StatusChip kind="confirmed" />
          ) : (
            <StatusChip tone="problem" icon={CircleAlert}>
              Issue sent
            </StatusChip>
          );
        headline = proof
          ? `Delivered ${clock(proof.delivered_at)}`
          : r
            ? state === "confirmed"
              ? `Receipt confirmed ${clock(r.confirmed_at)}`
              : `Issue sent ${clock(issueSentAt(r))}`
            : "Receipt confirmed";
        if (state === "disputed" && r) {
          subline = `You reported ${issuesSentence(r.issues, names)} at ${clock(issueSentAt(r))}.`;
        } else if (r && proof?.sent_at) {
          subline = `You confirmed receipt at ${clock(r.confirmed_at)}. ${driver}'s proof arrived at ${clock(proof.sent_at)}.`;
        } else if (r) {
          subline = `${driver}'s proof joins it as soon as that phone reaches us.`;
        }
        break;
      }
    }
  }

  return (
    <Card className="flex flex-col gap-3 p-4">
      <div className="flex flex-wrap gap-2">
        <StatusChip kind={chilled ? "chilled" : "dry"} />
        {chip}
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="t-h2">{headline}</h3>
        <p className="t-body text-asphalt-700">{subline}</p>
      </div>
      {moved && typeof moved.data.previous === "string" ? (
        <InfoNote>
          Moved {moved.data.direction === "earlier" ? "earlier" : "later"} at {clock(moved.created_at)}. It was expected
          around {around(moved.data.previous)}.
        </InfoNote>
      ) : null}
      {movedFrom ? (
        <InfoNote>
          {order.deferral?.kind === "cutoff"
            ? `Moved here from ${formatWeekday(movedFrom)}: it reached Waypoint after ${clock(order.locks_at)}.`
            : `Moved here from ${formatWeekday(movedFrom)}'s run.`}
        </InfoNote>
      ) : null}
      {movedTo && order.deferral ? (
        <Notice tone="attention" compact field>
          {order.deferral.kind === "cutoff"
            ? `It reached Waypoint after ${clock(order.locks_at)}, so it goes on the next run.`
            : order.deferral.store_notice.split("\n\n")[0]}
        </Notice>
      ) : null}
      <div className="h-px bg-asphalt-200" />
      <div className="flex flex-col gap-1">
        <Contents lines={contents(order, tracker, names)} />
        <p className="t-label text-asphalt-500">
          <span className="latin num">{order.order_ref}</span>. {placedLine(order, now)}
        </p>
      </div>
      {state === "scheduled" && tracker?.vehicle_id ? (
        <p className="flex items-center gap-2 t-label text-asphalt-700">
          <Truck size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          <span>
            {tracker.vehicle_kind} <span className="latin num">{tracker.vehicle_id}</span>, {hubName(home.outlet.depot)}
          </span>
        </p>
      ) : null}
      {shorts.map((s) => (
        <AttentionRow key={s.case_type} to={s.notice ? `/store/notices/${s.notice.id}` : null}>
          {shortRow(s.name, s.qty, s.day, after)}
        </AttentionRow>
      ))}
      {state === "on_the_way" ? (
        <Button variant="primary" icon={Navigation} full onClick={() => navigate(track)}>
          Track delivery
        </Button>
      ) : null}
      {(state === "passed" || state === "arrived" || state === "delivered") && tracker?.can_confirm ? (
        <Button variant="primary" icon={PackageCheck} full onClick={() => navigate(receipt)}>
          Confirm receipt
        </Button>
      ) : null}
      {state === "passed" ? <LinkRow to={track}>Track delivery</LinkRow> : null}
      {state === "confirmed" || state === "disputed" ? (
        <LinkRow to={receipt}>{proof ? `See the receipt and ${driver}'s proof` : "See your receipt"}</LinkRow>
      ) : null}
      {movedTo && deferralNotice ? <LinkRow to={`/store/notices/${deferralNotice.id}`}>Read the notice</LinkRow> : null}
      {changeable ? <LinkRow to={`/store/order?change=${order.order_ref}`}>Change this order</LinkRow> : null}
    </Card>
  );
}

/** When the next orders close: a countdown under 4 hours, the time when it is later today, or which run a new
 *  order joins once today's cutoff has passed. */
function CutoffLine({ home, now }: { home: StoreHome; now: Date }) {
  const cutoff = new Date(home.cutoff);
  const minutesLeft = (cutoff.getTime() - now.getTime()) / 60_000;
  const day = formatWeekday(dayOf(home.ordering_for));
  const timer = (urgent = false) => (
    <Timer size={20} strokeWidth={1.75} aria-hidden className={urgent ? "text-attention" : "text-asphalt-700"} />
  );

  if (minutesLeft > 0 && minutesLeft <= 240) {
    const urgent = minutesLeft < 60;
    return (
      <div
        className={`flex items-start gap-3 rounded-card px-4 py-3 ${urgent ? "bg-attention-soft" : "border border-asphalt-200 bg-white"}`}
      >
        {timer(urgent)}
        <div>
          <p className="t-label">
            Orders for {day} close at {clock(cutoff)}
          </p>
          <p className="t-h3 num">{formatDuration(minutesLeft)} left</p>
        </div>
      </div>
    );
  }
  if (minutesLeft > 0 && daysBetween(now, cutoff) === 0) {
    return (
      <div className="flex min-h-12 items-center gap-3 rounded-card border border-asphalt-200 bg-white px-4 py-3">
        {timer()}
        <p className="t-body">
          Orders for {day} close today at {clock(cutoff)}
        </p>
      </div>
    );
  }
  return (
    <div className="flex items-start gap-3 rounded-card border border-asphalt-200 bg-white px-4 py-3">
      {timer()}
      <div>
        <p className="t-label">New orders now go on {day}'s run</p>
        <p className="t-body text-asphalt-700">
          Orders for {day} close {dayWhen(cutoff, now)} at {clock(cutoff)}
        </p>
      </div>
    </div>
  );
}

/** Updates: every notice the store has had, newest first, with how many are still unread. Each opens in full, which
 *  marks it read. */
function Updates({ home, notices }: { home: StoreHome; notices: StoreNotice[] }) {
  const [open, setOpen] = useState(false);
  if (!notices.length) return null;
  const unread = home.unread_notices;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex min-h-12 items-center gap-3 rounded-card border border-asphalt-200 bg-white px-4 py-2 text-left"
      >
        <Bell size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
        <span className="min-w-0 flex-1 t-body-strong text-asphalt-900">Updates</span>
        {unread ? (
          <span className="num rounded-chip bg-petrol-50 px-2 py-0.5 t-label-strong text-petrol-700">{unread} new</span>
        ) : null}
        <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Updates"
        meta={unread ? `${unread} new` : "Newest first"}
      >
        <ul className="flex flex-col">
          {notices.map((n) => (
            <li key={n.id} className="border-b border-asphalt-200 last:border-b-0">
              <Link to={`/store/notices/${n.id}`} className="flex min-h-14 items-start gap-3 py-3">
                <span
                  aria-hidden
                  className={cx("mt-2 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-petrol-700")}
                />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className={cx("text-asphalt-900", n.read_at ? "t-body" : "t-body-strong")}>
                    {n.read_at ? null : <span className="sr-only">New. </span>}
                    {n.title}
                  </span>
                  <span className="t-label text-asphalt-700">{noticeLine(n, home)}</span>
                  <span className="t-caption text-asphalt-500">
                    {clock(n.created_at)}, {formatDayLong(n.created_at)}
                  </span>
                </span>
                <ChevronRight size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-asphalt-700" />
              </Link>
            </li>
          ))}
        </ul>
      </Sheet>
    </>
  );
}
