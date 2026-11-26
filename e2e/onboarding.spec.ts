import { test } from "@playwright/test";
import { ADMIN, ADMIN_EMAIL, ADMIN_PASSWORD, enrollTotp, expect, login } from "./helpers";

// Full onboarding against a running docker compose stack with mailpit, e.g.:
//   E2E_PROTOCOL=https E2E_BASE_DOMAIN=localhost MAILPIT_URL=http://localhost:8025 npx playwright test onboarding
const MAILPIT = process.env.MAILPIT_URL;

test.skip(!MAILPIT, "MAILPIT_URL nicht gesetzt");
test.use({ ignoreHTTPSErrors: true });

async function latestLink(request: import("@playwright/test").APIRequestContext, to: string) {
  for (let i = 0; i < 20; i++) {
    const list = await (await request.get(`${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:${to}`)}`)).json();
    if (list.messages?.length) {
      const msg = await (await request.get(`${MAILPIT}/api/v1/message/${list.messages[0].ID}`)).json();
      return { link: msg.Text.match(/https?:\/\/\S+\/passwort\/\S+/)[0] as string, from: msg.From, html: msg.HTML as string };
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`keine Mail an ${to}`);
}

test("Super-Admin legt Verein mit Subdomain an, Vereins-Admin startet auf seiner Adresse", async ({ page, request }) => {
  const stamp = Date.now();
  const slug = `club${stamp}`;
  const adminMail = `obmann${stamp}@verein.at`;
  // fresh stack: the platform admin must set up MFA first (or confirm it, if a previous run did)
  await login(page, ADMIN, ADMIN_EMAIL, ADMIN_PASSWORD);
  if (page.url().endsWith("/sicherheit")) await enrollTotp(page);
  else if (page.url().includes("/login/mfa")) test.skip(true, "Admin hat bereits MFA aus einem früheren Lauf – Stack neu aufsetzen");

  await page.goto(`${ADMIN}/admin/pakete/neu`);
  await page.getByLabel("Name").fill(`Paket ${stamp}`);
  await page.getByRole("button", { name: "Paket speichern" }).click();
  await page.waitForURL(/admin\/pakete$/);

  await page.goto(`${ADMIN}/admin/vereine/neu`);
  await page.getByLabel("Vereinsname").fill(`Sportunion ${stamp}`);
  await page.getByLabel("Subdomain").fill(slug);
  await page.getByLabel("Name", { exact: true }).fill("Otto Obmann");
  await page.getByLabel("E-Mail").fill(adminMail);
  await page.getByLabel("Lizenz").selectOption({ label: `Neue Lizenz aus Paket „Paket ${stamp}“` });
  await page.getByRole("button", { name: "Verein anlegen" }).click();
  await expect(page.getByRole("heading", { name: `Sportunion ${stamp}` })).toBeVisible();

  const mail = await latestLink(request, adminMail);
  expect(new URL(mail.link).hostname.startsWith(`${slug}.`)).toBe(true);
  expect(mail.from.Name).toBe(`Sportunion ${stamp}`);
  expect(mail.html).toContain("powered by Vereinsplattform");

  await page.goto(mail.link);
  await page.getByLabel("Neues Passwort").fill("ein-langes-passwort");
  await page.getByLabel("Passwort wiederholen").fill("ein-langes-passwort");
  await page.getByRole("button", { name: "Passwort speichern" }).click();
  await page.waitForURL(/dashboard/);
  expect(new URL(page.url()).hostname.startsWith(`${slug}.`)).toBe(true);

  await page.goto(`${new URL(page.url()).origin}/mitglieder/neu`);
  await page.getByLabel("Vorname").fill("Mia");
  await page.getByLabel("Nachname").fill("Mitglied");
  await page.getByLabel("E-Mail").fill(`mia${stamp}@verein.at`);
  await page.getByRole("button", { name: "Mitglied anlegen" }).click();
  await expect(page.getByRole("heading", { name: "Mia Mitglied" })).toBeVisible();
});
