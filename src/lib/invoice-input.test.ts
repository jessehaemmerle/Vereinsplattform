import { describe, expect, it } from "vitest";
import { parseInvoiceForm } from "./invoice-input";

const fd = (o: Record<string, string>) => {
  const f = new FormData();
  Object.entries(o).forEach(([k, v]) => f.append(k, v));
  return f;
};

describe("parseInvoiceForm", () => {
  it("reads items and German number formats", () => {
    const r = parseInvoiceForm(
      fd({
        recipientName: "Gemeinde Tal",
        recipientEmail: "",
        "items[0][description]": "Bandauftritt",
        "items[0][quantity]": "1",
        "items[0][unitCents]": "1.250,50",
        "items[0][taxRate]": "0",
        "items[1][description]": "Fahrtkosten",
        "items[1][quantity]": "2,5",
        "items[1][unitCents]": "12.5",
        "items[1][taxRate]": "20",
      }),
    );
    expect(r.success).toBe(true);
    expect(r.data?.items).toEqual([
      { description: "Bandauftritt", quantity: 1, unit: null, unitCents: 125050, taxRate: 0 },
      { description: "Fahrtkosten", quantity: 2.5, unit: null, unitCents: 1250, taxRate: 20 },
    ]);
  });

  it("rejects negative prices, odd tax rates and empty invoices", () => {
    expect(
      parseInvoiceForm(
        fd({ recipientName: "X", "items[0][description]": "a", "items[0][quantity]": "1", "items[0][unitCents]": "-5", "items[0][taxRate]": "0" }),
      ).success,
    ).toBe(false);
    expect(
      parseInvoiceForm(
        fd({ recipientName: "X", "items[0][description]": "a", "items[0][quantity]": "1", "items[0][unitCents]": "5", "items[0][taxRate]": "19" }),
      ).success,
    ).toBe(false);
    expect(parseInvoiceForm(fd({ recipientName: "X" })).success).toBe(false);
  });
});
