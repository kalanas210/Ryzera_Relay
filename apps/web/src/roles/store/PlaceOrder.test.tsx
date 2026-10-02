import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/api/client";
import type { StoreHome, StoreOrder } from "./api";
import { PlaceOrder } from "./PlaceOrder";

const order = (over: Partial<StoreOrder>): StoreOrder => ({
  id: over.order_ref ?? "o",
  order_ref: "ORD0098595",
  temp: "ambient",
  brand: "Fresh",
  requested_date: "2026-04-08",
  run_date: "2026-04-08",
  units: 102,
  weight_kg: 685.6,
  volume_m3: 3.772,
  status: "received",
  placed_at: "2026-04-07T14:14:00+05:30",
  locked: false,
  locks_at: "2026-04-07T16:00:00+05:30",
  lines: [],
  deferral: null,
  ...over,
});

/** Tuesday 7:30 PM: Wednesday's orders closed at 4:00 PM, the chilled order moved to Thursday, and the store's
 *  standing Thursday orders are in. */
const evening: StoreHome = {
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
  now: "2026-04-07T19:30:00+05:30",
  ordering_for: "2026-04-09",
  cutoff: "2026-04-08T16:00:00+05:30",
  closed_for: "2026-04-08",
  closed_at: "2026-04-07T16:00:00+05:30",
  next_run: "2026-04-08",
  orders: [
    order({ locked: true, status: "allocated" }),
    order({ order_ref: "ORD0098596", temp: "chilled", units: 92, run_date: "2026-04-09", locked: true }),
    order({
      order_ref: "ORD0098747",
      requested_date: "2026-04-09",
      run_date: "2026-04-09",
      locks_at: "2026-04-08T16:00:00+05:30",
    }),
    order({
      order_ref: "ORD0098748",
      temp: "chilled",
      requested_date: "2026-04-09",
      run_date: "2026-04-09",
      locks_at: "2026-04-08T16:00:00+05:30",
    }),
  ],
  case_types: [
    { code: "rice_dhal", name: "Rice and dhal case", temp: "ambient", kg: 10, m3: 0.04 },
    { code: "packet_foods", name: "Packet foods case", temp: "ambient", kg: 5.2, m3: 0.036 },
    { code: "tea_biscuit", name: "Tea and biscuit case", temp: "ambient", kg: 4.4, m3: 0.034 },
    { code: "dairy", name: "Dairy crate", temp: "chilled", kg: 8.4, m3: 0.038 },
    { code: "produce", name: "Produce crate", temp: "chilled", kg: 5.6, m3: 0.042 },
    { code: "meat_fish", name: "Meat and fish box", temp: "chilled", kg: 7.2, m3: 0.03 },
  ],
  unread_notices: 0,
};

let home = evening;

