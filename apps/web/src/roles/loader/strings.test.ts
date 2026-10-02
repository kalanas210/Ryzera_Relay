import { describe, expect, it } from "vitest";
import { i18n } from "@/i18n";
import { loader } from "@/i18n/loader";

function flatten(value: unknown, path = ""): [string, string][] {
  if (typeof value === "string") return [[path, value]];
  return Object.entries(value as Record<string, unknown>).flatMap(([key, inner]) =>
    flatten(inner, path ? `${path}.${key}` : key),
  );
}

describe("the loader's strings", () => {
  it("never use a long dash or an arrow, in any language", () => {
    for (const lang of ["en", "si", "ta"] as const) {
      const bad = flatten(loader[lang]).filter(([, text]) => /[\u2013\u2014\u2190-\u21ff]/.test(text));
      expect(bad).toEqual([]);
    }
  });

  it("say a truck is late in the past tense once its time to leave has gone", async () => {
    for (const lang of ["en", "si", "ta"]) {
      await i18n.changeLanguage(lang);
      const text = i18n.t("load.dueToLeave", { ns: "loader", vehicle: "VEH055", time: "5:45 AM", name: "Nuwan" });
      expect(text).toContain("VEH055");
      expect(text).toContain("Nuwan");
    }
    await i18n.changeLanguage("en");
    expect(i18n.t("load.dueToLeave", { ns: "loader", vehicle: "VEH055", time: "5:45 AM", name: "Nuwan" })).toBe(
      "VEH055 was due to leave at 5:45 AM. Call Nuwan now.",
    );
  });

  it("word the dispatcher's decision for damaged cases as cases kept off the truck", () => {
    expect(i18n.t("flag.infoDamaged", { ns: "loader", name: "Nuwan Perera", n: 1 })).toBe(
      "Keep loading. Nuwan Perera, the dispatcher on duty, sees this straight away and decides about the 1 kept off the truck.",
    );
  });
});
