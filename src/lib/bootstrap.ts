import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth";

/** Creates or updates the platform admin configured via environment variables. */
export async function ensureDefaultAdmin() {
  const email = process.env.DEFAULT_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.DEFAULT_ADMIN_PASSWORD;
  if (!email || !password) return;
  if (password.length < 12) {
    console.warn("[bootstrap] DEFAULT_ADMIN_PASSWORD muss mindestens 12 Zeichen haben – Standard-Admin wird nicht angelegt.");
    return;
  }
  const name = process.env.DEFAULT_ADMIN_NAME?.trim() || "Plattform-Admin";
  const existing = await db.user.findUnique({ where: { email } });
  const passwordHash = await hashPassword(password);
  if (existing) {
    await db.user.update({ where: { id: existing.id }, data: { isPlatformAdmin: true, name, passwordHash } });
  } else {
    await db.user.create({ data: { email, name, passwordHash, isPlatformAdmin: true, role: "ADMIN" } });
    console.info(`[bootstrap] Standard-Admin ${email} angelegt.`);
  }
}
