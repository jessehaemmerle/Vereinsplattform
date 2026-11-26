import { test } from "@playwright/test";
import { ADMIN, CLUB, OTHER_CLUB, ROOT, brandColor, browserFetch, expect, login, useAdminSession } from "./helpers";

// Multi-tenancy, white label and the super-admin panel. Requires the demo seed.

test("Jeder Verein hat sein eigenes Erscheinungsbild schon auf der Anmeldeseite", async ({ page }) => {
  await page.goto(`${CLUB}/login`);
  await expect(page.getByText("Willkommen beim Musikverein Grünbach")).toBeVisible();
  const musik = await brandColor(page);
  await page.goto(`${OTHER_CLUB}/login`);
  await expect(page.getByText("Sportunion Tal").first()).toBeVisible();
  const sport = await brandColor(page);
  expect(musik).toBe("#7a1f2b");
  expect(sport).not.toBe(musik);
  await expect(page).toHaveTitle(/Sportunion Tal/);
  await expect(page.getByText("powered by Vereinsplattform")).toBeVisible();
  await page.goto(`${CLUB}/login`);
  await page.screenshot({ path: "test-results/login-branded.png" });
});

test("Zugang eines Vereins funktioniert nicht beim anderen Verein", async ({ page }) => {
  // the sportunion admin cannot log in on the musikverein subdomain
  await login(page, CLUB, "obmann@demo.at", undefined, false);
  await expect(page.locator("form [role=alert]")).toContainText("stimmen nicht");

  // a session of club A is not valid on club B
  await login(page, OTHER_CLUB, "obmann@demo.at");
  await expect(page).toHaveURL(/dashboard/);
  await page.goto(`${CLUB}/dashboard`);
  await expect(page).toHaveURL(`${CLUB}/login`);
  // and platform pages do not exist on a club host
  expect((await page.goto(`${OTHER_CLUB}/admin`))?.status()).toBe(404);
});

test("Unbekannte Subdomain zeigt 404, Startseite führt zum Verein", async ({ page }) => {
  const res = await page.goto(ROOT.replace("://", "://gibt-es-nicht.") + "/login");
  expect(res?.status()).toBe(404);
  await page.goto(ROOT);
  await page.getByLabel("Adresse deines Vereins").fill("sportunion-tal");
  await page.getByRole("button", { name: "Zur Anmeldung" }).click();
  await expect(page).toHaveURL(`${OTHER_CLUB}/login`);
});

test("Vereins-Admin ändert Farben und Schrift, alle sehen es sofort", async ({ page }) => {
  await login(page, OTHER_CLUB, "obmann@demo.at");
  await page.goto(`${OTHER_CLUB}/einstellungen`);
  await page.locator("#primaryColor").fill("#ffd400"); // too light for white text
  await expect(page.getByText("zu hell").first()).toBeVisible(); // live preview warns
  await page.getByLabel("Schrift", { exact: true }).selectOption("nunito");
  await page.getByLabel("Absendername").fill("SU Tal Vorstand");
  await page.getByRole("button", { name: "Erscheinungsbild speichern" }).click();
  await expect(page.getByText("Erscheinungsbild gespeichert.")).toBeVisible();
  await page.screenshot({ path: "test-results/branding-settings.png", fullPage: true });

  await page.reload();
  const color = await brandColor(page);
  expect(color).not.toBe("#ffd400"); // darkened for contrast
  const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  expect(font.toLowerCase()).toContain("nunito");

  // reset for repeatable runs
  await page.locator("#primaryColor").fill("#0b5cad");
  await page.getByLabel("Schrift", { exact: true }).selectOption("lexend");
  await page.getByRole("button", { name: "Erscheinungsbild speichern" }).click();
  await expect(page.getByText("Erscheinungsbild gespeichert.")).toBeVisible();
});

