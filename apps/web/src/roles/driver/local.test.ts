import { describe, expect, it } from "vitest";
import type { FieldRecord, Queued, Sent } from "@/offline/outbox";
import { localItems, minutesBetween, nextStop, overlay, pillView, round5, stopLocal, windowState } from "./local";
import type { DriverRun, DriverStop, Question } from "./types";

const DAY = "2026-04-08";
const at = (clock: string) => new Date(`${DAY}T${clock}:00+05:30`).toISOString();

function stop(seq: number, place: string, extra: Partial<DriverStop> = {}): DriverStop {
  return {
    stop_id: `s${seq}`,
    seq,
    version: 1,
    status: "pending",
    order_ref: `ORD${seq}`,
    outlet_id: `OUT${seq}`,
    place,
    store_name: `Waypoint Fresh ${place}`,
    dock_type: "rear_dock",
    van_only: false,
    window_open: "04:00",
    window_close: "07:45",
    planned: at("05:19"),
    expected: at("06:35"),
    arrived_at: null,
    completed_at: null,
    moved_to: null,
    cases: 96,
    lines: [
      { case_type: "rice_dhal", name: "Rice and dhal", ordered: 36, loaded: 30, short: 6, short_until: "2026-04-09" },
    ],
    receiver: null,
    has_photo: false,
    sent_at: null,
    ...extra,
  };
}

/** Relay's one question about a stop with two copies, with the records it holds for it. */
function asked(extra: Partial<Question> = {}): Question {
  return {
    id: "q1",
    stop_id: "s4",
    seq: 4,
    place: "Aranayake",
    question: "",
    status: "waiting_for_driver",
    answer: null,
    opened_at: at("07:14"),
    arrived_at: at("06:56"),
    delivered_at: at("07:09"),
    cases: 86,
    receiver: "K. Herath",
    has_photo: true,
    signed: false,
    backup_vehicle: "VEH060",
    backup_driver: "Nimal Fernando",
    moved_at: at("06:15"),
    moved_by: "Nuwan Perera",
    answered_at: null,
    resolved_at: null,
    resolution: "",
    ...extra,
  };
}

function run(stops: DriverStop[], questions: DriverRun["questions"] = []): DriverRun {
  return {
    run_date: DAY,
    now: at("06:05"),
    driver: "Kasun Bandara",
    vehicle_id: "VEH045",
    published: true,
    dispatcher: "Nuwan Perera",
    trip: {
      trip_id: "t1",
      vehicle_id: "VEH045",
      vehicle_kind: "Dry-box truck",
      trip_no: 1,
      trips_today: 1,
      is_backup: false,
      brand: "Fresh",
      temp: "ambient",
      district: "Kegalle",
      depot: "Kandy",
      depot_label: "Kandy hub",
      status: "departed",
      planned_depart: at("03:29"),
      departed_at: null,
      planned_back: at("06:55"),
      expected_back: at("09:10"),
      finished_at: null,
      load: "to_accept",
      loader: "Mohamed Rizwan",
      handover: {
        completed_at: at("03:16"),
        completed_by: "Mohamed Rizwan",
        accepted_at: null,
        accepted_by: null,
        accepted_on: null,
        difference: "",
        stops: [],
        planned_cases: 0,
        loaded_cases: 0,
        planned_kg: 0,
        loaded_kg: 0,
        planned_m3: 0,
        loaded_m3: 0,
      },
      shortfalls: [],
      stops,
    },
    later: [],
    questions,
    notices: [],
    outage: null,
  };
}

let seq = 0;
function record(kind: FieldRecord["kind"], clock: string, stopId: string | null, payload = {}): FieldRecord {
  seq += 1;
  return { id: `r${seq}`, kind, trip_id: "t1", stop_id: stopId, occurred_at: at(clock), base_version: 1, payload };
}

const queued = (body: FieldRecord, extra: Partial<Queued> = {}): Queued =>
  ({ type: "record", id: body.id, body, tries: 0, queued_at: 0, seq: 0, ...extra }) as Queued;

const sent = (body: FieldRecord, outcome: Sent["outcome"], extra: Partial<Sent> = {}): Sent => ({
  id: body.id,
  type: "record",
  kind: body.kind,
  outcome,
  sent_at: 0,
  record: body,
  ...extra,
});

