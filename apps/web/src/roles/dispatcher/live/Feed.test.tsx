import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import type { Feed, FeedItem, RunMarker, RunRow } from "./api";
import { FeedEnvProvider, FeedGroups } from "./Feed";
import { Directory } from "./model";

const at = (clock: string) => `2026-04-08T${clock}:00+05:30`;

function marker(seq: number, place: string, over: Partial<RunMarker> = {}): RunMarker {
  return {
    stop_id: `stop-${seq}`,
    seq,
    outlet_id: `OUT${115 + seq}`,
    place,
    state: "pending",
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
    ...over,
  };
}

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
  status: "on_the_road",
  planned_depart: at("03:29"),
  departed_at: at("03:33"),
  finished_at: null,
  last_contact_at: at("05:41"),
  out_of_contact: true,
  silent_minutes: 24,
  position: "Probably still unloading at Mawanella.",
  caption: "",
  delivered: 1,
  stops: 4,
  attention: 2,
  markers: [
    marker(1, "Kegalle", { state: "delivered", recorded: at("05:11") }),
    marker(2, "Mawanella", { state: "arrived", recorded: at("05:30") }),
    marker(3, "Hemmathagama", {
      state: "next",
      estimate: at("06:35"),
      range: [at("06:05"), at("07:05")],
      closes: at("07:45"),
    }),
    marker(4, "Aranayake", { estimate: at("07:15"), range: [at("06:45"), at("07:45")] }),
  ],
};

function item(over: Partial<FeedItem>): FeedItem {
  return {
    id: "item",
    kind: "silence",
    depot: "Kandy",
    title: "",
    body: "",
    created_at: at("05:46"),
    handled_at: null,
    handled_by: null,
    outcome: "",
    shortfall: null,
    ...over,
  };
}

let client: QueryClient;

function show(items: FeedItem[], rows: RunRow[] = [kasun]) {
  const feed: Feed = { depot: "Kandy", depot_label: "Kandy hub", run_date: "2026-04-08", now: items, earlier: [] };
  return render(
    <QueryClientProvider client={client}>
      <FeedEnvProvider
        value={{
          depot: "Kandy",
          depotLabel: "Kandy hub",
          desk: true,
          rows,
          items,
          dir: new Directory(undefined),
          allInContact: false,
          onMove: () => {},
        }}
      >
        <FeedGroups feed={feed} />
      </FeedEnvProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  // who is signed in and the scenario clock never answer here
  vi.spyOn(api, "get").mockImplementation(() => new Promise(() => {}));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("a silent run in the feed", () => {
  it("says what is known and never why, with Relay's estimate and range for each stop to come", () => {
    show([item({ title: "No contact from Kasun since 5:41 AM", ref: { trip_id: "trip-045" } })]);
    expect(screen.getByText("No contact from Kasun since 5:41 AM")).toBeInTheDocument();
    expect(screen.getByText("24 min")).toBeInTheDocument();
    expect(screen.getByText("Probably still unloading at Mawanella.")).toBeInTheDocument();
    expect(screen.getByText("likely 6:05 to 7:05")).toBeInTheDocument();
    expect(screen.getByText("Aranayake's likely range already runs past its 7:30 AM close.")).toBeInTheDocument();
    expect(
      screen.getByText("Hemmathagama sees: Arriving around 6:35 AM. Last heard from Kasun 5:41 AM."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Move" })).toHaveLength(2);
    expect(screen.queryByRole("button", { name: /call/i })).toBeNull();
  });
});

describe("decisions the feed asks for", () => {
  const backup: RunRow = {
    ...kasun,
    trip_id: "trip-060",
    vehicle_id: "VEH060",
    driver: "Nimal Fernando",
    is_backup: true,
    out_of_contact: false,
    departed_at: at("06:36"),
    markers: [marker(1, "Aranayake", { backup_of: "stop-4", estimate: at("08:05"), late_risk: true })],
  };
  const receipted: RunRow = {
    ...kasun,
    markers: kasun.markers.map((m) =>
      m.seq === 3
        ? { ...m, state: "delivered", receipt_at: at("06:42"), estimate: null }
        : m.seq === 4
          ? { ...m, state: "moved", moved_to: "VEH060", estimate: at("07:05"), range: [at("06:45"), at("07:55")] }
          : m,
    ),
  };

  it("keeps the backup with the dispatcher's note", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(undefined);
    show(
      [item({ id: "receipt-1", kind: "receipt", title: "Hemmathagama confirmed receipt", created_at: at("06:42") })],
      [receipted, backup],
    );
    expect(screen.getByText("VEH060 is on its way, around 8:05 AM.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Note for the record"), { target: { value: "Still no contact." } });
    fireEvent.click(screen.getByRole("button", { name: "Keep backup" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/dispatch/live/feed/receipt-1/backup",
        { action: "keep", note: "Still no contact." },
        { role: "dispatcher" },
      ),
    );
  });

  it("settles two copies from the office only with the question's reference", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(undefined);
    const twoCopies = (ref?: Record<string, string>) =>
      item({
        id: "conflict-1",
        kind: "conflict",
        title: "Stop 4 has two copies",
        body: "Kasun Bandara's phone recorded Aranayake while VEH060 still has it. Relay has asked the driver.",
        created_at: at("07:14"),
        ref,
      });
    const conflicted = {
      ...kasun,
      markers: kasun.markers.map((m) => (m.seq === 4 ? { ...m, state: "conflict" as const } : m)),
    };
    const { unmount } = show([twoCopies()], [conflicted, backup]);
    expect(screen.getByRole("button", { name: "Cancel VEH060's copy" })).toBeDisabled();
    unmount();

    show([twoCopies({ conflict_id: "c-1", trip_id: "trip-045", stop_id: "stop-4" })], [conflicted, backup]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel VEH060's copy" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/dispatch/live/conflicts/c-1/settle", {}, { role: "dispatcher" }),
    );
  });
});