test("Super-Admin loggt sich als Verein ein und kehrt zurück", async ({ page }) => {
  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin`);
  await page.getByRole("link", { name: "Sportunion Tal" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Als Verein einloggen" }).click();
  await page.waitForURL(`${OTHER_CLUB}/dashboard`);
  await expect(page.getByText("als Plattform-Admin in diesem Verein angemeldet")).toBeVisible();
  await page.screenshot({ path: "test-results/impersonation.png" });

  // the ticket is single use
  await page.getByRole("button", { name: "Zurück zur Plattform" }).click();
  await page.waitForURL(/admin\.localhost.*\/admin\/vereine\//);
  await expect(page.getByText("impersonation_started").first()).toBeVisible(); // logged in the club's activity
});

test("Paket, Lizenz aus Paket, Verlängerung mit Verlauf", async ({ page }) => {
  await useAdminSession(page);
  const name = `Test-Paket ${Date.now()}`;
  await page.goto(`${ADMIN}/admin/pakete/neu`);
  await page.getByLabel("Name").fill(name);
  await page.getByLabel("Max. Mitglieder").fill("42");
  await page.getByLabel("Laufzeit (Monate)").fill("6");
  await page.getByRole("button", { name: "Paket speichern" }).click();
  await expect(page.getByRole("link", { name })).toBeVisible();

  await page.goto(`${ADMIN}/admin/lizenzen/neu`);
  await page.getByLabel("Bezeichnung").fill(`Lizenz ${name}`);
  await page.getByLabel("Paket").selectOption({ label: name });
  await expect(page.getByLabel("Max. Mitglieder")).toHaveValue("42"); // limits come from the plan
  await page.getByLabel("Gültig bis").fill("2027-01-31");
  await page.getByRole("button", { name: "Lizenz speichern" }).click();
  await page.getByRole("button", { name: "Um 6 Monate verlängern" }).click();
  await expect(page.getByText("verlängert", { exact: true })).toBeVisible();
  await expect(page.getByText(/31\.01\.2027 → 31\.07\.2027/)).toBeVisible();
  await page.screenshot({ path: "test-results/license.png", fullPage: true });
});

test("Neue Subdomain: alte Adresse leitet weiter", async ({ page }) => {
  await useAdminSession(page);
  await page.goto(`${ADMIN}/admin`);
  await page.getByRole("link", { name: "Sportunion Tal" }).click();
  await page.waitForURL(/\/admin\/vereine\/[^/]+$/);
  const clubPage = page.url();
  await page.getByLabel("Subdomain").fill("su-tal");
  await page.getByRole("button", { name: "Adresse ändern" }).click();
  await expect(page.getByText("leitet 90 Tage lang weiter")).toBeVisible();

  await page.goto(`${OTHER_CLUB}/login?x=1`);
  await expect(page).toHaveURL(`${OTHER_CLUB.replace("sportunion-tal", "su-tal")}/login?x=1`);

  // back to the original address (the seed and other tests rely on it)
  await page.goto(clubPage);
  await page.getByLabel("Subdomain").fill("sportunion-tal");
  await page.getByRole("button", { name: "Adresse ändern" }).click();
  await expect(page.getByText("leitet 90 Tage lang weiter")).toBeVisible();
  // proxy caches lookups for 30 s; the new address works right away
  const res = await browserFetch(page, "/api/health");
  expect(res.status).toBe(200);
});

test("Content-Security-Policy ist gesetzt und blockiert nichts von der App selbst", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => m.text().includes("Content Security Policy") && violations.push(m.text()));
  const res = await page.goto(`${CLUB}/login`);
  const policy = res?.headers()["content-security-policy"] ?? "";
  expect(policy).toContain("script-src 'self' 'nonce-");
  expect(policy).toContain("frame-ancestors 'none'");
  expect(policy).toContain("object-src 'none'");
  await login(page, CLUB, "obfrau@demo.at");
  await page.goto(`${CLUB}/einstellungen`);
  await page.goto(`${CLUB}/finanzen`);
  await page.goto(CLUB.replace("://", "://gibt-es-nicht-csp.") + "/");
  await expect(page.getByText("Unter dieser Adresse gibt es keinen Verein.")).toBeVisible();
  expect(violations).toEqual([]);
});