describe("the phone's own records over Relay's run", () => {
  it("shows a load accepted, a departure and a delivery the moment they are saved", () => {
    const base = run([stop(1, "Kegalle"), stop(2, "Mawanella")]);
    const items = localItems(
      [
        queued(record("load_accepted", "03:17", null)),
        queued(record("arrived", "04:41", "s1")),
        queued(record("delivered", "05:00", "s1", { receiver: "P. Silva", photo_id: "p1" })),
      ],
      [],
      new Set(),
    );
    const trip = overlay(base, items).trip;
    expect(trip?.load).toBe("accepted");
    expect(trip?.handover.accepted_at).toBe(at("03:17"));
    // a first arrival with no Leave the hub tapped: the truck left at its planned time, as Relay takes it too
    expect(trip?.departed_at).toBe(at("03:29"));
    expect(trip?.stops[0]).toMatchObject({ status: "delivered", completed_at: at("05:00"), receiver: "P. Silva" });
    expect(trip?.stops[0]?.has_photo).toBe(true);
    expect(trip?.stops[1]?.status).toBe("pending");
  });

  it("only ever moves a stop forward, and ignores what Relay refused", () => {
    const base = run([stop(1, "Kegalle", { status: "delivered", completed_at: at("05:11") })]);
    const late = record("arrived", "05:30", "s1");
    const refused = record("failed", "05:40", "s1");
    const items = localItems([queued(late)], [sent(refused, "rejected")], new Set());
    expect(overlay(base, items).trip?.stops[0]).toMatchObject({ status: "delivered", completed_at: at("05:11") });
  });

  it("keeps a delivery that clashed with the office's move, until the driver says no", () => {
    const moved = stop(4, "Aranayake", { status: "moved", moved_to: "VEH060", version: 2 });
    const delivered = record("delivered", "07:09", "s4", { receiver: "K. Herath" });
    const question = asked();
    const items = localItems([], [sent(delivered, "conflict")], new Set());
    expect(overlay(run([moved], [question]), items).trip?.stops[0]?.status).toBe("delivered");

    const no = record("conflict_answer", "07:15", "s4", { conflict_id: "q1", answer: "no" });
    const answered = localItems([queued(no)], [sent(delivered, "conflict")], new Set());
    expect(overlay(run([moved], [question]), answered).trip?.stops[0]?.status).toBe("moved");
  });

  it("shows a clashed stop as the driver's delivery from Relay's records when this phone holds none", () => {
    const moved = stop(4, "Aranayake", { status: "moved", moved_to: "VEH060", version: 2 });
    const shown = overlay(run([moved], [asked()]), []).trip?.stops[0];
    expect(shown).toMatchObject({ status: "delivered", completed_at: at("07:09"), arrived_at: at("06:56") });
    expect(shown).toMatchObject({ receiver: "K. Herath", has_photo: true });
    // a settled question leaves the stop as Relay has it
    const settled = overlay(run([moved], [asked({ status: "resolved", resolution: "driver" })]), []);
    expect(settled.trip?.stops[0]?.status).toBe("moved");
  });

  it("says when records saved with no signal reached Relay", () => {
    const delivered = record("delivered", "05:59", "s2");
    const items = localItems([], [sent(delivered, "applied", { saved_offline: true, at: at("07:14") })], new Set());
    const local = stopLocal(items, "s2");
    expect(local.waiting).toBe(false);
    expect(local.sentAt).toBe(at("07:14"));
  });
});

describe("the sync pill", () => {
  it("counts stops, not records: three stops while seven records wait", () => {
    const rows = [
      queued(record("delivered", "05:59", "s2")),
      queued(record("arrived", "06:21", "s3")),
      queued(record("delivered", "06:36", "s3")),
      {
        type: "photo",
        id: "p3",
        body: { id: "p3", stop_id: "s3", taken_at: at("06:36"), blob: new Blob(), width: 1, height: 1 },
        tries: 0,
        queued_at: 0,
      } as Queued,
      queued(record("arrived", "06:56", "s4")),
      queued(record("delivered", "07:09", "s4")),
      {
        type: "photo",
        id: "p4",
        body: { id: "p4", stop_id: "s4", taken_at: at("07:09"), blob: new Blob(), width: 1, height: 1 },
        tries: 0,
        queued_at: 0,
      } as Queued,
    ];
    const pill = pillView(localItems(rows, [], new Set()), true, null);
    expect(pill).toMatchObject({ state: "offline", stops: 3, photos: 2 });
  });

  it("reads Offline with nothing waiting, All synced with signal, and Sending while a record waits for its fix", () => {
    expect(pillView([], true, null)).toMatchObject({ state: "offline", stops: 0, photos: 0, updates: 0 });
    expect(pillView([], false, null)).toEqual({ state: "synced" });
    const fixing = localItems(
      [queued(record("arrived", "05:30", "s2"), { held_until: Date.now() + 10_000 })],
      [],
      new Set(),
    );
    expect(pillView(fixing, false, null)).toMatchObject({ state: "sending", stops: 1 });
  });

  it("counts a load acceptance as an update, not a stop", () => {
    const items = localItems([queued(record("load_accepted", "03:17", null))], [], new Set());
    expect(pillView(items, true, null)).toMatchObject({ state: "offline", stops: 0, updates: 1 });
  });
});

describe("the run's clock", () => {
  it("reads the receiving window the way the design does", () => {
    const s = stop(2, "Mawanella");
    expect(windowState(DAY, s.window_open, s.window_close, new Date(at("05:20")))).toMatchObject({
      state: "open",
      minutes: 145,
    });
    expect(windowState(DAY, "05:00", "07:30", new Date(at("04:40")))).toMatchObject({ state: "soon", minutes: 20 });
    expect(windowState(DAY, "05:00", "07:30", new Date(at("07:10")))).toMatchObject({ state: "closing", minutes: 20 });
    expect(windowState(DAY, "05:00", "07:30", new Date(at("07:45")))).toMatchObject({ state: "closed", minutes: 15 });
  });

  it("compares an arrival with the plan in whole minutes and rounds Expected to 5", () => {
    expect(minutesBetween(at("04:22"), at("04:41"))).toBe(19);
    expect(round5(new Date(`${DAY}T07:12:36+05:30`)).toISOString()).toBe(at("07:15"));
  });

  it("drives on past a stop left with a problem for the dispatcher", () => {
    const base = run([stop(1, "Kegalle"), stop(2, "Mawanella")]);
    const closed = record("problem", "05:20", "s1", { reason: "outlet_closed" });
    const items = localItems([queued(closed)], [], new Set());
    expect(nextStop(base.trip as NonNullable<DriverRun["trip"]>, items)?.stop_id).toBe("s2");
  });
});
