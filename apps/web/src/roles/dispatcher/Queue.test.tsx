import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/api/client";
import { NotOrdered, type Queue, QueuePage } from "./Queue";

const at = (clock: string) => `2026-04-07T${clock}:00+05:30`;
const now = new Date(at("15:20"));

function store(outlet_id: string, short_name: string, more: Partial<Queue["not_ordered"][number]> = {}) {
  return {
    outlet_id,
    outlet_name: `Waypoint Fresh ${short_name}`,
    short_name,
    depot: "Peliyagoda",
    temps: ["ambient", "chilled"],
    pattern: "Orders dry and chilled on Wednesdays",
    reminded_at: null,
    phone: null,
    ...more,
  };
}

function queue(notOrdered: Queue["not_ordered"]): Queue {
  return {
    run_date: "2026-04-08",
    now: at("15:20"),
    cutoff: at("16:00"),
    locked: false,
    orders: [],
    late: [],
    not_ordered: notOrdered,
    fresh_outlets_expected: 80,
    fresh_outlets_ordered: 80 - notOrdered.length,
    chilled: [],
  };
}

function panel(data: Queue) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NotOrdered data={data} depot="All" weekday="Wednesday" now={now} />
    </QueryClientProvider>,
  );
}

describe("the Not ordered panel", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("reminds one store, and says so", async () => {
    const post = vi
      .spyOn(api, "post")
      .mockResolvedValue([{ outlet_id: "OUT012", reminded_at: at("15:20") }] as unknown as never);
    panel(queue([store("OUT012", "Borella"), store("OUT032", "Kadawatha")]));
    fireEvent.click(screen.getByRole("button", { name: "Remind OUT012 Borella" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith("/api/dispatch/reminders", { outlet_ids: ["OUT012"] }, { role: "dispatcher" }),
    );
    expect(await screen.findByRole("status")).toHaveTextContent("Reminder sent to OUT012 Borella.");
  });

  it("shows a reminder sent a moment ago in place of the button, and Remind all skips that store", async () => {
    const post = vi.spyOn(api, "post").mockResolvedValue([] as unknown as never);
    panel(
      queue([
        store("OUT012", "Borella", { reminded_at: at("15:14") }),
        store("OUT032", "Kadawatha"),
        store("OUT041", "Panadura", { reminded_at: at("14:50") }),
      ]),
    );
    expect(screen.getByText("Reminded 3:14 PM")).toBeInTheDocument();
    // an older reminder can go again, and says when the last one went
    expect(screen.getByRole("button", { name: "Remind again OUT041 Panadura" })).toBeInTheDocument();
    expect(screen.getByText(/Reminded 2:50 PM/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remind the other 2" }));
    await waitFor(() =>
      expect(post).toHaveBeenCalledWith(
        "/api/dispatch/reminders",
        { outlet_ids: ["OUT032", "OUT041"] },
        { role: "dispatcher" },
      ),
    );
  });

  it("offers Call only for a store with a number on record", () => {
    panel(queue([store("OUT012", "Borella"), store("OUT087", "Mulgampola", { phone: "+94812345678" })]));
    const calls = screen.getAllByRole("link", { name: /^Call / });
    expect(calls).toHaveLength(1);
    expect(calls[0]).toHaveAttribute("href", "tel:+94812345678");
    expect(screen.getByText(/Call uses the number on the store's record/)).toBeInTheDocument();
  });

  it("does not promise a call when no store has a number", () => {
    panel(queue([store("OUT012", "Borella")]));
    expect(screen.queryByRole("link", { name: /^Call / })).toBeNull();
    expect(screen.queryByText(/Call uses the number/)).toBeNull();
  });
});

describe("the order queue", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("says when its first load failed, and tries again on request", async () => {
    const get = vi.spyOn(api, "get").mockRejectedValue(new ApiError(503, "Service Unavailable"));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <QueuePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Relay could not load the order queue.");
    const asked = get.mock.calls.filter(([path]) => path === "/api/dispatch/queue").length;
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await waitFor(() =>
      expect(get.mock.calls.filter(([path]) => path === "/api/dispatch/queue").length).toBe(asked + 1),
    );
  });
});
