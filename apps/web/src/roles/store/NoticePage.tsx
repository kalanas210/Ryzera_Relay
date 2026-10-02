import { Calendar, Check, Info, Lock, RefreshCw, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { Notice as NoticeBox } from "@/design/Notice";
import { BackHeader, Card, PhoneScreen } from "@/design/Phone";
import { StatusChip } from "@/design/StatusChip";
import { dayOf, formatDayLong, formatWeekday, isoDay } from "@/lib/time";
import {
  type Notice,
  type StoreHome,
  type StoreOrder,
  type Tracker,
  useAcknowledge,
  useStoreHome,
  useStoreNotices,
  useTracker,
} from "./api";
import { Contents, DetailRow } from "./parts";
import { around, cases, clock, placedAt, windowOf } from "./words";

const ACKNOWLEDGED = new Set(["order_deferred", "short_delivery"]);

/** STM-03 Delivery update: a deferral or a short delivery in full, and "Got it" so the dispatcher knows it was
 *  seen. Other notices open here too, as their title and body. */
export function NoticePage() {
  const { noticeId } = useParams();
  const notices = useStoreNotices();
  const home = useStoreHome();
  const now = useSimNow(15_000);
  const navigate = useNavigate();
  const notice = notices.data?.find((n) => n.id === noticeId);
  const data = home.data;
  const orderRef = typeof notice?.data.order_ref === "string" ? notice.data.order_ref : undefined;
  const order = data?.orders.find((o) => o.order_ref === orderRef);
  // a deferral names the order still coming that day; a short delivery the order itself
  const sibling =
    notice?.kind === "order_deferred" && order && data
      ? data.orders.find(
          (o) => o.requested_date === order.requested_date && o.run_date === o.requested_date && o.id !== order.id,
        )
      : undefined;
  const tracker = useTracker(notice?.kind === "short_delivery" ? orderRef : sibling?.order_ref);
  // back to whatever opened it, or to My orders when it was opened straight from a notification
  const back = () => ((window.history.state as { idx?: number } | null)?.idx ? navigate(-1) : navigate("/store"));
  const header = <BackHeader title="Delivery update" back={back} />;

  if (!notices.data || !data || !now) return <PhoneScreen header={header}>{null}</PhoneScreen>;
  if (!notice) {
    return (
      <PhoneScreen
        header={header}
        bar={
          <Button variant="primary" full onClick={() => navigate("/store")}>
            Back to my orders
          </Button>
        }
      >
        <NoticeBox tone="info" field>
          This update is not on your phone any more. Your orders show where things stand now.
        </NoticeBox>
      </PhoneScreen>
    );
  }

  return (
    <PhoneScreen
      header={header}
      bar={
        ACKNOWLEDGED.has(notice.kind) ? (
          <GotIt notice={notice} />
        ) : (
          <Button variant="primary" full onClick={() => navigate("/store")}>
            Back to my orders
          </Button>
        )
      }
    >
      <p className="t-caption text-asphalt-500">
        Sent {clock(notice.created_at)}, {formatDayLong(notice.created_at)}
      </p>
      {notice.kind === "order_deferred" && order ? (
        <Deferral notice={notice} order={order} sibling={sibling} tracker={tracker.data} home={data} now={now} />
      ) : notice.kind === "short_delivery" && order ? (
        <ShortDelivery notice={notice} order={order} tracker={tracker.data} home={data} now={now} />
      ) : (
        <>
          <h2 className="t-h2">{notice.title}</h2>
          <Card className="flex flex-col gap-2 p-4">
            {notice.body.split("\n\n").map((p) => (
              <p key={p} className="t-body">
                {p}
              </p>
            ))}
          </Card>
        </>
      )}
    </PhoneScreen>
  );
}

/** Got it, and once Relay has it, "Seen 6:41 PM". Never "Seen" before the server answers. */
function GotIt({ notice }: { notice: Notice }) {
  const ack = useAcknowledge();
  const navigate = useNavigate();
  if (notice.acknowledged_at) {
    return (
      <>
        <NoticeBox tone="done" compact className="items-center justify-center" role="status">
          Seen {clock(notice.acknowledged_at)}. The dispatcher can see this.
        </NoticeBox>
        <Button key="back" full onClick={() => navigate("/store")}>
          Back to my orders
        </Button>
      </>
    );
  }
  const offline = ack.error instanceof ApiError && ack.error.offline;
  return (
    <>
      {offline ? (
        <NoticeBox tone="waiting" compact field icon={WifiOff} role="status">
          Not sent. Your phone is offline.
        </NoticeBox>
      ) : ack.error ? (
        <NoticeBox tone="problem" compact field role="alert">
          {ack.error.message}
        </NoticeBox>
      ) : (
        <p className="text-center t-caption text-asphalt-500">Got it lets the dispatcher know you've seen this.</p>
      )}
      <Button
        key="ack"
        variant="primary"
        full
        icon={offline ? RefreshCw : Check}
        disabled={ack.isPending}
        onClick={() => ack.mutate(notice.id)}
      >
        {offline ? "Try again" : "Got it"}
      </Button>
    </>
  );
}

function OrderMeta({ order, now }: { order: StoreOrder; now: Date }) {
  return (
    <p className="t-label text-asphalt-500">
      <span className="latin num">{order.order_ref}</span>. {placedAt(order, now)}
    </p>
  );
}

function KindChip({ order }: { order: StoreOrder }) {
  return <StatusChip kind={order.temp === "chilled" ? "chilled" : "dry"} />;
}

function Deferral({
  notice,
  order,
  sibling,
  tracker,
  home,
  now,
}: {
  notice: Notice;
  order: StoreOrder;
  sibling: StoreOrder | undefined;
  tracker: Tracker | undefined;
  home: StoreHome;
  now: Date;
}) {
  const window = windowOf(home.outlet);
  const deferral = order.deferral;
  const from = dayOf(deferral?.from_date ?? order.requested_date);
  const to = dayOf(deferral?.to_date ?? order.run_date);
  const reason = (deferral?.store_notice ?? notice.body).split("\n\n");
  const siblingKind = sibling?.temp === "chilled" ? "chilled" : "dry";
  const expected = tracker?.expected && tracker.stop_seq !== null ? around(tracker.expected) : null;
  const done = tracker && ["delivered", "confirmed", "disputed"].includes(tracker.status);
  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <StatusChip kind="deferred">Moved to {formatWeekday(to)}</StatusChip>
        <h2 className="t-h2">{notice.title}</h2>
      </div>
      <Card className="flex flex-col gap-3 p-4">
        <div>
          <KindChip order={order} />
        </div>
        <div className="flex flex-col gap-0.5">
          <Contents lines={order.lines} />
          <OrderMeta order={order} now={now} />
        </div>
        <div className="h-px bg-asphalt-200" />
        <div className="flex flex-col gap-2">
          <ChangeRow label="Was">
            <s className="t-body text-asphalt-500">
              {formatDayLong(from)}, {window}
            </s>
          </ChangeRow>
          <ChangeRow label="Now" now>
            <span className="t-h3 text-asphalt-900">
              {formatDayLong(to)}, {window}
            </span>
          </ChangeRow>
        </div>
        <DetailRow icon={Lock}>This order won't be moved again unless the dispatcher approves it.</DetailRow>
      </Card>
      {sibling ? (
        <Card className="flex flex-col gap-2 p-4">
          <div>
            <KindChip order={sibling} />
          </div>
          <p className="t-body">
            {done
              ? `Your ${siblingKind} order came ${formatWeekday(from)}.`
              : expected
                ? `Your ${siblingKind} order still comes ${formatWeekday(from)}, expected around ${expected}.`
                : `Your ${siblingKind} order still comes ${formatWeekday(from)}.`}
          </p>
          <p className="latin num t-label text-asphalt-500">{sibling.order_ref}</p>
        </Card>
      ) : null}
      <Card className="flex flex-col gap-2 p-4">
        <h3 className="t-h3">Why it moved</h3>
        {reason.map((p) => (
          <p key={p} className="t-body">
            {p}
          </p>
        ))}
      </Card>
    </>
  );
}

