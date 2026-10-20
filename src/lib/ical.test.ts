import { describe, expect, it } from "vitest";
import { buildCalendar } from "./ical";

describe("buildCalendar", () => {
  it("escapes text, folds long lines and uses CRLF", () => {
    const ics = buildCalendar("Verein; Test", [
      {
        id: "e1",
        title: "Probe, Saal",
        description: "x".repeat(200),
        location: null,
        startsAt: new Date("2030-01-01T18:00:00Z"),
        endsAt: null,
        createdAt: new Date("2029-01-01T00:00:00Z"),
      },
    ]);
    expect(ics).toContain("X-WR-CALNAME:Verein\\; Test");
    expect(ics).toContain("SUMMARY:Probe\\, Saal");
    expect(ics).toContain("DTSTART:20300101T180000Z");
    expect(ics).toContain("DTEND:20300101T200000Z");
    expect(ics.split("\r\n").every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
});
