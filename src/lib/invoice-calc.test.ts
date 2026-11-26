import { describe, expect, it } from "vitest";
import { computeTotals, epcPayload, formatInvoiceNumber, netFromGross, taxNote } from "./invoice-calc";

describe("computeTotals", () => {
  it("sums per tax rate and adds VAT for taxable issuers", () => {
    const t = computeTotals(
      [
        { quantity: 2, unitCents: 1000, taxRate: 20 },
        { quantity: 1.5, unitCents: 333, taxRate: 20 },
        { quantity: 1, unitCents: 5000, taxRate: 10 },
      ],
      "STEUERPFLICHTIG",
    );
    expect(t.lines).toEqual([2000, 500, 5000]); // 1.5 × 3.33 = 4.995 → 5.00
    expect(t.groups).toEqual([
      { rate: 20, netCents: 2500, taxCents: 500 },
      { rate: 10, netCents: 5000, taxCents: 500 },
    ]);
    expect([t.netCents, t.taxCents, t.grossCents]).toEqual([7500, 1000, 8500]);
  });

  it("charges no VAT for small businesses and non-taxable clubs", () => {
    for (const mode of ["KLEINUNTERNEHMER", "NICHT_STEUERBAR"] as const) {
      const t = computeTotals([{ quantity: 1, unitCents: 19900, taxRate: 20 }], mode);
      expect(t).toMatchObject({ netCents: 19900, taxCents: 0, grossCents: 19900, groups: [{ rate: 0, netCents: 19900, taxCents: 0 }] });
    }
  });

  it("handles cancellations (negative amounts)", () => {
    const t = computeTotals([{ quantity: 1, unitCents: -16583, taxRate: 20 }], "STEUERPFLICHTIG");
    expect([t.netCents, t.taxCents, t.grossCents]).toEqual([-16583, -3317, -19900]);
  });
});

describe("helpers", () => {
  it("derives the net price of a gross license price so that the gross comes out exactly", () => {
    const net = netFromGross(19900, 20);
    expect(net).toBe(16583);
    expect(computeTotals([{ quantity: 1, unitCents: net, taxRate: 20 }], "STEUERPFLICHTIG").grossCents).toBe(19900);
  });

  it("formats numbers and tax notes", () => {
    expect(formatInvoiceNumber("RE", 2026, 7)).toBe("RE-2026-0007");
    expect(taxNote("KLEINUNTERNEHMER")).toContain("§ 6 Abs. 1 Z 27 UStG");
    expect(taxNote("STEUERPFLICHTIG")).toBeNull();
  });

  it("builds an EPC QR payload banking apps accept", () => {
    expect(epcPayload({ name: "Musikverein Grünbach", iban: "AT61 1904 3002 3457 3201", bic: "bkauatww", amountCents: 12345, text: "RE-2026-0001" })).toBe(
      "BCD\n002\n1\nSCT\nBKAUATWW\nMusikverein Grünbach\nAT611904300234573201\nEUR123.45\n\n\nRE-2026-0001",
    );
    expect(epcPayload({ name: "X", iban: null, amountCents: 100, text: "" })).toBeNull();
    expect(epcPayload({ name: "X", iban: "AT61", amountCents: 0, text: "" })).toBeNull();
  });
});

import { vi } from "vitest";
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: {} }));

describe("issuer checks", async () => {
  const { missingIssuerData, snapshotOf } = await import("./invoices");
  const club = (address: string | null, vatId: string | null = null) =>
    snapshotOf({
      kind: "club",
      club: {
        name: "SV Tal",
        address,
        vatId,
        email: null,
        iban: null,
        bic: null,
        bankName: null,
        invoiceFooter: null,
        logoPath: null,
        primaryColor: "#123456",
      } as never,
    });
  it("needs street, postal code and city", () => {
    expect(missingIssuerData(club("Sportplatzweg 3\n4040 Linz"), "NICHT_STEUERBAR")).toEqual([]);
    expect(missingIssuerData(club("Sportplatzweg 3, 4040 Linz"), "NICHT_STEUERBAR")).toEqual([]);
    expect(missingIssuerData(club("4040 Linz"), "NICHT_STEUERBAR")).toEqual(["Anschrift (Straße, PLZ und Ort)"]);
    expect(missingIssuerData(club(null), "NICHT_STEUERBAR")).toHaveLength(1);
  });
  it("needs a VAT id when charging VAT", () => {
    expect(missingIssuerData(club("Weg 1\n4040 Linz"), "STEUERPFLICHTIG")).toEqual(["UID-Nummer"]);
    expect(missingIssuerData(club("Weg 1\n4040 Linz", "ATU12345678"), "STEUERPFLICHTIG")).toEqual([]);
  });
});
