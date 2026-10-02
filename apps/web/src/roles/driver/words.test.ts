import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { useDriverText } from "./words";

const DAY = "2026-04-08";
const at = (clock: string) => new Date(`${DAY}T${clock}:00+05:30`).toISOString();

async function textIn(lang: "en" | "si" | "ta") {
  await act(() => i18n.changeLanguage(lang));
  return renderHook(() => useDriverText()).result.current;
}

afterEach(async () => {
  await act(() => i18n.changeLanguage("en"));
});

describe("the driver's words", () => {
  it("writes going to a place the way each language joins its ending to the name", async () => {
    let w = await textIn("ta");
    // the degradation spec's own string: "... அதே ஆர்டரை அரநாயக்கவுக்கு கொண்டு செல்கிறார்."
    const body = w.t("question.bodyDriver", {
      name: "Nuwan",
      n: 4,
      vehicle: "VEH060",
      who: "Nimal",
      time: w.clock(at("06:15")),
      placeTo: w.placeTo("Aranayake"),
    });
    expect(body).toContain("அதே ஆர்டரை அரநாயக்கவுக்கு கொண்டு செல்கிறார்.");
    // a place Relay has no Tamil for keeps its Latin name, with the ending set apart
    expect(w.placeTo("Ambepussa")).toBe("Ambepussa க்கு");

    w = await textIn("si");
    expect(w.placeTo("Aranayake")).toBe("අරනායකට");
    w = await textIn("en");
    expect(w.placeTo("Aranayake")).toBe("to Aranayake");
  });

  it("says when Relay's expected time has gone by on the clock", async () => {
    const w = await textIn("en");
    const stop = { status: "pending" as const, expected: at("05:04") };
    expect(w.expectedAt(stop, new Date(at("04:50")))).toBe("around 5:05 AM");
    expect(w.expectedAt(stop, new Date(at("05:20")))).toBe("around 5:05 AM, now passed");
    // offline the phone still runs on its own clock, and an arrived stop is no longer expected
    expect(w.expectedAt({ ...stop, status: "arrived" }, new Date(at("05:20")))).toBe("around 5:05 AM");
  });
});
