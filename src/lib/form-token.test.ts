import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { checkFormToken, formToken } = await import("./form-token");

describe("form time-trap", () => {
  it("accepts a human-paced submission only", () => {
    const t = formToken(1_000_000);
    expect(checkFormToken(t, 1_000_000 + 10_000)).toBe(true);
    expect(checkFormToken(t, 1_000_000 + 500)).toBe(false); // bot: too fast
    expect(checkFormToken(t, 1_000_000 + 2 * 86_400_000)).toBe(false); // stale
    expect(
      checkFormToken(
        t.replace(/.$/, (c) => (c === "A" ? "B" : "A")),
        1_000_000 + 10_000,
      ),
    ).toBe(false); // forged
    expect(checkFormToken("garbage")).toBe(false);
  });
});
