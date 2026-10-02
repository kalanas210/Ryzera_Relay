import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import { Replanning, WARMING_ASK_AGAIN_MS, WARMING_FIRST_ASK_MS } from "./Replanning";

const CHECKING = "Relay is checking every vehicle and every rule. A new fleet can take up to a minute.";
const WARMING = "Relay has just started and is still warming up the planner. This plan can take up to a minute.";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

/** Lets the timers run on and the health answer arrive. */
async function wait(ms: number) {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
}

describe("Replanning", () => {
  it("says the planner is still warming up while the API reports it, then goes back to the usual words", async () => {
    const get = vi
      .spyOn(api, "get")
      .mockResolvedValueOnce({ status: "ok", warming: true } as never)
      .mockResolvedValueOnce({ status: "ok", warming: false } as never);
    render(<Replanning active />);
    // a quick answer never asks
    expect(screen.getByRole("status")).toHaveTextContent(CHECKING);
    expect(get).not.toHaveBeenCalled();

    await wait(WARMING_FIRST_ASK_MS);
    expect(get).toHaveBeenCalledWith("/api/health");
    expect(screen.getByRole("status")).toHaveTextContent(WARMING);

    await wait(WARMING_ASK_AGAIN_MS);
    expect(get).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("status")).toHaveTextContent(CHECKING);
    // the warm-up is over, so nothing asks again
    await wait(WARMING_ASK_AGAIN_MS * 2);
    expect(get).toHaveBeenCalledTimes(2);
  });

  it("asks nothing once the search ends, and starts from the usual words on the next one", async () => {
    const get = vi.spyOn(api, "get").mockResolvedValue({ status: "ok", warming: true } as never);
    const { rerender } = render(<Replanning active />);
    await wait(WARMING_FIRST_ASK_MS);
    expect(screen.getByRole("status")).toHaveTextContent(WARMING);

    rerender(<Replanning active={false} />);
    expect(screen.queryByRole("status")).toBeNull();
    await wait(WARMING_ASK_AGAIN_MS * 2);
    expect(get).toHaveBeenCalledTimes(1);

    rerender(<Replanning active />);
    expect(screen.getByRole("status")).toHaveTextContent(CHECKING);
  });

  it("keeps the usual words when the health check cannot be reached", async () => {
    vi.spyOn(api, "get").mockRejectedValue(new Error("No connection"));
    render(<Replanning active />);
    await wait(WARMING_FIRST_ASK_MS);
    expect(screen.getByRole("status")).toHaveTextContent(CHECKING);
  });
});
