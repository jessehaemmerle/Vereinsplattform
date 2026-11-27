import type { TaxMode } from "@prisma/client";

export const TAX_RATES = [20, 13, 10, 0] as const;

export type CalcItem = { quantity: number; unitCents: number; taxRate: number };

export type Totals = {
  lines: number[]; // net cents per line
  groups: { rate: number; netCents: number; taxCents: number }[];
  netCents: number;
  taxCents: number;
  grossCents: number;
};

/**
 * Line net = round(quantity × unit price); VAT is computed per tax rate on the summed net
 * (as required for the per-rate breakdown of § 11 UStG). Without VAT liability every rate is 0.
 */
export function computeTotals(items: CalcItem[], taxMode: TaxMode): Totals {
  const taxable = taxMode === "STEUERPFLICHTIG";
  const lines = items.map((i) => Math.round(i.quantity * i.unitCents));
  const byRate = new Map<number, number>();
  items.forEach((i, idx) => {
    const rate = taxable ? i.taxRate : 0;
    byRate.set(rate, (byRate.get(rate) ?? 0) + lines[idx]);
  });
  const groups = [...byRate.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([rate, netCents]) => ({ rate, netCents, taxCents: Math.round((netCents * rate) / 100) }));
  const netCents = lines.reduce((a, b) => a + b, 0);
  const taxCents = groups.reduce((a, g) => a + g.taxCents, 0);
  return { lines, groups, netCents, taxCents, grossCents: netCents + taxCents };
}

/** Net unit price for a gross price (license prices are quoted gross). */
export function netFromGross(grossCents: number, rate: number) {
  return Math.round(grossCents / (1 + rate / 100));
}

export function formatInvoiceNumber(prefix: string, year: number, n: number) {
  return `${prefix}-${year}-${String(n).padStart(4, "0")}`;
}

export const TAX_MODE_LABELS: Record<TaxMode, string> = {
  KLEINUNTERNEHMER: "Kleinunternehmer (ohne Umsatzsteuer)",
  STEUERPFLICHTIG: "Umsatzsteuerpflichtig",
  NICHT_STEUERBAR: "Nicht steuerbar (z. B. gemeinnütziger Verein)",
};

/** Mandatory note on invoices without VAT. */
export function taxNote(mode: TaxMode) {
  if (mode === "KLEINUNTERNEHMER") return "Umsatzsteuerbefreit – Kleinunternehmer gemäß § 6 Abs. 1 Z 27 UStG.";
  if (mode === "NICHT_STEUERBAR") return "Keine Umsatzsteuer: nicht steuerbare Leistung (§ 2 UStG).";
  return null;
}

/**
 * EPC069-12 "SEPA Credit Transfer" QR payload ("Zahlen mit Code"). Version 002 makes the BIC optional.
 * Returns null when there is nothing to pay or no IBAN.
 */
export function epcPayload(p: { name: string; iban: string | null | undefined; bic?: string | null; amountCents: number; text: string }) {
  if (!p.iban || p.amountCents <= 0 || p.amountCents > 99_999_999_999) return null;
  const clean = (s: string, max: number) =>
    s
      .replace(/[\r\n]+/g, " ")
      .trim()
      .slice(0, max);
  return [
    "BCD",
    "002",
    "1", // UTF-8
    "SCT",
    (p.bic ?? "").replace(/\s/g, "").toUpperCase(),
    clean(p.name, 70),
    p.iban.replace(/\s/g, "").toUpperCase(),
    `EUR${(p.amountCents / 100).toFixed(2)}`,
    "", // purpose code
    "", // structured reference
    clean(p.text, 140),
  ].join("\n");
}

/**
 * The license period a subscription invoice bills. A license with an end date bills up to that date;
 * an open-ended license bills calendar years (from its start if that lies within the year).
 */
export function licensePeriod(validFrom: Date | null, validUntil: Date | null, year: number): { start: Date | null; end: Date } {
  if (validUntil) return { start: validFrom, end: validUntil };
  const jan1 = new Date(Date.UTC(year, 0, 1));
  return { start: validFrom && validFrom > jan1 ? validFrom : jan1, end: new Date(Date.UTC(year, 11, 31)) };
}

export function sameDay(a: Date | null | undefined, b: Date | null | undefined) {
  return !!a && !!b && a.toISOString().slice(0, 10) === b.toISOString().slice(0, 10);
}
