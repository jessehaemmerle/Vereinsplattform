import type { Metadata } from "next";
import { Schibsted_Grotesk } from "next/font/google";
import { readFlash } from "@/lib/flash";
import { FlashToast } from "@/components/flash";
import "./globals.css";

const font = Schibsted_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-schibsted", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Vereinsplattform", template: "%s · Vereinsplattform" },
  description: "Mitglieder, Finanzen, Termine und Dokumente deines Vereins an einem Ort.",
};

const themeScript = `try{var t=localStorage.getItem("vp-theme");if(t==="dark"||(!t&&matchMedia("(prefers-color-scheme: dark)").matches))document.documentElement.classList.add("dark")}catch(e){}`;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const flash = await readFlash();
  return (
    <html lang="de-AT" className={font.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        {children}
        {flash && <FlashToast key={flash.raw} flash={flash} />}
      </body>
    </html>
  );
}