function ChangeRow({ label, now, children }: { label: string; now?: boolean; children: ReactNode }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className={now ? "w-12 shrink-0 t-label-strong text-attention" : "w-12 shrink-0 t-label text-asphalt-500"}>
        {label}
      </span>
      {children}
    </div>
  );
}

function ShortDelivery({
  notice,
  order,
  tracker,
  home,
  now,
}: {
  notice: Notice;
  order: StoreOrder;
  tracker: Tracker | undefined;
  home: StoreHome;
  now: Date;
}) {
  const d = notice.data as {
    case_type?: string;
    qty?: number;
    planned?: number;
    added_to?: string | null;
    added_day?: string | null;
    day_label?: string | null;
    still?: string;
    why?: string;
  };
  const qty = d.qty ?? 0;
  const names = Object.fromEntries(home.case_types.map((c) => [c.code, c.name]));
  const window = windowOf(home.outlet);
  const run = dayOf(order.run_date);
  const day = isoDay(now) === order.run_date ? "Today" : formatWeekday(run);
  const comingNow = tracker && ["scheduled", "on_the_way", "arrived"].includes(tracker.status) && tracker.expected;
  const lines = tracker?.on_board.length
    ? tracker.on_board.map((l) => ({ code: l.case_type, qty: l.on_board, was: l.short > 0 ? l.ordered : null }))
    : order.lines.map((l) =>
        l.case_type === d.case_type
          ? { code: l.case_type, qty: l.qty - qty, was: l.qty }
          : { code: l.case_type, qty: l.qty, was: null },
      );
  const shortLine = lines.find((l) => l.code === d.case_type);
  const sameMorning = d.added_day
    ? home.orders.find((o) => o.run_date === d.added_day && o.requested_date !== o.run_date && o.id !== order.id)
    : undefined;
  const name = names[d.case_type ?? ""] ?? d.case_type ?? "";
  return (
    <>
      <div className="flex flex-col items-start gap-2">
        <StatusChip kind="short">{qty} short</StatusChip>
        <h2 className="t-h2">{notice.title}</h2>
      </div>
      <Card className="flex flex-col gap-3 p-4">
        <div>
          <KindChip order={order} />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="t-body text-asphalt-700">
            {day}, {window}
            {comingNow && tracker?.expected ? `, expected around ${around(tracker.expected)}` : ""}
          </p>
          <OrderMeta order={order} now={now} />
        </div>
        <div className="h-px bg-asphalt-200" />
        <ul className="flex flex-col">
          {lines.map((l) => (
            <li key={l.code} className="flex min-h-14 items-center justify-between gap-3">
              <span className="t-body text-asphalt-900">{names[l.code] ?? l.code}</span>
              <span className="flex items-baseline gap-2">
                {l.was !== null ? <span className="t-label text-attention">was {l.was}</span> : null}
                <span className="num t-h3">{l.qty}</span>
              </span>
            </li>
          ))}
        </ul>
      </Card>
      <Card className="flex flex-col gap-2 p-4">
        <h3 className="t-h3">
          {d.added_to
            ? `The ${qty} ${qty === 1 ? "case" : "cases"} still to come`
            : `What happens to the ${qty} ${qty === 1 ? "case" : "cases"}`}
        </h3>
        {d.added_to && d.day_label ? (
          <DetailRow icon={Calendar}>
            {d.day_label}, {window}
          </DetailRow>
        ) : null}
        <p className="t-body text-asphalt-700">
          {d.still}
          {sameMorning
            ? ` Your ${sameMorning.temp === "chilled" ? "chilled" : "dry"} order ${sameMorning.order_ref} comes the same morning.`
            : ""}
        </p>
      </Card>
      {d.why ? (
        <Card className="flex flex-col gap-2 p-4">
          <h3 className="t-h3">Why</h3>
          <p className="t-body">{d.why}</p>
        </Card>
      ) : null}
      {shortLine ? (
        <NoticeBox tone="info" icon={Info} field>
          When you check this delivery, the list will show {cases(name, shortLine.qty)}. There's no need to report
          {qty === 1 ? " this one" : ` these ${qty}`} as missing.
        </NoticeBox>
      ) : null}
    </>
  );
}
