import { randomBytes } from "node:crypto";

/** Unambiguous characters (no 0/O, 1/I) – easy to read out or type from the admin console. */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 characters: byte % 32 is unbiased
export const ONE_TIME_PASSWORD_DAYS = 7;

/** 12 random characters in groups of four (60 bits), e.g. "K7MP-Q4XR-9TWD". */
export function generateOneTimePassword(bytes: Buffer = randomBytes(12)) {
  const chars = [...bytes.subarray(0, 12)].map((b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)].map((g) => g.join("")).join("-");
}
