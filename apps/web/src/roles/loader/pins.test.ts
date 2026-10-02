import { describe, expect, it } from "vitest";
import { telLink } from "./FlagSheet";
import { pinFromHint } from "./LoaderShell";

describe("the demo PIN on the dock's PIN sheets", () => {
  it("reads the PIN from a loader's or a driver's hint", () => {
    expect(pinFromHint("PIN 4826")).toBe("4826");
    expect(pinFromHint("Password relay2026 · PIN 3690")).toBe("3690");
  });

  it("shows nothing for an account without a PIN", () => {
    expect(pinFromHint("Password relay2026")).toBeUndefined();
    expect(pinFromHint(undefined)).toBeUndefined();
  });
});

describe("the dispatch number", () => {
  it("dials the digits as written on the screen", () => {
    expect(telLink("081 000 2145")).toBe("tel:0810002145");
    expect(telLink("(081) 000-2145")).toBe("tel:0810002145");
  });

  it("keeps a leading plus and nothing else that is not a digit", () => {
    expect(telLink(" +94 81 000 2145 ")).toBe("tel:+94810002145");
    expect(telLink("081+000 2145")).toBe("tel:0810002145");
  });
});
