import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));
const { dueReminder } = await import("./reminders");

describe("dueReminder", () => {
  it("sends each threshold once", () => {
    expect(dueReminder(40, [])).toBeNull();
    expect(dueReminder(30, [])).toEqual({ send: 30, markSent: [30] });
    expect(dueReminder(20, [30])).toBeNull();
    expect(dueReminder(7, [30])).toEqual({ send: 7, markSent: [7] });
    expect(dueReminder(1, [30, 7])).toEqual({ send: 1, markSent: [1] });
    expect(dueReminder(0, [30, 7, 1])).toBeNull();
  });
  it("collapses missed thresholds into one mail", () => {
    expect(dueReminder(5, [])).toEqual({ send: 7, markSent: [30, 7] });
  });
  it("stays quiet after expiry", () => {
    expect(dueReminder(-1, [])).toBeNull();
  });
});
