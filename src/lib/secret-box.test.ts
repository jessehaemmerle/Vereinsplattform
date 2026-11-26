import { describe, expect, it } from "vitest";
import { open, seal } from "./secret-box";
import { generateRecoveryCodes, hashRecoveryCode } from "./recovery-codes";

describe("secret box", () => {
  it("round-trips and detects tampering", () => {
    process.env.APP_SECRET = "x".repeat(40);
    const sealed = seal("JBSWY3DPEHPK3PXP");
    expect(sealed).not.toContain("JBSWY3DP");
    expect(open(sealed)).toBe("JBSWY3DPEHPK3PXP");
    const parts = sealed.split(".");
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith("AA") ? "BB" : "AA");
    expect(() => open(parts.join("."))).toThrow();
    process.env.APP_SECRET = "y".repeat(40);
    expect(() => open(sealed)).toThrow(); // other key
  });
});

describe("recovery codes", () => {
  it("are unique and hash independent of formatting", () => {
    const codes = generateRecoveryCodes();
    expect(new Set(codes).size).toBe(10);
    expect(codes[0]).toMatch(/^[a-z2-9]{4}-[a-z2-9]{4}$/);
    expect(hashRecoveryCode(codes[0].toUpperCase().replace("-", " "))).toBe(hashRecoveryCode(codes[0]));
  });
});
