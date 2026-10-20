// Reads the live runs for the desk: trips per vehicle, feed items per run, what needs attention first.

import { calledName } from "@/lib/names";
import { formatTime, roundTo5 } from "@/lib/time";
import type { Board, PlanStop } from "../plan/api";
import type { FeedItem, RunMarker, RunRow } from "./api";

// The Fresh window every Fresh trip runs inside (relay_engine.standard).
export const FRESH_WINDOW = "3:30 to 8:00 AM";

// Attention is the current trip's. A later trip's late risk keeps it in view, not first.
export type VehicleRun = {
  vehicle_id: string;
  trips: RunRow[];
  current: RunRow;
  later: RunRow | null;
  attention: number;
  laterRisk: boolean;
};

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
  // The driver's run on the road, else the latest one they finished. Never a trip still to leave.
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

// Handled silences give way to the back-in-contact item.
export function shownInFeed(item: FeedItem): boolean {
  return !(item.kind === "silence" && item.handled_at && item.outcome.startsWith("Back in contact"));
}

export type Links = { open: Set<string>; today: Set<string> };

export function feedLinks(items: FeedItem[], rows: RunRow[]): Links {
  const links: Links = { open: new Set(), today: new Set() };
  for (const item of items) {
    for (const row of itemRows(item, rows)) {
      links.today.add(row.vehicle_id);
      if (inFront(item)) links.open.add(row.vehicle_id);
    }
  }
  return links;
}

export function rank(vehicle: VehicleRun, links: Links): number {
  if (vehicle.attention >= 2 || links.open.has(vehicle.vehicle_id)) return 0;
  if (vehicle.attention === 1) return 1;
  if (vehicle.trips.some((t) => t.is_backup)) return 2;
  if (links.today.has(vehicle.vehicle_id)) return 3;
  if (vehicle.laterRisk) return 4;
  return FOLDED;
}

export function slack(vehicle: VehicleRun): number {
  const gaps = vehicle.current.markers
    .filter((m) => (m.state === "next" || m.state === "pending") && m.estimate)
    .map((m) => (Date.parse(m.closes) - Date.parse(m.estimate ?? m.closes)) / 60_000);
  return gaps.length ? Math.min(...gaps) : Number.POSITIVE_INFINITY;
}

export function inOrder(vehicles: VehicleRun[], links: Links): VehicleRun[] {
  const room = (a: VehicleRun, b: VehicleRun) => {
    const d = slack(a) - slack(b);
    return Number.isNaN(d) ? 0 : d;
  };
  return [...vehicles].sort((a, b) => rank(a, links) - rank(b, links) || room(a, b));
}

// Stays in front while the backup's copy is live and the driver silent. Either may arrive first.
export function movedLive(item: FeedItem, rows: RunRow[]): boolean {
  if (item.kind !== "stop_moved") return false;
  const row = itemRows(item, rows).find((r) => !r.is_backup);
  const stopId = item.ref?.stop_id;
  const copy = rows.flatMap((r) => r.markers).find((m) => !!stopId && m.backup_of === stopId);
  return !!row?.out_of_contact && !!copy && copy.state !== "cancelled";
}

// Once the stop has two copies, the move's facts live on in that item's timeline.
export function overtaken(item: FeedItem, items: FeedItem[]): boolean {
  const stopId = item.ref?.stop_id;
  return (
    item.kind === "stop_moved" && !!stopId && items.some((i) => i.kind === "conflict" && i.ref?.stop_id === stopId)
  );
}
export const FOLDED = 9;

export function defaultSelection(vehicles: VehicleRun[], items: FeedItem[], links: Links, rows: RunRow[]) {
  const newestOpen = items.find((i) => inFront(i) && itemRows(i, rows).length);
  if (newestOpen) return itemRows(newestOpen, rows)[0]!.vehicle_id;
  return inOrder(vehicles, links).find((v) => rank(v, links) < FOLDED)?.vehicle_id ?? null;
}

export function awaitingReview(item: FeedItem): boolean {
  return item.kind === "conflict" && !!item.handled_at && !item.reviewed_at;
}

function inFront(item: FeedItem): boolean {
  return !item.handled_at || awaitingReview(item);
}

// Track labels drop the AM. Prose keeps it.
export function shortClock(value: string | Date): string {
  return formatTime(value).replace(/\s?[AP]M$/, "");
}

export type Tone = "plain" | "muted" | "attention" | "problem";

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
      if (!m.moved_to) return { text: "Moved", tone: "attention" };
      return m.handed_over
        ? { text: `With ${m.moved_to}`, tone: "muted" }
        : { text: `Also on ${m.moved_to}`, tone: "attention" };
    case "conflict":
      return { text: "Two copies", tone: "attention" };
    case "cancelled":
      return { text: "Cancelled", tone: "muted" };
    default: {
      if (!m.estimate) return { text: "", tone: "muted" };
      const at = shortClock(m.estimate);
      const tone: Tone = m.late_risk ? "problem" : "plain";
      if (m.passed) return { text: `${at} passed`, tone: m.late_risk ? "problem" : "muted" };
      if (silent) return { text: `around ${at}`, tone };
      return { text: m.state === "next" ? `Next, ${at}` : at, tone };
    }
  }
}

