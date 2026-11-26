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
  if (existing) {
    // the password from .env is only a starting value; reapplying it on every start would undo changes made in the UI
    const reset = process.env.DEFAULT_ADMIN_RESET_PASSWORD === "true";
    await db.user.update({
      where: { id: existing.id },
      data: { isPlatformAdmin: true, name, ...(reset ? { passwordHash: await hashPassword(password) } : {}) },
    });
    if (reset) {
      await db.session.deleteMany({ where: { userId: existing.id } });
      console.warn(`[bootstrap] Passwort von ${email} aus DEFAULT_ADMIN_PASSWORD zurückgesetzt – DEFAULT_ADMIN_RESET_PASSWORD wieder entfernen.`);
    }
  } else {
    await db.user.create({ data: { email, name, passwordHash: await hashPassword(password), isPlatformAdmin: true, role: "ADMIN" } });
    console.info(`[bootstrap] Standard-Admin ${email} angelegt.`);
  }
}
