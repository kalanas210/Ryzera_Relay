import { describe, expect, it } from "vitest";
import { NBSP, ordersCaption, shortDay, weekRange } from "./format";

/** The page keeps ranges and dates on one line with no-break spaces; the tests read them as plain spaces. */
const plain = (text: string) => text.replaceAll(NBSP, " ");

describe("outlook dates", () => {
  it("writes a week inside one month with the month once", () => {
    expect(plain(weekRange("2026-04-06", "2026-04-12"))).toBe("6 to 12 Apr");
    expect(plain(weekRange("2026-05-11", "2026-05-17"))).toBe("11 to 17 May");
  });

  it("names both months when a week crosses into the next", () => {
    expect(plain(weekRange("2026-04-27", "2026-05-03"))).toBe("27 Apr to 3 May");
    expect(plain(weekRange("2026-12-28", "2027-01-03"))).toBe("28 Dec to 3 Jan");
  });

  it("keeps a range on one line", () => {
    expect(weekRange("2026-04-27", "2026-05-03")).not.toContain(" ");
  });

  it("writes a day with its weekday, whatever the device's time zone", () => {
    expect(plain(shortDay("2026-04-08"))).toBe("Wed 8 Apr");
    expect(plain(shortDay("2026-05-13"))).toBe("Wed 13 May");
    expect(plain(shortDay("2026-04-11"))).toBe("Sat 11 Apr");
  });
});

describe("the chilled orders caption", () => {
  it("says how many orders the day carries and how many wait", () => {
    expect(ordersCaption(23, 1)).toBe("23 orders, 1 waits");
    expect(ordersCaption(23, 2)).toBe("23 orders, 2 wait");
    expect(ordersCaption(23, 0)).toBe("23 orders");
    expect(ordersCaption(1, 0)).toBe("1 order");
  });

  it("marks the headline day", () => {
    expect(ordersCaption(23, 0, true)).toBe("23 orders, heaviest");
  });
});
