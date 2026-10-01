import "fake-indexeddb/auto";
import { afterEach, describe, expect, it } from "vitest";
import { type FieldRecord, Offline, Outbox, type Outcome, type PhotoRecord, type Transport } from "./outbox";

let n = 0;
const outboxes: Outbox[] = [];

function freshOutbox() {
  n += 1;
  const outbox = new Outbox(`test-outbox-${n}`);
  outboxes.push(outbox);
  return outbox;
}

afterEach(async () => {
  for (const o of outboxes.splice(0)) {
    await o.clear();
    o.close();
  }
});

function record(id: string, kind: FieldRecord["kind"] = "arrived"): FieldRecord {
  return { id, kind, trip_id: "t1", stop_id: "s1", occurred_at: "2026-04-08T00:21:00Z", base_version: 1, payload: {} };
}

function photo(id: string): PhotoRecord {
  return { id, stop_id: "s1", taken_at: "2026-04-08T01:06:00Z", blob: new Blob(["x"]), width: 1, height: 1 };
}

function transport(log: string[], outcomes: Record<string, Outcome> = {}, offline = false): Transport {
  return {
    async sendRecords(records) {
      if (offline) throw new Offline("No connection");
      log.push(...records.map((r) => `record:${r.id}`));
      return records.map((r) => ({ id: r.id, outcome: outcomes[r.id] ?? "applied" }));
    },
    async sendPhoto(p) {
      if (offline) throw new Offline("No connection");
      log.push(`photo:${p.id}`);
      return "applied";
    },
  };
}

describe("the driver's outbox", () => {
  it("keeps records while there is no signal and sends them in order once it returns", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("a", "delivered"));
    await outbox.add(record("b", "arrived"));
    const log: string[] = [];

    const first = await outbox.flush(transport(log, {}, true));
    expect(first.offline).toBe(true);
    expect((await outbox.waiting()).map((q) => q.id)).toEqual(["a", "b"]);
    expect((await outbox.waiting())[0]?.tries).toBe(1);

    const second = await outbox.flush(transport(log));
    expect(second.sent).toBe(2);
    expect(log).toEqual(["record:a", "record:b"]);
    expect(await outbox.waiting()).toEqual([]);
  });

  it("sends stop records before photos, even a photo taken first", async () => {
    const outbox = freshOutbox();
    await outbox.addPhoto(photo("p1"));
    await outbox.add(record("r1", "delivered"));
    const log: string[] = [];
    await outbox.flush(transport(log));
    expect(log).toEqual(["record:r1", "photo:p1"]);
  });

  it("keeps the server's answer, including a conflict to settle", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("stop4", "delivered"));
    const result = await outbox.flush(transport([], { stop4: "conflict" }));
    expect(result.conflicts).toBe(1);
    const [sent] = await outbox.sent();
    expect(sent).toMatchObject({ id: "stop4", outcome: "conflict", kind: "delivered" });
  });

  it("runs one flush at a time, so a record is never sent twice at once", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("only"));
    const log: string[] = [];
    const t = transport(log);
    await Promise.all([outbox.flush(t), outbox.flush(t), outbox.flush(t)]);
    expect(log).toEqual(["record:only"]);
  });
});
