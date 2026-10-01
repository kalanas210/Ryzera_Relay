import { describe, expect, it } from "vitest";
import { calledName } from "@/lib/names";
import { formatWindow, roundTo5 } from "@/lib/time";

describe("names", () => {
  it("uses the name people are called by", () => {
    expect(calledName("Kasun Bandara")).toBe("Kasun");
    expect(calledName("Mohamed Rizwan")).toBe("Rizwan");
    expect(calledName(null)).toBe("");
  });
});

describe("times", () => {
  it("writes a window with AM or PM once when both ends share it", () => {
    expect(formatWindow("04:00", "07:45")).toBe("4:00 to 7:45 AM");
    expect(formatWindow("10:00", "13:00")).toBe("10:00 AM to 1:00 PM");
  });

  it("rounds expected times to 5 minutes for drivers and stores", () => {
    expect(roundTo5("2026-04-08T01:02:00Z").toISOString()).toBe("2026-04-08T01:00:00.000Z");
    expect(roundTo5("2026-04-08T01:03:00Z").toISOString()).toBe("2026-04-08T01:05:00.000Z");
  });
});
