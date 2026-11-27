import { describe, expect, it } from "vitest";
import { generateOneTimePassword } from "./one-time-password";

describe("generateOneTimePassword", () => {
  it("has three groups of four unambiguous characters", () => {
    for (let i = 0; i < 50; i++) expect(generateOneTimePassword()).toMatch(/^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  });
  it("maps every byte value onto the alphabet without bias", () => {
    const pw = generateOneTimePassword(Buffer.from([0, 31, 32, 255, 1, 2, 3, 4, 5, 6, 7, 8]));
    expect(pw).toBe("A9A9-BCDE-FGHJ");
  });
  it("differs between calls", () => {
    expect(new Set(Array.from({ length: 20 }, () => generateOneTimePassword())).size).toBe(20);
  });
});
