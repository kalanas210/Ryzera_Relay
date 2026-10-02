import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import type { StoreHome, Tracker } from "./api";
import { MyOrders } from "./MyOrders";

const home: StoreHome = {
  outlet: {
    outlet_id: "OUT117",
    name: "Waypoint Fresh Hemmathagama",
    short_name: "Hemmathagama",
    brand: "Fresh",
    district: "Kegalle",
    depot: "Kandy",
    dock_type: "rear_dock",
    parking_constraint: "normal",
    window_open: "04:00",
    window_close: "07:45",
  },
  now: "2026-04-08T05:20:00+05:30",
  ordering_for: "2026-04-09",
  cutoff: "2026-04-08T16:00:00+05:30",
  closed_for: null,
  closed_at: null,
  next_run: "2026-04-08",
  orders: [
    {
      id: "o1",
      order_ref: "ORD0098595",
      temp: "ambient",
      brand: "Fresh",
      requested_date: "2026-04-08",
      run_date: "2026-04-08",
      units: 30,
      weight_kg: 0,
      volume_m3: 0,
      status: "allocated",
      placed_at: "2026-04-07T14:14:00+05:30",
      locked: true,
      locks_at: "2026-04-07T16:00:00+05:30",
      lines: [{ case_type: "rice_dhal", name: "Rice and dhal case", qty: 30, carried_qty: 0, carried_from: null }],
      deferral: null,
    },
  ],
  case_types: [{ code: "rice_dhal", name: "Rice and dhal case", temp: "ambient", kg: 0, m3: 0 }],
  unread_notices: 0,
};

const onTheWay: Tracker = {
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
  position: "On the road to you.",
  window: "4:00 to 7:45 AM",
  can_confirm: false,
  planned: "2026-04-08T05:19:00+05:30",
  departed_at: "2026-04-08T03:33:00+05:30",
  arrived_at: null,
  issues_until: null,
  on_board: [],
  stops: [],
  proof: null,
  receipt: null,
};

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openMyOrders(tracker: Tracker) {
  vi.spyOn(api, "get").mockImplementation(async (path: string) => {
    if (path === "/api/demo/state") return { demo_mode: false, now: home.now, rate: 0 } as never;
    if (path === "/api/auth/me") return { display_name: "Dilani Jayawardena", role: "store_manager" } as never;
    if (path === "/api/store/home") return home as never;
    if (path === "/api/store/notices") return [] as never;
    if (path.endsWith("/tracker")) return tracker as never;
    throw new Error(`unexpected GET ${path}`);
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/store", element: <MyOrders /> }], { initialEntries: ["/store"] });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("Track delivery on My orders", () => {
  it("is a link to the tracker while the estimate is still ahead, the card's main step", async () => {
    openMyOrders(onTheWay);
    const track = await screen.findByRole("link", { name: "Track delivery" });
    expect(track).toHaveAttribute("href", "/store/orders/ORD0098595/track");
    expect(track).toHaveClass("bg-petrol-700");
    expect(screen.queryByRole("button", { name: "Track delivery" })).not.toBeInTheDocument();
  });

  it("is the same link once the estimate has passed, a step behind Confirm receipt", async () => {
    openMyOrders({ ...onTheWay, passed: true, out_of_contact: true, can_confirm: true });
    const track = await screen.findByRole("link", { name: "Track delivery" });
    expect(track).toHaveAttribute("href", "/store/orders/ORD0098595/track");
    expect(track).not.toHaveClass("bg-petrol-700");
    const confirm = screen.getByRole("button", { name: "Confirm receipt" });
    expect(confirm.compareDocumentPosition(track) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
