import { describe, expect, it } from "vitest";
import { type LoadLine, recount, type TripLoad } from "./api";

function line(id: string, qty: number, loaded: number, status: LoadLine["status"]): LoadLine {
  return { id, case_type: "rice_dhal", qty, loaded, status, shortfall: null };
}

function load(lines: LoadLine[]): TripLoad {
  return {
    trip_id: "t",
    vehicle_id: "VEH045",
    vehicle_kind: "Dry-box truck",
    trip_no: 1,
    temp: "ambient",
    brand: "Fresh",
    district: "Kegalle",
    driver: "Kasun Bandara",
    loader: null,
    planned_depart: "2026-04-07T21:59:00Z",
    departed_at: null,
    state: "loading",
    plan_changed_at: null,
    cases: lines.reduce((n, l) => n + l.qty, 0),
    loaded: 0,
    short: 0,
    lines_total: lines.length,
    lines_done: 0,
    flags_waiting: 0,
    groups: [
      {
        stop_id: "s",
        seq: 3,
        outlet_id: "OUT117",
        place: "Hemmathagama",
        order_ref: "ORD0098595",
        cases: 0,
        loaded: 0,
        short: 0,
        moved_from: null,
        moved_at: null,
        state: "loading",
        lines,
      },
    ],
    handover: {
      completed_at: null,
      completed_by: null,
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
    dispatcher: "Nuwan Perera",
  };
}

describe("recount after an optimistic tap", () => {
  it("counts cases on, the short left by decided flags, and lines done", () => {
    const next = recount(
      load([line("a", 36, 30, "decided"), line("b", 44, 44, "checked"), line("c", 22, 0, "flag_waiting")]),
    );
    expect(next.loaded).toBe(74);
    expect(next.short).toBe(6);
    expect(next.lines_done).toBe(2);
    expect(next.flags_waiting).toBe(1);
    expect(next.groups[0]?.loaded).toBe(74);
    expect(next.groups[0]?.short).toBe(6);
  });
});
