import { describe, expect, it } from "vitest";
import {
  abbreviateIdentifier,
  formatDateTime,
  formatPercentPair,
  formatRelative,
  pluralize,
  toDateTimeLocalValue,
} from "@/lib/format";

describe("pluralize", () => {
  it("uses the singular only for exactly one", () => {
    expect(pluralize(0, "vote")).toBe("0 votes");
    expect(pluralize(1, "vote")).toBe("1 vote");
    expect(pluralize(2, "vote")).toBe("2 votes");
  });

  it("accepts an irregular plural", () => {
    expect(pluralize(3, "entry", "entries")).toBe("3 entries");
  });
});

describe("formatPercentPair", () => {
  it("returns zeros when nothing has been counted", () => {
    expect(formatPercentPair(0, 0)).toEqual([0, 0]);
  });

  it("always sums to 100 and never shows 50/50 for an uneven split", () => {
    expect(formatPercentPair(1, 2)).toEqual([33, 67]);
    expect(formatPercentPair(2, 1)).toEqual([67, 33]);
    expect(formatPercentPair(1, 1)).toEqual([50, 50]);
    expect(formatPercentPair(5, 0)).toEqual([100, 0]);
    for (let a = 0; a < 20; a++) {
      for (let b = 0; b < 20; b++) {
        if (a + b === 0) continue;
        const [x, y] = formatPercentPair(a, b);
        expect(x + y).toBe(100);
      }
    }
  });
});

describe("dates", () => {
  it("formats an absolute time with a timezone name", () => {
    const text = formatDateTime("2026-07-13T12:00:00.000Z");
    expect(text).toMatch(/2026/);
    // Some zone abbreviation or offset is always present.
    expect(text).toMatch(/[A-Z]{2,5}|GMT|UTC|[+-]\d/);
  });

  it("formats invalid input without throwing", () => {
    expect(formatDateTime("not a date")).toBe("Unknown date");
    expect(formatRelative("not a date")).toBe("");
  });

  it("produces a local datetime-local value, not UTC", () => {
    const date = new Date(2026, 6, 13, 9, 5);
    expect(toDateTimeLocalValue(date)).toBe("2026-07-13T09:05");
  });
});

describe("abbreviateIdentifier", () => {
  it("keeps short values intact and shortens long ones from the middle", () => {
    expect(abbreviateIdentifier("abc")).toBe("abc");
    expect(abbreviateIdentifier("0x1234567890abcdef", 4)).toBe("0x12…cdef");
  });
});
