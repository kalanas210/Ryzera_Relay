import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import type { LoadLine } from "./api";
import { CountSheet, LoadLineRow } from "./parts";

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

const rice: LoadLine = {
  id: "rice",
  case_type: "rice_dhal",
  qty: 36,
  loaded: 0,
  status: "to_load",
  shortfall: null,
  changed_by_plan: false,
};

const sheet = (line: LoadLine | null) => <CountSheet line={line} onClose={() => {}} onSave={() => {}} />;

describe("How many are on?", () => {
  it("opens again on the line's own count, not on a number left on the stepper", () => {
    const view = render(sheet(rice));
    const value = () => (screen.getByRole("textbox", { hidden: true }) as HTMLInputElement).value;
    expect(value()).toBe("36");
    fireEvent.click(screen.getByRole("button", { name: "Fewer rice and dhal cases", hidden: true }));
    expect(value()).toBe("35");

    view.rerender(sheet(null)); // closed without saving
    view.rerender(sheet(rice));
    expect(value()).toBe("36");
  });

  it("names the stepper buttons in the reader's language", async () => {
    await i18n.changeLanguage("ta");
    render(sheet(rice));
    expect(screen.getByRole("button", { name: "அரிசி, பருப்பு பெட்டிகளைக் கூட்டு", hidden: true })).toBeDisabled();
    await i18n.changeLanguage("en");
  });
});

describe("loader counts", () => {
  it("say line and lines correctly", () => {
    expect(i18n.t("bar.toSend", { ns: "loader", count: 1 })).toBe("1 line to send");
    expect(i18n.t("bar.toSend", { ns: "loader", count: 3 })).toBe("3 lines to send");
    expect(i18n.t("load.toCheck", { ns: "loader", count: 1 })).toBe("1 line to check");
    expect(i18n.t("load.toCheck", { ns: "loader", count: 2 })).toBe("2 lines to check");
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
  const row = (props: { unsent?: boolean; noAnswer?: boolean }) => (
    <LoadLineRow
      line={waiting}
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
    render(row({}));
    expect(screen.getByText("Waiting for Nuwan")).toBeTruthy();
  });

  it("says it is not sent yet while it is still on the tablet, even close to departure", () => {
    const view = render(row({ unsent: true }));
    expect(screen.getByText("Not sent yet")).toBeTruthy();
    view.rerender(row({ unsent: true, noAnswer: true }));
    expect(screen.getByText("Not sent yet")).toBeTruthy();
    expect(screen.queryByText("No answer yet")).toBeNull();
  });
});
