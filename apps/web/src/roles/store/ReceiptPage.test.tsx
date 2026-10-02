import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/api/client";
import type { Notice, StoreHome, Tracker } from "./api";
import { ReceiptPage } from "./ReceiptPage";

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

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
  now: "2026-04-08T06:42:00+05:30",
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
      units: 102,
      weight_kg: 685.6,
      volume_m3: 3.772,
      status: "allocated",
      placed_at: "2026-04-07T14:14:00+05:30",
      locked: true,
      locks_at: "2026-04-07T16:00:00+05:30",
      lines: [],
      deferral: null,
    },
    {
      id: "o2",
      order_ref: "ORD0098747",
      temp: "ambient",
      brand: "Fresh",
      requested_date: "2026-04-09",
      run_date: "2026-04-09",
      units: 133,
      weight_kg: 0,
      volume_m3: 0,
      status: "received",
      placed_at: "2026-04-07T11:00:00+05:30",
      locked: false,
      locks_at: "2026-04-08T16:00:00+05:30",
      lines: [],
      deferral: null,
    },
  ],
  case_types: [
    { code: "rice_dhal", name: "Rice and dhal case", temp: "ambient", kg: 0, m3: 0 },
    { code: "packet_foods", name: "Packet foods case", temp: "ambient", kg: 0, m3: 0 },
    { code: "tea_biscuit", name: "Tea and biscuit case", temp: "ambient", kg: 0, m3: 0 },
  ],
  unread_notices: 0,
};

const pastEstimate: Tracker = {
  order_ref: "ORD0098595",
  kind: "dry",
  status: "on_the_way",
  vehicle_id: "VEH045",
  vehicle_kind: "Dry-box truck",
  driver: "Kasun Bandara",
  stop_seq: 3,
  stops_before: 1,
  expected: "2026-04-08T06:35:00+05:30",
  range: ["2026-04-08T06:45:00+05:30", "2026-04-08T07:20:00+05:30"],
  passed: true,
  out_of_contact: true,
  last_heard: "2026-04-08T05:41:00+05:30",
  position: "Probably on the road to you.",
  window: "4:00 to 7:45 AM",
  can_confirm: true,
  planned: "2026-04-08T05:19:00+05:30",
  departed_at: "2026-04-08T03:33:00+05:30",
  arrived_at: null,
  issues_until: "2026-04-08T16:00:00+05:30",
  on_board: [
    { case_type: "rice_dhal", name: "Rice and dhal", ordered: 36, on_board: 30, short: 6, comes_on: "ORD0098747" },
    { case_type: "packet_foods", name: "Packet foods", ordered: 44, on_board: 44, short: 0, comes_on: null },
    { case_type: "tea_biscuit", name: "Tea and biscuit", ordered: 22, on_board: 22, short: 0, comes_on: null },
  ],
  stops: [],
  proof: null,
  receipt: null,
};

