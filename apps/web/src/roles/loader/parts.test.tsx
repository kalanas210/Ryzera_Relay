import { act, cleanup, fireEvent, render, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { i18n } from "@/i18n";
import type { LoadLine } from "./api";
import { CountSheet, LoadLineRow, SETTLE_MS, Swap, useSettledTap } from "./parts";

beforeAll(async () => {
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
  await i18n.changeLanguage("en");
});

afterEach(cleanup);

/** The text a reader sees: what is not laid out unseen to hold a box's size. */
function seen(text: string): HTMLElement[] {
  return screen.queryAllByText(text).filter((el) => !el.closest(".invisible"));
}

const rice: LoadLine = {
  id: "rice",
  case_type: "rice_dhal",
  qty: 36,
  loaded: 0,
  status: "to_load",
  shortfall: null,
  changed_by_plan: false,
};

describe("How many are on?", () => {
  const sheet = (line: LoadLine | null, onSave = (_: number) => {}) => (
    <CountSheet line={line} onClose={() => {}} onSave={onSave} />
  );
  const value = () => (screen.getByRole("textbox", { hidden: true }) as HTMLInputElement).value;

  it("opens on what the line has on: none for a line not started", () => {
    render(sheet(rice));
    expect(value()).toBe("0");
    cleanup();
    render(sheet({ ...rice, loaded: 30, status: "in_progress" }));
    expect(value()).toBe("30");
  });

  it("opens again on the line's own count, not on a number left on the stepper", () => {
    const view = render(sheet(rice));
    fireEvent.click(screen.getByRole("button", { name: "More rice and dhal cases", hidden: true }));
    expect(value()).toBe("1");

    view.rerender(sheet(null)); // closed without saving
    view.rerender(sheet(rice));
    expect(value()).toBe("0");
  });

  it("saves on Enter in the number, as Save does", () => {
    const onSave = vi.fn();
    render(sheet(rice, onSave));
    const input = screen.getByRole("textbox", { hidden: true });
    fireEvent.change(input, { target: { value: "6" } });
    fireEvent.submit(input);
    expect(onSave).toHaveBeenCalledWith(6);
  });

  it("names the stepper buttons in the reader's language", async () => {
    await i18n.changeLanguage("ta");
    render(sheet(rice));
    expect(screen.getByRole("button", { name: "அரிசி, பருப்பு பெட்டிகளைக் குறை", hidden: true })).toBeDisabled();
    await i18n.changeLanguage("en");
  });
});

describe("loader counts", () => {
  it("say line and lines correctly", () => {
    expect(i18n.t("bar.toSend", { ns: "loader", count: 1 })).toBe("1 line to send");
    expect(i18n.t("bar.toSend", { ns: "loader", count: 3 })).toBe("3 lines to send");
    expect(i18n.t("load.toCheck", { ns: "loader", count: 1 })).toBe("1 line to check.");
    expect(i18n.t("load.toCheck", { ns: "loader", count: 2 })).toBe("2 lines to check.");
  });
});

describe("a load line", () => {
  const row = (line: LoadLine, props: { readOnly?: boolean; onToggle?: () => void; onFlag?: () => void } = {}) => (
    <LoadLineRow
      line={line}
      stop={3}
      kind="Dry"
      chilled={false}
      dispatcher="Nuwan Perera"
      onToggle={props.onToggle ?? (() => {})}
      onCount={() => {}}
      onFlag={props.onFlag ?? (() => {})}
      readOnly={props.readOnly}
    />
  );

  it("names its stop with the kind after a dot that goes with the kind when it wraps", () => {
    const { container } = render(row(rice));
    expect(container.textContent).toContain("Stop 3·Dry");
  });

  it("sits in a group named by its case and stop, with its Flag button", () => {
    render(row(rice));
    // jsdom lays nothing out, so it reads the stop and the kind with no space between them; a browser puts one
    const line = screen.getByRole("group", { name: /^Rice and dhal Stop 3\s?Dry$/ });
    expect(
      within(line).getByRole("button", { name: "Flag", description: /^Rice and dhal Stop 3\s?Dry$/ }),
    ).toBeTruthy();
  });

  it("is a record once the load is marked complete: no check, no flag", () => {
    const onToggle = vi.fn();
    render(row({ ...rice, loaded: 36, status: "checked" }, { readOnly: true, onToggle }));
    expect(screen.queryByRole("button")).toBeNull();
    fireEvent.click(screen.getByText("Rice and dhal"));
    expect(onToggle).not.toHaveBeenCalled();
  });
});

describe("a flagged line", () => {
  const waiting: LoadLine = {
    ...rice,
    loaded: 30,
    status: "flag_waiting",
    shortfall: {
      id: "unsent-rice",
      kind: "missing",
      qty: 6,
      flagged_at: "2026-04-07T21:17:00Z",
      flagged_by: "Mohamed Rizwan",
      decision: null,
      decided_at: null,
      decided_by: null,
      added_to_order_ref: null,
      added_to_day: null,
      store_contact: null,
      photo_id: null,
    },
  };
  const decided: LoadLine = {
    ...waiting,
    status: "decided",
    shortfall: waiting.shortfall && {
      ...waiting.shortfall,
      decision: "send_short",
      decided_at: "2026-04-07T21:22:00Z",
      decided_by: "Nuwan Perera",
      added_to_order_ref: "ORD0098747",
      added_to_day: "2026-04-09",
    },
  };
  const row = (line: LoadLine, props: { unsent?: boolean; noAnswer?: boolean; readOnly?: boolean } = {}) => (
    <LoadLineRow
      line={line}
      stop={3}
      kind="Dry"
      chilled={false}
      dispatcher="Nuwan Perera"
      onToggle={() => {}}
      onCount={() => {}}
      onFlag={() => {}}
      {...props}
    />
  );

  it("waits for the dispatcher once it has reached Relay", () => {
    render(row(waiting));
    expect(seen("Waiting for Nuwan")).toHaveLength(1);
    expect(seen("No answer yet")).toHaveLength(0);
  });

  it("holds the room of the answer to come, so the answer never changes its height", () => {
    const view = render(row(waiting));
    // laid out unseen while it waits: the decided lines, for any day the cases may come
    expect(screen.getAllByText("30 loaded, 6 short").length).toBeGreaterThan(0);
    expect(screen.getByText("6 come on Thursday")).toBeTruthy();
    expect(seen("6 come on Thursday")).toHaveLength(0);

    view.rerender(row(decided));
    expect(seen("30 loaded, 6 short")).toHaveLength(1);
    expect(seen("6 come on Thursday")).toHaveLength(1);
    expect(seen("Waiting for Nuwan")).toHaveLength(0);
  });

  it("says it is not sent yet while it is still on the tablet, even close to departure", () => {
    const view = render(row(waiting, { unsent: true }));
    expect(seen("Not sent yet")).toHaveLength(1);
    view.rerender(row(waiting, { unsent: true, noAnswer: true }));
    expect(seen("Not sent yet")).toHaveLength(1);
    expect(seen("No answer yet")).toHaveLength(0);
  });

  it("still opens its flag once the load is complete", () => {
    const onFlag = vi.fn();
    render(
      <LoadLineRow
        line={decided}
        stop={3}
        kind="Dry"
        chilled={false}
        dispatcher="Nuwan Perera"
        onToggle={() => {}}
        onCount={() => {}}
        onFlag={onFlag}
        readOnly
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /View/ }));
    expect(onFlag).toHaveBeenCalledTimes(1);
  });
});

describe("Swap", () => {
  it("lays every option out in one place and shows one", () => {
    render(<Swap shown="b" options={{ a: "Missing", b: "Damaged" }} />);
    expect(screen.getByText("Missing").className).toContain("invisible");
    expect(screen.getByText("Damaged").className).not.toContain("invisible");
  });
});

describe("a button that has just appeared", () => {
  it("takes no tap for half a second, so a double tap never fires it", () => {
    let now = 1_000;
    const clock = vi.spyOn(performance, "now").mockImplementation(() => now);
    const action = vi.fn();
    const { result, rerender } = renderHook(({ moved }) => useSettledTap(moved), { initialProps: { moved: 1 } });

    now += 350; // the second tap of a double tap
    act(() => result.current(action)());
    expect(action).not.toHaveBeenCalled();

    now += SETTLE_MS;
    act(() => result.current(action)());
    expect(action).toHaveBeenCalledTimes(1);

    // it moved, or was replaced by another button in the same place: it waits again
    rerender({ moved: 2 });
    now += 100;
    act(() => result.current(action)());
    expect(action).toHaveBeenCalledTimes(1);
    clock.mockRestore();
  });
});
