import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, api } from "@/api/client";
import {
  type FlagWrite,
  type LoadLine,
  type TripLoad,
  useFlag,
  useSetLine,
  useTripLoad,
  useUnsentFlags,
  withLine,
} from "./api";

function line(id: string, loaded = 0): LoadLine {
  return {
    id,
    case_type: "packet_foods",
    qty: 44,
    loaded,
    status: loaded ? "checked" : "to_load",
    shortfall: null,
    changed_by_plan: false,
  };
}

function trip(...lines: LoadLine[]): TripLoad {
  return {
    trip_id: "t",
    vehicle_id: "VEH045",
    vehicle_kind: "Dry-box truck",
    trip_no: 1,
    temp: "ambient",
    brand: "Fresh",
    district: "Kegalle",
    driver: "Kasun Bandara",
    loader: null,
    planned_depart: "2026-04-07T22:10:00Z",
    departed_at: null,
    state: "loading",
    plan_changed_at: null,
    cases: lines.reduce((n, l) => n + l.qty, 0),
    loaded: lines.reduce((n, l) => n + l.loaded, 0),
    short: 0,
    lines_total: lines.length,
    lines_done: 0,
    lines_to_check: 0,
    flags_waiting: 0,
    groups: [
      {
        stop_id: "s3",
        seq: 3,
        outlet_id: "OUT117",
        place: "Hemmathagama",
        order_ref: "ORD0098595",
        cases: 0,
        loaded: 0,
        short: 0,
        moved_from: null,
        moved_at: null,
        state: "loading",
        lines,
      },
    ],
    handover: {
      completed_at: null,
      completed_by: null,
      accepted_at: null,
      accepted_by: null,
      accepted_on: null,
      difference: "",
      stops: [],
      planned_cases: 0,
      loaded_cases: 0,
      planned_kg: 0,
      loaded_kg: 0,
      planned_m3: 0,
      loaded_m3: 0,
    },
    dispatcher: "Nuwan Perera",
    dispatcher_phone: null,
    plan_changed_by: null,
  };
}

type Pending<T> = { resolve: (value: T) => void; reject: (error: unknown) => void };

/** Server calls that answer only when the test says so, in the order they were made. */
function controlled<T>() {
  const calls: Pending<T>[] = [];
  const fn = () =>
    new Promise<T>((resolve, reject) => {
      calls.push({ resolve, reject });
    });
  return { calls, fn };
}

const key = ["dock", "trip", "t"];
let client: QueryClient;
const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);
const shown = (id: string) => client.getQueryData<TripLoad>(key)?.groups[0]?.lines.find((l) => l.id === id)?.status;

