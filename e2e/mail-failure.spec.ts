import { test } from "@playwright/test";
import { ADMIN, expect, useAdminSession } from "./helpers";

// Only with an unreachable mail server: start the app with SMTP_HOST=127.0.0.1 SMTP_PORT=2599 and set E2E_BROKEN_SMTP=1.
test.skip(!process.env.E2E_BROKEN_SMTP, "nur mit absichtlich unerreichbarem Mailserver");

test("Mailserver kaputt: Verein wird angelegt, klare Meldung statt allgemeinem Fehler", async ({ page }) => {
  await useAdminSession(page);
  const stamp = Date.now();
  await page.goto(`${ADMIN}/admin/vereine/neu`);
  await page.getByLabel("Vereinsname").fill(`Mailtest ${stamp}`);
  await page.getByLabel("Name", { exact: true }).fill("Max Mail");
  await page.getByLabel("E-Mail").fill(`mailtest${stamp}@demo.at`);
  await page.getByRole("button", { name: "Verein anlegen" }).click();
  await page.waitForURL(/\/admin\/vereine\/(?!neu)[^/]+$/);
  await expect(page.getByRole("heading", { name: `Mailtest ${stamp}` })).toBeVisible();
  await expect(page.getByText("Die Einladungs-E-Mail konnte aber nicht gesendet werden")).toBeVisible();

  await page.goto(`${ADMIN}/admin/rechtliches`);
  await page.getByRole("button", { name: "Test-E-Mail an mich senden" }).click();
  await expect(page.getByText("Der Mailserver lehnt die Verbindung ab")).toBeVisible();
});
