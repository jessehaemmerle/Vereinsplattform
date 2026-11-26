import { afterEach, describe, expect, it, vi } from "vitest";
import { bucketCount, isLimited, rateLimit } from "./rate-limit";

afterEach(() => vi.useRealTimers());

describe("rateLimit", () => {
  it("limits per window and forgets expired entries", () => {
    vi.useFakeTimers({ now: 10_000_000 });
    for (let i = 0; i < 3; i++) expect(rateLimit("ip:1.2.3.4", 3, 60_000)).toBe(true);
    expect(rateLimit("ip:1.2.3.4", 3, 60_000)).toBe(false);
    expect(isLimited("ip:1.2.3.4", 3)).toBe(true);
    vi.setSystemTime(10_000_000 + 2 * 3_600_000);
    rateLimit("other", 3, 60_000); // triggers the sweep
    expect(isLimited("ip:1.2.3.4", 3)).toBe(false);
    expect(bucketCount()).toBe(1);
  });
});
