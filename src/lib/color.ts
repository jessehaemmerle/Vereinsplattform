/** Small sRGB colour toolkit for deriving an accessible theme from one brand colour (WCAG 2.x contrast). */
export type RGB = [number, number, number];

export const HEX_PATTERN = /^#[0-9a-f]{6}$/i;

export function parseHex(hex: string): RGB | null {
  const m = hex.trim().match(/^#?([0-9a-f]{6}|[0-9a-f]{3})$/i);
  if (!m) return null;
  const h = m[1].length === 3 ? [...m[1]].map((c) => c + c).join("") : m[1];
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}

export function toHex([r, g, b]: RGB) {
  return (
    "#" +
    [r, g, b]
      .map((v) =>
        Math.round(Math.min(255, Math.max(0, v)))
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}

export function mix(a: RGB, b: RGB, amountOfB: number): RGB {
  return [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * amountOfB) as RGB;
}

function channel(v: number) {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance([r, g, b]: RGB) {
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

const WHITE: RGB = [255, 255, 255];
const BLACK: RGB = [0, 0, 0];

/** Moves `color` towards black (or white) in small steps until it reaches `ratio` against `against`. */
export function ensureContrast(color: RGB, against: RGB, ratio: number, direction: "darken" | "lighten"): RGB {
  const target = direction === "darken" ? BLACK : WHITE;
  for (let step = 0; step <= 40; step++) {
    const candidate = mix(color, target, step / 40);
    if (contrast(candidate, against) >= ratio) return candidate;
  }
  return target;
}

export type ThemeTokens = Record<string, string>;
export type Theme = { light: ThemeTokens; dark: ThemeTokens; warnings: string[] };

const LIGHT_PAPER: RGB = [244, 246, 242];
const DARK_SURFACE: RGB = [24, 30, 27];

/**
 * Derives all colour tokens of the UI from a primary and an accent colour.
 * Every derived pair used for text keeps at least WCAG AA (4.5:1).
 */
export function buildTheme(primaryHex: string, accentHex: string): Theme {
  const warnings: string[] = [];
  const primary = parseHex(primaryHex) ?? parseHex("#2e5a44")!;
  const accent = parseHex(accentHex) ?? parseHex("#a87a1f")!;

  const button = ensureContrast(primary, WHITE, 4.5, "darken");
  if (toHex(button) !== toHex(primary)) warnings.push("Die Hauptfarbe war für weiße Schrift zu hell und wurde für Schaltflächen etwas abgedunkelt.");
  const accentText = ensureContrast(accent, LIGHT_PAPER, 4.5, "darken");
  if (toHex(accentText) !== toHex(accent)) warnings.push("Die Akzentfarbe war als Schriftfarbe zu hell und wird für Text etwas dunkler verwendet.");

  const rail = ensureContrast(mix(button, BLACK, 0.3), WHITE, 8, "darken");
  const paper = mix(LIGHT_PAPER, primary, 0.03);

  const light: ThemeTokens = {
    "--paper": toHex(paper),
    "--loden": toHex(button),
    "--loden-strong": toHex(mix(button, BLACK, 0.25)),
    "--loden-soft": toHex(mix(primary, WHITE, 0.87)),
    "--brass": toHex(accentText),
    "--brass-soft": toHex(mix(accent, WHITE, 0.85)),
    "--rail": toHex(rail),
    "--rail-ink": toHex(mix(WHITE, primary, 0.06)),
  };

  const darkPrimary = ensureContrast(mix(primary, WHITE, 0.25), DARK_SURFACE, 4.5, "lighten");
  const darkAccent = ensureContrast(mix(accent, WHITE, 0.2), DARK_SURFACE, 4.5, "lighten");
  const dark: ThemeTokens = {
    "--paper": toHex(mix([17, 22, 19], primary, 0.04)),
    "--loden": toHex(darkPrimary),
    "--loden-strong": toHex(mix(darkPrimary, WHITE, 0.25)),
    "--loden-soft": toHex(mix(DARK_SURFACE, primary, 0.3)),
    "--brass": toHex(darkAccent),
    "--brass-soft": toHex(mix(DARK_SURFACE, accent, 0.25)),
    "--rail": toHex(mix([10, 14, 12], primary, 0.12)),
    "--rail-ink": toHex(mix(WHITE, primary, 0.08)),
  };
  return { light, dark, warnings };
}

export function themeCss(theme: Theme) {
  const block = (t: ThemeTokens) =>
    Object.entries(t)
      .map(([k, v]) => `${k}:${v}`)
      .join(";");
  return `:root{${block(theme.light)}}.dark{${block(theme.dark)}}`;
}
