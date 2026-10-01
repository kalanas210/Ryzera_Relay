import { describe, expect, it } from "vitest";
import { clockIn, i18n, shortDayIn, weekdayIn } from "@/i18n";

describe("clock times in each language", () => {
  const dawn = "2026-04-07T22:10:00Z"; // 3:40 AM in Colombo
  const night = "2026-04-07T15:42:00Z"; // 9:12 PM in Colombo

  it("writes English with AM and PM after the time", () => {
    expect(clockIn("en", dawn)).toBe("3:40 AM");
    expect(clockIn("en", night)).toBe("9:12 PM");
  });

  it("writes Sinhala with the day part first, as the design's strings do", () => {
    expect(clockIn("si", dawn)).toBe("පෙ.ව. 3:40");
    expect(clockIn("si", night)).toBe("ප.ව. 9:12");
  });

  it("writes Tamil with the part of the day first", () => {
    expect(clockIn("ta", dawn)).toBe("காலை 3:40");
    expect(clockIn("ta", night)).toBe("இரவு 9:12");
  });

  it("reads a plain date as that day in Sri Lanka", () => {
    expect(weekdayIn("en", "2026-04-09")).toBe("Thursday");
    expect(shortDayIn("en", "2026-04-08")).toBe("Wed 8 Apr");
  });
});

describe("loader strings", () => {
  it("counts in each language with the number where each language puts it", async () => {
    await i18n.changeLanguage("en");
    expect(i18n.t("load.progress", { ns: "loader", loaded: 116, total: 383 })).toBe("116 of 383 cases loaded");
    await i18n.changeLanguage("ta");
    expect(i18n.t("load.progress", { ns: "loader", loaded: 116, total: 383 })).toBe("383 பெட்டிகளில் 116 ஏற்றப்பட்டன");
    await i18n.changeLanguage("si");
    expect(i18n.t("load.progress", { ns: "loader", loaded: 116, total: 383 })).toBe("පෙට්ටි 383න් 116ක් පටවා ඇත");
    await i18n.changeLanguage("en");
  });

  it("uses plural forms for counts", () => {
    expect(i18n.t("tonight.stops", { ns: "loader", count: 1 })).toBe("1 stop");
    expect(i18n.t("tonight.stops", { ns: "loader", count: 4 })).toBe("4 stops");
  });
});
