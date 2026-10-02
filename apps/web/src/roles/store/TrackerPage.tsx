import {
  CircleAlert,
  Clock,
  CloudOff,
  History,
  MapPin,
  PackageCheck,
  ReceiptText,
  Route,
  Users,
  Warehouse,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { ApiError } from "@/api/client";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { BackHeader, Card, PhoneScreen } from "@/design/Phone";
import { StatusChip } from "@/design/StatusChip";
import { calledName } from "@/lib/names";
import { roundTo5 } from "@/lib/time";
import { type StoreHome, type Tracker, useStoreHome, useStoreNotices, useTracker } from "./api";
import { Contents, DriverRow, EstimateMark, NotPlanned, OfflineNotice, RunCard } from "./parts";
import { around, clock, dockWords, lastHeard, shortLines, shortRow, span, stopsBefore, windowOf } from "./words";

/** STM-04 Your delivery: when it will arrive, from the driver's own records. While the driver's phone is quiet it
 *  says so plainly and gives the likely range; once the estimate has passed, the store can confirm receipt itself. */
export function TrackerPage() {
  const { orderRef } = useParams();
  const tracker = useTracker(orderRef);
  const home = useStoreHome();
  const notices = useStoreNotices();
  const now = useSimNow(15_000);
  const header = <BackHeader title="Your delivery" back="/store" />;
  const t = tracker.data;
  const data = home.data;

  if (tracker.error instanceof ApiError && tracker.error.status === 404) {
    return (
      <PhoneScreen header={header}>
        <Notice tone="info" field>
          This order is not at your store.
        </Notice>
      </PhoneScreen>
    );
  }
  if (!t || !data || !now) return <PhoneScreen header={header}>{null}</PhoneScreen>;
  if (t.stop_seq === null) return <NotPlanned header={header} />;

  const failed = [tracker, home].some((q) => q.isRefetchError && q.error instanceof ApiError && q.error.offline);
  const departed = t.status !== "scheduled";
  const after = ["arrived", "delivered", "confirmed", "disputed"].includes(t.status);
  const names = Object.fromEntries(data.case_types.map((c) => [c.code, c.name]));
  const shorts = shortLines(t, data, notices.data ?? []);

  return (
    <PhoneScreen header={header}>
      <OfflineNotice failed={failed} knownAt={data.now} />
      <ArrivalCard tracker={t} home={data} now={now} />
      {departed && t.stops.length ? <RunCard tracker={t} /> : null}
      <DriverRow tracker={t} depot={data.outlet.depot} />
      {t.on_board.length ? (
        <Card className="flex flex-col gap-2 p-4">
          <h2 className="t-h3">{after ? "Loaded for you" : "Coming to you"}</h2>
          <Contents lines={t.on_board.map((l) => ({ name: names[l.case_type] ?? l.name, qty: l.on_board }))} />
          {shorts.map((s) => (
            <p key={s.case_type} className="flex items-center gap-2 t-label text-attention">
              <Clock size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
              {shortRow(s.name, s.qty, s.day, true).replace(/\.$/, "")}
            </p>
          ))}
          {after ? null : (
            <p className="flex items-center gap-3 t-body">
              <Warehouse size={20} strokeWidth={1.75} aria-hidden className="shrink-0 text-asphalt-700" />
              {dockWords(data.outlet.dock_type).unloading}
            </p>
          )}
        </Card>
      ) : null}
    </PhoneScreen>
  );
}

function ArrivalCard({ tracker: t, home, now }: { tracker: Tracker; home: StoreHome; now: Date }) {
  const navigate = useNavigate();
  const name = calledName(t.driver);
  const window = windowOf(home.outlet);
  const kindChip = <StatusChip kind={t.kind === "chilled" ? "chilled" : "dry"} />;
  const ref = <p className="latin num t-label text-asphalt-500">{t.order_ref}</p>;
  const planned = t.planned ? `Planned ${clock(t.planned)}` : null;
  const receipt = () => navigate(`/store/orders/${t.order_ref}/receipt`);
  const silentSince = t.last_heard ? clock(t.last_heard) : null;

  if (t.status === "confirmed" || t.status === "disputed" || t.status === "delivered" || t.status === "arrived") {
    const r = t.receipt;
    const title =
      t.status === "arrived"
        ? `${name} is at your store`
        : t.status === "delivered"
          ? `Delivered ${t.proof ? clock(t.proof.delivered_at) : ""}`
          : t.status === "confirmed"
            ? "Receipt confirmed"
            : "Issue sent";
    const body =
      t.status === "arrived"
        ? "Check the goods at your dock, then confirm receipt."
        : t.status === "delivered"
          ? t.proof?.receiver
            ? `Received by ${t.proof.receiver}. Check the goods, then confirm receipt.`
            : "Check the goods, then confirm receipt."
          : `You ${t.status === "confirmed" ? "confirmed receipt" : "sent an issue"} at ${r ? clock(r.confirmed_at) : ""}.`;
    const chip =
      t.status === "arrived" ? (
        <StatusChip tone="done" icon={MapPin}>
          Arrived
        </StatusChip>
      ) : t.status === "delivered" ? (
        <StatusChip kind="delivered" />
      ) : t.status === "confirmed" ? (
        <StatusChip kind="confirmed" />
      ) : (
        <StatusChip tone="problem" icon={CircleAlert}>
          Issue sent
        </StatusChip>
      );
    return (
      <Card className="flex flex-col gap-2 p-5">
        <Chips>
          {kindChip}
          {chip}
        </Chips>
        {ref}
        <h2 className="t-h2">{title}</h2>
        <p className="t-body text-asphalt-700">{body}</p>
        <Button
          variant="primary"
          full
          icon={t.can_confirm ? PackageCheck : ReceiptText}
          className="mt-2"
          onClick={receipt}
        >
          {t.can_confirm ? "Confirm receipt" : "See your receipt"}
        </Button>
      </Card>
    );
  }

  if (t.passed) {
    return (
      <Card className="flex flex-col gap-2 p-5">
        <Chips>
          {kindChip}
          <StatusChip kind="estimatePassed" />
        </Chips>
        {ref}
        <p className="num t-label text-asphalt-700">
          {planned ? `${planned} · ` : ""}Expected around {t.expected ? around(t.expected) : ""}
        </p>
        <h2 className="t-h2">The estimate has passed</h2>
        <p className="t-body">
          {!silentSince
            ? `No word from ${name} on the road yet.`
            : t.out_of_contact
              ? `No word from ${name} since ${silentSince}.`
              : `${lastHeard(t)}.`}
        </p>
        <div className="my-1 h-px bg-asphalt-200" />
        <div className="flex flex-col gap-1">
          <p className="t-body-strong">Goods already at your store?</p>
          <p className="t-body text-asphalt-700">
            Check them and confirm. {name}'s proof joins your receipt when that phone reaches us.
          </p>
        </div>
        {t.can_confirm ? (
          <Button variant="primary" full icon={PackageCheck} className="mt-2" onClick={receipt}>
            Confirm receipt
          </Button>
        ) : null}
      </Card>
    );
  }

  const silent = t.out_of_contact && t.status === "on_the_way";
  const range = t.range;
  const dock = dockWords(home.outlet.dock_type);
  // the range never starts before now, so when it starts now, "from now" is the honest staffing call
  const fromNow = range ? roundTo5(range[0]).getTime() <= roundTo5(now).getTime() + 5 * 60_000 : false;
  return (
    <Card className="flex flex-col gap-2 p-5">
      <Chips>
        {kindChip}
        {silent && silentSince ? (
          <StatusChip tone="waiting" icon={CloudOff}>
            No word since {silentSince}
          </StatusChip>
        ) : (
          <StatusChip kind={t.status === "scheduled" ? "scheduled" : "onTheWay"} />
        )}
      </Chips>
      {ref}
      <div className="flex flex-col">
        <p className="t-label text-asphalt-700">{t.status === "scheduled" ? "Expected around" : "Arriving around"}</p>
        <p className="num t-display text-asphalt-900">{t.expected ? around(t.expected) : ""}</p>
        <p className="t-body text-asphalt-700">Your window is {window}</p>
        {planned ? <p className="num t-label text-asphalt-500">{planned}</p> : null}
      </div>
      {silent && range ? (
        <p className="flex items-center gap-2 t-body text-asphalt-700">
          <EstimateMark />
          Likely between {span(range[0], range[1], "and")}.
        </p>
      ) : null}
      <div className="my-1 h-px bg-asphalt-200" />
      {silent ? (
        <>
          <Row icon={<Users size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-900" />}>
            <span className="t-body-strong">
              Have someone {dock.at} {fromNow || !range ? "from\u00a0now" : `from ${around(range[0])}`}.
            </span>
          </Row>
          <Row icon={<EstimateMark />}>
            <span className="t-h3">{t.position || `Probably ${stopsBefore(t.stops_before).toLowerCase()}.`}</span>
          </Row>
          {silentSince ? (
            <Row icon={<CloudOff size={16} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />}>
              <span className="t-label text-asphalt-700">{lastHeard(t)}</span>
            </Row>
          ) : null}
          <Notice tone="waiting" compact field>
            <p>
              {name}'s phone last reached us at {silentSince}
              {lastEvent(t)}. {hint(home.outlet.depot)}
            </p>
            <p className="text-asphalt-700">They update as soon as the phone reconnects.</p>
          </Notice>
        </>
      ) : (
        <>
          <Row icon={<Route size={20} strokeWidth={1.75} aria-hidden className="text-asphalt-900" />}>
            <span className="t-h3">{stopsBefore(t.stops_before)}</span>
          </Row>
          {t.status === "scheduled" ? (
            <p className="t-label text-asphalt-700">Times start to update once the truck leaves the hub.</p>
          ) : lastHeard(t) ? (
            <Row icon={<History size={16} strokeWidth={1.75} aria-hidden className="text-asphalt-700" />}>
              <span className="t-label text-asphalt-700">{lastHeard(t)}</span>
            </Row>
          ) : null}
        </>
      )}
    </Card>
  );
}

function Chips({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-2">{children}</div>;
}

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <span className="flex w-5 shrink-0 justify-center">{icon}</span>
      {children}
    </div>
  );
}

/** ", after arriving at Mawanella": the last stop event the driver's phone sent before it went quiet. */
function lastEvent(t: Tracker): string {
  const heard = t.last_heard ? new Date(t.last_heard).getTime() : Number.POSITIVE_INFINITY;
  const last = [...t.stops]
    .reverse()
    .find((s) => (s.state === "arrived" || s.state === "delivered") && s.at && new Date(s.at).getTime() <= heard);
  if (!last) return "";
  return last.state === "arrived" ? `, after arriving at ${last.place}` : `, after the delivery at ${last.place}`;
}

/** The only hint at a cause a store screen gives, and only where it is true of the roads. */
function hint(depot: string): string {
  return depot === "Kandy"
    ? "Hill roads often lose signal, so these times are our estimate."
    : "Until we hear again, these times are our estimate.";
}
