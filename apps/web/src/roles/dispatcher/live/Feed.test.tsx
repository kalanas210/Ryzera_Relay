import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import type { Feed, FeedItem, RunMarker, RunRow, ShortfallDetail } from "./api";
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
    denied: false,
    store_contact: null,
    handed_over: false,
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
  expected_back: null,
  last_contact_at: at("05:41"),
  out_of_contact: true,
  silent_minutes: 24,
  position: "Probably still unloading at Mawanella.",
  caption: "",
  risk: "",
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
      store_contact: "Dilani Jayawardena",
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
    reviewed_at: null,
    reviewed_by: null,
    shortfall: null,
    ...over,
  };
}

let client: QueryClient;

function show(items: FeedItem[], rows: RunRow[] = [kasun], earlier: FeedItem[] = []) {
  const feed: Feed = { depot: "Kandy", depot_label: "Kandy hub", run_date: "2026-04-08", now: items, earlier };
  return render(
    <QueryClientProvider client={client}>
      <FeedEnvProvider
        value={{
          depot: "Kandy",
          depotLabel: "Kandy hub",
          desk: true,
          rows,
          items: [...items, ...earlier],
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
      screen.getByText("Dilani sees: Arriving around 6:35 AM. Last heard from Kasun 5:41 AM."),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Move stop/ }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Move stop 3, Hemmathagama",
      "Move stop 4, Aranayake",
    ]);
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

    const ref = { conflict_id: "c-1", trip_id: "trip-045", stop_id: "stop-4" };
    const second = show([twoCopies(ref)], [conflicted, backup]);
    fireEvent.click(screen.getByRole("button", { name: "Cancel VEH060's copy" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/dispatch/live/conflicts/c-1/settle",
        { keep: "driver" },
        { role: "dispatcher" },
      ),
    );
    second.unmount();

    // once Kasun says it was not delivered, keeping the backup's copy comes first
    const denied = {
      ...kasun,
      markers: kasun.markers.map((m) => (m.seq === 4 ? { ...m, state: "conflict" as const, denied: true } : m)),
    };
    show([twoCopies(ref)], [denied, backup]);
    const [first] = screen.getAllByRole("button", { name: /VEH060's copy$/ });
    expect(first).toHaveTextContent("Keep VEH060's copy");
    fireEvent.click(first!);
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/dispatch/live/conflicts/c-1/settle",
        { keep: "backup" },
        { role: "dispatcher" },
      ),
    );
  });
});

describe("the record of what was decided", () => {
  it("names the store's manager, or the store when Relay has nobody there", () => {
    const silence = item({ title: "No contact from Kasun since 5:41 AM", ref: { trip_id: "trip-045" } });
    const nobody = { ...kasun, markers: kasun.markers.map((m) => ({ ...m, store_contact: null })) };
    show([silence], [nobody]);
    expect(screen.getByText(/^Hemmathagama sees: Arriving around 6:35 AM/)).toBeInTheDocument();
  });

  it("keeps a settled two-copy stop under Now until it is marked reviewed", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue(undefined);
    const settled = item({
      id: "conflict-1",
      kind: "conflict",
      title: "Stop 4 conflict resolved",
      created_at: at("07:14"),
      handled_at: at("07:15"),
      outcome: "The driver answered yes: delivered. The backup's copy is cancelled.",
      ref: {
        conflict_id: "c-1",
        trip_id: "trip-045",
        stop_id: "stop-4",
        photo_id: "photo-1",
        delivered_at: at("07:09"),
      },
    });
    const { unmount } = show([], [kasun], [settled]);
    expect(screen.getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["Now"]);
    expect(screen.getByRole("img", { name: "Kasun's photo, 7:09 AM" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Mark reviewed" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/dispatch/live/feed/conflict-1/review", {}, { role: "dispatcher" }),
    );
    unmount();

    show([], [kasun], [{ ...settled, reviewed_at: at("07:20"), reviewed_by: "Nuwan Perera" }]);
    expect(screen.getByText("Earlier today")).toBeInTheDocument();
    expect(screen.getByText(/marked it reviewed at 7:20 AM/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Stop 4 conflict resolved/ }));
    expect(screen.getByText("Reviewed 7:20 AM")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mark reviewed" })).toBeNull();
  });

  it("shows the dock's photo of damaged cases in a decided shortfall", () => {
    const shortfall: ShortfallDetail = {
      id: "s-1",
      kind: "damaged",
      qty: 2,
      planned: 30,
      case_type: "RD",
      case_name: "Rice and dhal",
      temp_label: "Dry",
      vehicle_id: "VEH045",
      trip_no: 1,
      stop_seq: 3,
      order_ref: "ORD0098595",
      outlet_id: "OUT117",
      place: "Hemmathagama",
      flagged_at: at("02:47"),
      flagged_by: "Mohamed Rizwan",
      run_date: "2026-04-08",
      departs: at("03:40"),
      trip_stops: 4,
      driver: "Kasun Bandara",
      stop_cases: 102,
      next_order_ref: "ORD0098747",
      next_day: "2026-04-09",
      window: "4:00 to 7:45 AM",
      store_contact: "Dilani Jayawardena",
      decision: "send_short",
      decided_at: at("02:52"),
      decided_by: "Nuwan Perera",
      added_to_order_ref: "ORD0098747",
      store_seen_at: null,
      completed_at: null,
      loaded_cases: 0,
      planned_cases: 0,
      accepted_at: null,
      accepted_by: null,
      hub_spare: null,
      next_delivery_at: null,
      photo_id: "photo-2",
    };
    show(
      [],
      [kasun],
      [
        item({
          kind: "shortfall",
          title: "Shortfall on VEH045, stop 3",
          created_at: at("02:47"),
          handled_at: at("02:52"),
          outcome: "Send short, add to Thursday.",
          shortfall,
        }),
      ],
    );
    // the only item in the feed opens on the desk
    expect(screen.getByRole("img", { name: "The damaged rice and dhal cases, from the dock" })).toBeInTheDocument();
  });
});