beforeEach(() => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } } });
  client.setQueryData(key, trip(line("packet"), line("tea")));
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("taps on one load reach the screen in the order they were made", () => {
  it("never lets the answer to an earlier tap undo a later one", async () => {
    const post = controlled<TripLoad>();
    const spy = vi.spyOn(api, "post").mockImplementation(post.fn);
    const { result } = renderHook(() => useSetLine("t"), { wrapper });

    act(() => result.current.mutate({ lineId: "packet", loaded: 44 }));
    act(() => result.current.mutate({ lineId: "tea", loaded: 44 }));
    await waitFor(() => expect(shown("tea")).toBe("checked"));
    // one at a time: the second tap waits for the first to be saved
    expect(spy).toHaveBeenCalledTimes(1);

    // the server saved packet foods only so far
    await act(async () => post.calls[0]?.resolve(trip(line("packet", 44), line("tea"))));
    expect(shown("packet")).toBe("checked");
    expect(shown("tea")).toBe("checked");

    await waitFor(() => expect(spy).toHaveBeenCalledTimes(2));
    await act(async () => post.calls[1]?.resolve(trip(line("packet", 44), line("tea", 44))));
    await waitFor(() => expect(client.isMutating()).toBe(0));
    expect(shown("tea")).toBe("checked");
  });

  it("puts back only the failed tap's own line", async () => {
    const post = controlled<TripLoad>();
    vi.spyOn(api, "post").mockImplementation(post.fn);
    const { result } = renderHook(() => useSetLine("t"), { wrapper });

    act(() => result.current.mutate({ lineId: "packet", loaded: 44 }));
    act(() => result.current.mutate({ lineId: "tea", loaded: 44 }));
    await waitFor(() => expect(shown("tea")).toBe("checked"));

    await act(async () => post.calls[0]?.reject(new ApiError(503, "Relay is busy")));
    expect(shown("packet")).toBe("to_load");
    expect(shown("tea")).toBe("checked");
  });

  it("ignores a poll that crossed a tap on the wire", async () => {
    const post = controlled<TripLoad>();
    const get = controlled<TripLoad>();
    vi.spyOn(api, "post").mockImplementation(post.fn);
    vi.spyOn(api, "get").mockImplementation(get.fn);
    const { result } = renderHook(() => ({ write: useSetLine("t"), read: useTripLoad("t") }), { wrapper });

    act(() => result.current.write.mutate({ lineId: "tea", loaded: 44 }));
    await waitFor(() => expect(shown("tea")).toBe("checked"));

    // the 8 second poll goes out while the tap is still on its way, and is answered from before the tap
    act(() => void result.current.read.refetch());
    await waitFor(() => expect(get.calls).toHaveLength(1));
    await act(async () => get.calls[0]?.resolve(trip(line("packet"), line("tea"))));
    expect(shown("tea")).toBe("checked");
  });
});

describe("an optimistic line", () => {
  it("is confirmed where it sits when its stop moved, so it no longer shows as changed", () => {
    const moved = { ...line("tea", 44), changed_by_plan: true };
    const next = withLine(trip(moved), "tea", { loaded: 44 });
    expect(next.groups[0]?.lines[0]?.changed_by_plan).toBe(false);
    expect(next.groups[0]?.lines[0]?.status).toBe("checked");
  });
});

describe("a flag saves on the tablet first", () => {
  const flagged: FlagWrite = { lineId: "packet", kind: "missing", qty: 6, at: "2026-04-07T21:17:00Z", by: "Rizwan" };
  const shownLine = () => client.getQueryData<TripLoad>(key)?.groups[0]?.lines.find((l) => l.id === "packet");

  it("shows on its line at once, and a refusal from Relay puts the line back", async () => {
    const post = controlled<TripLoad>();
    vi.spyOn(api, "post").mockImplementation(post.fn);
    const { result } = renderHook(() => useFlag("t"), { wrapper });

    act(() => result.current.mutate(flagged));
    await waitFor(() => expect(shown("packet")).toBe("flag_waiting"));
    expect(shownLine()?.loaded).toBe(38);
    expect(shownLine()?.shortfall?.flagged_by).toBe("Rizwan");

    await act(async () => post.calls[0]?.reject(new ApiError(409, "This line is already flagged.")));
    expect(shown("packet")).toBe("to_load");
    expect(shownLine()?.shortfall).toBeNull();
  });

  it("keeps trying without a connection, and reads as not sent after a minute", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.spyOn(api, "post").mockRejectedValue(new ApiError(0, "No connection"));
      const { result } = renderHook(() => ({ flag: useFlag("t"), unsent: useUnsentFlags("t") }), { wrapper });

      act(() => result.current.flag.mutate(flagged));
      await waitFor(() => expect(shown("packet")).toBe("flag_waiting"));
      expect(result.current.unsent.has("packet")).toBe(false);

      await act(async () => {
        await vi.advanceTimersByTimeAsync(61_000);
      });
      expect(result.current.flag.failureCount).toBeGreaterThan(1);
      expect(result.current.flag.isPending).toBe(true);
      // a missing connection never puts the flag back: it waits on the tablet
      expect(shown("packet")).toBe("flag_waiting");
      expect(result.current.unsent.has("packet")).toBe(true);
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });
});
