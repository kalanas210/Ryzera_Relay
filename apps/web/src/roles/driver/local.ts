/** The phone's own view of the run: Relay's last snapshot with this phone's records laid over it, so a screen shows
 *  an arrival or a delivery the moment it is saved, signal or not. Pure functions, so the rules are tested apart
 *  from the screens.
 *
 *  Records only move a stop forward (pending, then arrived, then delivered or not delivered); a record Relay refused
 *  changes nothing. A delivery that clashed with an office change (the stop was moved to a backup while the phone
 *  was silent) still shows as delivered here: it is the driver's own record, and the question card asks about it.
 *  A "no" cancels nothing either: the stop waits for the dispatcher, and only a settlement that keeps the other
 *  vehicle's copy takes the record back. The same holds when Relay has the clashing record and this phone does not
 *  (a demo jump played the stop): the question carries it. */
import type { FieldRecord, Outcome, PhotoRecord, Queued, Sent } from "@/offline/outbox";
import type { DriverRun, DriverStop, DriverTrip, Question, StopStatus } from "./types";

export type LocalItem = {
  id: string;
  type: "record" | "photo";
  /** Still on the phone. */
  queued: boolean;
  record: FieldRecord | null;
  photo: Omit<PhotoRecord, "blob"> | null;
  outcome: Outcome | null;
  reason: string | null;
  /** When Relay had it, on the scenario clock. */
  at: string | null;
  savedOffline: boolean;
  /** Waiting for its location fix before it may go. */
  held: boolean;
  inFlight: boolean;
};

export function localItems(
  queued: Queued[],
  sent: Sent[],
  inFlight: ReadonlySet<string>,
  now = Date.now(),
): LocalItem[] {
  const done: LocalItem[] = [...sent]
    .sort((a, b) => a.sent_at - b.sent_at)
    .map((s) => ({
      id: s.id,
      type: s.type,
      queued: false,
      record: s.record ?? null,
      photo: s.photo ?? null,
      outcome: s.outcome,
      reason: s.reason ?? null,
      at: s.at ?? null,
      savedOffline: Boolean(s.saved_offline),
      held: false,
      inFlight: false,
    }));
  const waiting: LocalItem[] = queued.map((q) => {
    const photo = q.type === "photo" ? (({ blob: _blob, ...rest }) => rest)(q.body) : null;
    return {
      id: q.id,
      type: q.type,
      queued: true,
      record: q.type === "record" ? q.body : null,
      photo,
      outcome: null,
      reason: null,
      at: null,
      savedOffline: Boolean(q.saved_offline),
      held: q.held_until !== undefined && q.held_until > now,
      inFlight: inFlight.has(q.id),
    };
  });
  return [...done, ...waiting];
}

const RANK: Record<StopStatus, number> = { pending: 0, moved: 0, cancelled: 0, arrived: 1, delivered: 2, failed: 2 };

/** Kinds that belong to a stop: the pill counts these as that stop. */
const STOP_KINDS = new Set(["arrived", "delivered", "failed", "problem"]);

function usable(items: LocalItem[]): FieldRecord[] {
  return items
    .filter((i) => i.record && i.outcome !== "rejected")
    .map((i) => i.record as FieldRecord)
    .sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at));
}

/** The latest answer this phone gave to each question, by question id. */
export function localAnswers(items: LocalItem[]): Map<string, { answer: "yes" | "no"; queued: boolean }> {
  const out = new Map<string, { answer: "yes" | "no"; queued: boolean }>();
  for (const item of items) {
    const r = item.record;
    if (r?.kind !== "conflict_answer" || item.outcome === "rejected") continue;
    const id = String(r.payload.conflict_id ?? "");
    const answer = r.payload.answer === "no" ? "no" : "yes";
    out.set(id, { answer, queued: item.queued });
  }
  return out;
}

/** Open questions the driver answered "no", here or on Relay. Nothing is cancelled on a "no": the record stays, the
 *  backup carries on, and the driver waits at the dock for the dispatcher's call. */
