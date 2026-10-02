import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Contents, OfflineNotice } from "./parts";

afterEach(cleanup);

describe("the store's own phone offline", () => {
  it("shows what Relay knew at the last answer, in scenario time", () => {
    render(<OfflineNotice failed knownAt="2026-04-08T05:20:00+05:30" />);
    expect(screen.getByRole("status")).toHaveTextContent("You're offline. Showing what we knew at 5:20 AM.");
  });

  it("says nothing while the answers keep coming", () => {
    render(<OfflineNotice failed={false} knownAt="2026-04-08T05:20:00+05:30" />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});

describe("contents", () => {
  it("keeps each count with its noun, so the list wraps only between items", () => {
    const { container } = render(
      <Contents
        lines={[
          { name: "Rice and dhal case", qty: 30 },
          { name: "Meat and fish box", qty: 20 },
        ]}
      />,
    );
    expect(container.textContent).toBe("30 rice and dhal cases, 20 meat and fish boxes");
    expect([...container.querySelectorAll(".whitespace-nowrap")].map((s) => s.textContent)).toEqual([
      "30 rice and dhal cases",
      "20 meat and fish boxes",
    ]);
  });
});
