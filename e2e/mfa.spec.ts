import { test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { CLUB, PASSWORD, browserFetch, enrollTotp, expect, login, totpCode } from "./helpers";

// Two-factor login. Requires the demo seed. Resets the touched accounts directly in the database afterwards.
test.use({ baseURL: CLUB });
const db = new PrismaClient();
const ACCOUNTS = ["mitglied@demo.at", "obfrau@demo.at", "kassier@demo.at"];

async function resetAccounts() {
  const users = await db.user.findMany({ where: { email: { in: ACCOUNTS } } });
  for (const u of users) {
    await db.passkey.deleteMany({ where: { userId: u.id } });
    await db.user.update({ where: { id: u.id }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryHashes: [] } });
  }
  await db.club.updateMany({ where: { slug: "musikverein-gruenbach" }, data: { mfaPolicy: "OPTIONAL" } });
}
test.beforeAll(resetAccounts);
test.afterAll(async () => {
  await resetAccounts();
  await db.$disconnect();
});

async function logout(page: Page) {
  await page.getByRole("button", { name: "Abmelden" }).click();
  await page.waitForURL(/\/login$/);
}

async function passwordStep(page: Page, email: string) {
  await login(page, CLUB, email, PASSWORD, false);
  await page.waitForURL(/\/login\/mfa/);
}

test("Authenticator-App: einrichten, falscher Code, richtiger Code, Wiederherstellungscode", async ({ page }) => {
  await login(page, CLUB, "mitglied@demo.at");
  await page.goto("/sicherheit");
  const secret = await enrollTotp(page);
  const codes = await page.getByRole("list", { name: "Wiederherstellungscodes" }).locator("li").allTextContents();
  expect(codes).toHaveLength(10);
  await page.screenshot({ path: "test-results/mfa-setup.png", fullPage: true });
  await logout(page);

  // password alone no longer opens the area
  await passwordStep(page, "mitglied@demo.at");
  expect((await browserFetch(page, "/mein-bereich")).status).not.toBe(200);
  await page.getByLabel(/Code aus der App/).fill("000000");
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.getByText("Der Code stimmt nicht")).toBeVisible();
  await page.screenshot({ path: "test-results/mfa-login.png" });
  await page.getByLabel(/Code aus der App/).fill(totpCode(secret, 1)); // next step: the enrol code may not be replayed
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await page.waitForURL(/mein-bereich/);
  await logout(page);

  // a recovery code works once
  await passwordStep(page, "mitglied@demo.at");
  await page.getByLabel(/Code aus der App/).fill(codes[0].toUpperCase());
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await page.waitForURL(/mein-bereich/);
  await expect(page.getByText("Noch 9 übrig")).toBeVisible();
  await logout(page);
  await passwordStep(page, "mitglied@demo.at");
  await page.getByLabel(/Code aus der App/).fill(codes[0]);
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.getByText("Der Code stimmt nicht")).toBeVisible();
});

test("Passkey als zweiter Faktor (virtueller Authenticator)", async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", {
    options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true },
  });

  await login(page, CLUB, "kassier@demo.at");
  await page.goto("/sicherheit");
  await page.getByLabel("Bezeichnung").fill("Testgerät");
  await page.getByRole("button", { name: "Passkey hinzufügen" }).click();
  await expect(page.getByText("Passkey gespeichert.")).toBeVisible();
  await page.reload();
  await expect(page.getByText("Testgerät", { exact: true })).toBeVisible();
  await logout(page);

  await passwordStep(page, "kassier@demo.at");
  await page.getByRole("button", { name: "Mit Passkey bestätigen" }).click();
  await page.waitForURL(/dashboard/);
});

test("Verein verlangt 2FA für den Vorstand; Admin setzt 2FA zurück", async ({ page, browser }) => {
  await resetAccounts(); // the passkey test left the kassier with a passkey
  await login(page, CLUB, "obfrau@demo.at");
  await page.goto("/einstellungen");
  await page.getByLabel("Wer muss einen zweiten Faktor").selectOption("BOARD");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  // the admin herself has no second factor yet, so she is sent to set it up right away
  await page.waitForURL(/\/sicherheit$/);
  await page.goto("/mitglieder");
  await page.waitForURL(/\/sicherheit$/);
  await expect(page.getByText("Bitte richte jetzt einen zweiten Faktor ein.")).toBeVisible();
  await enrollTotp(page);
  await page.goto("/mitglieder");
  await expect(page.getByRole("heading", { name: "Mitglieder" })).toBeVisible();

  // a board member without 2FA cannot use the club area or its downloads
  const kassier = await (await browser.newContext()).newPage();
  await login(kassier, CLUB, "kassier@demo.at");
  await kassier.waitForURL(/\/sicherheit$/);
  await kassier.goto(`${CLUB}/finanzen`);
  await kassier.waitForURL(/\/sicherheit$/);
  expect((await browserFetch(kassier, "/api/finanzen/export")).status).toBe(403);
  const secret = await enrollTotp(kassier);
  await kassier.goto(`${CLUB}/finanzen`);
  await expect(kassier.getByRole("heading", { name: "Finanzen" })).toBeVisible();

  // lost phone: the club admin resets it, the kassier is signed out everywhere
  await page.goto("/einstellungen");
  page.once("dialog", (d) => d.accept());
  await page.locator("li", { hasText: "kassier@demo.at" }).getByRole("button", { name: "2FA zurücksetzen" }).click();
  await expect(page.getByText("Zwei-Faktor-Anmeldung von Franz Leitner zurückgesetzt")).toBeVisible();
  await kassier.goto(`${CLUB}/finanzen`);
  await kassier.waitForURL(/\/login$/);
  expect(secret).toBeTruthy();
});
