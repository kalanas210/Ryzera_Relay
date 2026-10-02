import { describe, expect, it } from "vitest";
import type { Notice, StoreHome, StoreOrder, Tracker } from "./api";
import {
  around,
  cardState,
  clock,
  closesLine,
  daySummary,
  dayWhen,
  defaultTemp,
  eveningOf,
  flaggedLabel,
  issueSentAt,
  issuesSentence,
  noticeLine,
  openReminder,
  placedLine,
  sendIssues,
  shortRow,
  span,
  stopsBefore,
} from "./words";

const dry: StoreOrder = {
  id: "o1",
  order_ref: "ORD0098595",
  temp: "ambient",
  brand: "Fresh",
  requested_date: "2026-04-08",
  run_date: "2026-04-08",
  units: 102,
  weight_kg: 685.6,
  volume_m3: 3.772,
  status: "allocated",
  placed_at: "2026-04-07T14:14:00+05:30",
  locked: true,
  locks_at: "2026-04-07T16:00:00+05:30",
  lines: [{ case_type: "rice_dhal", name: "Rice and dhal case", qty: 36, carried_qty: 0, carried_from: null }],
  deferral: null,
};

const tracker = (over: Partial<Tracker>): Tracker => ({
  order_ref: "ORD0098595",
  kind: "dry",
  status: "on_the_way",
  vehicle_id: "VEH045",
  vehicle_kind: "Dry-box truck",
  driver: "Kasun Bandara",
  stop_seq: 3,
  stops_before: 1,
  expected: "2026-04-08T06:35:00+05:30",
  range: null,
  passed: false,
  out_of_contact: false,
  last_heard: "2026-04-08T05:20:00+05:30",
  position: "",
  window: "4:00 to 7:45 AM",
  can_confirm: false,
  planned: null,
  departed_at: null,
  arrived_at: null,
  issues_until: null,
  on_board: [],
  stops: [],
  proof: null,
  receipt: null,
  ...over,
});

describe("order card states", () => {
  it("follows the order from the plan to the receipt", () => {
    expect(cardState({ ...dry, run_date: "2026-04-09" }, undefined)).toBe("deferred");
    expect(cardState(dry, undefined)).toBe("received");
    expect(cardState(dry, tracker({ stop_seq: null, status: "scheduled" }))).toBe("received");
    expect(cardState(dry, tracker({ status: "scheduled" }))).toBe("scheduled");
    expect(cardState(dry, tracker({}))).toBe("on_the_way");
    expect(cardState(dry, tracker({ passed: true, out_of_contact: true }))).toBe("passed");
    expect(cardState(dry, tracker({ status: "confirmed" }))).toBe("confirmed");
  });

  it("reads a moved order as moved on its first day and as a delivery on the day it now runs", () => {
    const moved = { ...dry, run_date: "2026-04-09" };
    expect(cardState(moved, undefined, "2026-04-08")).toBe("deferred");
    expect(cardState(moved, tracker({ status: "scheduled" }), "2026-04-09")).toBe("scheduled");
    expect(cardState(moved, undefined, "2026-04-09")).toBe("received");
  });

  it("sums up the day the way the design does", () => {
    expect(daySummary(["scheduled", "deferred"], "Thursday")).toBe("1 order coming, 1 moved to Thursday");
    expect(daySummary(["on_the_way", "deferred"], "Thursday")).toBe("1 on the way, 1 moved to Thursday");
    expect(daySummary(["passed", "deferred"], "Thursday")).toBe("1 on the way, 1 moved to Thursday");
    expect(daySummary(["confirmed", "deferred"], "Thursday")).toBe("1 arrived, 1 moved to Thursday");
    expect(daySummary(["received", "received"], null)).toBe("Both orders received");
    expect(daySummary([], null)).toBe("No orders yet");
  });
});

describe("store times", () => {
  it("keep the AM with the time and round expected times to 5 minutes", () => {
    expect(clock("2026-04-08T06:36:00+05:30")).toBe("6:36\u00a0AM");
    expect(around("2026-04-08T06:33:00+05:30")).toBe("6:35\u00a0AM");
  });

  it("write a range with the AM or PM once", () => {
    expect(span("2026-04-08T06:05:00+05:30", "2026-04-08T07:05:00+05:30", "and")).toBe("6:05 and 7:05\u00a0AM");
    expect(span("2026-04-08T11:40:00+05:30", "2026-04-08T12:20:00+05:30")).toBe("11:40\u00a0AM to 12:20\u00a0PM");
  });

  it("say Locked only on the day the order was placed, and never for one that came in after its cutoff", () => {
    expect(placedLine(dry, new Date("2026-04-07T19:30:00+05:30"))).toBe("Placed 2:14\u00a0PM. Locked at 4:00\u00a0PM.");
    expect(placedLine(dry, new Date("2026-04-08T05:20:00+05:30"))).toBe("Placed Tuesday 2:14\u00a0PM");
    const late = { ...dry, placed_at: "2026-04-07T16:05:00+05:30", run_date: "2026-04-09" };
    expect(placedLine(late, new Date("2026-04-07T19:30:00+05:30"))).toBe("Placed 4:05\u00a0PM");
  });

  it("say when a cutoff falls from now, with the PM kept on its line", () => {
    const tuesdayEvening = new Date("2026-04-07T19:30:00+05:30");
    const wednesdayFour = "2026-04-08T16:00:00+05:30";
    expect(dayWhen(wednesdayFour, tuesdayEvening)).toBe("tomorrow");
    expect(dayWhen(wednesdayFour, new Date("2026-04-08T05:20:00+05:30"))).toBe("today");
    expect(dayWhen("2026-04-10T16:00:00+05:30", tuesdayEvening)).toBe("on Friday");
    expect(closesLine("2026-04-09", wednesdayFour, tuesdayEvening)).toBe(
      "Orders for Thursday close tomorrow at 4:00\u00a0PM.",
    );
    expect(closesLine("2026-04-08", "2026-04-07T16:00:00+05:30", new Date("2026-04-07T14:10:00+05:30"))).toBe(
      "Orders for Wednesday close at 4:00\u00a0PM.",
    );
    expect(eveningOf(wednesdayFour, tuesdayEvening)).toBe("tomorrow evening");
    expect(eveningOf("2026-04-07T16:00:00+05:30", new Date("2026-04-07T14:10:00+05:30"))).toBe("this evening");
  });
});

