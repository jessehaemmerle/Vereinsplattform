import { describe, expect, it } from "vitest";
import { buildTheme, contrast, parseHex, themeCss } from "./color";

const WHITE = [255, 255, 255] as const;

describe("buildTheme", () => {
  it("keeps a dark brand colour unchanged and warns about nothing", () => {
    const t = buildTheme("#1d3557", "#8a5a00");
    expect(t.light["--loden"]).toBe("#1d3557");
    expect(t.warnings).toEqual([]);
  });

  it("darkens light colours until white text is readable (AA)", () => {
    for (const hex of ["#ffd400", "#7fdbff", "#ffffff", "#ff4136"]) {
      const t = buildTheme(hex, "#ffd400");
      expect(contrast(parseHex(t.light["--loden"])!, [...WHITE])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parseHex(t.light["--brass"])!, parseHex(t.light["--paper"])!)).toBeGreaterThanOrEqual(4.4);
      expect(contrast(parseHex(t.dark["--loden"])!, [24, 30, 27])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(parseHex(t.light["--rail-ink"])!, parseHex(t.light["--rail"])!)).toBeGreaterThanOrEqual(7);
    }
    expect(buildTheme("#ffd400", "#ffd400").warnings.length).toBe(2);
  });

  it("falls back to defaults for invalid input and renders CSS", () => {
    const css = themeCss(buildTheme("nope", "</style>"));
    expect(css).toMatch(/^:root\{--paper:#[0-9a-f]{6};/);
    expect(css).not.toContain("<");
  });
});
