import { test } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { ADMIN, CLUB, expect, login, useAdminSession } from "./helpers";

// Billing runs: subscription invoices per button (platform) and membership fee invoices (club). Requires the demo seed.
const db = new PrismaClient();
const year = new Date().getFullYear();
const operator = {
  operatorName: "Muster Software e.U.",
  street: "Hauptplatz 1",
  zipCity: "4020 Linz",
  email: "office@muster.at",
  iban: "AT483200000012345864",
  taxMode: "KLEINUNTERNEHMER" as const,
};

test.beforeAll(async () => {
  await db.platformSettings.upsert({ where: { id: "default" }, create: { id: "default", ...operator }, update: operator });
  // start from an unbilled demo license and no fee invoices, so the spec can run repeatedly
  await db.invoice.deleteMany({ where: { issuerClubId: null, license: { key: "VP-DEMO-DEMO-DEMO-DEMO" } } });
  await db.invoice.deleteMany({ where: { issuerClub: { slug: "musikverein-gruenbach" }, feeYear: { not: null } } });
});
test.afterAll(async () => {
  await db.platformSettings.deleteMany({});
  await db.$disconnect();
});

test("Plattform: Abrechnung erzeugt die Abo-Rechnung per Knopf", async ({ page }) => {
  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin`);
  await page.getByRole("link", { name: "Abrechnung" }).click();
  await expect(page.getByRole("heading", { name: "Abrechnung" })).toBeVisible();
  const row = page.locator("tr", { hasText: "Musikverein Grünbach" });
  await expect(row.getByText("nicht verrechnet")).toBeVisible();
  await expect(row.getByText("€ 199,00")).toBeVisible();

  await page.getByLabel("Erstellte Rechnungen").selectOption("issue");
  await row.getByRole("button", { name: "Rechnung erzeugen" }).click();
  await expect(page.getByText("1 Rechnungen ausgestellt.")).toBeVisible();
  await expect(page.locator("tr", { hasText: "Musikverein Grünbach" })).toHaveCount(0); // no longer open

  await page.getByRole("link", { name: /Alle Lizenzen/ }).click();
  const billed = page.locator("tr", { hasText: "Musikverein Grünbach" });
  await expect(billed.getByText(new RegExp(`RE-${year}-\\d{4}`))).toBeVisible();
  await expect(billed.getByRole("button", { name: "Rechnung erzeugen" })).toHaveCount(0);
  await page.screenshot({ path: "test-results/billing-run.png", fullPage: true });
});

test("Verein: Beitragsrechnung erstellen, bezahlt → Beitrag bezahlt, zurücknehmen öffnet die Rechnung", async ({ page }) => {
  await login(page, CLUB, "obfrau@demo.at");
  await page.goto(`${CLUB}/rechnungen`);
  await page.getByRole("link", { name: "Beitragsrechnungen" }).click();
  await expect(page.getByRole("heading", { name: `Beitragsrechnungen ${year}` })).toBeVisible();

  const row = page.locator("tr", { has: page.getByRole("button", { name: "Rechnung erstellen" }) }).first();
  const name = (await row.locator("td").nth(1).getByRole("link").textContent())!.trim(); // "Nachname Vorname"
  const [last, first] = name.split(" ");
  await page.getByLabel("Erstellte Rechnungen").selectOption("issue");
  await row.getByRole("button", { name: "Rechnung erstellen" }).click();
  await expect(page.getByText("1 Beitragsrechnungen ausgestellt.")).toBeVisible();

  const invoiceRow = page.locator("tr", { hasText: name });
  await expect(invoiceRow.getByText(new RegExp(`RE-${year}-\\d{4}`))).toBeVisible();
  await invoiceRow.getByRole("link", { name: new RegExp(`RE-${year}`) }).click();
  await expect(page.getByText(`01.01.${year} – 31.12.${year}`)).toBeVisible();

  // paid invoice = paid fee, booked once as membership fee
  await page.getByRole("button", { name: "Als bezahlt markieren" }).click();
  await expect(page.getByText("Als bezahlt markiert")).toBeVisible();
  await page.goto(`${CLUB}/finanzen`);
  await expect(page.getByText(`Beitrag ${year} – ${first} ${last}`)).toHaveCount(1);
  await page.goto(`${CLUB}/rechnungen/beitraege`);
  await expect(page.locator("tr", { hasText: name }).getByText("bezahlt").first()).toBeVisible();

  // reverting at the member reopens the invoice
  await page.locator("tr", { hasText: name }).getByRole("link", { name }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Zahlung zurücknehmen" }).click();
  await expect(page.getByText(`Beitrag ${year} für ${first} ${last} wieder auf offen gesetzt.`)).toBeVisible();
  await page.goto(`${CLUB}/rechnungen/beitraege`);
  await expect(page.locator("tr", { hasText: name }).getByText("offen")).toHaveCount(2); // fee and invoice

  // paying at the member settles the open invoice
  await page.locator("tr", { hasText: name }).getByRole("link", { name }).click();
  await page.getByRole("button", { name: "Als bezahlt buchen" }).click();
  await expect(page.getByText(/Rechnung RE-\d{4}-\d{4} als bezahlt markiert/)).toBeVisible();
  await page.goto(`${CLUB}/finanzen`);
  await expect(page.getByText(`Beitrag ${year} – ${first} ${last}`)).toHaveCount(1);
});
