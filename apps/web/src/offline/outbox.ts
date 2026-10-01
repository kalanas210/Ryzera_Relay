/** The driver's outbox: every action is written to IndexedDB first, then sent in the order it was made.
 *
 *  A record is one stop event (load accepted, arrived, delivered, a problem, trip finished) or one photo. Each
 *  carries the id the phone gave it when it was made, so a resend after a dropped connection is harmless: the server
 *  answers "duplicate". Records go before photos, so on a weak signal the stop reaches the dispatcher first and the
 *  heavier photo follows. Nothing is ever dropped: a record that fails stays queued and is retried when the browser
 *  says it is back online, when the app returns to the foreground, and on a timer. */
import Dexie, { type EntityTable } from "dexie";

export type RecordKind =
  | "load_accepted"
  | "departed"
  | "arrived"
  | "delivered"
  | "failed"
  | "problem"
  | "trip_finished"
  | "checkin";

export type FieldRecord = {
  id: string;
  kind: RecordKind;
  trip_id: string | null;
  stop_id: string | null;
  /** Scenario time on the phone when it happened; kept even if it reaches Relay an hour later. */
  occurred_at: string;
  /** The stop version the phone last saw, so the server can spot an office change made meanwhile. */
  base_version: number | null;
  lat?: number | null;
  lng?: number | null;
  accuracy_m?: number | null;
  payload: Record<string, unknown>;
};

export type PhotoRecord = {
  id: string;
  stop_id: string | null;
  taken_at: string;
  blob: Blob;
  width: number;
  height: number;
};

export type Outcome = "applied" | "duplicate" | "conflict" | "rejected";

type Queued =
  | { seq?: number; type: "record"; id: string; body: FieldRecord; tries: number; queued_at: number; error?: string }
  | { seq?: number; type: "photo"; id: string; body: PhotoRecord; tries: number; queued_at: number; error?: string };

type Sent = { id: string; type: "record" | "photo"; kind: string; outcome: Outcome; sent_at: number };

class OutboxDb extends Dexie {
  queue!: EntityTable<Queued, "seq">;
  sent!: EntityTable<Sent, "id">;

  constructor(name: string) {
    super(name);
    this.version(1).stores({ queue: "++seq, id, type", sent: "id, sent_at" });
  }
}

export type Transport = {
  sendRecords: (records: FieldRecord[]) => Promise<{ id: string; outcome: Outcome }[]>;
  sendPhoto: (photo: PhotoRecord) => Promise<Outcome>;
};

/** Thrown by a transport when the phone has no connection; anything else is a server answer. */
export class Offline extends Error {}

export class Outbox {
  private readonly db: OutboxDb;
  private flushing: Promise<FlushResult> | null = null;
  private readonly listeners = new Set<() => void>();

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

  async add(record: FieldRecord): Promise<void> {
    await this.db.queue.add({ type: "record", id: record.id, body: record, tries: 0, queued_at: Date.now() });
    this.changed();
  }

  async addPhoto(photo: PhotoRecord): Promise<void> {
    await this.db.queue.add({ type: "photo", id: photo.id, body: photo, tries: 0, queued_at: Date.now() });
    this.changed();
  }

  /** Everything still waiting, records first, each kind in the order it was made. */
  async waiting(): Promise<Queued[]> {
    const all = await this.db.queue.orderBy("seq").toArray();
    return [...all.filter((q) => q.type === "record"), ...all.filter((q) => q.type === "photo")];
  }

  async records(): Promise<FieldRecord[]> {
    return (await this.db.queue.orderBy("seq").toArray()).flatMap((q) => (q.type === "record" ? [q.body] : []));
  }

  async sent(limit = 50): Promise<Sent[]> {
    return this.db.sent.orderBy("sent_at").reverse().limit(limit).toArray();
  }

  /** Send what is waiting. Concurrent calls share one run, so a record is never sent twice at once. */
  flush(transport: Transport): Promise<FlushResult> {
    if (!this.flushing) {
      this.flushing = this.run(transport).finally(() => {
        this.flushing = null;
      });
    }
    return this.flushing;
  }

  private async run(transport: Transport): Promise<FlushResult> {
    const result: FlushResult = { sent: 0, conflicts: 0, offline: false, failed: 0 };
    const queue = await this.waiting();
    const records = queue.filter((q): q is Extract<Queued, { type: "record" }> => q.type === "record");
    if (records.length) {
      try {
        const answers = await transport.sendRecords(records.map((q) => q.body));
        const byId = new Map(answers.map((a) => [a.id, a.outcome]));
        await this.db.transaction("rw", this.db.queue, this.db.sent, async () => {
          for (const q of records) {
            const outcome = byId.get(q.id);
            if (!outcome) continue;
            await this.db.queue.delete(q.seq as number);
            await this.db.sent.put({ id: q.id, type: "record", kind: q.body.kind, outcome, sent_at: Date.now() });
            result.sent += 1;
            if (outcome === "conflict") result.conflicts += 1;
          }
        });
      } catch (error) {
        await this.noteFailure(records, error);
        result.offline = error instanceof Offline;
        result.failed += records.length;
        this.changed();
        return result; // photos wait until their stops are through
      }
    }
    for (const q of queue) {
      if (q.type !== "photo") continue;
      try {
        const outcome = await transport.sendPhoto(q.body);
        await this.db.transaction("rw", this.db.queue, this.db.sent, async () => {
          await this.db.queue.delete(q.seq as number);
          await this.db.sent.put({ id: q.id, type: "photo", kind: "photo", outcome, sent_at: Date.now() });
        });
        result.sent += 1;
      } catch (error) {
        await this.noteFailure([q], error);
        result.offline = error instanceof Offline;
        result.failed += 1;
        break;
      }
    }
    this.changed();
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

export type FlushResult = { sent: number; conflicts: number; offline: boolean; failed: number };

export function newRecordId(): string {
  return crypto.randomUUID();
}
