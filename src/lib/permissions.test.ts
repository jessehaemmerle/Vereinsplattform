import { describe, expect, it } from "vitest";
import { can } from "./permissions";

describe("role matrix", () => {
  it("separates duties", () => {
    expect(can("KASSIER", "finance:write")).toBe(true);
    expect(can("KASSIER", "members:write")).toBe(false);
    expect(can("SCHRIFTFUEHRER", "finance:write")).toBe(false);
    expect(can("VORSTAND", "finance:read")).toBe(true);
    expect(can("VORSTAND", "events:write")).toBe(false);
    expect(can("MITGLIED", "members:read")).toBe(false);
    expect(can("ADMIN", "club:manage")).toBe(true);
  });
});

import { neutralize } from "./csv";

describe("csv neutralize", () => {
  it("defuses formulas but keeps negative numbers", () => {
    expect(neutralize("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(neutralize("@SUM")).toBe("'@SUM");
    expect(neutralize("-12,50")).toBe("-12,50");
    expect(neutralize("Max")).toBe("Max");
  });
});
