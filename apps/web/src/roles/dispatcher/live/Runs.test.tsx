import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { RunMarker, RunRow, RunsPanel } from "./api";
import { Directory, feedLinks, vehicleRuns } from "./model";
import { RunsPanelView } from "./Runs";

const at = (clock: string) => `2026-04-08T${clock}:00+05:30`;

function marker(seq: number, place: string, over: Partial<RunMarker> = {}): RunMarker {
  return {
    stop_id: `stop-${seq}`,
    seq,
    outlet_id: `OUT${115 + seq}`,
    place,
    state: "delivered",
    planned: at("05:00"),
    closes: at("07:30"),
    recorded: null,
    estimate: null,
    range: null,
    passed: false,
    late_risk: false,
    receipt_at: null,
    moved_to: null,
    backup_of: null,
    held: null,
    denied: false,
    store_contact: null,
    handed_over: false,
    ...over,
  };
}

/** Kasun at 7:22: Finish trip tapped at Aranayake's dock at 7:17. */
const kasun: RunRow = {
  trip_id: "trip-045",
  vehicle_id: "VEH045",
  trip_no: 1,
  is_backup: false,
  vehicle_kind: "Dry-box truck",
  driver: "Kasun Bandara",
  district: "Kegalle",
  temp: "ambient",
  brand: "Fresh",
  status: "finished",
  planned_depart: at("03:29"),
  departed_at: at("03:33"),
  finished_at: at("07:17"),
  expected_back: at("09:08"),
  last_contact_at: at("07:17"),
  out_of_contact: false,
  silent_minutes: 0,
  position: "",
  caption: "Trip finished at 7:17 AM. Expected back at the Kandy hub around 9:10 AM.",
  risk: "",
  delivered: 4,
  stops: 4,
  attention: 0,
  markers: [
    marker(1, "Kegalle", { recorded: at("05:11") }),
    marker(2, "Mawanella", { recorded: at("05:59") }),
    marker(3, "Hemmathagama", { recorded: at("06:36") }),
    marker(4, "Aranayake", { recorded: at("07:09") }),
  ],
};

function show(rows: RunRow[], toast: string | null = null, onSelect = vi.fn()) {
  const panel: RunsPanel = {
    depot: "Kandy",
    depot_label: "Kandy hub",
    run_date: "2026-04-08",
    published: true,
    now: at("07:22"),
    running: 0,
    delivered: 4,
    stops: 4,
    out_of_contact: 0,
    standby_free: 0,
    standby: [],
    rows,
  };
  render(
    <RunsPanelView
      panel={panel}
      vehicles={vehicleRuns(rows)}
      links={feedLinks([], rows)}
      items={[]}
      dir={new Directory(undefined)}
      selected="VEH045"
      onSelect={onSelect}
      query=""
      onMove={() => {}}
      toast={toast}
    />,
  );
  return onSelect;
}

afterEach(cleanup);

describe("the runs panel", () => {
  it("draws the way home as Relay's estimate, never as an arrival at the hub", () => {
    show([kasun]);
    expect(screen.getByText("Hub next")).toBeInTheDocument();
    expect(screen.getByText("around 9:10")).toBeInTheDocument();
    expect(screen.queryByText(/Back at the hub/)).toBeNull();
    expect(screen.getByText(kasun.caption)).toBeInTheDocument();
  });

  it("shows the driver's no above the two-copy chip", () => {
    const answered = {
      ...kasun,
      status: "on_the_road",
      finished_at: null,
      markers: kasun.markers.map((m) =>
        m.seq === 4 ? { ...m, state: "conflict" as const, held: at("07:09"), denied: true } : m,
      ),
    };
    show([answered]);
    expect(screen.getByText("Kasun says not delivered")).toBeInTheDocument();
    expect(screen.getByText("Two copies")).toBeInTheDocument();
    expect(screen.queryByText("Delivered 7:09")).toBeNull();
  });

  it("picks a run with its own button, outside the stop list", () => {
    const onSelect = show([kasun]);
    const pick = screen.getByRole("button", { name: "VEH045, Kasun Bandara" });
    expect(pick).toHaveAttribute("aria-pressed", "true");
    // the list of stops and its markers are never inside a button
    expect(screen.getByRole("list", { name: "VEH045 stops" }).closest("button")).toBeNull();
    fireEvent.click(pick);
    expect(onSelect).toHaveBeenCalledWith("VEH045");
  });

  it("keeps each run in a group named by its select button, the stop list with it", () => {
    show([kasun]);
    const run = screen.getByRole("group", { name: "VEH045, Kasun Bandara" });
    expect(within(run).getByRole("button", { name: "VEH045, Kasun Bandara" })).toBeInTheDocument();
    expect(within(run).getByRole("list", { name: "VEH045 stops" })).toBeInTheDocument();
  });

  it("puts the toast at the foot of the panel, in the footnote's place", () => {
    show([kasun], "Stop 4 moved to VEH060. Nimal, the Kandy hub dock and the store have been told.");
    expect(screen.getByRole("status")).toHaveTextContent("Stop 4 moved to VEH060.");
    expect(screen.queryByText(/Progress comes from each driver's stop records/)).toBeNull();
    cleanup();
    show([kasun]);
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.getByText(/Progress comes from each driver's stop records/)).toBeInTheDocument();
  });
});
