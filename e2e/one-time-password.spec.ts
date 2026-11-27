import { test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { ADMIN, expect, login, useAdminSession } from "./helpers";

// First club admin with a one-time password shown in the admin console (no e-mail needed).
const db = new PrismaClient();
const BASE = process.env.E2E_BASE_DOMAIN ?? "localhost:3000";
const PROTO = process.env.E2E_PROTOCOL ?? "http";

test.afterAll(() => db.$disconnect());

test("Erster Admin: Einmal-Passwort in der Konsole, Anmeldung erzwingt eigenes Passwort", async ({ page, browser }) => {
  const stamp = Date.now();
  const slug = `otp-${stamp}`;
  const email = `otp${stamp}@demo.at`;
  const club = `${PROTO}://${slug}.${BASE}`;

  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin/vereine/neu`);
  await page.getByLabel("Vereinsname").fill(`Einmal ${stamp}`);
  await page.getByLabel("Subdomain").fill(slug);
  await page.getByLabel("Name", { exact: true }).fill("Olga Otp");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Einmal-Passwort").check();
  await page.getByRole("button", { name: "Verein anlegen" }).click();
  await expect(page.getByText("Das Einmal-Passwort für den Vereins-Admin steht unten")).toBeVisible();
  const password = (await page.getByTestId("one-time-password").textContent())!.trim();
  expect(password).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/);
  await page.screenshot({ path: "test-results/one-time-password.png", fullPage: true });

  // first login: only the password change is reachable, server actions included
  const admin = await (await browser.newContext()).newPage();
  await login(admin, club, email, password);
  await expect(admin).toHaveURL(/\/passwort-aendern$/);
  await admin.goto(`${club}/mitglieder`);
  await expect(admin).toHaveURL(/\/passwort-aendern$/);
  await admin.getByLabel("Neues Passwort").fill(password);
  await admin.getByLabel("Passwort wiederholen").fill(password);
  await admin.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(admin.getByText("Bitte ein eigenes, neues Passwort wählen.")).toBeVisible();
  await admin.getByLabel("Neues Passwort").fill("mein-eigenes-passwort-1");
  await admin.getByLabel("Passwort wiederholen").fill("mein-eigenes-passwort-1");
  await admin.getByRole("button", { name: "Passwort speichern" }).click();
  await expect(admin.getByText("Passwort gespeichert. Ab jetzt meldest du dich damit an.")).toBeVisible();
  await expect(admin).toHaveURL(/\/dashboard$/);

  // the console no longer shows it, the one-time password no longer works
  await page.reload();
  await expect(page.getByTestId("one-time-password")).toHaveCount(0);
  const again = await (await browser.newContext()).newPage();
  await login(again, club, email, password, false);
  await expect(again.getByText("E-Mail oder Passwort stimmen nicht.")).toBeVisible();
  await login(again, club, email, "mein-eigenes-passwort-1");
  await expect(again).toHaveURL(/\/dashboard$/);
});

test("Abgelaufenes Einmal-Passwort wird abgelehnt", async ({ page, browser }) => {
  const stamp = Date.now();
  const slug = `otp-alt-${stamp}`;
  const email = `otpalt${stamp}@demo.at`;
  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin/vereine/neu`);
  await page.getByLabel("Vereinsname").fill(`Einmal alt ${stamp}`);
  await page.getByLabel("Subdomain").fill(slug);
  await page.getByLabel("Name", { exact: true }).fill("Otto Alt");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Einmal-Passwort").check();
  await page.getByRole("button", { name: "Verein anlegen" }).click();
  const password = (await page.getByTestId("one-time-password").textContent())!.trim();
  await db.user.update({ where: { email }, data: { oneTimePasswordExp: new Date(Date.now() - 60_000) } });

  await page.reload();
  await expect(page.getByText("Einmal-Passwort abgelaufen")).toBeVisible();
  const admin = await (await browser.newContext()).newPage();
  await login(admin, `${PROTO}://${slug}.${BASE}`, email, password, false);
  await expect(admin.getByText("Dieses Einmal-Passwort ist abgelaufen.")).toBeVisible();
});
