import { describe, expect, it } from "vitest";
import { kgValue, m3Value, tenths } from "@/lib/time";
import type { Board, Fit, PlanTrip, Waiting } from "./api";
import { sortFits } from "./TripPicker";
import { everyOrderPlaced, firstProposalText, fitTooltip, noRoom, planChip, planHelper, planSummary } from "./words";

const trip = (vehicle_id: string, trip_no: number, broken = 0): PlanTrip =>
  ({ vehicle_id, trip_no, broken, stops: [], rules: [] }) as unknown as PlanTrip;

const waiting = (confirmed: boolean): Waiting =>
  ({
    order_ref: "ORD0098596",
    deferral: { confirmed_at: confirmed ? "2026-04-07T16:52:00+05:30" : null, to_date: "2026-04-09" },
  }) as unknown as Waiting;

function board(over: { broken?: number; trips?: PlanTrip[]; waiting?: Waiting[]; plan?: Partial<Board["plan"]> }) {
  return {
    plan: {
      id: "p",
      depot: "Kandy",
      run_date: "2026-04-08",
      status: "draft",
      version: 1,
      proposed_at: "2026-04-07T16:35:00+05:30",
      published_at: null,
      edited_at: null,
      ready_at: null,
      fleet_changed_at: null,
      ...over.plan,
    },
    orders: 57,
    served: 56,
    trips: 18,
    lanes: [{ trips: over.trips ?? [] }],
    waiting: over.waiting ?? [],
    broken: over.broken ?? 0,
    can_undo: true,
  } as unknown as Board;
}

const fitOf = (over: Partial<Fit>): Fit => ({
  vehicle_id: "VEH057",
  trip_no: 2,
  fits: false,
  hint: "Over weight and volume",
  weight_kg: 1460.8,
  volume_m3: 7.676,
  weight_cap_kg: 1040,
  volume_cap_m3: 7,
  stop: 3,
  current: false,
  ...over,
});

describe("plan bar", () => {
  it("counts the waiting order, and names its day once it has a reason", () => {
    expect(planSummary(board({ waiting: [waiting(false)] }), "Kandy")).toBe(
      "Kandy hub: 57 orders, 56 on 18 trips, 1 waits.",
    );
    expect(planSummary(board({ waiting: [waiting(true)] }), "Kandy")).toBe(
      "Kandy hub: 57 orders, 56 on 18 trips, 1 waits for Thursday with a reason.",
    );
  });

  it("says where the broken rules are, and agrees in number", () => {
    expect(planSummary(board({ broken: 3, trips: [trip("VEH057", 2, 3)] }), "Kandy")).toBe(
      "3 rules broken on VEH057 trip 2. Publish stays off until they're fixed.",
    );
    expect(planSummary(board({ broken: 1, trips: [trip("VEH043", 1, 1)] }), "Kandy")).toBe(
      "1 rule broken on VEH043 trip 1. Publish stays off until it's fixed.",
    );
    expect(planHelper(board({ broken: 1, trips: [trip("VEH043", 1, 1)] }))).toBe("Fix 1 broken rule to publish.");
  });

  it("shows the most pressing state in the chip, with its time", () => {
    expect(planChip(board({})).text).toBe("Proposed 4:35 PM");
    expect(planChip(board({ plan: { ready_at: "2026-04-07T16:52:00+05:30" } }))).toEqual({
      kind: "ready",
      text: "Ready 4:52 PM",
    });
    // Undo back to the proposal clears edited_at, so the chip no longer says Edited
    expect(planChip(board({ plan: { edited_at: null } })).kind).toBe("proposed");
    expect(planChip(board({ broken: 1, trips: [trip("VEH043", 1, 1)] })).kind).toBe("ruleBroken");
    expect(planChip(board({ plan: { fleet_changed_at: "2026-04-07T16:40:00+05:30" } })).text).toBe(
      "Fleet changed 4:40 PM",
    );
    expect(planHelper(board({ plan: { fleet_changed_at: "2026-04-07T16:40:00+05:30" } }))).toBe(
      "Fleet changed. Propose again to re-plan.",
    );
  });

  it("puts the article before the hub and not before a place", () => {
    expect(firstProposalText("Kandy", 57)).toMatch(/^Relay plans the Kandy hub's 57 orders on its vehicles/);
    expect(firstProposalText("Peliyagoda", 79)).toMatch(/^Relay plans Peliyagoda's 79 orders on its vehicles/);
  });

  it("lists the vehicles in the workshop as a sentence does", () => {
    expect(noRoom(["VEH039", "VEH058"], 1)).toBe(
      "VEH039 and VEH058 are in the workshop, and no refrigerated trip left has room for it in time.",
    );
    expect(noRoom(["VEH039", "VEH043", "VEH058"], 3)).toBe(
      "VEH039, VEH043 and VEH058 are in the workshop, and no refrigerated trip left has room for them in time.",
    );
  });

  it("names the trip when every order is placed but one breaks", () => {
    expect(everyOrderPlaced(board({ broken: 3, trips: [trip("VEH057", 2, 3)] }))).toBe(
      "Every order is placed, but VEH057 trip 2 now breaks 3 rules. Undo the move and Relay's deferral comes back.",
    );
  });
});

describe("drag tooltip", () => {
  it("says what the trip would carry, as the design writes it", () => {
    expect(fitTooltip(fitOf({}))).toBe(
      "VEH057 trip 2 would carry 1,460.8 of 1,040 kg. You can drop it here, but the plan won't publish until it fits.",
    );
    expect(fitTooltip(fitOf({ weight_kg: 900.2, volume_m3: 7.676 }))).toBe(
      "VEH057 trip 2 would carry 7.676 of 7.0 m³. You can drop it here, but the plan won't publish until it fits.",
    );
    expect(fitTooltip(fitOf({ fits: true, weight_kg: 880, hint: "Fits" }))).toBe(
      "VEH057 trip 2 would carry 880.0 of 1,040 kg, and every rule passes.",
    );
    expect(
      fitTooltip(
        fitOf({ vehicle_id: "VEH040", trip_no: 1, weight_kg: 900, volume_m3: 5.1, hint: "Serves Badulla only" }),
      ),
    ).toBe("VEH040 trip 1: Serves Badulla only. You can drop it here, but the plan won't publish until it fits.");
  });

  it("lists the trips it fits first in the Trip picker, and the one it is on last", () => {
    const rows = sortFits([
      fitOf({ vehicle_id: "A", fits: false }),
      fitOf({ vehicle_id: "B", current: true }),
      fitOf({ vehicle_id: "C", fits: true }),
      fitOf({ vehicle_id: "D", fits: false }),
    ]);
    expect(rows.map((r) => r.vehicle_id)).toEqual(["C", "A", "D", "B"]);
  });
});

describe("numbers", () => {
  it("keeps the data's precision in meters and tables", () => {
    expect(kgValue(515)).toBe("515.0");
    expect(kgValue(1171)).toBe("1,171.0");
    expect(m3Value(4.2)).toBe("4.200");
    expect(tenths(7)).toBe("7.0");
  });
});
