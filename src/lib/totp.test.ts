import { describe, expect, it } from "vitest";
import { base32Decode, base32Encode, hotp, otpauthUri, verifyTotp } from "./totp";

// RFC 6238 Appendix B test vectors (8 digits, seed "12345678901234567890" for SHA-1)
const SEED = Buffer.from("12345678901234567890");
const vectors: [number, string][] = [
  [59, "94287082"],
  [1111111109, "07081804"],
  [1111111111, "14050471"],
  [1234567890, "89005924"],
  [2000000000, "69279037"],
  [20000000000, "65353130"],
];

describe("TOTP", () => {
  it("matches the RFC 6238 SHA-1 test vectors", () => {
    for (const [time, code] of vectors) expect(hotp(SEED, Math.floor(time / 30), "sha1", 8)).toBe(code);
  });

  it("round-trips base32", () => {
    expect(base32Encode(SEED)).toBe("GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ");
    expect(base32Decode("gezd gnbv gy3t qojq gezd gnbv gy3t qojq")).toEqual(SEED);
  });

  it("accepts the current and neighbouring step once, never twice", () => {
    const secret = base32Encode(SEED);
    const now = 1_800_000_000_000;
    const step = Math.floor(now / 30_000);
    const code = hotp(SEED, step);
    expect(verifyTotp(secret, code, null, now)).toBe(step);
    expect(verifyTotp(secret, code, step, now)).toBeNull(); // replay
    expect(verifyTotp(secret, hotp(SEED, step - 1), null, now)).toBe(step - 1); // drift
    expect(verifyTotp(secret, hotp(SEED, step - 2), null, now)).toBeNull();
    expect(verifyTotp(secret, "12345", null, now)).toBeNull();
    expect(verifyTotp(secret, "abcdef", null, now)).toBeNull();
  });

  it("builds an otpauth URI authenticator apps understand", () => {
    expect(otpauthUri("SV Tal", "a@b.at", "ABC")).toBe("otpauth://totp/SV%20Tal%3Aa%40b.at?secret=ABC&issuer=SV+Tal&algorithm=SHA1&digits=6&period=30");
  });
});