beforeEach(() => {
  home = evening;
  vi.spyOn(api, "get").mockImplementation(async (path: string) => {
    if (path === "/api/demo/state") return { demo_mode: false, now: home.now, rate: 0 } as never;
    if (path === "/api/store/home") return home as never;
    throw new Error(`unexpected GET ${path}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openForm(path = "/store/order") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/store/order", element: <PlaceOrder /> },
      { path: "/store", element: <p>My orders</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return client;
}

/** Text as a reader sees it: the no-break spaces that keep "4:00 PM" together read as spaces. */
const text = (s: string) => s.replace(/\s/g, " ");

describe("Place an order after the cutoff", () => {
  it("says the day closed, which run a new order joins, and what is already coming", async () => {
    openForm();
    expect(await screen.findByText("Orders for Wednesday closed at 4:00 PM")).toBeInTheDocument();
    expect(screen.getByText("Anything you send now goes on Thursday's run.")).toBeInTheDocument();
    expect(screen.getByText("Orders for Thursday close tomorrow at 4:00 PM")).toBeInTheDocument();
    const notes = screen.getAllByText(/has already moved to Thursday/);
    expect(text(notes[0]?.textContent ?? "")).toBe(
      "Your chilled order ORD0098596 has already moved to Thursday. Those 92 cases are coming, so order only what else you need.",
    );
    // every order already sent for Thursday is named, in one sentence
    expect(screen.getByText(/Already sent for Thursday/).textContent).toBe(
      "Already sent for Thursday: dry order ORD0098747 and chilled order ORD0098748",
    );
    // both types have an order, so the form starts on chilled and says a send adds a second one
    expect(screen.getByRole("radio", { name: "Chilled" })).toHaveAttribute("aria-checked", "true");
    expect(text(screen.getByText(/This adds a second order/).textContent ?? "")).toBe(
      "You already sent a chilled order for Thursday, ORD0098748. This adds a second order.",
    );
    expect(screen.getByRole("button", { name: "Send for Thursday's run" })).toBeDisabled();
  });

  it("keeps the counts while the phone is offline, retries with the same id, and names the run it joined", async () => {
    const sent = order({
      order_ref: "ORD0098754",
      temp: "chilled",
      requested_date: "2026-04-09",
      run_date: "2026-04-09",
      placed_at: "2026-04-07T19:31:00+05:30",
      locks_at: "2026-04-08T16:00:00+05:30",
      units: 4,
      lines: [{ case_type: "dairy", name: "Dairy crate", qty: 4, carried_qty: 0, carried_from: null }],
    });
    const post = vi
      .spyOn(api, "post")
      .mockRejectedValueOnce(new ApiError(0, "No connection"))
      .mockResolvedValueOnce(sent as never);
    openForm();
    fireEvent.click(await screen.findByRole("button", { name: "More dairy crates" }));
    fireEvent.click(screen.getByRole("button", { name: "Send for Thursday's run" }));

    expect(await screen.findByText("Not sent. Your phone is offline. Your counts are saved here.")).toBeInTheDocument();
    expect(screen.queryByText("Received by Waypoint")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Received by Waypoint")).toBeInTheDocument();
    const [path, first] = post.mock.calls[0] as [string, { client_ref: string; for_date: string }];
    const [, second] = post.mock.calls[1] as [string, { client_ref: string }];
    expect(path).toBe("/api/store/orders");
    expect(first.for_date).toBe("2026-04-09");
    expect(second.client_ref).toBe(first.client_ref);
    expect(
      screen.getByText("Orders for Wednesday closed at 4:00 PM, so this one goes on Thursday's run."),
    ).toBeInTheDocument();
    expect(screen.getByText("Orders for Thursday close tomorrow at 4:00 PM.")).toBeInTheDocument();
    expect(screen.getByText("Your delivery time shows in My orders tomorrow evening.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Place another order" })).toBeInTheDocument();
  });
});

describe("Place an order", () => {
  it("keeps the type the store is counting when a later answer changes the default", async () => {
    // 2:12 PM, the chilled order sent: the form starts on dry
    home = {
      ...evening,
      now: "2026-04-07T14:12:00+05:30",
      ordering_for: "2026-04-08",
      cutoff: "2026-04-07T16:00:00+05:30",
      closed_for: null,
      closed_at: null,
      orders: [order({ order_ref: "ORD0098596", temp: "chilled" })],
    };
    const client = openForm();
    fireEvent.click(await screen.findByRole("button", { name: "More rice and dhal cases" }));
    expect(screen.getByRole("radio", { name: "Dry" })).toHaveAttribute("aria-checked", "true");

    // a dry order arrives from elsewhere: both types now have one, but the counted dry cases stay in view
    home = { ...home, orders: [...home.orders, order({})] };
    await client.invalidateQueries({ queryKey: ["store", "home"] });
    expect(await screen.findByText(/You already sent a dry order/)).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Dry" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("button", { name: "Send order" })).toBeEnabled();
  });
});

describe("Change this order", () => {
  it("fills in the order's own counts and saves only a real change", async () => {
    home = {
      ...evening,
      now: "2026-04-07T14:20:00+05:30",
      ordering_for: "2026-04-08",
      cutoff: "2026-04-07T16:00:00+05:30",
      closed_for: null,
      closed_at: null,
      orders: [
        order({
          lines: [
            { case_type: "rice_dhal", name: "Rice and dhal case", qty: 36, carried_qty: 0, carried_from: null },
            { case_type: "packet_foods", name: "Packet foods case", qty: 44, carried_qty: 0, carried_from: null },
          ],
        }),
      ],
    };
    const patch = vi.spyOn(api, "patch").mockResolvedValue(home.orders[0] as never);
    openForm("/store/order?change=ORD0098595");
    expect(screen.getByRole("heading", { name: "Change ORD0098595" })).toBeInTheDocument();
    const save = await screen.findByRole("button", { name: "Save changes" });
    expect(save).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Fewer rice and dhal cases" }));
    fireEvent.click(save);
    expect(await screen.findByText("My orders")).toBeInTheDocument();
    expect(patch).toHaveBeenCalledWith(
      "/api/store/orders/ORD0098595",
      {
        lines: [
          { case_type: "rice_dhal", qty: 35 },
          { case_type: "packet_foods", qty: 44 },
        ],
      },
      { role: "store_manager" },
    );
  });

  it("says plainly when the order has closed", async () => {
    openForm("/store/order?change=ORD0098595");
    expect(
      await screen.findByText("Orders for Wednesday closed at 4:00 PM, so this order can't be changed now."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save changes" })).not.toBeInTheDocument();
  });
});
