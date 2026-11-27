import "server-only";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";
import { open, seal } from "@/lib/secret-box";
import { generateOneTimePassword, ONE_TIME_PASSWORD_DAYS } from "@/lib/one-time-password";

/**
 * Sets a one-time password chosen by the platform: it replaces the current password, signs the person out
 * everywhere and voids open invitation/reset links. The plaintext stays readable (sealed) for the admin
 * console until the first login; the person must then choose their own password.
 */
export async function assignOneTimePassword(userId: string) {
  const password = generateOneTimePassword();
  const expires = new Date(Date.now() + ONE_TIME_PASSWORD_DAYS * 86_400_000);
  await db.$transaction([
    db.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true, oneTimePasswordEnc: seal(password), oneTimePasswordExp: expires },
    }),
    db.session.deleteMany({ where: { userId } }),
    db.token.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  return { password, expires };
}

/** The one-time password as shown in the admin console – only while unused and not expired. */
export function visibleOneTimePassword(user: Pick<User, "oneTimePasswordEnc" | "oneTimePasswordExp">) {
  if (!user.oneTimePasswordEnc || !user.oneTimePasswordExp || user.oneTimePasswordExp < new Date()) return null;
  try {
    return { password: open(user.oneTimePasswordEnc), expires: user.oneTimePasswordExp };
  } catch {
    return null; // APP_SECRET changed: the admin simply creates a new one
  }
}

export function oneTimePasswordExpired(user: Pick<User, "mustChangePassword" | "oneTimePasswordExp">) {
  return user.mustChangePassword && !!user.oneTimePasswordExp && user.oneTimePasswordExp < new Date();
}
