import { ArrowLeft, Check, CircleCheck, Clock, Info, ListChecks, Send, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { dayOf, formatDayLong, formatTime } from "@/lib/time";
import { type Board, type DepotName, useCheck, usePublish } from "./api";

const DEPOT_LABEL: Record<DepotName, string> = { Kandy: "Kandy hub", Peliyagoda: "Peliyagoda" };

/** DSP-02 / publish check, the Publish dialog and the published state. */
export function PublishCheck({ board, depot, onBack }: { board: Board; depot: DepotName; onBack: () => void }) {
  const check = useCheck(board.plan.id, true);
  const publish = usePublish(depot, board.plan.id);
  const [dialog, setDialog] = useState(false);
  const data = check.data;
  const published = board.plan.status === "published";
  const running = board.lanes.filter((l) => l.trips.length).length;
  const standby = board.lanes.filter((l) => l.status === "standby");
  const waits = board.waiting;

  return (
    <section className="flex flex-col gap-3 rounded-card border border-asphalt-200 bg-white px-5 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ListChecks size={20} strokeWidth={1.75} aria-hidden />
          <h2 className="t-h2">Publish check</h2>
          {data ? <span className="t-caption text-asphalt-500">{data.fresh_stops} Fresh stops</span> : null}
        </div>
        <Button density="desk" variant="link" icon={ArrowLeft} onClick={onBack}>
          Back to the board
        </Button>
      </header>
      {!data ? (
        <p className="t-dense text-asphalt-500">Checking the plan</p>
      ) : (
        <>
          {data.broken.length ? (
            <p className="flex items-start gap-2 rounded-button bg-problem-soft px-3 py-2 t-dense">
              <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-problem" />
              <span>
                <strong>{data.broken.length} rules are broken.</strong>{" "}
                {data.broken.map((b) => `${b.vehicle_id} trip ${b.trip_no}: ${b.message}`).join(". ")}.
              </span>
            </p>
          ) : (
            <p className="flex items-start gap-2 rounded-button bg-done-soft px-3 py-2 t-dense">
              <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-done" />
              <span>
                <strong>No planned arrival is after its window closes.</strong> Early arrivals wait for the store to
                open.
              </span>
            </p>
          )}
          {data.expected_late.length ? (
            <>
              <p className="flex items-start gap-2 rounded-button bg-attention-soft px-3 py-2 t-dense">
                <Clock size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-attention" />
                <span>
                  <strong>
                    Relay expects {data.expected_late.length} of the {data.fresh_stops} Fresh stops to arrive after
                    their window
                  </strong>
                  , and says why it keeps each one where it is.
                </span>
              </p>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] t-dense">
                  <thead className="t-caption text-asphalt-500">
                    <tr className="h-8 text-left">
                      <th className="font-medium">Trip</th>
                      <th className="font-medium">Store</th>
                      <th className="font-medium">Closes</th>
                      <th className="font-medium">Planned</th>
                      <th className="font-medium">Expected</th>
                      <th className="font-medium">Why Relay keeps it</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.expected_late.map((e) => (
                      <tr key={e.order_ref} className="border-t border-asphalt-100 align-top">
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className="latin">{e.vehicle_id}</span> trip {e.trip_no}
                        </td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className="latin t-dense-strong">{e.outlet_id}</span>
                        </td>
                        <td className="num py-2 pr-3">{e.closes}</td>
                        <td className="num py-2 pr-3">{e.planned}</td>
                        <td className="py-2 pr-3 whitespace-nowrap">
                          <span className="num inline-flex items-center gap-1 t-dense-strong text-attention">
                            <Clock size={16} strokeWidth={1.75} aria-hidden />
                            {e.expected}
                          </span>
                        </td>
                        <td className="py-2 text-asphalt-700">{e.why}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="flex items-start gap-2 rounded-button bg-done-soft px-3 py-2 t-dense">
              <CircleCheck size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-done" />
              Relay expects every Fresh stop inside its window.
            </p>
          )}
          <p className="flex items-center gap-2 t-caption text-asphalt-500">
            <Info size={16} strokeWidth={1.75} aria-hidden />
            Planned is the published standard at free flow. Expected is Relay's model of the day, shown to the minute
            here.
          </p>
          {!published ? (
            <div className="flex justify-end">
              <Button
                density="desk"
                variant="primary"
                icon={Send}
                disabled={!data.can_publish}
                onClick={() => setDialog(true)}
              >
                Publish plan
              </Button>
            </div>
          ) : null}
        </>
      )}
      <Sheet
        open={dialog}
        onClose={() => setDialog(false)}
        variant="dialog"
        width={560}
        title={`Publish the ${DEPOT_LABEL[depot]} plan?`}
        footer={
          <div className="flex justify-end gap-2">
            <Button density="desk" variant="quiet" onClick={() => setDialog(false)}>
              Cancel
            </Button>
            <Button
              density="desk"
              variant="primary"
              icon={Send}
              disabled={publish.isPending}
              onClick={() =>
                publish.mutate(undefined, {
                  onSuccess: () => {
                    setDialog(false);
                  },
                })
              }
            >
              {publish.isPending ? "Publishing" : "Publish plan"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col gap-4">
          <p className="t-dense text-asphalt-700">
            {board.served} orders on {board.trips} trips for {formatDayLong(dayOf(board.plan.run_date))}.
            {waits.length
              ? ` ${waits.length} order${waits.length > 1 ? "s move" : " moves"} to the next run with a reason`
              : ""}
            {data?.expected_late.length
              ? `, and Relay expects ${data.expected_late.length} stops after their window.`
              : "."}
          </p>
          <div className="flex flex-col gap-2">
            <p className="t-label-strong">When you publish</p>
            {[
              `Tonight's loading lists update at the ${DEPOT_LABEL[depot]} dock.`,
              `The drivers of all ${running} vehicles see their runs on their phones.${
                standby.length
                  ? ` ${standby.map((s) => `${s.driver ?? s.vehicle_id} sees ${s.vehicle_id} on standby`).join(", ")}.`
                  : ""
              }`,
              "Every store on these trips sees its expected arrival.",
              ...waits.map((w) => `${w.outlet_id} ${w.short_name} gets a notice with the new date and the reason.`),
            ].map((line) => (
              <p key={line} className="flex items-start gap-2 t-dense">
                <Check size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-petrol-700" />
                {line}
              </p>
            ))}
          </div>
          <p className="t-caption text-asphalt-500">
            You can still change the plan after publishing. Every change reaches the dock, the driver and the store.
          </p>
          {publish.error ? <p className="t-dense text-problem">{publish.error.message}</p> : null}
        </div>
      </Sheet>
      {published && board.plan.published_at ? (
        <p className="t-caption text-asphalt-500">
          Published {formatTime(board.plan.published_at)}. This is the record of what was checked.
        </p>
      ) : null}
    </section>
  );
}