const told: Notice = {
  id: "n1",
  kind: "short_delivery",
  title: "6 rice and dhal cases are short in today's dry order",
  body: "",
  data: { order_ref: "ORD0098595", added_day: "2026-04-09" },
  created_at: "2026-04-08T02:52:00+05:30",
  read_at: null,
  acknowledged_at: null,
};

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(api, "get").mockImplementation(async (path: string) => {
    if (path === "/api/demo/state") return { demo_mode: false, now: "2026-04-08T06:42:00+05:30", rate: 0 } as never;
    if (path === "/api/auth/me") return { display_name: "Dilani Jayawardena", role: "store_manager" } as never;
    if (path === "/api/store/home") return home as never;
    if (path === "/api/store/notices") return [told] as never;
    if (path.endsWith("/tracker")) return pastEstimate as never;
    throw new Error(`unexpected GET ${path}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openReceipt() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: "/store/orders/:orderRef/receipt", element: <ReceiptPage /> },
      { path: "/store", element: <p>My orders</p> },
    ],
    { initialEntries: ["/store/orders/ORD0098595/receipt"] },
  );
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("Confirm receipt", () => {
  it("checks against what was loaded and says the short cases were already told", async () => {
    openReceipt();
    expect(await screen.findByText("96 cases")).toBeInTheDocument();
    expect(screen.getByText("30 loaded")).toBeInTheDocument();
    expect(screen.getByText("6 short. You were told at 2:52 AM. Coming Thursday.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Everything arrived" })).toBeEnabled();
  });

  it("sends a flagged line as an issue, and keeps it with the same client_ref while the phone is offline", async () => {
    const post = vi.spyOn(api, "post").mockRejectedValueOnce(new ApiError(0, "No connection"));
    openReceipt();
    fireEvent.click(await screen.findByRole("button", { name: "Flag Packet foods case" }));
    const add = screen.getByRole("button", { name: "Add to receipt", hidden: true });
    expect(add).toBeDisabled(); // nothing is staged until a reason is picked
    fireEvent.click(screen.getByRole("radio", { name: "Damaged", hidden: true }));
    fireEvent.click(add);

    expect(screen.getByText("Flagged: 1 damaged")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Send 1 issue" }));

    expect(await screen.findByText("Not sent. Your phone is offline. Your flags are saved here.")).toBeInTheDocument();
    expect(screen.queryByText("Issue sent")).not.toBeInTheDocument();
    const [path, first] = post.mock.calls[0] as [string, { client_ref: string; issues: unknown[] }];
    expect(path).toBe("/api/store/orders/ORD0098595/receipt");
    expect(first.issues).toEqual([{ case_type: "packet_foods", kind: "damaged", qty: 1, note: "" }]);

    const confirmed: Tracker = {
      ...pastEstimate,
      status: "disputed",
      can_confirm: false,
      receipt: {
        status: "with_issues",
        confirmed_at: "2026-04-08T06:43:00+05:30",
        before_driver_proof: true,
        issues: [{ case_type: "packet_foods", kind: "damaged", qty: 1, note: "" }],
        reported_at: null,
      },
    };
    post.mockResolvedValueOnce(confirmed as never);
    vi.mocked(api.get).mockImplementation(async (p: string) => {
      if (p.endsWith("/tracker")) return confirmed as never;
      if (p === "/api/store/notices") return [told] as never;
      if (p === "/api/store/home") return home as never;
      if (p === "/api/auth/me") return { display_name: "Dilani Jayawardena" } as never;
      return { demo_mode: false, now: "2026-04-08T06:43:00+05:30", rate: 0 } as never;
    });
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByRole("heading", { name: "Issue sent" })).toBeInTheDocument();
    const [, second] = post.mock.calls[1] as [string, { client_ref: string }];
    expect(second.client_ref).toBe(first.client_ref);
  });

  it("after Everything arrived, offers a quiet Report a problem below what is still to come", async () => {
    const confirmed: Tracker = {
      ...pastEstimate,
      status: "confirmed",
      can_confirm: false,
      receipt: {
        status: "confirmed",
        confirmed_at: "2026-04-08T06:42:00+05:30",
        before_driver_proof: true,
        issues: [],
        reported_at: null,
      },
    };
    vi.spyOn(api, "post").mockResolvedValueOnce(confirmed as never);
    openReceipt();
    const send = await screen.findByRole("button", { name: "Everything arrived" });
    const before = vi.mocked(api.get).getMockImplementation();
    vi.mocked(api.get).mockImplementation(async (p: string, o) =>
      p.endsWith("/tracker") ? (confirmed as never) : (before?.(p, o) as never),
    );
    fireEvent.click(send);

    expect(await screen.findByRole("heading", { name: "Receipt confirmed" })).toBeInTheDocument();
    const toCome = screen.getByRole("heading", { name: "Still to come on Thursday 9 April" });
    const report = screen.getByRole("button", { name: "Report a problem" });
    expect(toCome.compareDocumentPosition(report) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(report.closest("section")).toBeNull(); // not a card of its own
    expect(report.nextElementSibling).toHaveTextContent("You can still report a problem until 4:00 PM today");
  });
});
