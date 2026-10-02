import { describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { colomboDay, shortDate, weekdayName } from "./days";

const en = i18n.getFixedT("en", "loader");
const si = i18n.getFixedT("si", "loader");
const ta = i18n.getFixedT("ta", "loader");

describe("days on the dock", () => {
  it("reads a plain date as that day in Sri Lanka", () => {
    expect(colomboDay("2026-04-09")).toEqual({ weekday: 4, day: 9, month: 3 });
  });

  it("reads a time as the day it is in Colombo, not in UTC", () => {
    // 3:40 AM on Wednesday in Colombo is still Tuesday evening in UTC
    expect(colomboDay("2026-04-07T22:10:00Z")).toEqual({ weekday: 3, day: 8, month: 3 });
    expect(colomboDay(new Date("2026-04-07T18:29:00Z")).weekday).toBe(2);
    expect(colomboDay(new Date("2026-04-07T18:30:00Z")).weekday).toBe(3);
  });

  it("names the day in each language from the loader's own strings, never the browser's", () => {
    expect(weekdayName(en, "2026-04-09")).toBe("Thursday");
    expect(weekdayName(si, "2026-04-09")).toBe("බ්‍රහස්පතින්දා");
    expect(weekdayName(ta, "2026-04-09")).toBe("வியாழன்");
    expect(weekdayName(si, "2026-04-07T22:10:00Z")).toBe("බදාදා");
  });

  it("writes the short date the way each language does", () => {
    expect(shortDate(en, "2026-04-08")).toBe("Wed 8 Apr");
    expect(shortDate(si, "2026-04-08")).toBe("අප්‍රේල් 8, බදාදා");
    expect(shortDate(ta, "2026-04-08")).toBe("புதன், 8 ஏப்ரல்");
  });

  it("has every day and month in every language", () => {
    for (const t of [en, si, ta]) {
      for (let weekday = 0; weekday < 7; weekday++) {
        expect(t(`dates.weekdays.${weekday}`)).not.toContain("dates.");
        expect(t(`dates.weekdaysShort.${weekday}`)).not.toContain("dates.");
      }
      for (let month = 0; month < 12; month++) expect(t(`dates.months.${month}`)).not.toContain("dates.");
    }
  });
});
