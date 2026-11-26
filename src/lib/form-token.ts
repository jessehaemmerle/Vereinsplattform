import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Time-trap for public forms without cookies or third-party captchas: the page embeds a signed timestamp;
 * submissions faster than a human could type, or older than a day, are dropped.
 */
function sign(ts: string) {
  return createHmac("sha256", process.env.APP_SECRET ?? "dev-form-token")
    .update(`form:${ts}`)
    .digest("base64url");
}

export function formToken(now = Date.now()) {
  const ts = String(now);
  return `${ts}.${sign(ts)}`;
}

export function checkFormToken(token: string, now = Date.now(), minMs = 3_000, maxMs = 86_400_000) {
  const [ts, mac] = token.split(".");
  if (!ts || !mac) return false;
  const expected = Buffer.from(sign(ts));
  const given = Buffer.from(mac);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return false;
  const age = now - Number(ts);
  return age >= minMs && age <= maxMs;
}
