// The driver's outbox. Every action goes to IndexedDB first, then out in the order it was made.
// Each record carries the id the phone gave it, so a resend after a dropped connection is harmless.
// A failed record stays queued. It is retried when the browser is back online, when the app returns
// to the foreground, and with the minute check-in.
import Dexie, { type EntityTable } from "dexie";

export type RecordKind =
  | "load_accepted"
  | "load_difference"
  | "departed"
  | "arrived"
  | "delivered"
  | "failed"
  | "problem"
  | "trip_finished"
  | "conflict_answer"
  | "checkin";

export type FieldRecord = {
  id: string;
  kind: RecordKind;
  trip_id: string | null;
  stop_id: string | null;
  // scenario time on the phone when it happened, even if Relay hears an hour later
  occurred_at: string;
  // the stop version the phone last saw, so the server can spot an office change made meanwhile
  base_version: number | null;
  lat?: number | null;
  lng?: number | null;
  accuracy_m?: number | null;
  payload: Record<string, unknown>;
};

export type PhotoRecord = {
  id: string;
  stop_id: string | null;
  // the record this photo belongs to, when it is not a stop's proof (a problem report's photo)
  event_id?: string | null;
  taken_at: string;
  blob: Blob;
  width: number;
  height: number;
};

export type Outcome = "applied" | "duplicate" | "conflict" | "rejected";

export type Answer = { id: string; outcome: Outcome; reason?: string; at?: string };

type Common = {
  seq?: number;
  id: string;
  tries: number;
  queued_at: number;
  error?: string;
  saved_offline?: boolean;
  // a record waits for its location fix until this wall-clock time, then goes with or without one
  held_until?: number;
};

export type Queued = (Common & { type: "record"; body: FieldRecord }) | (Common & { type: "photo"; body: PhotoRecord });

export type Sent = {
  id: string;
  type: "record" | "photo";
  kind: string;
  outcome: Outcome;
  sent_at: number;
  reason?: string;
  // scenario time Relay had it, for "Saved offline, sent 7:14 AM"
  at?: string;
  saved_offline?: boolean;
  // kept so the phone can still show its own record after the queue lets go of it
  record?: FieldRecord;
  photo?: Omit<PhotoRecord, "blob">;
};

class OutboxDb extends Dexie {
  queue!: EntityTable<Queued, "seq">;
  sent!: EntityTable<Sent, "id">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ queue: "++seq, id, type", sent: "id, sent_at" });
  }
}

export type Transport = {
  sendRecords: (records: FieldRecord[]) => Promise<Answer[]>;
  sendPhoto: (photo: PhotoRecord) => Promise<Outcome | Omit<Answer, "id">>;
};

// Thrown by a transport when the phone has no connection. Anything else is a server answer.
export class Offline extends Error {}

export type AddOptions = {
  savedOffline?: boolean;
  holdMs?: number;
};

export class Outbox {
  private readonly db: OutboxDb;
  private flushing: Promise<FlushResult> | null = null;
  private readonly listeners = new Set<() => void>();
  private moving = new Set<string>();
  // saved or let go while a run is sending, so that run takes them next and they count as on their way
  private joining = new Set<string>();
  private again = false;

