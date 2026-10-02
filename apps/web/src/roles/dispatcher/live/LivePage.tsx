import { ChevronDown, Package, PackageX, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { useMe } from "@/app/session";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { RelayMark } from "@/design/Logo";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { dayOf, formatDayLong, formatDuration, formatTime, formatWeekday } from "@/lib/time";
import { DeskHeader, useDepot } from "../DispatcherShell";
import { type FeedItem, type ShortfallDetail, useDecide, useFeed } from "./api";

/** DSP-04 Live runs. The exceptions feed comes first: at phone width it is all the dispatcher sees, so a flag from
 *  the dock at night reaches the dispatcher on call at home, with the decision it needs. The run rows join it with
 *  the drivers' app. */
export function LivePage() {
  const [depotChoice, setDepot] = useDepot("Kandy");
  const depot = depotChoice === "All" ? "Kandy" : depotChoice;
  const feed = useFeed(depot);
  const data = feed.data;
  const meta = data ? `${data.depot_label} · ${formatDayLong(dayOf(data.run_date))}` : undefined;
  return (
    <div className="flex flex-col">
      <div className="max-md:hidden">
        <DeskHeader title="Live runs" meta={meta} depot={depot} onDepot={setDepot} allowAll={false} />
      </div>
      <PhoneHeader meta={meta} />
      <main className="mx-auto flex w-full max-w-[720px] flex-col gap-3 px-4 py-4">
        {data && !data.now.length && !data.earlier.length ? (
          <p className="t-body text-asphalt-700">
            Nothing needs you. Flags from the dock, delays and missed stops appear here the moment they happen.
          </p>
        ) : null}
        {data?.now.length ? <h2 className="t-caption text-asphalt-500">Now</h2> : null}
        {data?.now.map((item) => (
          <FeedCard key={item.id} item={item} depot={depot} />
        ))}
        {data?.earlier.length ? <h2 className="mt-2 t-caption text-asphalt-500">Earlier today</h2> : null}
        {data?.earlier.map((item) => (
          <FeedCard key={item.id} item={item} depot={depot} />
        ))}
      </main>
    </div>
  );
}

/** The phone header (Top bar / phone header / home): the Relay mark, the title and the day. The depot switch
 *  belongs to the desk; the phone opens on the hub the dispatcher is on call for. */
function PhoneHeader({ meta }: { meta?: string }) {
  return (
    <header className="flex min-h-20 items-center gap-3 border-b border-asphalt-200 bg-white px-4 py-3 md:hidden">
      <RelayMark size={24} />
      <div className="min-w-0">
        <h1 className="t-h1">Live runs</h1>
        {meta ? <p className="t-label text-asphalt-700">{meta}</p> : null}
      </div>
    </header>
  );
}

/** "1 rice and dhal case", "6 rice and dhal cases" */
function casesOf(count: number, name = "") {
  return `${count} ${name ? `${name} ` : ""}${count === 1 ? "case" : "cases"}`;
}

const lowerFirst = (text: string) => text.charAt(0).toLowerCase() + text.slice(1);

function FeedCard({ item, depot }: { item: FeedItem; depot: "Kandy" | "Peliyagoda" }) {
  const open = !item.handled_at;
  return open ? <OpenItem item={item} depot={depot} /> : <DoneItem item={item} />;
}

/** Exception item / attention / expanded: what happened, and the decision it asks for. */
function OpenItem({ item, depot }: { item: FeedItem; depot: "Kandy" | "Peliyagoda" }) {
  const now = useSimNow(15_000);
  const minutes = now ? Math.max(0, Math.round((now.getTime() - Date.parse(item.created_at)) / 60_000)) : 0;
  const s = item.shortfall;
  const Icon = s?.kind === "damaged" ? TriangleAlert : PackageX;
  return (
    <article className="relative flex flex-col gap-3 overflow-hidden rounded-card border border-asphalt-300 bg-white p-4 pl-5">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-attention" />
      <header className="flex items-start gap-3">
        <Icon size={24} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-attention" />
        <h3 className="min-w-0 flex-1 t-h3">{item.title}</h3>
        <span className="num shrink-0 t-label text-asphalt-500">{formatDuration(minutes)}</span>
      </header>
      {s ? (
        <ShortfallDecision item={item} s={s} depot={depot} />
      ) : (
        <p className="t-body text-asphalt-700">{item.body}</p>
      )}
    </article>
  );
}

function ShortfallDecision({ item, s, depot }: { item: FeedItem; s: ShortfallDetail; depot: "Kandy" | "Peliyagoda" }) {
  const decide = useDecide(depot);
  const place = `${s.outlet_id} ${s.place} · ${s.order_ref}`;
  const nextDay = s.next_day ? formatWeekday(dayOf(s.next_day)) : null;
  const store = calledName(s.store_contact);
  const driver = calledName(s.driver);
  const cases = lowerFirst(s.case_name);
  const kept =
    s.kind === "missing"
      ? "None left on the shelf."
      : `The damaged ${s.qty === 1 ? "case stays" : "cases stay"} at the hub.`;
  // What the hub holds decides whether holding the truck could help: a spare, or a delivery before it leaves.
  // Where Relay does not know the hub's stock of this case type, the box says what holding the truck costs.
  const hold = `Holding ${s.vehicle_id} past ${formatTime(s.departs)} delays ${s.trip_stops === 1 ? "its only stop" : `all ${s.trip_stops} stops`}.`;
  const spare =
    s.hub_spare === null
      ? null
      : s.hub_spare > 0
        ? `${s.hub_spare} spare ${cases} ${s.hub_spare === 1 ? "case" : "cases"} at the hub.`
        : "No spare at the hub.";
  const delivery = s.next_delivery_at
    ? ` The next ${cases} delivery comes at ${formatTime(s.next_delivery_at)}, ${Date.parse(s.next_delivery_at) > Date.parse(s.departs) ? "after" : "before"} ${s.vehicle_id} leaves.`
    : "";
  const stock = spare === null ? null : `${spare}${delivery}`;
  const situation = s.kind === "missing" ? (stock ?? `${kept} ${hold}`) : `${kept} ${stock ?? hold}`;
  const join = s.qty === 1 ? `The ${s.kind} case joins` : `The ${s.qty} ${s.kind} cases join`;
  return (
    <>
      <div className="flex flex-col gap-0.5 t-label text-asphalt-700">
        <p>
          {s.flagged_by ?? "The dock"}, {depot === "Kandy" ? "Kandy hub" : depot} dock, {formatTime(s.flagged_at)}
        </p>
        <p>
          <span className="latin">{s.vehicle_id}</span> leaves {formatTime(s.departs)}
        </p>
      </div>
      <div className="flex flex-col gap-1 rounded-button border border-asphalt-200 bg-asphalt-50 p-3">
        <p className="latin t-body-strong">{place}</p>
        <p className="flex items-center gap-1.5 t-body">
          <Package size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
          {s.kind === "missing"
            ? `${s.temp_label} · ${s.planned - s.qty} of ${casesOf(s.planned, cases)} on the shelf`
            : `${s.temp_label} · ${s.qty} of ${casesOf(s.planned, cases)} damaged, kept off the truck`}
        </p>
        <p className="t-body text-asphalt-700">{situation}</p>
        {s.photo_id ? (
          <a href={`/api/photos/${s.photo_id}?as=dispatcher`} target="_blank" rel="noreferrer" className="self-start">
            <img
              src={`/api/photos/${s.photo_id}?as=dispatcher`}
              alt={`The damaged ${cases} ${s.qty === 1 ? "case" : "cases"}, from the dock`}
              className="mt-1 h-28 w-auto rounded-button border border-asphalt-200 object-cover"
            />
          </a>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">
        <p className="t-label text-asphalt-500">Your decision</p>
        <div className="flex flex-col gap-2">
          <Button
            variant="primary"
            full
            icon={Send}
            disabled={decide.isPending}
            onClick={() => decide.mutate({ shortfallId: s.id, decision: "send_short" })}
          >
            Send short, add to {nextDay ?? "the next order"}
          </Button>
          <p className="t-dense text-asphalt-700">
            {driver ? `${driver} takes ${casesOf(s.stop_cases - s.qty)} to stop ${s.stop_seq}. ` : ""}
            {s.next_order_ref
              ? `${join} ${store ? `${store}'s` : "the store's"} ${nextDay} ${s.temp_label.toLowerCase()} order, ${s.next_order_ref}, marked from ${formatWeekday(dayOf(s.run_date))}: ${formatDayLong(dayOf(s.next_day ?? ""))}, ${s.window}.`
              : "The store has no next order yet. Relay opens one for the next run."}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <Button
            full
            disabled={decide.isPending}
            onClick={() => decide.mutate({ shortfallId: s.id, decision: "no_replacement" })}
          >
            Send short, no replacement
          </Button>
          <p className="t-dense text-asphalt-500">{s.store_contact ?? "The store"} is told either way.</p>
        </div>
        {decide.error ? <p className="t-dense text-problem">{decide.error.message}</p> : null}
        <p className="text-center t-caption text-asphalt-500">
          Sent to your phone at {formatTime(item.created_at)} because you are on call tonight.
        </p>
      </div>
    </>
  );
}

/** Exception item / done: collapsed to its title and one line, and opens to the record of what happened. */
function DoneItem({ item }: { item: FeedItem }) {
  const [expanded, setExpanded] = useState(false);
  const s = item.shortfall;
  const Icon = s?.kind === "damaged" ? TriangleAlert : PackageX;
  return (
    <article className="relative overflow-hidden rounded-card border border-asphalt-200 bg-white">
      <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-done" />
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start gap-3 p-4 pl-5 text-left hover:bg-asphalt-50"
      >
        <Icon size={20} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-done" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="t-h3">{item.title}</span>
          <span className="t-label text-asphalt-700">{s?.decided_at ? decidedLine(s) : item.outcome || item.body}</span>
        </span>
        <ChevronDown
          size={20}
          strokeWidth={1.75}
          aria-hidden
          className={cx("mt-0.5 shrink-0 text-asphalt-500", expanded && "rotate-180")}
        />
      </button>
      {expanded ? (
        <div className="px-4 pb-4 pl-5">
          {s?.decided_at ? (
            <ShortfallRecord item={item} s={s} />
          ) : (
            <p className="t-label text-asphalt-700">
              {item.handled_at ? `${formatTime(item.handled_at)} · ` : ""}
              {item.handled_by ? `${item.handled_by}: ` : ""}
              {item.outcome || item.body}
            </p>
          )}
        </div>
      ) : null}
    </article>
  );
}

/** "6 rice and dhal cases short. Decided 2:52 AM: send short, add to Thursday." */
function decidedLine(s: ShortfallDetail) {
  const answer =
    s.decision === "send_short"
      ? `send short, add to ${s.next_day ? formatWeekday(dayOf(s.next_day)) : "the next order"}`
      : "send short, no replacement";
  return `${casesOf(s.qty, lowerFirst(s.case_name))} short. Decided ${formatTime(s.decided_at ?? "")}: ${answer}.`;
}

/** The shortfall's record, in the order it happened: the flag, the answer, the store told, the load handed over. */
function ShortfallRecord({ item, s }: { item: FeedItem; s: ShortfallDetail }) {
  const me = useMe("dispatcher");
  const who = s.decided_by && s.decided_by === me.data?.display_name ? "You" : (s.decided_by ?? "The dispatcher");
  const flagged = `${casesOf(s.qty, lowerFirst(s.case_name))} ${s.kind} on ${s.vehicle_id}, stop ${s.stop_seq}`;
  const found = s.kind === "missing" ? `${s.planned - s.qty} of ${s.planned} on the shelf.` : "Kept off the truck.";
  const decided = formatTime(s.decided_at ?? "");
  return (
    <ol className="flex flex-col gap-1 t-label text-asphalt-700">
      <li>
        {formatTime(s.flagged_at)} · {s.flagged_by ?? "The dock"} flagged {flagged}. {found}
      </li>
      <li>
        {decided} · {who} decided: {lowerFirst(item.outcome)}
      </li>
      <li>
        {decided} · {s.store_contact ?? "The store"} was told
        {s.store_seen_at ? `, and read it at ${formatTime(s.store_seen_at)}.` : "."}
      </li>
      {s.completed_at ? (
        <li>
          {formatTime(s.completed_at)} · Load complete: {s.loaded_cases} of {casesOf(s.planned_cases)}.
          {s.accepted_by ? ` ${calledName(s.accepted_by)} accepted the load.` : ""}
        </li>
      ) : null}
    </ol>
  );
}
