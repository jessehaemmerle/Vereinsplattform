import { test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { ADMIN, CLUB, ROOT, expect, useAdminSession } from "./helpers";

// Landing page, legal pages and the inquiry flow. Requires the demo seed.
const db = new PrismaClient();
test.afterAll(async () => {
  await db.contactRequest.deleteMany({ where: { email: "anfrage-e2e@demo.at" } });
  await db.platformSettings.deleteMany({});
  await db.$disconnect();
});

test("Startseite: Inhalte, Preise, keine CSP-Verstöße, kein horizontales Scrollen am Handy", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => m.text().includes("Content Security Policy") && violations.push(m.text()));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(ROOT);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Vereinsverwaltung");
  await expect(page.getByText("€ 199")).toBeVisible();
  await expect(page.getByText("auf Anfrage", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  const images = await page.evaluate(async () => {
    const imgs = [...document.images];
    imgs.forEach((i) => (i.loading = "eager"));
    await Promise.all(imgs.map((i) => i.decode().catch(() => null)));
    return imgs.map((i) => i.naturalWidth);
  });
  expect(images.every((w) => w > 0)).toBe(true);
  expect(violations).toEqual([]);
});

test("Rechtliches: Seiten erreichbar, Platzhalter bis der Betreiber Angaben einträgt", async ({ page }) => {
  for (const [path, heading] of [
    ["/impressum", "Impressum"],
    ["/datenschutz", "Datenschutzerklärung"],
    ["/nutzungsbedingungen", "Nutzungsbedingungen"],
    ["/auftragsverarbeitung", "Vereinbarung zur Auftragsverarbeitung"],
  ]) {
    await page.goto(ROOT + path);
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
  }
  await page.goto(`${ROOT}/impressum`);
  await expect(page.getByText("[Name bzw. Firma fehlt]")).toBeVisible();

  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin/rechtliches`);
  await page.getByLabel("Name bzw. Firma *").fill("Muster Software e.U.");
  await page.getByLabel("Straße und Hausnummer *").fill("Hauptplatz 1");
  await page.getByLabel("PLZ und Ort *").fill("4020 Linz");
  await page.getByLabel("E-Mail *").fill("office@muster.at");
  await page.getByLabel("Unternehmensgegenstand *").fill("Softwareentwicklung");
  await page.getByLabel("Hosting *").fill("Hetzner Online GmbH, Falkenstein (Deutschland)");
  await page.getByRole("button", { name: "Speichern" }).click();
  await expect(page.getByText("Angaben gespeichert.")).toBeVisible();

  await page.goto(`${ROOT}/impressum`);
  await expect(page.getByText("Muster Software e.U.").first()).toBeVisible();
  await expect(page.getByText("noch nicht vollständig")).toHaveCount(0);
  await page.goto(`${ROOT}/datenschutz`);
  await expect(page.getByText("Hetzner Online GmbH").first()).toBeVisible();

  // club pages link to the platform's legal pages
  await page.goto(`${CLUB}/login`);
  await expect(page.getByRole("link", { name: "Impressum" })).toHaveAttribute("href", `${ROOT}/impressum`);
});

test("Anfrage über die Startseite landet beim Super-Admin", async ({ page }) => {
  await page.goto(`${ROOT}/#anfrage`);
  await page.getByLabel("Name des Vereins").fill("Trachtenverein E2E");
  await page.getByLabel("Dein Name").fill("Theresa Tracht");
  await page.getByLabel("E-Mail").fill("anfrage-e2e@demo.at");
  await page.getByLabel("Interesse an").selectOption({ label: "Plus" });
  await page.getByLabel(/Datenschutzerklärung/).check();
  await page.waitForTimeout(3200); // the form rejects submissions faster than a human
  await page.getByRole("button", { name: "Anfrage senden" }).click();
  await expect(page.getByText("Danke! Deine Anfrage ist angekommen")).toBeVisible();

  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin/anfragen`);
  await expect(page.getByText("Trachtenverein E2E")).toBeVisible();
  await page.locator("li", { hasText: "Trachtenverein E2E" }).getByRole("link", { name: "Verein anlegen" }).click();
  await expect(page.getByLabel("Vereinsname")).toHaveValue("Trachtenverein E2E");
  await expect(page.getByLabel("Subdomain")).toHaveValue("trachtenverein-e2e");
});

test("Bots: Honeypot und zu schnelles Absenden werden still verworfen", async ({ page }) => {
  await page.goto(`${ROOT}/#anfrage`);
  await page.getByLabel("Name des Vereins").fill("Bot-Verein");
  await page.getByLabel("Dein Name").fill("Bot");
  await page.getByLabel("E-Mail").fill("anfrage-e2e@demo.at");
  await page.getByLabel(/Datenschutzerklärung/).check();
  await page.getByRole("button", { name: "Anfrage senden" }).click(); // immediately
  await expect(page.getByText("Danke!")).toBeVisible();
  expect(await db.contactRequest.count({ where: { clubName: "Bot-Verein" } })).toBe(0);
});
