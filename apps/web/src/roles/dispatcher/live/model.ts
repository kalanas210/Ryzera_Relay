/** The desk's reading of the live runs, kept apart from the screens so it can be tested: which trips belong to one
 *  vehicle, which feed item is about which run, what needs the dispatcher first, and the words under each stop. */

import { calledName } from "@/lib/names";
import { formatTime } from "@/lib/time";
import type { Board, PlanStop } from "../plan/api";
import type { FeedItem, RunMarker, RunRow } from "./api";

/** The Fresh window every Fresh trip runs inside (relay_engine.standard). */
export const FRESH_WINDOW = "3:30 to 8:00 AM";

/** One vehicle on the desk: its Fresh trips in order, the one it is on now, and the one after. Its attention is the
 *  current trip's; a later trip's late risk keeps it in view without putting it first. */
export type VehicleRun = {
  vehicle_id: string;
  trips: RunRow[];
  current: RunRow;
  later: RunRow | null;
  attention: number;
  laterRisk: boolean;
};

/** Trips grouped by vehicle, in the order the panel sent them (needing attention first). */
export function vehicleRuns(rows: RunRow[]): VehicleRun[] {
  const byVehicle = new Map<string, RunRow[]>();
  for (const row of rows) byVehicle.set(row.vehicle_id, [...(byVehicle.get(row.vehicle_id) ?? []), row]);
  return [...byVehicle.values()].map((trips) => {
    const sorted = [...trips].sort((a, b) => a.trip_no - b.trip_no);
    const current =
      sorted.find((t) => t.departed_at && !t.finished_at) ??
      sorted.find((t) => !t.departed_at && !t.finished_at) ??
      sorted[sorted.length - 1]!;
    const later = sorted.find((t) => t.trip_no > current.trip_no && !t.finished_at) ?? null;
    return {
      vehicle_id: current.vehicle_id,
      trips: sorted,
      current,
      later,
      attention: current.attention,
      laterRisk: !!later?.markers.some((m) => m.late_risk),
    };
  });
}

const VEHICLE_ID = /VEH\d{3}/g;

/** The runs a feed item is about: from its reference when the feed sends one, otherwise from what it names. */
export function itemRows(item: FeedItem, rows: RunRow[]): RunRow[] {
  const byTrip = (id: string | null | undefined) => (id ? rows.find((r) => r.trip_id === id) : undefined);
  const found = [byTrip(item.ref?.trip_id), byTrip(item.ref?.backup_trip_id)].filter((r): r is RunRow => !!r);
  if (found.length) return found;
  if (item.shortfall) {
    const s = item.shortfall;
    return rows.filter((r) => r.vehicle_id === s.vehicle_id && r.trip_no === s.trip_no);
  }
  const text = `${item.title} ${item.body}`;
  if (item.kind === "receipt") {
    const place = item.title.replace(/ confirmed receipt$/, "");
    const row = rows.find((r) => !r.is_backup && r.markers.some((m) => m.place === place && m.receipt_at));
    return row ? [row] : [];
  }
  if (item.kind === "conflict") {
    const seq = Number(item.title.match(/^Stop (\d+)/)?.[1]);
    const row = rows.find((r) => r.markers.some((m) => m.seq === seq && m.state === "conflict"));
    if (row) return [row];
  }
  // the driver's run on the road, else the latest one they finished, never a trip still to leave
  const driven = rows
    .filter((r) => !r.is_backup && r.driver && text.includes(r.driver))
    .sort((a, b) => a.trip_no - b.trip_no);
  const pick =
    driven.find((r) => r.departed_at && !r.finished_at) ??
    [...driven].reverse().find((r) => r.finished_at) ??
    driven[0];
  if (pick) return [pick];
  const first = [...item.body.matchAll(VEHICLE_ID), ...item.title.matchAll(VEHICLE_ID)][0]?.[0];
  const named = rows.filter((r) => r.vehicle_id === first);
  return named.length ? [named.find((r) => r.departed_at && !r.finished_at) ?? named[0]!] : [];
}

/** Handled silences give way to the back-in-contact item. */
export function shownInFeed(item: FeedItem): boolean {
  return !(item.kind === "silence" && item.handled_at && item.outcome.startsWith("Back in contact"));
}

export type Links = { open: Set<string>; today: Set<string> };

