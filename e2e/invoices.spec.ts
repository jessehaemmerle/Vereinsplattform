import { test, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { ADMIN, CLUB, OTHER_CLUB, browserFetch, expect, login, useAdminSession } from "./helpers";

// Invoicing for clubs and the platform. Requires the demo seed.
const db = new PrismaClient();
const year = new Date().getFullYear();

test.beforeAll(async () => {
  // operator data the platform needs before it may issue invoices
  await db.platformSettings.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      operatorName: "Muster Software e.U.",
      street: "Hauptplatz 1",
      zipCity: "4020 Linz",
      email: "office@muster.at",
      iban: "AT483200000012345864",
      taxMode: "KLEINUNTERNEHMER",
    },
    update: {
      operatorName: "Muster Software e.U.",
      street: "Hauptplatz 1",
      zipCity: "4020 Linz",
      email: "office@muster.at",
      iban: "AT483200000012345864",
      taxMode: "KLEINUNTERNEHMER",
    },
  });
});
test.afterAll(async () => {
  await db.platformSettings.deleteMany({});
  await db.$disconnect();
});

async function pdfText(page: Page, href: string) {
  const res = await browserFetch(page, href);
  return res;
}

test("Verein: Rechnung schreiben, ausstellen, bezahlt → Kassabuch, stornieren", async ({ page }) => {
  await login(page, CLUB, "obfrau@demo.at");
  await page.goto(`${CLUB}/rechnungen/neu`);
  await page.getByLabel("Aus Adressbuch übernehmen").selectOption({ label: "Marktgemeinde Grünbach (Adressbuch)" });
  await expect(page.getByLabel("Name / Firma")).toHaveValue("Marktgemeinde Grünbach");
  await page.getByLabel("Beschreibung Position 1").fill("Musikalische Umrahmung Gemeindefest");
  await page.getByLabel("Preis Position 1").fill("450");
  await page.getByRole("button", { name: "Position hinzufügen" }).click();
  await page.getByLabel("Beschreibung Position 2").fill("Fahrtkosten");
  await page.getByLabel("Menge Position 2").fill("2,5");
  await page.getByLabel("Preis Position 2").fill("12,40");
  await expect(page.getByText("€ 481,00")).toBeVisible(); // live total: 450 + 2.5 × 12.40
  await page.getByLabel("Leistungsdatum / -zeitraum").fill("15.06.2026");
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByRole("heading", { name: "Rechnungsentwurf" })).toBeVisible();
  expect((await pdfText(page, page.url().replace(CLUB, "").replace("/rechnungen/", "/api/rechnungen/"))).head).toBe("%PDF-");

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Nur ausstellen" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Rechnung RE-${year}-\\d{4}`) })).toBeVisible();
  const number = (await page.getByRole("heading", { level: 1 }).textContent())!.replace("Rechnung ", "");
  await expect(page.getByText("offen")).toBeVisible();
  await page.screenshot({ path: "test-results/invoice-detail.png", fullPage: true });

  // paid → booking in the cash book
  await page.getByRole("button", { name: "Als bezahlt markieren" }).click();
  await expect(page.getByText("Als bezahlt markiert")).toBeVisible();
  await page.goto(`${CLUB}/finanzen`);
  await expect(page.getByText(`Rechnung ${number} – Marktgemeinde Grünbach`)).toBeVisible();

  // cancellation: own number, original marked cancelled, no deletion of issued invoices
  await page.goto(`${CLUB}/rechnungen`);
  await page.getByRole("link", { name: number }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Stornieren" }).click();
  await expect(page.getByText(/Stornorechnung RE-\d{4}-\d{4} erstellt/)).toBeVisible();
  await page.goto(`${CLUB}/rechnungen`);
  await expect(page.locator("tr", { hasText: number }).getByText("storniert")).toBeVisible();
});

test("Plattform: Lizenz aus Paket erzeugt Rechnungsentwurf, Verein sieht nur seine Rechnung", async ({ page, browser }) => {
  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin`);
  await page.getByRole("link", { name: "Sportunion Tal" }).click();
  await page.getByLabel("Paket").selectOption({ label: "Plus" });
  await page.getByRole("button", { name: "Neue Lizenz aus Paket" }).click();
  await expect(page.getByText("Rechnungsentwurf erstellt")).toBeVisible(); // license history

  await page.goto(`${ADMIN}/admin/rechnungen?status=DRAFT`);
  await page.locator("tr", { hasText: "Sportunion Tal" }).first().getByRole("link").click();
  await expect(page.getByLabel("Beschreibung Position 1")).toHaveValue(/Lizenz „Plus“/);
  await expect(page.getByText("€ 199,00").first()).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Nur ausstellen" }).click();
  await expect(page.getByRole("heading", { name: new RegExp(`Rechnung RE-${year}-\\d{4}`) })).toBeVisible();
  const invoiceId = page.url().split("/").pop()!;
  const pdf = await browserFetch(page, `/api/rechnungen/${invoiceId}`);
  expect(pdf.head).toBe("%PDF-");

  // the club sees it in its settings and can open it …
  const club = await (await browser.newContext()).newPage();
  await login(club, OTHER_CLUB, "obmann@demo.at");
  await club.goto(`${OTHER_CLUB}/einstellungen`);
  await expect(club.getByText("Rechnungen der Plattform")).toBeVisible();
  expect((await browserFetch(club, `/api/rechnungen/${invoiceId}`)).head).toBe("%PDF-");

  // … another club cannot
  const other = await (await browser.newContext()).newPage();
  await login(other, CLUB, "obfrau@demo.at");
  expect((await browserFetch(other, `/api/rechnungen/${invoiceId}`)).status).toBe(404);
});

test("Plattform kann ohne Betreiberdaten nicht ausstellen", async ({ page }) => {
  await db.platformSettings.update({ where: { id: "default" }, data: { street: null } });
  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin/rechnungen/neu`);
  await page.getByLabel("Aus Adressbuch übernehmen").selectOption({ label: "Musikverein Grünbach" });
  await page.getByLabel("Beschreibung Position 1").fill("Einrichtung");
  await page.getByLabel("Preis Position 1").fill("50");
  await page.getByRole("button", { name: "Entwurf speichern" }).click();
  await expect(page.getByText("Vor dem Ausstellen fehlen Angaben des Ausstellers: Anschrift (Straße, PLZ und Ort)")).toBeVisible();
  await db.platformSettings.update({ where: { id: "default" }, data: { street: "Hauptplatz 1" } });
});
