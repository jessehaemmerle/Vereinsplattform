import { expect, test, type Page } from "@playwright/test";

// Requires the demo seed (npm run db:seed) and the default admin from .env.
const PASSWORD = "demo-passwort-123";

async function login(page: Page, email: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  if (password === PASSWORD || !password.startsWith("falsch")) await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

test("Login mit falschem Passwort zeigt Fehler", async ({ page }) => {
  await login(page, "obfrau@demo.at", "falsch-falsch");
  await expect(page.locator("form [role=alert]")).toContainText("stimmen nicht");
});

test("Vereins-Admin: Mitglied anlegen, Beitrag buchen, Finanzen prüfen", async ({ page }) => {
  await login(page, "obfrau@demo.at");
  await expect(page).toHaveURL(/dashboard/);
  await expect(page.getByText("Kassastand")).toBeVisible();
  await page.screenshot({ path: "test-results/dashboard.png", fullPage: true });

  const email = `test${Date.now()}@demo.at`;
  await page.goto("/mitglieder/neu");
  await page.getByLabel("Vorname").fill("Erika");
  await page.getByLabel("Nachname").fill("Testerin");
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Jahresbeitrag (EUR)").fill("viel");
  await page.getByRole("button", { name: "Mitglied anlegen" }).click();
  await expect(page.getByText("Mitgliedsbeitrag ist keine Zahl")).toBeVisible();
  await expect(page.getByLabel("Vorname")).toHaveValue("Erika"); // input survives validation errors
  await page.getByLabel("Jahresbeitrag (EUR)").fill("33,50");
  await page.getByRole("button", { name: "Mitglied anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Erika Testerin" })).toBeVisible();
  await expect(page.getByText("Mitglied angelegt.")).toBeVisible();

  await page.getByRole("button", { name: "Als bezahlt buchen" }).click();
  await expect(page.getByText("bezahlt", { exact: true })).toBeVisible();
  await page.goto("/finanzen");
  await expect(page.getByText("Beitrag", { exact: false }).filter({ hasText: "Erika Testerin" }).first()).toBeVisible();
  await page.screenshot({ path: "test-results/finanzen.png", fullPage: true });

  const pdf = await page.request.get(`/api/finanzen/bericht/jahresabschluss?jahr=${new Date().getFullYear()}`);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  await page.goto("/mitglieder");
  await page.screenshot({ path: "test-results/mitglieder.png", fullPage: true });
});

test("Termin mit Kosten erzeugt Buchung und erscheint im Kalender-Feed", async ({ page }) => {
  await login(page, "obfrau@demo.at");
  const title = `Ausflug ${Date.now()}`;
  await page.goto("/events/neu");
  await page.getByLabel("Titel").fill(title);
  await page.getByLabel("Beginn").fill("2030-06-01T10:00");
  await page.getByLabel("Kosten für den Verein (EUR, optional)").fill("120");
  await page.getByRole("button", { name: "Termin anlegen" }).click();
  await expect(page.getByText(title)).toBeVisible();
  await page.goto("/finanzen?jahr=2030");
  await expect(page.getByText(`Kosten für Termin: ${title}`)).toBeVisible();

  const feedUrl = await page.goto("/events").then(() => page.getByLabel("Link").first().inputValue());
  const ics = await page.request.get(new URL(feedUrl).pathname);
  expect(await ics.text()).toContain(`SUMMARY:${title}`);
});

test("Kassier darf keine Mitglieder anlegen", async ({ page }) => {
  await login(page, "kassier@demo.at");
  await page.goto("/mitglieder");
  await expect(page.getByRole("link", { name: "Mitglied anlegen" })).toHaveCount(0);
  const res = await page.goto("/mitglieder/neu");
  expect(res?.status()).toBe(404);
});

test("Mitglied sieht nur den eigenen Bereich", async ({ page }) => {
  await login(page, "mitglied@demo.at");
  await expect(page).toHaveURL(/mein-bereich/);
  await expect(page.getByRole("heading", { name: "Hallo Lena" })).toBeVisible();
  await page.screenshot({ path: "test-results/mein-bereich.png", fullPage: true });
  await page.goto("/finanzen");
  await expect(page).toHaveURL(/mein-bereich/);
  expect((await page.request.get("/api/mitglieder/export")).status()).toBe(403);
});

test("Plattform-Admin legt Lizenz an", async ({ page }) => {
  await login(page, process.env.DEFAULT_ADMIN_EMAIL ?? "admin@example.com", process.env.DEFAULT_ADMIN_PASSWORD ?? "admin-passwort-123");
  await expect(page).toHaveURL(/admin/);
  await page.goto("/admin/lizenzen/neu");
  const name = `E2E ${Date.now()}`;
  await page.getByLabel("Bezeichnung").fill(name);
  await page.getByLabel("Max. Mitglieder").fill("50");
  await page.getByRole("button", { name: "Lizenz speichern" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();
  await page.goto("/admin");
  await page.screenshot({ path: "test-results/admin.png", fullPage: true });
});

test("E-Mail eines Vorstandszugangs lässt sich über die Mitgliederdaten nicht ändern", async ({ page }) => {
  await login(page, "obfrau@demo.at");
  await page.goto("/mitglieder?q=kassier%40demo.at");
  await page.getByRole("link", { name: "Leitner Franz" }).click();
  await page.getByRole("link", { name: "Bearbeiten" }).click();
  await page.getByLabel("E-Mail").fill("angreifer@example.com");
  await page.getByRole("button", { name: "Änderungen speichern" }).click();
  await expect(page.locator("form [role=alert]")).toContainText("Vorstandszugang");
});
