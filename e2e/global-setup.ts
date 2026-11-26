import { chromium, type FullConfig } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { mkdirSync, writeFileSync } from "node:fs";
import { ADMIN, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_STATE, enrollTotp } from "./helpers";

/**
 * Platform admins must use MFA. Reset the test admin's factors, sign in once, enrol TOTP and keep the
 * session for all admin tests (a code may only be used once, so we do not log in per test).
 */
export default async function globalSetup(config: FullConfig) {
  if (process.env.MAILPIT_URL) return; // the docker onboarding run signs in itself
  const db = new PrismaClient();
  const admin = await db.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (admin) {
    await db.passkey.deleteMany({ where: { userId: admin.id } });
    await db.user.update({ where: { id: admin.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryHashes: [] } });
    await db.session.deleteMany({ where: { userId: admin.id } });
  }
  await db.$disconnect();

  const executablePath = process.env.PW_CHROMIUM || undefined;
  const browser = await chromium.launch({ executablePath });
  const page = await browser.newPage({ ignoreHTTPSErrors: true });
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel("E-Mail").fill(ADMIN_EMAIL);
  await page.getByLabel("Passwort").fill(ADMIN_PASSWORD);
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL(`${ADMIN}/sicherheit`);
  const secret = await enrollTotp(page);
  mkdirSync("e2e/.auth", { recursive: true });
  writeFileSync("e2e/.auth/admin-totp.txt", secret);
  await page.context().storageState({ path: ADMIN_STATE });
  await browser.close();
  void config;
}
