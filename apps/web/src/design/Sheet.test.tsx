import { cleanup, render } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { Sheet } from "./Sheet";

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

const press = (type: "pointerdown" | "pointerup", pointerId: number) =>
  window.dispatchEvent(new PointerEvent(type, { pointerId, bubbles: true }));

function sheet(open: boolean, dismissible = true) {
  return (
    <Sheet open={open} onClose={() => {}} title="How many are on?" dismissible={dismissible}>
      30 of 36
    </Sheet>
  );
}

const closedBy = () => document.querySelector("dialog")?.getAttribute("closedby");

describe("a sheet opened in the middle of a press", () => {
  afterEach(() => {
    press("pointerup", 1);
    cleanup();
  });

  it("is not closed by the release of that press, only by a tap that starts after it", () => {
    const view = render(sheet(false));
    press("pointerdown", 1); // the press and hold on a load line
    view.rerender(sheet(true));
    expect(document.querySelector("dialog")?.hasAttribute("open")).toBe(true);
    expect(closedBy()).toBe("closerequest");

    press("pointerup", 1); // the finger lifts: the browser would read this as a tap outside
    expect(closedBy()).toBe("closerequest");

    press("pointerdown", 2); // a fresh tap may close it again
    expect(closedBy()).toBe("any");
    press("pointerup", 2);
  });

  it("closes on a tap outside straight away when it opened after the press ended", () => {
    const view = render(sheet(false));
    view.rerender(sheet(true));
    expect(closedBy()).toBe("any");
  });

  it("never lets a tap outside close a sheet that must stay open", () => {
    const view = render(sheet(false, false));
    view.rerender(sheet(true, false));
    press("pointerdown", 3);
    expect(closedBy()).toBe("none");
    press("pointerup", 3);
  });
});