  constructor(name = "relay-outbox") {
    this.db = new OutboxDb(name);
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changed() {
    for (const listener of this.listeners) listener();
  }

  inFlight(): ReadonlySet<string> {
    return this.joining.size ? new Set([...this.moving, ...this.joining]) : this.moving;
  }

  private joined(id: string) {
    if (!this.flushing) return;
    this.again = true;
    this.joining.add(id);
  }

  async add(record: FieldRecord, options: AddOptions = {}): Promise<void> {
    await this.db.queue.add({
      type: "record",
      id: record.id,
      body: record,
      tries: 0,
      queued_at: Date.now(),
      saved_offline: options.savedOffline,
      held_until: options.holdMs ? Date.now() + options.holdMs : undefined,
    });
    this.joined(record.id);
    this.changed();
  }

  async addPhoto(photo: PhotoRecord, options: Omit<AddOptions, "holdMs"> = {}): Promise<void> {
    await this.db.queue.add({
      type: "photo",
      id: photo.id,
      body: photo,
      tries: 0,
      queued_at: Date.now(),
      saved_offline: options.savedOffline,
    });
    this.joined(photo.id);
    this.changed();
  }

  async release(id: string, patch: Partial<Pick<FieldRecord, "lat" | "lng" | "accuracy_m">> = {}): Promise<void> {
    let released = false;
    await this.db.transaction("rw", this.db.queue, async () => {
      const item = await this.db.queue.where("id").equals(id).first();
      if (item?.type !== "record") return;
      await this.db.queue.update(item.seq as number, { body: { ...item.body, ...patch }, held_until: undefined });
      released = true;
    });
    if (released) this.joined(id);
    this.changed();
  }

  // Records go before photos, so on a weak signal the stop reaches the dispatcher first.
  async waiting(): Promise<Queued[]> {
    const all = await this.db.queue.orderBy("seq").toArray();
    return [...all.filter((q) => q.type === "record"), ...all.filter((q) => q.type === "photo")];
  }

  async records(): Promise<FieldRecord[]> {
    return (await this.db.queue.orderBy("seq").toArray()).flatMap((q) => (q.type === "record" ? [q.body] : []));
  }

  async sent(limit = 200): Promise<Sent[]> {
    return this.db.sent.orderBy("sent_at").reverse().limit(limit).toArray();
  }

  // Concurrent calls share one run, so a record is never sent twice at once. Anything saved while it
  // runs goes out in the same run, unless the run found no connection. Then it waits for the next try.
  flush(transport: Transport): Promise<FlushResult> {
    this.flushing ??= this.drain(transport);
    return this.flushing;
  }

  private async drain(transport: Transport): Promise<FlushResult> {
    const total: FlushResult = { sent: 0, conflicts: 0, offline: false, failed: 0, held: false };
    try {
      for (;;) {
        this.again = false;
        const pass = await this.run(transport);
        total.sent += pass.sent;
        total.conflicts += pass.conflicts;
        total.failed += pass.failed;
        total.offline = pass.offline;
        total.held = pass.held;
        if (!this.again || pass.offline) return total;
      }
    } finally {
      // Let go in the same step that decides there is nothing more, so a record saved just after starts a new run.
      this.flushing = null;
      this.moving = new Set();
      this.joining = new Set();
      this.changed();
    }
  }

  private async run(transport: Transport): Promise<FlushResult> {
    const result: FlushResult = { sent: 0, conflicts: 0, offline: false, failed: 0, held: false };
    const queue = await this.waiting();
    const records = queue.filter((q): q is Extract<Queued, { type: "record" }> => q.type === "record");
    // Order is kept. A record still waiting for its location holds back every record and photo after it.
    const heldAt = records.findIndex((q) => q.held_until !== undefined && q.held_until > Date.now());
    const ready = heldAt === -1 ? records : records.slice(0, heldAt);
    result.held = heldAt !== -1;
    if (ready.length) {
      this.moving = new Set(ready.map((q) => q.id));
      this.changed();
      try {
        const answers = await transport.sendRecords(ready.map((q) => q.body));
        const byId = new Map(answers.map((a) => [a.id, a]));
        await this.db.transaction("rw", this.db.queue, this.db.sent, async () => {
          for (const q of ready) {
            const answer = byId.get(q.id);
            if (!answer) continue;
            await this.db.queue.delete(q.seq as number);
            await this.db.sent.put({
              id: q.id,
              type: "record",
              kind: q.body.kind,
              outcome: answer.outcome,
              sent_at: Date.now(),
              reason: answer.reason || undefined,
              at: answer.at,
              saved_offline: q.saved_offline,
              record: q.body,
            });
            result.sent += 1;
            if (answer.outcome === "conflict") result.conflicts += 1;
          }
        });
      } catch (error) {
        await this.noteFailure(ready, error);
        result.offline = error instanceof Offline;
        result.failed += ready.length;
        return result; // photos wait until their stops are through
      }
    }
    if (result.held) return result;
    for (const q of queue) {
      if (q.type !== "photo") continue;
      this.moving = new Set([q.id]);
      this.changed();
      try {
        const answer = await transport.sendPhoto(q.body);
        const { outcome, reason, at } = typeof answer === "string" ? { outcome: answer } : answer;
        const { blob: _blob, ...photo } = q.body;
        await this.db.transaction("rw", this.db.queue, this.db.sent, async () => {
          await this.db.queue.delete(q.seq as number);
          await this.db.sent.put({
            id: q.id,
            type: "photo",
            kind: "photo",
            outcome,
            sent_at: Date.now(),
            reason: reason || undefined,
            at,
            saved_offline: q.saved_offline,
            photo,
          });
        });
        result.sent += 1;
      } catch (error) {
        await this.noteFailure([q], error);
        result.offline = error instanceof Offline;
        result.failed += 1;
        break;
      }
    }
    return result;
  }

  private async noteFailure(items: Queued[], error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    await this.db.queue.bulkUpdate(
      items.map((q) => ({ key: q.seq as number, changes: { tries: q.tries + 1, error: message } })),
    );
  }

  async clear(): Promise<void> {
    await this.db.queue.clear();
    await this.db.sent.clear();
    this.changed();
  }

  close() {
    this.db.close();
  }
}

export type FlushResult = { sent: number; conflicts: number; offline: boolean; failed: number; held: boolean };

export function newRecordId(): string {
  return crypto.randomUUID();
}
