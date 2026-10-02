import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { api } from "@/api/client";
import type { Account } from "@/api/types";
import { SignIn } from "./SignIn";

const accounts: Account[] = [
  {
    username: "dilani",
    display_name: "Dilani Jayawardena",
    role: "store_manager",
    detail: "OUT117 Waypoint Fresh Hemmathagama",
    uses_pin: false,
    hint: "Password relay2026",
  },
  {
    username: "rizwan",
    display_name: "Mohamed Rizwan",
    role: "loader",
    detail: "Kandy hub dock",
    uses_pin: true,
    hint: "PIN 2580",
  },
];

function show() {
  vi.spyOn(api, "get").mockImplementation((path: string) =>
    path === "/api/auth/accounts" ? Promise.resolve(accounts as never) : Promise.reject(new Error("not in this test")),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/signin"]}>
        <SignIn />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("signing in", () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  it("brings the chosen role's sign-in into view, ready for the password", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    show();
    fireEvent.click(await screen.findByRole("button", { name: /^Store manager/ }));
    expect(scrolled).toHaveBeenCalledWith({ block: "nearest" });
    expect(screen.getByLabelText("Password")).toHaveFocus();
  });

  it("brings the PIN pad into view for a loader without focusing a field", async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    show();
    fireEvent.click(await screen.findByRole("button", { name: /^Loader/ }));
    expect(scrolled).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText("Password")).toBeNull();
  });
});
