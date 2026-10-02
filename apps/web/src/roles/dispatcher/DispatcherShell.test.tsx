import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { type Depot, DeskHeader } from "./DispatcherShell";

afterEach(cleanup);

function header(onDepot: (d: Depot) => void, allowAll: boolean) {
  // the clock stays empty: nothing here asks the API
  const client = new QueryClient({ defaultOptions: { queries: { enabled: false, retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <DeskHeader title="Plan board" depot="Kandy" onDepot={onDepot} allowAll={allowAll} />
      <input aria-label="Search" />
    </QueryClientProvider>,
  );
}

const shift = (code: string, target: Element | Window = window) =>
  fireEvent.keyDown(target, { key: code.slice(3), code, shiftKey: true });

describe("the desk's depot keys", () => {
  it("switch the depot with Shift P and Shift K", () => {
    const onDepot = vi.fn();
    header(onDepot, true);
    shift("KeyP");
    shift("KeyK");
    shift("KeyA");
    expect(onDepot.mock.calls.map(([d]) => d)).toEqual(["Peliyagoda", "Kandy", "All"]);
  });

  it("leave All alone where the switch has it off, and say why on the segment", () => {
    const onDepot = vi.fn();
    header(onDepot, false);
    shift("KeyA");
    expect(onDepot).not.toHaveBeenCalled();
    const all = screen.getByRole("radio", { name: "All" });
    expect(all.getAttribute("aria-disabled")).toBe("true");
    fireEvent.click(all);
    expect(onDepot).not.toHaveBeenCalled();
    expect(all.title).toBe("Plans are made one depot at a time, because each vehicle serves only its home depot.");
  });

  it("stay off while a field has focus", () => {
    const onDepot = vi.fn();
    header(onDepot, true);
    shift("KeyP", screen.getByLabelText("Search"));
    expect(onDepot).not.toHaveBeenCalled();
  });
});