describe("a new order", () => {
  it("starts on a type the store has not sent yet that day, chilled before dry", () => {
    expect(defaultTemp(["chilled", "ambient"], [])).toBe("chilled");
    expect(defaultTemp(["chilled", "ambient"], [{ temp: "chilled" }])).toBe("ambient");
    expect(defaultTemp(["chilled", "ambient"], [{ temp: "ambient" }])).toBe("chilled");
    expect(defaultTemp(["chilled", "ambient"], [{ temp: "ambient" }, { temp: "chilled" }])).toBe("chilled");
    expect(defaultTemp(["ambient"], [{ temp: "ambient" }])).toBe("ambient"); // a store with dry goods only
  });
});

describe("store words", () => {
  it("tell a short delivery before and after it arrives", () => {
    expect(shortRow("Rice and dhal case", 6, "Thursday", false)).toBe(
      "6 rice and dhal cases short. They come\u00a0Thursday.",
    );
    expect(shortRow("Rice and dhal case", 6, "Thursday", true)).toBe("6 rice and dhal cases follow on\u00a0Thursday.");
    expect(shortRow("Meat and fish box", 1, null, false)).toBe("1 meat and fish box short. It won't be\u00a0replaced.");
  });

  it("count stops and issues with their nouns", () => {
    expect(stopsBefore(1)).toBe("1 stop before you");
    expect(stopsBefore(2)).toBe("2 stops before you");
    expect(stopsBefore(0)).toBe("Your store is the next stop");
    expect(flaggedLabel("not_cold", 2)).toBe("Flagged: 2 not cold");
    expect(sendIssues(1)).toBe("Send 1 issue");
    expect(sendIssues(2)).toBe("Send 2 issues");
    const names = { packet_foods: "Packet foods case", dairy: "Dairy crate" };
    expect(
      issuesSentence(
        [
          { case_type: "packet_foods", kind: "damaged", qty: 1 },
          { case_type: "dairy", kind: "not_cold", qty: 2 },
        ],
        names,
      ),
    ).toBe("1 damaged packet foods case and 2 dairy crates not cold");
  });

  it("time an issue sent after confirming by when it was sent, not by the receipt", () => {
    expect(issueSentAt({ confirmed_at: "2026-04-08T06:41:00+05:30", reported_at: "2026-04-08T07:22:00+05:30" })).toBe(
      "2026-04-08T07:22:00+05:30",
    );
    expect(issueSentAt({ confirmed_at: "2026-04-08T06:41:00+05:30", reported_at: null })).toBe(
      "2026-04-08T06:41:00+05:30",
    );
  });

  it("list each update the way the lock screen says it", () => {
    const home = {
      outlet: { window_open: "04:00", window_close: "07:45" },
      orders: [{ ...dry, order_ref: "ORD0098596", temp: "chilled", run_date: "2026-04-09" }],
    } as unknown as StoreHome;
    const notice = (over: Partial<Notice>): Notice => ({
      id: "n",
      kind: "order_received",
      title: "",
      body: "",
      data: {},
      created_at: "2026-04-07T18:40:00+05:30",
      read_at: null,
      acknowledged_at: null,
      ...over,
    });
    expect(noticeLine(notice({ kind: "order_deferred", data: { order_ref: "ORD0098596" } }), home)).toBe(
      "Your chilled order ORD0098596 moves to Thursday 9 April, 4:00\u00a0to\u00a07:45\u00a0AM.",
    );
    expect(noticeLine(notice({ kind: "short_delivery", data: { added_day: "2026-04-09" } }), home)).toBe(
      "They come Thursday.",
    );
    expect(noticeLine(notice({ body: "Your dry order ORD0098595 is expected around 5:20 AM.\n\nMore." }), home)).toBe(
      "Your dry order ORD0098595 is expected around 5:20 AM.",
    );
  });

  it("keep the dispatcher's reminder in front only while it can still be acted on", () => {
    const reminder: Notice = {
      id: "r",
      kind: "cutoff_reminder",
      title: "Your Wednesday order isn't in yet",
      body: "",
      data: { run_date: "2026-04-08", cutoff: "2026-04-07T16:00:00+05:30" },
      created_at: "2026-04-07T15:12:00+05:30",
      read_at: null,
      acknowledged_at: null,
    };
    const home = {
      ordering_for: "2026-04-08",
      cutoff: "2026-04-07T16:00:00+05:30",
      orders: [],
    } as unknown as StoreHome;
    const at = (hhmm: string) => new Date(`2026-04-07T${hhmm}:00+05:30`);
    expect(openReminder([reminder], home, at("15:20"))?.id).toBe("r");
    // read, past the cutoff, or answered with an order: it steps back into Updates
    expect(openReminder([{ ...reminder, read_at: "2026-04-07T15:21:00+05:30" }], home, at("15:30"))).toBeUndefined();
    expect(openReminder([reminder], home, at("16:00"))).toBeUndefined();
    const sent = { ...home, orders: [{ ...dry, requested_date: "2026-04-08" }] } as StoreHome;
    expect(openReminder([reminder], sent, at("15:30"))).toBeUndefined();
  });
});
