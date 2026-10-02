import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { DemoState } from "@/api/types";
import { DemoBar } from "./DemoBar";

const post = vi.fn();
vi.mock("@/api/client", async (original) => ({
  ...(await original<typeof import("@/api/client")>()),
  api: { get: vi.fn(() => new Promise(() => {})), post: (...args: unknown[]) => post(...args) },
}));

// jsdom has <dialog> but not its methods; these do what the browser does to the open attribute.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.show = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
    this.dispatchEvent(new Event("close"));
  };
});

beforeEach(() => post.mockReset());
afterEach(cleanup);

const handover = { key: "handover", label: "Handover at the dock", at: "2026-04-08T03:16:00+05:30", passed: false };

function state(code: string, shared: boolean): DemoState {
  return {
    demo_mode: true,
    workspace: { code, label: "", is_default: shared, edition: code },
    now: "2026-04-07T14:05:00+05:30",
    rate: shared ? 0 : 1,
    moments: [handover],
    next: handover,
    played: [],
    outages: {},
  };
}

function bar(demo: DemoState) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  client.setQueryData(["demo"], demo);
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/driver"]}>
        <DemoBar />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const jump = () => fireEvent.click(screen.getByRole("button", { name: "Jump to 3:16 AM: Handover at the dock" }));

describe("the demo bar in the shared walkthrough", () => {
  it("offers a copy of the judge's own before a jump, and makes the jump in it", async () => {
    const mine = state("K7P2QX", false);
    post.mockResolvedValueOnce(mine).mockResolvedValueOnce({ ...mine, played: ["Rizwan finishes loading"] });
    bar(state("MAIN", true));

    jump();
    expect(post).not.toHaveBeenCalled();
    expect(screen.getByText("Start your own copy to jump the clock?")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Start my copy" }));
    await waitFor(() => expect(post).toHaveBeenCalledTimes(2));
    expect(post.mock.calls).toEqual([
      ["/api/demo/workspaces", undefined],
      ["/api/demo/clock", { action: "jump", to: "handover" }],
    ]);
    expect(await screen.findByText("Relay played 1 skipped step")).toBeInTheDocument();
  });

  it("moves nothing when the judge says not now", () => {
    bar(state("MAIN", true));
    jump();
    fireEvent.click(screen.getByRole("button", { name: "Not now" }));
    expect(post).not.toHaveBeenCalled();
  });

  it("has no reset for the shared copy, which starts again by itself", () => {
    bar(state("MAIN", true));
    fireEvent.click(screen.getByRole("button", { name: "Demo controls" }));
    expect(screen.getByRole("button", { name: "Start a private copy" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reset this copy" })).toBeNull();
  });
});

describe("the demo bar in a private copy", () => {
  it("jumps straight away", async () => {
    post.mockResolvedValueOnce(state("K7P2QX", false));
    bar(state("K7P2QX", false));
    jump();
    await waitFor(() => expect(post).toHaveBeenCalledWith("/api/demo/clock", { action: "jump", to: "handover" }));
    expect(screen.queryByText("Start your own copy to jump the clock?")).not.toBeVisible();
  });

  it("names each moment's Go button for the moment it goes to", () => {
    bar(state("K7P2QX", false));
    fireEvent.click(screen.getByRole("button", { name: "Demo controls" }));
    expect(screen.getByRole("button", { name: "Go to 3:16 AM, Handover at the dock" })).toBeVisible();
  });
});
