import { describe, expect, it } from "vitest";
import type { StoreOrder, Tracker } from "./api";
import {
  around,
  cardState,
  clock,
  daySummary,
  flaggedLabel,
  issuesSentence,
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

  it("say Locked only on the day the order was placed", () => {
    expect(placedLine(dry, new Date("2026-04-07T19:30:00+05:30"))).toBe("Placed 2:14\u00a0PM. Locked at 4:00 PM.");
    expect(placedLine(dry, new Date("2026-04-08T05:20:00+05:30"))).toBe("Placed Tuesday 2:14\u00a0PM");
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
});