export function answeredNo(run: DriverRun, items: LocalItem[]): Question[] {
  const answers = localAnswers(items);
  return run.questions.filter(
    (q) => q.status !== "resolved" && (answers.get(q.id)?.answer ?? (q.answer === "no" ? "no" : null)) === "no",
  );
}

/** Stops whose two-copy question was settled without Relay keeping this phone's delivery: the office kept the
 *  other vehicle's copy, so the phone's own records for them are set aside. */
function settledElsewhere(run: DriverRun): Set<string> {
  const relay = new Map([run.trip, ...run.later].flatMap((t) => t?.stops ?? []).map((s) => [s.stop_id, s.status]));
  return new Set(
    run.questions.filter((q) => q.status === "resolved" && relay.get(q.stop_id) !== "delivered").map((q) => q.stop_id),
  );
}

export function overlay(run: DriverRun, items: LocalItem[]): DriverRun {
  const records = usable(items);
  const setAside = settledElsewhere(run);
  // an open question keeps the driver's delivery, answered or not: only the office's decision takes it back
  const asked = run.questions.filter((q) => q.status !== "resolved" && q.delivered_at);
  if (!records.length && !asked.length) return run;
  const apply = (trip: DriverTrip): DriverTrip => applyQuestions(applyTrip(trip, records, setAside), asked);
  return { ...run, trip: run.trip ? apply(run.trip) : null, later: run.later.map(apply) };
}

/** A stop with two copies is the driver's delivery until the question says otherwise, as Relay has it recorded. */
function applyQuestions(trip: DriverTrip, asked: Question[]): DriverTrip {
  if (!asked.some((q) => trip.stops.some((s) => s.stop_id === q.stop_id))) return trip;
  return {
    ...trip,
    stops: trip.stops.map((s) => {
      const q = asked.find((x) => x.stop_id === s.stop_id);
      if (!q?.delivered_at || RANK[s.status] >= 2) return s;
      return {
        ...s,
        status: "delivered",
        arrived_at: s.arrived_at ?? q.arrived_at,
        completed_at: q.delivered_at,
        receiver: s.receiver ?? q.receiver,
        has_photo: s.has_photo || q.has_photo,
      };
    }),
  };
}

function applyTrip(trip: DriverTrip, all: FieldRecord[], setAside: Set<string>): DriverTrip {
  const records = all.filter((r) => r.trip_id === trip.trip_id);
  if (!records.length) return trip;
  const next: DriverTrip = { ...trip, handover: { ...trip.handover }, stops: trip.stops.map((s) => ({ ...s })) };
  const byId = new Map(next.stops.map((s) => [s.stop_id, s]));
  for (const r of records) {
    switch (r.kind) {
      case "load_accepted":
        if (!next.handover.accepted_at) {
          next.handover.accepted_at = r.occurred_at;
          next.handover.accepted_on = "phone";
        }
        next.load = "accepted";
        break;
      case "load_difference":
        next.handover.difference = String(r.payload.note ?? "");
        break;
      case "departed":
        next.departed_at = next.departed_at ?? r.occurred_at;
        break;
      case "arrived":
      case "delivered":
      case "failed": {
        // the truck left even if nobody tapped Leave the hub: Relay takes the planned time, so the phone does too
        next.departed_at = next.departed_at ?? trip.planned_depart;
        const stop = r.stop_id ? byId.get(r.stop_id) : undefined;
        if (!stop || setAside.has(stop.stop_id)) break;
        stop.arrived_at = stop.arrived_at ?? r.occurred_at;
        if (r.kind === "arrived") {
          if (RANK[stop.status] < 1) stop.status = "arrived";
        } else if (RANK[stop.status] < 2) {
          stop.status = r.kind;
          stop.completed_at = r.occurred_at;
          if (r.kind === "delivered") {
            stop.receiver = typeof r.payload.receiver === "string" ? r.payload.receiver : stop.receiver;
            stop.has_photo = stop.has_photo || Boolean(r.payload.photo_id);
          }
        }
        break;
      }
      case "trip_finished":
        next.finished_at = next.finished_at ?? r.occurred_at;
        break;
      default:
        break;
    }
  }
  return next;
}

