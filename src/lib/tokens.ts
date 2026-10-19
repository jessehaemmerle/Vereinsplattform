import "server-only";
import type { TokenPurpose } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";

const LIFETIME_HOURS: Record<TokenPurpose, number> = {
  PASSWORD_SETUP: 24 * 7,
  PASSWORD_RESET: 2,
  MEMBER_ACTIVATION: 24 * 3,
};

export async function issueToken(userId: string, purpose: TokenPurpose) {
  const token = randomToken();
  await db.token.deleteMany({ where: { userId, purpose, usedAt: null } });
  await db.token.create({
    data: {
      tokenHash: sha256(token),
      userId,
      purpose,
      expiresAt: new Date(Date.now() + LIFETIME_HOURS[purpose] * 3_600_000),
    },
  });
  return token;
}

export async function findValidToken(token: string) {
  const row = await db.token.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  return row;
}

export function appUrl(path: string) {
  const base = (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}
