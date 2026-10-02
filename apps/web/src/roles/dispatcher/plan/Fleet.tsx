import { CircleCheck, Clock, Wrench } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button, IconButton } from "@/design/Button";
import { Sheet } from "@/design/Sheet";
import { cx } from "@/lib/cx";
import { dayOf, formatDayLong } from "@/lib/time";
import { type DepotName, type Lane, useVehicleStatus } from "./api";

const CHOICES: { status: Lane["status"]; label: string; line: string; icon: typeof Wrench }[] = [
  { status: "available", label: "In service", line: "Relay can plan trips on it.", icon: CircleCheck },
  {
    status: "workshop",
    label: "In the workshop",
    line: "Not on this run. A trip left on it breaks a rule until Relay re-plans.",
    icon: Wrench,
  },
  {
    status: "standby",
    label: "On standby",
    line: "Kept free for problems on the day. Relay plans no trips on it.",
    icon: Clock,
  },
];

/** The lane's button for the fleet: send a vehicle to the workshop, back into service, or onto standby for this
 *  run, so the judge can watch the plan respond. Only on a draft. */
export function FleetButton({ lane, onOpen }: { lane: Lane; onOpen: (lane: Lane) => void }) {
  return (
    <IconButton
      icon={Wrench}
      density="desk"
      label={`Change ${lane.vehicle_id}'s status for this run`}
      onClick={() => onOpen(lane)}
      className="text-asphalt-500"
    />
  );
}

export function FleetDialog({
  lane,
  depot,
  runDate,
  onClose,
}: {
  lane: Lane | null;
  depot: DepotName;
  runDate: string;
  onClose: () => void;
}) {
  const change = useVehicleStatus(depot, runDate);
  const [status, setStatus] = useState<Lane["status"]>("available");
  const [note, setNote] = useState("");
  const noteId = useId();

  // each opening starts from the vehicle as it stands
  useEffect(() => {
    if (!lane) return;
    setStatus(lane.status);
    setNote(lane.status === "available" ? "" : lane.note);
    change.reset();
  }, [lane, change.reset]);

  const unchanged = lane ? status === lane.status && (status === "available" || note.trim() === lane.note) : true;

  return (
    <Sheet
      open={Boolean(lane)}
      onClose={onClose}
      variant="dialog"
      width={520}
      title={lane ? `${lane.vehicle_id} for ${formatDayLong(dayOf(runDate))}` : "Vehicle"}
      meta="Relay keeps this plan as it is until you propose again."
      footer={
        <div className="flex justify-end gap-2">
          <Button density="desk" variant="quiet" onClick={onClose}>
            Cancel
          </Button>
          <Button
            density="desk"
            variant="primary"
            disabled={unchanged || change.isPending}
            onClick={() =>
              lane && change.mutate({ vehicle_id: lane.vehicle_id, status, note: note.trim() }, { onSuccess: onClose })
            }
          >
            {change.isPending ? "Saving" : "Save"}
          </Button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        <div role="radiogroup" aria-label="Status for this run" className="flex flex-col gap-2">
          {CHOICES.map((c) => {
            const selected = c.status === status;
            return (
              // biome-ignore lint/a11y/useSemanticElements: a styled radio row, as the Vehicle picker row draws it
              <button
                key={c.status}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setStatus(c.status)}
                className={cx(
                  "flex items-start gap-3 rounded-button px-3 py-2 text-left",
                  selected ? "border-[1.5px] border-petrol-700 bg-petrol-50" : "border border-asphalt-300 bg-white",
                )}
              >
                <c.icon
                  size={20}
                  strokeWidth={1.75}
                  aria-hidden
                  className={cx("mt-0.5 shrink-0", selected ? "text-petrol-700" : "text-asphalt-500")}
                />
                <span className="flex flex-col">
                  <span className={cx("t-dense-strong", selected && "text-petrol-700")}>{c.label}</span>
                  <span className="t-caption text-asphalt-700">{c.line}</span>
                </span>
              </button>
            );
          })}
        </div>
        {status !== "available" ? (
          <label htmlFor={noteId} className="flex flex-col gap-1">
            <span className="t-label text-asphalt-700">Note on the board (optional)</span>
            <input
              id={noteId}
              value={note}
              maxLength={120}
              onChange={(event) => setNote(event.target.value)}
              placeholder={status === "workshop" ? "In the workshop, back Thu 9 Apr" : "Standby, free until 8:00 AM"}
              className="h-9 rounded-chip border border-asphalt-300 bg-white px-3 t-dense placeholder:text-asphalt-500"
            />
          </label>
        ) : null}
        {lane?.trips.length && status === "workshop" ? (
          <p className="t-caption text-attention">
            {lane.trips.length > 1
              ? `${lane.vehicle_id} has ${lane.trips.length} trips on this plan. They stay until you propose again, and Publish stays off while they do.`
              : `${lane.vehicle_id} has a trip on this plan. It stays until you propose again, and Publish stays off while it does.`}
          </p>
        ) : null}
        {change.error ? (
          <p role="alert" className="t-dense text-problem">
            {change.error.message}
          </p>
        ) : null}
      </div>
    </Sheet>
  );
}
