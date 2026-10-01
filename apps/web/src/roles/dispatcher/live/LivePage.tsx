import { Package, PackageX, Send, TriangleAlert } from "lucide-react";
import { useSimNow } from "@/demo/clock";
import { Button } from "@/design/Button";
import { cx } from "@/lib/cx";
import { calledName } from "@/lib/names";
import { dayOf, formatDayLong, formatTime, formatWeekday } from "@/lib/time";
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
  return (
    <div className="flex flex-col">
      <DeskHeader
        title="Live runs"
        meta={data ? `${data.depot_label} · ${formatDayLong(dayOf(data.run_date))}` : undefined}
        depot={depot}
        onDepot={setDepot}
        allowAll={false}
      />
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

function FeedCard({ item, depot }: { item: FeedItem; depot: "Kandy" | "Peliyagoda" }) {
  const now = useSimNow(15_000);
  const open = !item.handled_at;
  const minutes = now ? Math.max(0, Math.round((now.getTime() - Date.parse(item.created_at)) / 60_000)) : 0;
  const s = item.shortfall;
  const Icon = s?.kind === "damaged" ? TriangleAlert : PackageX;
  return (
    <article
      className={cx(
        "relative flex flex-col gap-3 overflow-hidden rounded-card border bg-white p-4 pl-5",
        open ? "border-asphalt-300" : "border-asphalt-200",
      )}
    >
      <span aria-hidden className={cx("absolute inset-y-0 left-0 w-1", open ? "bg-attention" : "bg-asphalt-300")} />
      <header className="flex items-start gap-3">
        <Icon
          size={24}
          strokeWidth={1.75}
          aria-hidden
          className={cx("mt-0.5 shrink-0", open ? "text-attention" : "text-asphalt-500")}
        />
        <h3 className="min-w-0 flex-1 t-h3">{item.title}</h3>
        <span className="num shrink-0 t-label text-asphalt-500">
          {open ? `${minutes} min` : item.handled_at ? formatTime(item.handled_at) : ""}
        </span>
      </header>
      {s ? <ShortfallBody item={item} s={s} depot={depot} /> : <p className="t-body text-asphalt-700">{item.body}</p>}
    </article>
  );
}

function ShortfallBody({ item, s, depot }: { item: FeedItem; s: ShortfallDetail; depot: "Kandy" | "Peliyagoda" }) {
  const decide = useDecide(depot);
  const place = `${s.outlet_id} ${s.place} · ${s.order_ref}`;
  const onShelf = s.planned - s.qty;
  const nextDay = s.next_day ? formatWeekday(dayOf(s.next_day)) : null;
  const store = calledName(s.store_contact);
  const driver = calledName(s.driver);
  const cases = s.case_name.charAt(0).toLowerCase() + s.case_name.slice(1);
  return (
    <>
      <div className="flex flex-col gap-0.5 t-label text-asphalt-700">
        <p>
          {s.flagged_by}, {depot === "Kandy" ? "Kandy hub" : depot} dock, {formatTime(s.flagged_at)}
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
            ? `${s.temp_label} · ${onShelf} of ${s.planned} ${cases} cases on the shelf`
            : `${s.temp_label} · ${s.qty} of ${s.planned} ${cases} cases damaged, kept off the truck`}
        </p>
      </div>
      {item.handled_at ? (
        <p className="t-body text-asphalt-700">
          {item.handled_by ? `${item.handled_by}: ` : ""}
          {item.outcome}
        </p>
      ) : (
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
              {driver ? `${driver} takes ${s.stop_cases - s.qty} cases to stop ${s.stop_seq}. ` : ""}
              {s.next_order_ref
                ? `The ${s.qty} ${s.kind} cases join ${store ? `${store}'s` : "the store's"} ${nextDay} ${s.temp_label.toLowerCase()} order, ${s.next_order_ref}, marked from ${formatWeekday(s.flagged_at)}: ${formatDayLong(dayOf(s.next_day ?? ""))}, ${s.window}.`
                : "The store has no next order yet; Relay opens one for the next run."}
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
      )}
    </>
  );
}
