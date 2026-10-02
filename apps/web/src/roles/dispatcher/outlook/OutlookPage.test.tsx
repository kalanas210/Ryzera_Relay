import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { BusiestDay, Outlook, OutlookDay, OutlookWeek } from "./api";
import { OutlookGrid } from "./OutlookPage";

function day(date: string, needed: number, available: number, more: Partial<OutlookDay> = {}): OutlookDay {
  return {
    date,
    chilled_orders: 23,
    chilled_kg: 6000,
    chilled_m3: 32,
    needed,
    available,
    in_workshop: [],
    state: needed > available ? "over" : available - needed <= 1 ? "limit" : "within",
    from_order_book: false,
    waits: 0,
    served_one_fewer: 22,
    ...more,
  };
}

function week(iso_week: number, first_day: string, last_day: string, days: OutlookDay[], busiest: BusiestDay) {
  return {
    iso_year: 2026,
    iso_week,
    first_day,
    last_day,
    open_days: days.length,
    chip: null,
    lines: [],
    demand: { chilled: 188.6, dry: 333.5, style: 80.4, tech: 18.2, all: 620.7 },
    chilled_limit_m3: 730,
    chilled_pct: 25.8,
    busiest,
    days,
  } satisfies OutlookWeek;
}

// week 15 as drawn: 6 needed with 5 in service, two in the workshop; week 16: 6 of 7, the seventh the standby
const run = day("2026-04-08", 6, 5, { in_workshop: ["VEH039", "VEH058"], from_order_book: true, waits: 1 });
const ahead = day("2026-04-15", 6, 7);
const outlook: Outlook = {
  depot: "Kandy",
  depot_label: "Kandy hub",
  now: "2026-04-07T18:45:00+05:30",
  run_date: "2026-04-08",
  forecast_updated: "2026-04-06",
  fleet: 7,
  weeks: [
    week(15, "2026-04-06", "2026-04-12", [day("2026-04-07", 4, 5), run], {
      ...run,
      segments: { filled: 5, short: 1, standby: 0, workshop: 1 },
      headline: false,
    }),
    week(16, "2026-04-13", "2026-04-19", [ahead, day("2026-04-16", 5, 7)], {
      ...ahead,
      segments: { filled: 6, short: 0, standby: 1, workshop: 0 },
      headline: true,
    }),
  ],
  headline: { date: "2026-04-15", needed: 6, available: 7, state: "limit", title: "", detail: "", support: "" },
  key_figures: [],
  arrange: [],
  notes: [],
  method: [],
  labels: { fleet: "Against the Kandy hub's refrigerated fleet", vehicles: "", day: "", tech: "" },
  empty: null,
};

const meters = () => screen.getAllByRole("img").map((meter) => [...meter.children].map((s) => s.className));
const count = (segments: string[], fill: string) => segments.filter((c) => c.split(" ").includes(fill)).length;
const shown = () => screen.queryAllByRole("tooltip").map((t) => t.textContent?.match(/^Week \d+/)?.[0]);
const header = (n: number) => screen.getByRole("button", { name: new RegExp(`^Week ${n}`) });

describe("the outlook grid", () => {
  afterEach(cleanup);

  it("draws one segment per refrigerated vehicle", () => {
    render(<OutlookGrid data={outlook} />);
    const [over, limit] = meters();

    expect(over).toHaveLength(7);
    expect([count(over!, "bg-problem"), count(over!, "bg-problem-soft"), count(over!, "bg-asphalt-100")]).toEqual([
      5, 1, 1,
    ]);
    expect([count(limit!, "bg-attention"), count(limit!, "bg-white")]).toEqual([6, 1]);
    expect(screen.getAllByRole("img").map((m) => m.getAttribute("aria-label"))).toEqual([
      "6 needed, 5 in service, 1 short, 2 in the workshop",
      "6 needed, 7 in service, 1 on standby",
    ]);
  });

  it("shows one week's days at a time, from the keyboard or the pointer", () => {
    render(<OutlookGrid data={outlook} />);
    expect(shown()).toEqual([]);

    act(() => header(15).focus());
    expect(shown()).toEqual(["Week 15"]);

    fireEvent.mouseEnter(header(16).parentElement!);
    expect(shown()).toEqual(["Week 16"]);
    fireEvent.mouseLeave(header(16).parentElement!);
    expect(shown()).toEqual(["Week 15"]);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(shown()).toEqual([]);
    expect(header(15)).toHaveFocus();
  });

  it("names the busiest day in each row's label", () => {
    render(<OutlookGrid data={outlook} />);
    act(() => header(16).focus());

    // label queries read a no-break space as a plain one
    expect(screen.getByLabelText(/^Wed 15 Apr:/).getAttribute("aria-label")).toContain(", the busiest day this week.");
    expect(screen.getByLabelText(/^Thu 16 Apr:/).getAttribute("aria-label")).not.toContain("busiest");
  });
});
