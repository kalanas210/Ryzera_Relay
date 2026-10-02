import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { PinMessage } from "./LoaderShell";

beforeAll(async () => {
  await i18n.changeLanguage("en");
});

afterEach(cleanup);

const shown = (text: string) => !screen.getByText(text).closest(".invisible");

describe("the line under the PIN dots", () => {
  const note = "Each loader's language comes back when they sign in.";
  const wrong = "That PIN did not match. Try again.";

  it("keeps the room of every message it may show, whichever one shows", () => {
    render(<PinMessage note={note} error={null} />);
    expect(shown(note)).toBe(true);
    // laid out unseen, so a wrong PIN arriving never moves the keys below
    expect(shown(wrong)).toBe(false);
    expect(shown("No connection. Check the Wi-Fi and try again.")).toBe(false);
  });

  it("shows what went wrong in place of the note, and keeps it laid out once the next digit clears it", () => {
    const failure = { text: "Could not sign in. The server is busy.", wrongPin: false, shown: true };
    const view = render(<PinMessage note={note} error={failure} />);
    expect(shown(failure.text)).toBe(true);
    expect(shown(note)).toBe(false);

    view.rerender(<PinMessage note={note} error={{ ...failure, shown: false }} />);
    expect(shown(note)).toBe(true);
    expect(shown(failure.text)).toBe(false);
  });
});
