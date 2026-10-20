import { expect, test } from "@playwright/test";

// Full onboarding against a running docker compose stack with mailpit:
//   E2E_BASE_URL=https://localhost MAILPIT_URL=http://localhost:8025 npx playwright test onboarding
const MAILPIT = process.env.MAILPIT_URL;

test.skip(!MAILPIT, "MAILPIT_URL nicht gesetzt");
test.use({ ignoreHTTPSErrors: true });

async function latestLink(request: import("@playwright/test").APIRequestContext, to: string) {
  for (let i = 0; i < 20; i++) {
    const list = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    if (list.messages?.length) {
      const msg = await (await request.get(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      return new URL(msg.Text.match(/https?:\/\/\S+\/passwort\/\S+/)[0]).pathname;
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`keine Mail an ${to}`);
}

test("Plattform-Admin legt Verein an, Vereins-Admin setzt Passwort und legt Mitglied an", async ({ page, request }) => {
  const stamp = Date.now();
  const adminMail = `obmann${stamp}@verein.at`;
  await page.goto("/login");
  await page.getByLabel("E-Mail").fill(process.env.DEFAULT_ADMIN_EMAIL ?? "admin@example.com");
  await page.getByLabel("Passwort").fill(process.env.DEFAULT_ADMIN_PASSWORD ?? "admin-passwort-123");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL(/admin/);

  await page.goto("/admin/lizenzen/neu");
  await page.getByLabel("Bezeichnung").fill(`Lizenz ${stamp}`);
  await page.getByRole("button", { name: "Lizenz speichern" }).click();
  await page.waitForURL(/admin\/lizenzen$/);

  await page.goto("/admin/vereine/neu");
  await page.getByLabel("Vereinsname").fill(`Sportunion ${stamp}`);
  await page.getByLabel("Name", { exact: true }).fill("Otto Obmann");
  await page.getByLabel("E-Mail").fill(adminMail);
  const option = page.getByLabel("Lizenz zuweisen").locator("option", { hasText: `Lizenz ${stamp}` });
  await page.getByLabel("Lizenz zuweisen").selectOption((await option.getAttribute("value"))!);
  await page.getByRole("button", { name: "Verein anlegen" }).click();
  await expect(page.getByRole("heading", { name: `Sportunion ${stamp}` })).toBeVisible();

  const link = await latestLink(request, adminMail);
  await page.context().clearCookies();
  await page.goto(link);
  await page.getByLabel("Neues Passwort").fill("ein-langes-passwort");
  await page.getByLabel("Passwort wiederholen").fill("ein-langes-passwort");
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await page.waitForURL(/dashboard/);

  await page.goto("/mitglieder/neu");
  await page.getByLabel("Vorname").fill("Mia");
  await page.getByLabel("Nachname").fill("Mitglied");
  await page.getByLabel("E-Mail").fill(`mia${stamp}@verein.at`);
  await page.getByRole("button", { name: "Mitglied anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Mia Mitglied" })).toBeVisible();
});