export function heldWords(m: RunMarker, row: RunRow): string | null {
  if (m.state !== "conflict") return null;
  if (m.denied) return `${driverName(row)} says not delivered`;
  return m.held ? `Delivered ${shortClock(m.held)}` : null;
}

export function isRecorded(m: RunMarker): boolean {
  return (
    m.state === "delivered" ||
    m.state === "arrived" ||
    m.state === "failed" ||
    m.state === "conflict" ||
    m.state === "cancelled"
  );
}

export function isEstimated(m: RunMarker): boolean {
  return (m.state === "next" || m.state === "pending" || m.state === "moved") && !!m.estimate;
}

export function lastRecord(
  row: RunRow,
): { marker: RunMarker; kind: "delivered" | "arrived" | "receipt"; at: string } | null {
  for (const m of [...row.markers].reverse()) {
    if (m.state === "arrived" && m.recorded) return { marker: m, kind: "arrived", at: m.recorded };
    if (m.state === "delivered" && m.recorded) return { marker: m, kind: "delivered", at: m.recorded };
  }
  return null;
}

export function onTheRoadTo(row: RunRow): string | null {
  return row.position.match(/^Probably on the road to (.+)\.$/)?.[1] ?? null;
}

export function runLine(row: RunRow): string {
  const load = row.brand === "Fresh" ? `Fresh ${row.temp === "chilled" ? "chilled" : "dry"}` : row.brand;
  return `${load}, ${row.district} district`;
}

export function vehicleWords(type: string, temp: string): string {
  return `${temp === "reefer" ? "Refrigerated" : "Ambient"} ${type}`;
}

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

// A later trip's late stops are said apart from this trip's windows, so they never contradict.
export function rowCaption(vehicle: VehicleRun): string {
  const { current: row, later } = vehicle;
  if (row.out_of_contact) return silentCaption(row);
  if (!later?.risk) return row.caption;
  const own = row.caption.replace(
    "Every stop still to come is expected inside its window.",
    `Trip ${row.trip_no} stops are inside their windows.`,
  );
  return `${own} Trip ${later.trip_no}: ${later.risk}`;
}

export function driverName(row: RunRow): string {
  return calledName(row.driver) || row.vehicle_id;
}

export type Station =
  | { kind: "stop"; marker: RunMarker }
  | { kind: "hub"; label: string; status: string; recorded: boolean };

// Relay never records a vehicle back at the hub, so the hub node is always an estimate.
export function stations(vehicle: VehicleRun, depotLabel: string, now: string): Station[] {
  const row = vehicle.current;
  const out: Station[] = [];
  if (row.is_backup) {
    out.push({
      kind: "hub",
      label: depotLabel,
      status: row.departed_at ? `Left ${shortClock(row.departed_at)}` : "Loading at the dock",
      recorded: !!row.departed_at,
    });
  }
  for (const marker of row.markers) out.push({ kind: "stop", marker });
  // A stop moved to a backup is still the driver's until it is settled, so the hub is not next yet.
  const allDone = row.markers.every((m) => isRecorded(m) || m.receipt_at);
  if (vehicle.later) {
    // A planned time already gone by is not a promise. The second trip leaves once the first is back.
    const due = Date.parse(vehicle.later.planned_depart) <= Date.parse(now);
    out.push({
      kind: "hub",
      label: `Then trip ${vehicle.later.trip_no}`,
      status: due ? "Leaves after this trip" : `Leaves ${shortClock(vehicle.later.planned_depart)}`,
      recorded: false,
    });
  } else if (row.finished_at) {
    const back =
      row.expected_back && Date.parse(row.expected_back) > Date.parse(row.finished_at) ? row.expected_back : null;
    out.push({
      kind: "hub",
      label: "Hub next",
      status: back ? `around ${shortClock(roundTo5(back))}` : "",
      recorded: false,
    });
  } else if (row.status === "returning") {
    out.push({ kind: "hub", label: "Back to the hub", status: "Turned back", recorded: false });
  } else if (row.departed_at && allDone) {
    out.push({ kind: "hub", label: "Hub next", status: "", recorded: false });
  }
  return out;
}

export class Directory {
  constructor(private readonly board: Board | undefined) {}

  lane(vehicleId: string) {
    return this.board?.lanes.find((l) => l.vehicle_id === vehicleId);
  }

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

export function accessWords(dockType: string | undefined): string | null {
  if (dockType === "rear_dock") return "Rear dock";
  if (dockType === "street") return "Curb";
  if (dockType === "mall_bay") return "Mall bay";
  return null;
}
