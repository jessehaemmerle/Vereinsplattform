import { randomBytes } from "node:crypto";
import { sha256 } from "@/lib/crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o, 1/l/i

/** Ten one-time codes like "k7m2-x9qa". Only their hashes are stored. */
export function generateRecoveryCodes(count = 10) {
  return Array.from({ length: count }, () => {
    const bytes = randomBytes(8);
    const chars = Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
    return `${chars.slice(0, 4)}-${chars.slice(4)}`;
  });
}

export function normalizeRecoveryCode(code: string) {
  return code
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export function hashRecoveryCode(code: string) {
  return sha256(`recovery:${normalizeRecoveryCode(code)}`);
}
