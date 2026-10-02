import { describe, expect, it } from "vitest";
import { inStorm, playedSummary } from "./model";

const storm = { from: "2026-04-08T05:41:00+05:30", to: "2026-04-08T07:14:00+05:30" };

describe("the story's storm on the driver's phone", () => {
  it("holds from the minute it starts until the minute it ends", () => {
    expect(inStorm(storm, new Date("2026-04-08T05:40:59+05:30"))).toBeNull();
    expect(inStorm(storm, new Date("2026-04-08T05:41:00+05:30"))?.to).toEqual(new Date(storm.to));
    expect(inStorm(storm, new Date("2026-04-08T07:13:59+05:30"))).not.toBeNull();
    expect(inStorm(storm, new Date("2026-04-08T07:14:00+05:30"))).toBeNull();
  });

  it("is nothing for a phone the story never cuts off", () => {
    expect(inStorm(undefined, new Date("2026-04-08T06:00:00+05:30"))).toBeNull();
  });
});

describe("the steps a jump played", () => {
  it("fit one line on a phone and a sentence on a desk", () => {
    expect(playedSummary(1)).toEqual({ short: "1 skipped step", long: "the step" });
    expect(playedSummary(14)).toEqual({ short: "14 skipped steps", long: "the 14 steps" });
  });
});