/** What one stop has on this phone: its own records, and whether any part is still waiting to send. */
export type StopLocal = {
  waiting: boolean;
  sending: boolean;
  arrival: { record: FieldRecord; held: boolean } | null;
  delivery: { record: FieldRecord; held: boolean; outcome: Outcome | null } | null;
  photo: { id: string; queued: boolean } | null;
  /** When Relay had records this phone saved with no signal: "Saved offline, sent 7:14 AM". */
  sentAt: string | null;
  /** The phone's record clashed with an office change. */
  conflict: boolean;
  problem: string | null;
};

export function stopLocal(items: LocalItem[], stopId: string): StopLocal {
  // a proof photo names its stop; a problem report's photo names only its report
  const mine = items.filter(
    (i) => i.outcome !== "rejected" && (i.record?.stop_id === stopId || i.photo?.stop_id === stopId),
  );
  const last = (kind: string) => [...mine].reverse().find((i) => i.record?.kind === kind);
  const arrival = last("arrived");
  const delivery = last("delivered");
  const photoId = delivery?.record?.payload.photo_id;
  const photo = typeof photoId === "string" ? items.find((i) => i.id === photoId) : undefined;
  const offline = mine.filter((i) => !i.queued && i.savedOffline && i.at && i.record);
  const problem = [...mine].reverse().find((i) => i.record?.kind === "problem");
  return {
    waiting: mine.some((i) => i.queued && (i.type === "photo" || STOP_KINDS.has(i.record?.kind ?? ""))),
    sending: mine.some((i) => i.queued && (i.inFlight || i.held)),
    arrival: arrival?.record ? { record: arrival.record, held: arrival.held } : null,
    delivery: delivery?.record ? { record: delivery.record, held: delivery.held, outcome: delivery.outcome } : null,
    photo: typeof photoId === "string" ? { id: photoId, queued: photo ? photo.queued : false } : null,
    sentAt: offline.length ? (offline[offline.length - 1]?.at ?? null) : null,
    conflict: mine.some((i) => i.outcome === "conflict"),
    problem: problem?.record ? String(problem.record.payload.reason ?? "") : null,
  };
}

export type Counts = { stops: number; photos: number; updates: number; stopIds: string[] };

/** What is waiting, the way the driver thinks of it: stops, then photos once only photos are left, then anything
 *  else (a load acceptance, a finished trip). */
export function countOf(items: LocalItem[]): Counts {
  const stopIds = new Set<string>();
  let photos = 0;
  let updates = 0;
  for (const item of items) {
    if (item.type === "photo") photos += 1;
    else if (item.record?.stop_id && STOP_KINDS.has(item.record.kind)) stopIds.add(item.record.stop_id);
    else updates += 1;
  }
  return { stops: stopIds.size, photos, updates, stopIds: [...stopIds] };
}

export type PillView = { state: "synced" } | ({ state: "offline" | "sending" } & Counts);

/** The sync pill: all synced, sending (for the seconds it takes), or offline with what is still on the phone. */
export function pillView(items: LocalItem[], offline: boolean, batch: Counts | null): PillView {
  if (batch && !offline) return { state: "sending", ...batch };
  const queued = items.filter((i) => i.queued);
  if (!queued.length) {
    return offline ? { state: "offline", stops: 0, photos: 0, updates: 0, stopIds: [] } : { state: "synced" };
  }
  const moving = !offline && queued.every((i) => i.held || i.inFlight);
  return { state: moving ? "sending" : "offline", ...countOf(queued) };
}

/** The stop to drive to: the first one not yet done, not handed to another vehicle, and not left with a problem
 *  for the dispatcher to decide. */
export function nextStop(trip: DriverTrip, items: LocalItem[]): DriverStop | null {
  const parked = new Set(
    items
      .filter((i) => i.record?.kind === "problem" && i.outcome !== "rejected")
      .filter((i) => ["outlet_closed", "access_blocked"].includes(String(i.record?.payload.reason)))
      .map((i) => i.record?.stop_id),
  );
  return trip.stops.find((s) => (s.status === "pending" || s.status === "arrived") && !parked.has(s.stop_id)) ?? null;
}

