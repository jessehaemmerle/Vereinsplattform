import { describe, expect, it } from "vitest";
import { fromDateTimeInput, toDateTimeInput, viennaDateString } from "./format";
import { parseAmount, parseFlexibleDate } from "./member-csv";

describe("Vienna time handling", () => {
  it("converts local input to the right instant, also around DST changes", () => {
    expect(fromDateTimeInput("2026-07-01T10:00").toISOString()).toBe("2026-07-01T08:00:00.000Z");
    expect(fromDateTimeInput("2026-01-15T10:00").toISOString()).toBe("2026-01-15T09:00:00.000Z");
    expect(fromDateTimeInput("2026-03-29T01:30").toISOString()).toBe("2026-03-29T00:30:00.000Z");
    expect(toDateTimeInput(new Date("2026-07-01T08:00:00Z"))).toBe("2026-07-01T10:00");
  });

  it("uses the Vienna calendar day", () => {
    expect(viennaDateString(new Date("2026-12-31T23:30:00Z"))).toBe("2027-01-01");
  });
});

describe("CSV value parsing", () => {
  it("rejects impossible dates and reads thousands separators", () => {
    expect(parseFlexibleDate("31.02.2024")).toBeNull();
    expect(parseAmount("1.000")).toBe(1000);
    expect(parseAmount("1.5")).toBe(1.5);
  });
});
