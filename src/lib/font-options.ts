/** Brand fonts a club can choose; keys are stored in Club.fontKey. */
export const FONT_OPTIONS = {
  schibsted: { label: "Schibsted Grotesk – sachlich", cssVar: "--font-schibsted" },
  source: { label: "Source Sans 3 – neutral, sehr gut lesbar", cssVar: "--font-source" },
  nunito: { label: "Nunito Sans – freundlich, rund", cssVar: "--font-nunito" },
  lexend: { label: "Lexend – breit, leicht lesbar", cssVar: "--font-lexend" },
  literata: { label: "Literata – klassisch mit Serifen", cssVar: "--font-literata" },
} as const;

export type FontKey = keyof typeof FONT_OPTIONS;

export function fontVar(key: string | null | undefined) {
  return (FONT_OPTIONS[key as FontKey] ?? FONT_OPTIONS.schibsted).cssVar;
}