/** Which vehicles the feed is talking about, open and handled. */
export function feedLinks(items: FeedItem[], rows: RunRow[]): Links {
  const links: Links = { open: new Set(), today: new Set() };
  for (const item of items) {
    for (const row of itemRows(item, rows)) {
      links.today.add(row.vehicle_id);
      if (!item.handled_at) links.open.add(row.vehicle_id);
    }
  }
  return links;
}

/** Needs attention first: an open exception or a silent or two-copy run, then late risk, then a backup on the road,
 *  then a run with something handled today, then one whose later trip is at risk. Everything else folds into the
 *  group row. */
export function rank(vehicle: VehicleRun, links: Links): number {
  if (vehicle.attention >= 2 || links.open.has(vehicle.vehicle_id)) return 0;
  if (vehicle.attention === 1) return 1;
  if (vehicle.trips.some((t) => t.is_backup)) return 2;
  if (links.today.has(vehicle.vehicle_id)) return 3;
  if (vehicle.laterRisk) return 4;
  return FOLDED;
}

/** A stop moved to a backup stays in front of the dispatcher while the backup's copy is live and the driver is
 *  still silent: either may reach the store first. */
export function movedLive(item: FeedItem, rows: RunRow[]): boolean {
  if (item.kind !== "stop_moved") return false;
  const row = itemRows(item, rows).find((r) => !r.is_backup);
  const stopId = item.ref?.stop_id;
  const copy = rows.flatMap((r) => r.markers).find((m) => !!stopId && m.backup_of === stopId);
  return !!row?.out_of_contact && !!copy && copy.state !== "cancelled";
}

/** Once the stop has two copies, the move's facts live on in that item's timeline. */
export function overtaken(item: FeedItem, items: FeedItem[]): boolean {
  const stopId = item.ref?.stop_id;
  return (
    item.kind === "stop_moved" && !!stopId && items.some((i) => i.kind === "conflict" && i.ref?.stop_id === stopId)
  );
}
export const FOLDED = 9;

/** The run the desk opens on: the newest open exception's, else the first that needs the dispatcher, else the
 *  newest one the feed spoke about today. */
export function defaultSelection(vehicles: VehicleRun[], items: FeedItem[], links: Links, rows: RunRow[]) {
  const newestOpen = items.find((i) => !i.handled_at && itemRows(i, rows).length);
  if (newestOpen) return itemRows(newestOpen, rows)[0]!.vehicle_id;
  const urgent = vehicles.find((v) => rank(v, links) === 0);
  if (urgent) return urgent.vehicle_id;
  const recent = [...items]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .find((i) => itemRows(i, rows).length);
  if (recent) return itemRows(recent, rows)[0]!.vehicle_id;
  return vehicles.find((v) => rank(v, links) < FOLDED)?.vehicle_id ?? null;
}

/** "5:11": track labels drop the AM; prose keeps it. */
export function shortClock(value: string): string {
  return formatTime(value).replace(/\s?[AP]M$/, "");
}

export type Tone = "plain" | "muted" | "attention" | "problem";

/** The status line under a stop on the track. Recorded facts say what happened and when; anything after the last
 *  record is an estimate, and while the phone is silent it says "around". */
export function markerStatus(m: RunMarker, silent: boolean): { text: string; tone: Tone } {
  switch (m.state) {
    case "delivered":
      return m.recorded
        ? { text: `Delivered ${shortClock(m.recorded)}`, tone: "plain" }
        : m.receipt_at
          ? { text: `Store receipt ${shortClock(m.receipt_at)}`, tone: "plain" }
          : { text: "Delivered", tone: "plain" };
    case "arrived":
      return { text: m.recorded ? `Arrived ${shortClock(m.recorded)}` : "Arrived", tone: "plain" };
    case "failed":
      return { text: m.recorded ? `Not delivered ${shortClock(m.recorded)}` : "Not delivered", tone: "problem" };
    case "moved":
      return { text: m.moved_to ? `Also on ${m.moved_to}` : "Moved", tone: "attention" };
    case "conflict":
      return { text: "Two copies", tone: "attention" };
    case "cancelled":
      return { text: "Cancelled", tone: "muted" };
    default: {
      if (!m.estimate) return { text: "", tone: "muted" };
      const at = shortClock(m.estimate);
      const tone: Tone = m.late_risk ? "problem" : "plain";
      // An estimate that went by with no word stays where it was, and says so.
      if (m.passed) return { text: `${at} passed`, tone: m.late_risk ? "problem" : "muted" };
      if (silent) return { text: `around ${at}`, tone };
      return { text: m.state === "next" ? `Next, ${at}` : at, tone };
    }
  }
}

