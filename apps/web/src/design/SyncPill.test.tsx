import { QueryClient, QueryClientProvider, useMutation } from "@tanstack/react-query";
import { cleanup, render, screen } from "@testing-library/react";
import { type ReactNode, useEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SyncPill } from "./SyncPill";

function withClient(children: ReactNode) {
  return <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;
}

const pill = (waiting?: number) => (
  <SyncPill
    synced="All synced"
    sending="Sending"
    offline="Offline"
    waiting={waiting}
    toSend={(count) => `${count} ${count === 1 ? "line" : "lines"} to send`}
  />
);

/** A save that never answers, so the pill stays in its sending state. */
function Saving() {
  const save = useMutation({ mutationFn: () => new Promise<void>(() => {}), networkMode: "always" });
  const { mutate } = save;
  useEffect(() => mutate(), [mutate]);
  return null;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("the sync pill only counts what is really waiting", () => {
  it("says Offline, with no count, when nothing is waiting", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(withClient(pill()));
    expect(screen.getByRole("status")).toHaveTextContent(/^Offline$/);
  });

  it("counts the lines still to send", () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    render(withClient(pill(2)));
    expect(screen.getByRole("status")).toHaveTextContent("2 lines to send");
  });

  it("says Sending, not All synced, while a save is on its way", async () => {
    render(
      withClient(
        <>
          <Saving />
          {pill()}
        </>,
      ),
    );
    expect(await screen.findByText("Sending")).toBeInTheDocument();
  });

  it("says All synced when online with nothing in flight", () => {
    render(withClient(pill()));
    expect(screen.getByRole("status")).toHaveTextContent("All synced");
  });
});
