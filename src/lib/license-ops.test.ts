import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
const { extendedUntil } = await import("./license-ops");

const d = (s: string) => new Date(`${s}T00:00:00Z`);

describe("extendedUntil", () => {
  it("extends from the current end while the license is still running", () => {
    expect(extendedUntil(d("2027-03-15"), 12, d("2026-11-26")).toISOString().slice(0, 10)).toBe("2028-03-15");
  });
  it("extends from today when the license already expired", () => {
    expect(extendedUntil(d("2026-01-01"), 12, d("2026-11-26")).toISOString().slice(0, 10)).toBe("2027-11-26");
  });
  it("clamps month ends", () => {
    expect(extendedUntil(d("2027-01-31"), 1, d("2026-11-26")).toISOString().slice(0, 10)).toBe("2027-02-28");
  });
});
