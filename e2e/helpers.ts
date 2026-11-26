import { expect, type Page } from "@playwright/test";

// Hosts of the demo seed. *.localhost resolves to 127.0.0.1 in Chromium without any DNS setup.
const BASE = process.env.E2E_BASE_DOMAIN ?? "localhost:3000";
const PROTO = process.env.E2E_PROTOCOL ?? "http";
export const CLUB = `${PROTO}://musikverein-gruenbach.${BASE}`;
export const OTHER_CLUB = `${PROTO}://sportunion-tal.${BASE}`;
export const ADMIN = `${PROTO}://admin.${BASE}`;
export const ROOT = `${PROTO}://${BASE}`;
export const PASSWORD = "demo-passwort-123";
export const ADMIN_EMAIL = process.env.DEFAULT_ADMIN_EMAIL ?? "admin@example.com";
export const ADMIN_PASSWORD = process.env.DEFAULT_ADMIN_PASSWORD ?? "admin-passwort-123";

export async function login(page: Page, origin: string, email: string, password = PASSWORD, expectSuccess = true) {
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(password);
  await page.getByRole("button", { name: "Anmelden" }).click();
  if (expectSuccess) await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

/** fetch() from inside the page: uses the browser's resolver and cookies (Node cannot resolve *.localhost). */
export async function browserFetch(page: Page, path: string) {
  return page.evaluate(async (p) => {
    const res = await fetch(p, { redirect: "manual" });
    const buf = new Uint8Array(await res.arrayBuffer());
    return {
      status: res.status,
      type: res.headers.get("content-type"),
      head: String.fromCharCode(...buf.slice(0, 5)),
      text: new TextDecoder().decode(buf.slice(0, 4000)),
    };
  }, path);
}

export async function brandColor(page: Page) {
  return page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue("--loden").trim());
}

export { expect };

import { existsSync, readFileSync } from "node:fs";
import { base32Decode, currentStep, hotp } from "../src/lib/totp";

export const ADMIN_STATE = "e2e/.auth/admin.json";

/** Sets up TOTP on the /sicherheit page and returns the secret. */
export async function enrollTotp(page: Page) {
  await page.getByRole("button", { name: "Authenticator-App einrichten" }).click();
  await page.getByText("Schlüssel manuell eingeben").click();
  const secret = (await page.locator("details code").textContent())!.replace(/\s/g, "");
  await page.getByLabel("Code aus der App").fill(totpCode(secret));
  await page.getByRole("button", { name: "Bestätigen und aktivieren" }).click();
  await page.getByText("Authenticator-App eingerichtet.").waitFor();
  await page.getByRole("list", { name: "Wiederherstellungscodes" }).waitFor();
  return secret;
}

/** Code for the current step plus `offset` (a code can only be used once, so the next login uses the next step). */
export function totpCode(secret: string, offset = 0) {
  return hotp(base32Decode(secret), currentStep() + offset);
}

/** Re-uses the admin session created (with MFA) in global setup. */
export async function useAdminSession(page: Page) {
  if (!existsSync(ADMIN_STATE)) throw new Error("Admin-Sitzung fehlt – globalSetup lief nicht");
  const state = JSON.parse(readFileSync(ADMIN_STATE, "utf8"));
  await page.context().addCookies(state.cookies);
}
