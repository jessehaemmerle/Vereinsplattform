import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const { safe, renderReport } = await import("./pdf");

describe("PDF text", () => {
  it("keeps minus signs, umlauts and the euro sign instead of turning them into ?", () => {
    expect(safe("−€ 12,50")).toBe("-€ 12,50");
    expect(safe("Ausgaben: ‑5 – Grünbach € ß")).toBe("Ausgaben: -5 – Grünbach € ß");
    expect(safe("1 234,00")).toBe("1 234,00"); // narrow no-break space
    expect(safe("Emoji 🎺")).toBe("Emoji ?");
  });

  it("renders a report with negative amounts and running balances", async () => {
    const pdf = await renderReport({
      title: "Jahresabschluss 2026",
      subtitle: "Test",
      summary: [["Endbestand", "-€ 120,00"]],
      sections: [{ columns: [{ header: "Betrag", width: 100, align: "right" }], rows: [["−€ 450,00"], ["-€ 1.054,40"]] }],
    });
    expect(Buffer.from(pdf).subarray(0, 4).toString()).toBe("%PDF");
  });
});
