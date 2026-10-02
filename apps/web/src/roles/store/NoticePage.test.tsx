import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import { type Notice, type StoreHome, withAnswer } from "./api";
import { NoticePage } from "./NoticePage";

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
  now: "2026-04-08T02:55:00+05:30",
  ordering_for: "2026-04-09",
  cutoff: "2026-04-08T16:00:00+05:30",
  closed_for: null,
  closed_at: null,
  next_run: "2026-04-08",
  orders: [],
  case_types: [],
  unread_notices: 1,
};

const notice: Notice = {
  id: "n1",
  kind: "short_delivery",
  title: "6 rice and dhal cases are short in today's dry order",
  body: "",
  data: {},
  created_at: "2026-04-08T02:52:00+05:30",
  read_at: null,
  acknowledged_at: null,
};

const READ = "2026-04-08T02:54:00+05:30";
const SEEN = "2026-04-08T02:55:00+05:30";

let notices: Notice[];

beforeEach(() => {
  notices = [notice];
  vi.spyOn(api, "get").mockImplementation(async (path: string) => {
    if (path === "/api/demo/state") return { demo_mode: false, now: SEEN, rate: 0 } as never;
    if (path === "/api/store/home") return home as never;
    if (path === "/api/store/notices") return notices as never;
    throw new Error(`unexpected GET ${path}`);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function openNotice() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: "/store/notices/:noticeId", element: <NoticePage /> }], {
    initialEntries: ["/store/notices/n1"],
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe("Got it on a delivery update", () => {
  it("keeps Seen when the read that went out on opening comes back after Got it", async () => {
    let answerRead: (n: Notice) => void = () => {};
    const post = vi.spyOn(api, "post").mockImplementation((path: string) => {
      if (path.endsWith("/read")) {
        return new Promise((resolve) => {
          answerRead = (n) => resolve(n as never);
        });
      }
      notices = [{ ...notice, read_at: READ, acknowledged_at: SEEN }];
      return Promise.resolve(notices[0] as never);
    });
    openNotice();

    fireEvent.click(await screen.findByRole("button", { name: "Got it" }));
    expect(await screen.findByText("Seen 2:55 AM. The dispatcher can see this.")).toBeInTheDocument();
    expect(post.mock.calls.map(([path]) => path)).toEqual(["/api/store/notices/n1/read", "/api/store/notices/n1/ack"]);

    // Relay read the notice before Got it reached it, so this answer has no acknowledgement yet; the cache tells the
    // screen on the next task, so the test waits one
    await act(async () => {
      answerRead({ ...notice, read_at: READ });
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(screen.getByText("Seen 2:55 AM. The dispatcher can see this.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Got it" })).not.toBeInTheDocument();
  });
});

describe("an answer laid over the notice on the phone", () => {
  it("never takes back a time Relay already gave, and takes every new one", () => {
    const seen = { ...notice, read_at: READ, acknowledged_at: SEEN };
    const other = { ...notice, id: "n2" };
    expect(withAnswer([seen, other], { ...notice, read_at: READ })).toEqual([seen, other]);
    expect(withAnswer([notice, other], seen)).toEqual([seen, other]);
    expect(withAnswer(undefined, seen)).toBeUndefined();
  });
});
