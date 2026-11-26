import { Lexend, Literata, Nunito_Sans, Schibsted_Grotesk, Source_Sans_3 } from "next/font/google";

// Only the default font is preloaded; the others download when a club actually uses them.
const schibsted = Schibsted_Grotesk({ subsets: ["latin", "latin-ext"], variable: "--font-schibsted", display: "swap" });
const source = Source_Sans_3({ subsets: ["latin", "latin-ext"], variable: "--font-source", display: "swap", preload: false });
const nunito = Nunito_Sans({ subsets: ["latin", "latin-ext"], variable: "--font-nunito", display: "swap", preload: false });
const lexend = Lexend({ subsets: ["latin", "latin-ext"], variable: "--font-lexend", display: "swap", preload: false });
const literata = Literata({ subsets: ["latin", "latin-ext"], variable: "--font-literata", display: "swap", preload: false });

export const fontVariables = [schibsted, source, nunito, lexend, literata].map((f) => f.variable).join(" ");
