import { ArrowRight, Check, Clock, RefreshCw, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Button } from "@/design/Button";
import { Notice } from "@/design/Notice";
import { Sheet } from "@/design/Sheet";
import { cx } from "@/lib/cx";
import { formatTime } from "@/lib/time";
import { type DepotName, type PlanTrip, useReorder, useReorderPreview } from "./api";

/** Changing a published trip's stop order (the 9:12 PM swap): Relay shows the cost first, to the minute, and who it
 *  will tell; the dispatcher confirms with a note for the record. */
export function ChangeOrder({
  planId,
  depot,
  trip,
  order,
  onClose,
}: {
  planId: string;
  depot: DepotName;
  trip: PlanTrip;
  order: string[] | null;
  onClose: () => void;
}) {
  const preview = useReorderPreview(planId, trip.vehicle_id, trip.trip_no, order);
  const reorder = useReorder(depot, planId);
  const [note, setNote] = useState("");
  const data = preview.data;
  const moved = data?.stops.filter((s) => s.from_seq !== s.to_seq) ?? [];
  const swap = moved.length === 2;
  const title = swap
    ? `Swap stops ${Math.min(...moved.map((s) => s.from_seq))} and ${Math.max(...moved.map((s) => s.from_seq))} on ${trip.vehicle_id}?`
    : `Change the stop order on ${trip.vehicle_id}?`;

  return (
    <Sheet
      open={Boolean(order)}
      onClose={() => {
        setNote("");
        onClose();
      }}
      variant="dialog"
      width={640}
      title={title}
      meta="The plan is published. Relay shows what the change costs before anyone is told."
      footer={
        <div className="flex justify-end gap-2">
          <Button density="desk" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            density="desk"
            variant="primary"
            icon={RefreshCw}
            disabled={!data || data.broken.length > 0 || reorder.isPending}
            onClick={() =>
              order &&
              reorder.mutate(
                { vehicle_id: trip.vehicle_id, trip_no: trip.trip_no, order_refs: order, note: note.trim() },
                {
                  onSuccess: () => {
                    setNote("");
                    onClose();
                  },
                },
              )
            }
          >
            {reorder.isPending ? "Changing the order" : swap ? "Swap stops" : "Change the order"}
          </Button>
        </div>
      }
    >
      {!data ? (
        <p className="t-dense text-asphalt-500">{preview.error ? preview.error.message : "Working out the cost"}</p>
      ) : (
        <div className="flex flex-col gap-4">
          {data.broken.length ? (
            <Notice tone="problem" compact title="This order breaks a rule">
              {data.broken.join(". ")}. Relay keeps the published order.
            </Notice>
          ) : null}
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] t-dense">
              <thead className="t-caption text-asphalt-500">
                <tr className="h-8 text-left">
                  <th className="font-medium">Stop</th>
                  <th className="font-medium">Store</th>
                  <th className="font-medium">Expected</th>
                  <th className="font-medium">Margin before close</th>
                </tr>
              </thead>
              <tbody>
                {data.stops.map((s) => {
                  const changed = s.from_seq !== s.to_seq;
                  const worse = s.margin_after < s.margin_before;
                  return (
                    <tr key={s.order_ref} className={cx("border-t border-asphalt-100", changed && "bg-attention-soft")}>
                      <td className="num py-2 pr-3 whitespace-nowrap">
                        {changed ? (
                          <span className="inline-flex items-center gap-1">
                            {s.from_seq}
                            <ArrowRight size={14} strokeWidth={1.75} aria-label="becomes" />
                            <strong>{s.to_seq}</strong>
                          </span>
                        ) : (
                          s.to_seq
                        )}
                      </td>
                      <td className="py-2 pr-3">
                        <span className="latin t-dense-strong">{s.outlet_id}</span> {s.place}
                        <span className="block t-caption text-asphalt-500">Closes {s.closes}</span>
                      </td>
                      <td className="num py-2 pr-3 whitespace-nowrap">
                        {formatTime(s.expected_before)}
                        {formatTime(s.expected_before) !== formatTime(s.expected_after) ? (
                          <>
                            {" "}
                            <ArrowRight size={14} strokeWidth={1.75} aria-label="now" className="inline" />{" "}
                            <strong>{formatTime(s.expected_after)}</strong>
                          </>
                        ) : null}
                      </td>
                      <td className={cx("num py-2 whitespace-nowrap", worse && "text-attention")}>
                        {s.margin_before === s.margin_after ? (
                          `${s.margin_after} min`
                        ) : (
                          <>
                            {s.margin_before} min{" "}
                            <ArrowRight size={14} strokeWidth={1.75} aria-label="now" className="inline" />{" "}
                            <strong>{s.margin_after} min</strong>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {data.costs.length ? (
            <div className="flex flex-col gap-1">
              <p className="t-label-strong">What it costs</p>
              {data.costs.map((line) => (
                <p key={line} className="flex items-start gap-2 t-dense">
                  <Clock size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-attention" />
                  {line}
                </p>
              ))}
            </div>
          ) : null}
          <div className="flex flex-col gap-1">
            <p className="t-label-strong">When you confirm</p>
            {data.told.map((line) => (
              <p key={line} className="flex items-start gap-2 t-dense">
                <Check size={16} strokeWidth={1.75} aria-hidden className="mt-0.5 shrink-0 text-petrol-700" />
                {line}
              </p>
            ))}
          </div>
          <label className="flex flex-col gap-1">
            <span className="t-label-strong">Why (kept on the record)</span>
            <input
              value={note}
              maxLength={300}
              onChange={(event) => setNote(event.target.value)}
              placeholder="For example: Mawanella asked to be served earlier"
              className="h-9 rounded-chip border border-asphalt-300 bg-white px-3 t-dense"
            />
          </label>
          {reorder.error ? (
            <p className="flex items-center gap-2 t-dense text-problem">
              <TriangleAlert size={16} strokeWidth={1.75} aria-hidden />
              {reorder.error.message}
            </p>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}
