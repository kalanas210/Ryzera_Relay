import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import type { Board, Check } from "./api";
import { PublishCheck } from "./PublishCheck";

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

const board = {
  plan: { id: "plan-1", depot: "Kandy", run_date: "2026-04-08", status: "draft", published_at: null },
  served: 56,
  trips: 18,
  lanes: [],
  waiting: [],
} as unknown as Board;

function check(over: Partial<Check> = {}): Check {
  return {
    fresh_stops: 52,
    planned_late: 0,
    broken: [],
    waiting_without_reason: [],
    expected_late: [
      {
        vehicle_id: "VEH042",
        trip_no: 2,
        order_ref: "ORD0098575",
        outlet_id: "OUT085",
        short_name: "Kandy Town",
        closes: "7:30 AM",
        planned: "7:12 AM",
        expected: "7:41 AM",
        why: "Kandy Town would miss its 7:30 AM close in any stop order.",
      },
    ],
    can_publish: true,
    ...over,
  };
}

function show(data: Check) {
  vi.spyOn(api, "get").mockResolvedValue(data as never);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PublishCheck board={board} depot="Kandy" onBack={() => {}} />
    </QueryClientProvider>,
  );
}

describe("the publish check", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("names each late store and opens the Publish dialog with Ctrl Enter", async () => {
    show(check());
    expect(await screen.findByText("Kandy Town")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(await screen.findByRole("dialog", { name: "Publish the Kandy hub plan?" })).toBeInTheDocument();
  });

  it("keeps Ctrl Enter off while a rule is broken, and says one rule in the singular", async () => {
    show(check({ broken: [{ vehicle_id: "VEH057", trip_no: 2, message: "Over weight" }], can_publish: false }));
    expect(await screen.findByText("1 rule is broken.")).toBeInTheDocument();
    fireEvent.keyDown(window, { key: "Enter", ctrlKey: true });
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
