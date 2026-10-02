import { useQuery } from "@tanstack/react-query";
import { CircleCheck, Inbox, TriangleAlert } from "lucide-react";
import { type KeyboardEvent, useEffect, useRef } from "react";
import { Sheet } from "@/design/Sheet";
import { cx } from "@/lib/cx";
import { type Fit, fetchFits, type Lane, type MoveInput } from "./api";
import { tripName } from "./words";

/** What is being moved: one Not placed order, or every order of a stop. */
export type Moving = {
  refs: string[];
  /** "OUT117 Hemmathagama" */
  label: string;
  /** The trip it rides now; none for a Not placed order. */
  from: { vehicle_id: string; trip_no: number } | null;
};

/** The Trip picker, M on a focused stop or order: the keyboard path for a drag. One row per trip with the same fit
 *  hint the drag shows, the trips it fits first; Up and Down move between rows, Enter moves it. */
export function TripPicker({
  planId,
  moving,
  lanes,
  onPick,
  onClose,
}: {
  planId: string;
  moving: Moving | null;
  lanes: Lane[];
  onPick: (move: MoveInput) => void;
  onClose: () => void;
}) {
  const fits = useQuery({
    queryKey: ["plan-fit", planId, moving?.refs.join(",")],
    queryFn: ({ signal }) => fetchFits(planId, moving?.refs ?? [], signal),
    enabled: Boolean(moving),
    staleTime: 0,
  });
  const list = useRef<HTMLUListElement>(null);
  const rows = sortFits(fits.data ?? []);

  // the first row takes focus once the trips are in, so Up, Down and Enter work straight away
  const loaded = Boolean(moving && fits.data);
  useEffect(() => {
    if (loaded) list.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
  }, [loaded]);

  const onKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const buttons = [...(list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [])];
    const at = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "ArrowDown" ? Math.min(buttons.length - 1, at + 1) : Math.max(0, at - 1);
    buttons[next]?.focus();
  };

  const district = (fit: Fit) =>
    lanes.find((l) => l.vehicle_id === fit.vehicle_id)?.trips.find((t) => t.trip_no === fit.trip_no)?.district;

  return (
    <Sheet
      open={Boolean(moving)}
      onClose={onClose}
      variant="dialog"
      width={440}
      title={moving ? `Move ${moving.label}` : "Move"}
      meta="Relay checks every rule on each trip. You can still pick one it breaks; the board names what breaks."
    >
      {!fits.data ? (
        <p className="t-dense text-asphalt-500" role="status">
          {fits.isError ? "Relay could not check the trips. Close this and press M again." : "Checking every trip"}
        </p>
      ) : (
        <ul ref={list} aria-label="Trips" onKeyDown={onKeyDown} className="flex max-h-[320px] flex-col overflow-y-auto">
          {rows.map((fit) => {
            const where = district(fit);
            return (
              <li key={`${fit.vehicle_id}:${fit.trip_no}`}>
                <button
                  type="button"
                  disabled={fit.current}
                  onClick={() => onPick({ order_refs: moving!.refs, vehicle_id: fit.vehicle_id, trip_no: fit.trip_no })}
                  className={cx(
                    "flex min-h-10 w-full items-center gap-3 rounded-button px-3 text-left",
                    "hover:bg-asphalt-50 focus-visible:bg-petrol-50 disabled:cursor-not-allowed disabled:opacity-60",
                  )}
                >
                  <span className="min-w-0 flex-1 t-dense-strong">
                    <span className="latin">{fit.vehicle_id}</span> trip {fit.trip_no}
                    <span className="t-caption font-normal text-asphalt-500"> · {where ?? "new trip"}</span>
                  </span>
                  {fit.current ? (
                    <span className="t-caption text-asphalt-500">On it now</span>
                  ) : fit.fits ? (
                    <span className="inline-flex shrink-0 items-center gap-1 t-caption font-semibold text-done">
                      <CircleCheck size={16} strokeWidth={1.75} aria-hidden />
                      Fits
                    </span>
                  ) : (
                    <span className="inline-flex min-w-0 items-center gap-1 t-caption font-semibold text-problem">
                      <TriangleAlert size={16} strokeWidth={1.75} aria-hidden className="shrink-0" />
                      {fit.hint}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
          {moving?.from ? (
            <li className="mt-1 border-t border-asphalt-200 pt-1">
              <button
                type="button"
                onClick={() => onPick({ order_refs: moving.refs })}
                className="flex min-h-10 w-full items-center gap-3 rounded-button px-3 text-left hover:bg-asphalt-50 focus-visible:bg-petrol-50"
              >
                <Inbox size={16} strokeWidth={1.75} aria-hidden className="text-asphalt-500" />
                <span className="flex-1 t-dense-strong">Not placed</span>
                <span className="t-caption text-asphalt-500">Off {tripName(moving.from)}, waits with a reason</span>
              </button>
            </li>
          ) : null}
        </ul>
      )}
    </Sheet>
  );
}

/** The trips it fits first, then the rest, each group in lane order; the trip it is on now goes last. */
export function sortFits(fits: Fit[]): Fit[] {
  const rank = (f: Fit) => (f.current ? 2 : f.fits ? 0 : 1);
  return fits
    .map((f, i) => ({ f, i }))
    .sort((a, b) => rank(a.f) - rank(b.f) || a.i - b.i)
    .map(({ f }) => f);
}
