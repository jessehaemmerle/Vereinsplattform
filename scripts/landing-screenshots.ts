/**
 * Regenerates the product screenshots of the landing page from the demo seed:
 *   npm run db:seed && (app running on BASE_DOMAIN=localhost:3000) && npx tsx scripts/landing-screenshots.ts
 */
import { chromium, type Page } from "@playwright/test";
import sharp from "sharp";

const BASE = process.env.E2E_BASE_DOMAIN ?? "localhost:3000";
const OUT = "public/landing";

async function login(page: Page, origin: string, email: string) {
  await page.goto(`${origin}/login`);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("demo-passwort-123");
  await page.getByRole("button", { name: "Anmelden" }).click();
  await page.waitForURL((u) => !u.pathname.startsWith("/login"));
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || undefined });
  const shots: [string, string, string, string][] = [
    ["musikverein-gruenbach", "obfrau@demo.at", "/dashboard", "dashboard-musikverein"],
    ["musikverein-gruenbach", "obfrau@demo.at", "/mitglieder", "mitglieder"],
    ["musikverein-gruenbach", "obfrau@demo.at", "/finanzen", "finanzen"],
    ["sportunion-tal", "obmann@demo.at", "/dashboard", "dashboard-sportunion"],
  ];
  for (const [slug, email, path, name] of shots) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 800 }, colorScheme: "light", deviceScaleFactor: 1.5 });
    const page = await context.newPage();
    const origin = `http://${slug}.${BASE}`;
    await login(page, origin, email);
    await page.goto(origin + path);
    await page.waitForLoadState("networkidle");
    const png = await page.screenshot();
    await sharp(png).resize(1600).webp({ quality: 82 }).toFile(`${OUT}/${name}.webp`);
    await context.close();
  }
  await browser.close();
}

main();
