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

  it("holds a record for its location, and everything saved after it, until it is released", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("arrive"), { holdMs: 15_000 });
    await outbox.add(record("deliver", "delivered"));
    await outbox.addPhoto(photo("p"));
    const log: string[] = [];

    const held = await outbox.flush(transport(log));
    expect(held.held).toBe(true);
    expect(log).toEqual([]);

    await outbox.release("arrive", { lat: 7.25, lng: 80.35, accuracy_m: 12 });
    await outbox.flush(transport(log));
    expect(log).toEqual(["record:arrive", "record:deliver", "photo:p"]);
    const sent = await outbox.sent();
    expect(sent.find((s) => s.id === "arrive")?.record).toMatchObject({ lat: 7.25, lng: 80.35 });
  });

  it("lets go of a held record once its wait is over, with or without a location", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("late"), { holdMs: -1 });
    const log: string[] = [];
    await outbox.flush(transport(log));
    expect(log).toEqual(["record:late"]);
  });

  it("keeps Relay's reason for a record it refused, with when it was answered and whether it waited", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("old"), { savedOffline: true });
    const t: Transport = {
      async sendRecords(records) {
        return records.map((r) => ({
          id: r.id,
          outcome: "rejected",
          reason: "No such trip.",
          at: "2026-04-08T01:44:00Z",
        }));
      },
      async sendPhoto() {
        return "applied";
      },
    };
    await outbox.flush(t);
    const [sent] = await outbox.sent();
    expect(sent).toMatchObject({ outcome: "rejected", reason: "No such trip.", saved_offline: true });
    expect(sent?.at).toBe("2026-04-08T01:44:00Z");
    expect(await outbox.waiting()).toEqual([]);
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

/** A transport whose first send waits until the test lets it answer, so the test can save while it is going. */
function slowFirstSend(log: string[], offline = false) {
  let answer = () => {};
  const going = new Promise<void>((resolve) => {
    answer = resolve;
  });
  let first = true;
  const t = transport(log, {}, offline);
  const slow: Transport = {
    async sendRecords(records) {
      if (first) {
        first = false;
        await going;
      }
      return t.sendRecords(records);
    },
    sendPhoto: (p) => t.sendPhoto(p),
  };
  return { slow, answer };
}

describe("saving while the outbox is sending", () => {
  it("sends what was saved during a send in the same run, after it, without waiting for another try", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("first", "arrived"));
    const log: string[] = [];
    const { slow, answer } = slowFirstSend(log);

    const running = outbox.flush(slow);
    await expect.poll(() => outbox.inFlight().has("first")).toBe(true);
    await outbox.add(record("second", "delivered"));
    await outbox.addPhoto(photo("proof"));
    // the save's own nudge joins the run already going, and the phone counts the new ones as on their way
    const joined = outbox.flush(slow);
    expect([...outbox.inFlight()].sort()).toEqual(["first", "proof", "second"]);

    answer();
    const result = await joined;
    expect(await running).toBe(result);
    expect(log).toEqual(["record:first", "record:second", "photo:proof"]);
    expect(result).toMatchObject({ sent: 3, failed: 0, offline: false });
    expect(await outbox.waiting()).toEqual([]);
    expect(outbox.inFlight().size).toBe(0);
  });

  it("sends a record let go of its location wait during a send, without waiting for the wait to run out", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("delivered", "delivered"));
    await outbox.add(record("arrive"), { holdMs: 15_000 });
    const log: string[] = [];
    const { slow, answer } = slowFirstSend(log);

    const running = outbox.flush(slow);
    await expect.poll(() => outbox.inFlight().has("delivered")).toBe(true);
    await outbox.release("arrive", { lat: 7.25, lng: 80.35, accuracy_m: 12 });
    answer();

    const result = await running;
    expect(result.held).toBe(false);
    expect(log).toEqual(["record:delivered", "record:arrive"]);
  });

  it("leaves what was saved during a send that found no connection for the next try, in order", async () => {
    const outbox = freshOutbox();
    await outbox.add(record("a"));
    const log: string[] = [];
    const { slow, answer } = slowFirstSend(log, true);

    const running = outbox.flush(slow);
    await expect.poll(() => outbox.inFlight().has("a")).toBe(true);
    await outbox.add(record("b"));
    answer();

    const result = await running;
    expect(result).toMatchObject({ offline: true, sent: 0, failed: 1 });
    expect((await outbox.waiting()).map((q) => [q.id, q.tries])).toEqual([
      ["a", 1],
      ["b", 0],
    ]);
    expect(outbox.inFlight().size).toBe(0);

    await outbox.flush(transport(log));
    expect(log).toEqual(["record:a", "record:b"]);
  });
});
