import type { Metadata } from "next";
import { readFlash } from "@/lib/flash";
import { fontVariables } from "@/lib/fonts";
import { getTenant } from "@/lib/tenant";
import { assetUrl, brandCss } from "@/lib/branding";
import { FlashToast } from "@/components/flash";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const tenant = await getTenant();
  const club = tenant.kind === "club" ? tenant.club : null;
  if (!club) {
    const name = tenant.kind === "admin" ? "Plattform-Verwaltung" : "Vereinsplattform";
    return { title: { default: name, template: `%s · ${name}` }, description: "Mitglieder, Finanzen, Termine und Dokumente deines Vereins an einem Ort." };
  }
  const icon = assetUrl(club, "favicon") ?? assetUrl(club, "logo");
  return {
    title: { default: club.name, template: `%s · ${club.name}` },
    description: `Mitgliederbereich und Verwaltung des ${club.name}`,
    icons: icon ? { icon } : undefined,
    robots: { index: false },
  };
}

const themeScript = `try{var t=localStorage.getItem("vp-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [flash, tenant] = await Promise.all([readFlash(), getTenant()]);
  const club = tenant.kind === "club" ? tenant.club : null;
  return (
    <html lang="de-AT" className={fontVariables} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        {club && <style dangerouslySetInnerHTML={{ __html: brandCss(club) }} />}
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        {flash && <FlashToast key={flash.raw} flash={flash} />}
      </body>
    </html>
  );
}
