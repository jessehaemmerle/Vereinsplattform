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
