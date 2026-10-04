import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
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

function show(names: Promise<Account[]> = Promise.resolve(accounts), entry = "/signin") {
  vi.spyOn(api, "get").mockImplementation((path: string) =>
    path === "/api/auth/accounts" ? (names as Promise<never>) : Promise.reject(new Error("not in this test")),
  );
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
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

  it("says in brackets which device each role is built for", async () => {
    show();
    const devices: Record<string, string> = {
      "Store manager": "use mobile phone",
      Dispatcher: "use desktop",
      Loader: "use mobile phone or tablet",
      Driver: "use mobile phone",
    };
    for (const [title, device] of Object.entries(devices)) {
      expect(await screen.findByRole("button", { name: new RegExp(`^${title} \\(${device}\\)`) })).toBeInTheDocument();
    }
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

  it("keeps the PIN keys off, and says why, until the loaders' names are in", async () => {
    let arrive: (list: Account[]) => void = () => {};
    show(new Promise((resolve) => (arrive = resolve)), "/signin?role=loader");
    expect(screen.getByText("Loading the names. The keys work once a name is picked.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "2" })).toBeDisabled();

    act(() => arrive(accounts));
    expect(await screen.findByRole("button", { name: /Rizwan$/ })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Demo account. PIN 2580")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "2" }));
    expect(screen.getByRole("img", { name: "1 of 4 digits entered" })).toBeInTheDocument();
  });
});