/** Recorded on the track: drawn solid, and the line into it is solid. */
export function isRecorded(m: RunMarker): boolean {
  return (
    m.state === "delivered" ||
    m.state === "arrived" ||
    m.state === "failed" ||
    m.state === "conflict" ||
    m.state === "cancelled"
  );
}

/** Still to come, with an estimate. */
export function isEstimated(m: RunMarker): boolean {
  return (m.state === "next" || m.state === "pending" || m.state === "moved") && !!m.estimate;
}

/** The last thing Relay heard from the run: a delivery, an arrival or a store's receipt. */
export function lastRecord(
  row: RunRow,
): { marker: RunMarker; kind: "delivered" | "arrived" | "receipt"; at: string } | null {
  for (const m of [...row.markers].reverse()) {
    if (m.state === "arrived" && m.recorded) return { marker: m, kind: "arrived", at: m.recorded };
    if (m.state === "delivered" && m.recorded) return { marker: m, kind: "delivered", at: m.recorded };
  }
  return null;
}

/** Where the silent run probably is, when Relay's estimate puts it between two stops. */
export function onTheRoadTo(row: RunRow): string | null {
  return row.position.match(/^Probably on the road to (.+)\.$/)?.[1] ?? null;
}

/** "Fresh dry, Kegalle district" */
export function runLine(row: RunRow): string {
  const load = row.brand === "Fresh" ? `Fresh ${row.temp === "chilled" ? "chilled" : "dry"}` : row.brand;
  return `${load}, ${row.district} district`;
}

/** The dispatcher's word for a vehicle: "Ambient truck", "Refrigerated van". */
export function vehicleWords(type: string, temp: string): string {
  return `${temp === "reefer" ? "Refrigerated" : "Ambient"} ${type}`;
}

/** The silent-run caption: what was last recorded, and what has happened to the stops since. */
export function silentCaption(row: RunRow): string {
  const last = lastRecord(row);
  const lines = [
    last
      ? `Last record: stop ${last.marker.seq}, ${last.kind === "arrived" ? "arrived" : "delivered"} ${formatTime(last.at)}.`
      : `Left at ${formatTime(row.departed_at ?? row.planned_depart)}.`,
  ];
  const receipts = row.markers.filter((m) => m.receipt_at && !m.recorded);
  const moved = row.markers.filter((m) => m.state === "moved" && m.moved_to);
  for (const m of receipts) lines.push(`Stop ${m.seq} counted from the store's receipt.`);
  for (const m of moved) lines.push(`Stop ${m.seq} also given to ${m.moved_to}.`);
  if (!receipts.length && !moved.length) lines.push("Times after that are estimates.");
  return lines.join(" ");
}

/** The first name a driver is called by, or the vehicle when nobody is on it. */
export function driverName(row: RunRow): string {
  return calledName(row.driver) || row.vehicle_id;
}

/** The plan's record of each stop, for the order, the store's name, its access and its window. */
export class Directory {
  constructor(private readonly board: Board | undefined) {}

  lane(vehicleId: string) {
    return this.board?.lanes.find((l) => l.vehicle_id === vehicleId);
  }

  /** Vehicles out of service today. */
  workshop() {
    return this.board?.lanes.filter((l) => l.status === "workshop") ?? [];
  }

  stop(row: RunRow, outletId: string): PlanStop | undefined {
    const trips = this.board?.lanes.flatMap((l) => l.trips) ?? [];
    const own = trips.find((t) => t.vehicle_id === row.vehicle_id && t.trip_no === row.trip_no);
    return (
      own?.stops.find((s) => s.outlet_id === outletId) ??
      trips.flatMap((t) => (t.temp === row.temp ? t.stops : [])).find((s) => s.outlet_id === outletId)
    );
  }

  vehicle(vehicleId: string, fallback: string): string {
    const lane = this.lane(vehicleId);
    return lane ? vehicleWords(lane.type, lane.temp) : fallback.replace("Dry-box", "Ambient");
  }
}

/** Access words as the plan board says them. */
export function accessWords(dockType: string | undefined): string | null {
  if (dockType === "rear_dock") return "Rear dock";
  if (dockType === "street") return "Curb";
  if (dockType === "mall_bay") return "Mall bay";
  return null;
}
