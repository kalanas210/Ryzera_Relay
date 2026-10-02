/** The plan board's sentences, kept apart from the screens so each can be read and tested on its own. */

import type { ChipKind } from "@/design/StatusChip";
import { dayOf, formatTime, formatWeekday, kgValue, m3Value, numberFormat, tenths } from "@/lib/time";
import type { Board, DepotName, Fit, PlanTrip } from "./api";

export const DEPOT_LABEL: Record<DepotName, string> = { Kandy: "Kandy hub", Peliyagoda: "Peliyagoda" };

/** A hub takes the article and a place name doesn't: "the Kandy hub's", "Peliyagoda's". */
const DEPOT_OWNS: Record<DepotName, string> = { Kandy: "the Kandy hub's", Peliyagoda: "Peliyagoda's" };

export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many);

/** "VEH039", "VEH039 and VEH058", "VEH039, VEH043 and VEH058" */
export function andList(items: string[]): string {
  return items.length < 2 ? items.join("") : `${items.slice(0, -1).join(", ")} and ${items.at(-1)}`;
}

/** Why Not placed holds what it holds, under its title. */
export function noRoom(limiting: string[], waits: number): string {
  const them = waits > 1 ? "them" : "it";
  return limiting.length
    ? `${andList(limiting)} ${limiting.length > 1 ? "are" : "is"} in the workshop, and no refrigerated trip left has ` +
        `room for ${them} in time.`
    : `No trip left has room for ${them} in time.`;
}

/** "VEH057 trip 2" */
export const tripName = (trip: { vehicle_id: string; trip_no: number }) => `${trip.vehicle_id} trip ${trip.trip_no}`;

export function firstProposalText(depot: DepotName, orders: number): string {
  return (
    `Relay plans ${DEPOT_OWNS[depot]} ${orders} ${plural(orders, "order")} on its vehicles: every order checked ` +
    "against the eleven rules, each vehicle kept on its usual run where it can, and any order that doesn't fit " +
    "explained. This can take up to a minute."
  );
}

/** The trips that break a rule now. */
export function brokenTrips(board: Board): PlanTrip[] {
  return board.lanes.flatMap((l) => l.trips).filter((t) => t.broken > 0);
}

function brokenWhere(board: Board): string {
  const trips = brokenTrips(board);
  if (trips.length === 1) return ` on ${tripName(trips[0]!)}`;
  return trips.length > 1 ? ` on ${trips.length} trips` : "";
}

/** The plan bar's summary: "Kandy hub: 57 orders, 56 on 18 trips, 1 waits", or what keeps Publish off. */
export function planSummary(board: Board, depot: DepotName): string {
  const broken = board.broken;
  if (broken) {
    return (
      `${broken} ${plural(broken, "rule")} broken${brokenWhere(board)}. ` +
      `Publish stays off until ${broken === 1 ? "it's" : "they're"} fixed.`
    );
  }
  const head = `${DEPOT_LABEL[depot]}: ${board.orders} orders, ${board.served} on ${board.trips} trips`;
  const waits = board.waiting.length;
  if (!waits) return `${head}.`;
  const counted = `${head}, ${waits} ${plural(waits, "waits", "wait")}`;
  if (board.waiting.some((w) => !w.deferral?.confirmed_at)) return `${counted}.`;
  const days = [...new Set(board.waiting.map((w) => w.deferral?.to_date))];
  const day = days.length === 1 && days[0] ? ` for ${formatWeekday(dayOf(days[0]))}` : "";
  return `${counted}${day} with a reason.`;
}

/** Beside the plan bar's buttons: what is left to do before Publish turns on. */
export function planHelper(board: Board): string {
  if (board.plan.fleet_changed_at) return "Fleet changed. Propose again to re-plan.";
  if (board.broken) return `Fix ${board.broken} broken ${plural(board.broken, "rule")} to publish.`;
  const unreasoned = board.waiting.filter((w) => w.deferral && !w.deferral.confirmed_at).length;
  return unreasoned ? `Give the ${plural(unreasoned, "deferral")} a reason to publish.` : "";
}

/** The plan's status chip, the most pressing state first. */
export function planChip(board: Board): { kind: ChipKind; text: string } {
  const plan = board.plan;
  if (plan.fleet_changed_at) return { kind: "planChanged", text: `Fleet changed ${formatTime(plan.fleet_changed_at)}` };
  if (board.broken) {
    return plan.edited_at
      ? { kind: "edited", text: `Edited ${formatTime(plan.edited_at)}` }
      : { kind: "ruleBroken", text: "Rule broken" };
  }
  if (plan.ready_at) return { kind: "ready", text: `Ready ${formatTime(plan.ready_at)}` };
  if (plan.edited_at) return { kind: "edited", text: `Edited ${formatTime(plan.edited_at)}` };
  return { kind: "proposed", text: plan.proposed_at ? `Proposed ${formatTime(plan.proposed_at)}` : "Proposed" };
}

/** Not placed, once every order is on a trip but a rule breaks. */
export function everyOrderPlaced(board: Board): string {
  const trips = brokenTrips(board);
  const n = board.broken;
  const what =
    trips.length === 1
      ? `${tripName(trips[0]!)} now breaks ${n} ${plural(n, "rule")}`
      : `${n} ${plural(n, "rule is", "rules are")} broken`;
  return board.can_undo
    ? `Every order is placed, but ${what}. Undo the move and Relay's deferral comes back.`
    : `Every order is placed, but ${what}. Propose again and Relay re-plans it.`;
}

const TRY_ANYWAY = "You can drop it here, but the plan won't publish until it fits.";

/** The dark tooltip beside the trip an order is held over: what the trip would carry, and whether it fits. */
export function fitTooltip(fit: Fit): string {
  const trip = tripName(fit);
  if (fit.current) return `Already on ${trip}.`;
  const weight = `${kgValue(fit.weight_kg)} of ${numberFormat.format(fit.weight_cap_kg)} kg`;
  if (fit.fits) return `${trip} would carry ${weight}, and every rule passes.`;
  if (fit.weight_kg > fit.weight_cap_kg) return `${trip} would carry ${weight}. ${TRY_ANYWAY}`;
  if (fit.volume_m3 > fit.volume_cap_m3) {
    return `${trip} would carry ${m3Value(fit.volume_m3)} of ${tenths(fit.volume_cap_m3)} m³. ${TRY_ANYWAY}`;
  }
  return `${trip}: ${fit.hint.replace(/\.$/, "")}. ${TRY_ANYWAY}`;
}