export function doneCount(trip: DriverTrip): number {
  return trip.stops.filter((s) => s.status === "delivered" || s.status === "failed").length;
}

/** The stops this truck still carries: one moved to another vehicle, or cancelled, is not the driver's to count. */
export function ownStops(trip: DriverTrip): DriverStop[] {
  return trip.stops.filter((s) => s.status !== "moved" && s.status !== "cancelled");
}

/** When the stop's records saved with no signal had all reached Relay: the later of this phone's own answer and
 *  Relay's, which also covers what a demo jump recorded for the driver (an arrival this phone sent at 5:37 and a
 *  delivery that reached the office at 7:14 make the stop's 7:14). */
export function sentAt(stop: DriverStop, local: StopLocal): string | null {
  return latest([local.sentAt, stop.sent_at]);
}

/** The latest of some times, whichever way each is written; null when there is none. */
export function latest(times: (string | null | undefined)[]): string | null {
  return times.reduce<string | null>((best, t) => (t && (!best || Date.parse(t) > Date.parse(best)) ? t : best), null);
}

/** The open question about a stop, if Relay has asked one. */
export function questionFor(run: DriverRun, stopId: string): Question | undefined {
  return run.questions.find((q) => q.stop_id === stopId && q.status !== "resolved");
}

/** A question still waiting for the driver: open, and not answered on this phone or on Relay. */
export function awaitingAnswer(run: DriverRun, items: LocalItem[], stopId: string): boolean {
  const q = questionFor(run, stopId);
  return Boolean(q && !q.answer && !localAnswers(items).has(q.id));
}

/** The driver said "no" about this stop and the dispatcher has not settled it yet. */
export function waitingForCall(run: DriverRun, items: LocalItem[], stopId: string): boolean {
  return answeredNo(run, items).some((q) => q.stop_id === stopId);
}

export type WindowState = { state: "soon" | "open" | "closing" | "closed"; minutes: number; closesAt: Date };

/** A time of day on the run date, in Sri Lanka. */
export function onRunDate(runDate: string, hhmm: string): Date {
  return new Date(`${runDate}T${hhmm}:00+05:30`);
}

const minute = (d: Date | string) => Math.floor((typeof d === "string" ? Date.parse(d) : d.getTime()) / 60_000);

/** Whole minutes from one clock time to another, as people read the clock. */
export function minutesBetween(from: Date | string, to: Date | string): number {
  return minute(to) - minute(from);
}

/** The receiving window against now: opens soon, open, closing soon (under 30 minutes left) or closed. */
export function windowState(runDate: string, open: string, close: string, now: Date): WindowState {
  const opensAt = onRunDate(runDate, open);
  const closesAt = onRunDate(runDate, close);
  if (minute(now) < minute(opensAt)) return { state: "soon", minutes: minutesBetween(now, opensAt), closesAt };
  const left = minutesBetween(now, closesAt);
  if (left > 0) return { state: left < 30 ? "closing" : "open", minutes: left, closesAt };
  return { state: "closed", minutes: -left, closesAt };
}

/** A scenario time stamped to the whole minute, as the driver reads the clock. */
export function minuteIso(now: Date): string {
  return new Date(minute(now) * 60_000).toISOString();
}

/** A stop still to come whose expected time has gone by on the clock. The phone never pushes Relay's time later, so
 *  the screens say it has passed rather than show a time behind the clock as if it were still ahead. */
export function expectedPassed(stop: Pick<DriverStop, "status" | "expected">, now: Date): boolean {
  return stop.status === "pending" && stop.expected !== null && minute(now) > minute(round5(stop.expected));
}

/** Round to the nearest 5 minutes: Expected times are always "around". */
export function round5(value: string | Date): Date {
  const five = 5 * 60_000;
  const ms = typeof value === "string" ? Date.parse(value) : value.getTime();
  return new Date(Math.round(ms / five) * five);
}
