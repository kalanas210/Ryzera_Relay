import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import type { Board, Drawer, DrawerGroup, DrawerWaiting } from "./api";
import { DeferralsDrawer } from "./Deferrals";

// jsdom has <dialog> but not its methods; these do what the browser does to the open attribute.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const at = (day: string, clock: string) => `2026-04-${day}T${clock}:00+05:30`;

function waiting(outlet_id: string, short_name: string, more: Record<string, unknown> = {}): DrawerWaiting {
  return {
    order_ref: `ORD-${outlet_id}`,
    outlet_id,
    short_name,
    name: `Waypoint Fresh ${short_name}`,
    temp: "chilled",
    brand: "Fresh",
    units: 40,
    weight_kg: 249.9,
    volume_m3: 1.384,
    window_open: "03:00",
    window_close: "08:00",
    kind: "capacity",
    rule: 3,
    unavoidable: false,
    last_delivered: "2026-04-06",
    sibling: null,
    moves_to: "2026-04-09",
    reasons: [{ code: "reefer_short", label: "Refrigerated capacity short", suggested: true }],
    reason_code: null,
    reason: "",
    note: "",
    confirmed_at: null,
    next_run: null,
    costs: [`249.9 kg of chilled goods waits a day at ${short_name}.`],
    store_notice: "",
    lines: [{ name: "Produce crate", qty: 16 }],
    placed_at: at("07", "09:21"),
    ...more,
  } as DrawerWaiting;
}

const group = {
  temp_class: "chilled",
  orders: 23,
  max_served: 21,
  unavoidable: 2,
  running: 4,
  limiting: ["VEH039", "VEH043", "VEH058"],
  total_kg: 8144.5,
  total_m3: 43.63,
  planned: 21,
  planned_kg: 7734.8,
  planned_m3: 41.383,
  waits: 2,
  waits_kg: 409.7,
  waits_m3: 2.247,
  by_override: 0,
  pool: {
    count: 15,
    by_district: { Badulla: ["OUT110", "OUT111"] },
    keeping: ["OUT110", "OUT111"],
    summary: "Rule 3 picks OUT110 and OUT111.",
  },
  rules: [
    {
      n: 1,
      title: "Keep every other vehicle on its usual run.",
      reason: "VEH039, VEH043 and VEH058 are in the workshop.",
      lines: [],
    },
    {
      n: 3,
      title: "Keep the most goods moving.",
      reason: "For each order that waits, the trip that would carry it and what it weighs:",
      lines: ["OUT110 Badulla Town, 249.9 kg: one line", "OUT111 Hali-Ela, 159.8 kg: another line"],
    },
  ],
  paper: null,
  picked_by_rule: 3,
  result: "So Badulla Town's and Hali-Ela's orders wait.",
} satisfies DrawerGroup;

function drawer(rows: DrawerWaiting[], protectedCards: Drawer["protected"] = []): Drawer {
  return {
    depot: "Kandy",
    depot_label: "Kandy hub",
    run_date: "2026-04-08",
    proposed_at: at("07", "16:35"),
    status: "draft",
    groups: [group],
    waiting: rows,
    protected: protectedCards,
  };
}

function board(status: "draft" | "published"): Board {
  return { plan: { id: "plan-1", depot: "Kandy", run_date: "2026-04-08", status } } as unknown as Board;
}

function open(data: Drawer, status: "draft" | "published" = "draft", preview?: string) {
  vi.spyOn(api, "get").mockImplementation((path: string) =>
    Promise.resolve(
      (path.includes("/override/preview")
        ? { order_ref: "ORD0098599", consequence: preview, lines: [] }
        : data) as never,
    ),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeferralsDrawer open onClose={() => {}} board={board(status)} depot="Kandy" onReady={() => {}} />
    </QueryClientProvider>,
  );
}

describe("the deferrals drawer", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("puts several waiting orders under one header and names the store on each card", async () => {
    open(drawer([waiting("OUT110", "Badulla Town"), waiting("OUT111", "Hali-Ela")]));
    expect(await screen.findByRole("heading", { name: "Orders to defer" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Order to defer" })).toBeNull();
    const costs = screen.getAllByRole("heading", { name: "What the choice costs" });
    expect(costs.map((h) => h.nextElementSibling?.textContent)).toEqual(["OUT110 Badulla Town", "OUT111 Hali-Ela"]);
    expect(screen.getByText("OUT110 Badulla Town, 249.9 kg: one line")).toBeInTheDocument();
    expect(screen.getByText("2 deferrals need a reason")).toBeInTheDocument();
  });

  it("shows the plan that only works on paper, and where the clock breaks it", async () => {
    const paper = {
      orders: 23,
      rows: [{ vehicle_id: "VEH042", takes: "Matale, then all three Kegalle stores", minutes: "129 + 124 = 253" }],
      fails: ["VEH042 is back from Matale at 6:16 AM and would reach Aranayake at 8:14 AM, after its 7:30 AM close."],
    };
    open({ ...drawer([waiting("OUT117", "Hemmathagama")]), groups: [{ ...group, paper } as DrawerGroup] });
    expect(await screen.findByRole("heading", { name: "On paper, all 23 fit" })).toBeInTheDocument();
    expect(
      screen.getByRole("row", { name: "VEH042 Matale, then all three Kegalle stores 129 + 124 = 253" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/would reach Aranayake at 8:14 AM/)).toHaveTextContent(/^On the clock it fails\./);
  });

  it("after publishing, shows when each store saw its notice", async () => {
    open(
      drawer([
        waiting("OUT110", "Badulla Town", {
          confirmed_at: at("07", "16:52"),
          reason: "Refrigerated capacity short",
          notified_at: at("07", "18:40"),
          acknowledged_at: at("07", "18:41"),
        }),
        waiting("OUT111", "Hali-Ela", {
          confirmed_at: at("07", "16:52"),
          reason: "Refrigerated capacity short",
          notified_at: at("07", "18:40"),
          acknowledged_at: null,
        }),
      ]),
      "published",
    );
    expect(await screen.findByText("Seen 6:41 PM")).toBeInTheDocument();
    expect(screen.getByText(/Not seen yet/, { selector: "span" })).toBeInTheDocument();
  });

  it("asks for the override's note with a label, focuses it, and says what the override changes", async () => {
    const card = {
      order_ref: "ORD0098599",
      outlet_id: "OUT119",
      short_name: "Kegalle",
      temp: "chilled",
      units: 65,
      weight_kg: 466.4,
      volume_m3: 2.438,
      waited_on: "Monday",
      vehicle_id: "VEH057",
      trip_no: 2,
      planned: "7:33 AM",
      expected: "8:32 AM",
      late_by: 32,
      closes: "8:00 AM",
    };
    const consequence =
      "If you defer it, Hemmathagama's order rides VEH057 with Aranayake instead: 994.4 kg on the van.";
    open(drawer([waiting("OUT117", "Hemmathagama")], [card]), "draft", consequence);
    fireEvent.click(await screen.findByRole("button", { name: "Defer anyway" }));
    const note = screen.getByLabelText("Why is this needed? (required)");
    expect(note).toHaveFocus();
    expect(note).toHaveAttribute("placeholder", "Write a note for the record");
    expect(await screen.findByText(consequence)).toBeInTheDocument();
  });
});
