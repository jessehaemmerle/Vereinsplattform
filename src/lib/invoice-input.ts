import { z } from "zod";
import { formObject, zf } from "@/lib/form";
import { TAX_RATES } from "@/lib/invoice-calc";

const money = (v: unknown) =>
  typeof v === "string"
    ? Math.round(
        Number(
          v
            .replace(/\s/g, "")
            .replace(/\./g, (m, o, s: string) => (s.includes(",") ? "" : m))
            .replace(",", "."),
        ) * 100,
      )
    : v;

const itemSchema = z.object({
  description: zf.text("Beschreibung", 500),
  quantity: z.preprocess(
    (v) => (typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z.number({ error: "Menge ist keine Zahl" }).positive("Menge muss größer als 0 sein").max(1_000_000),
  ),
  unit: zf.optText(30),
  unitCents: z.preprocess(money, z.number({ error: "Preis ist keine Zahl" }).int().min(0, "Preise ohne Minus – Korrekturen über Storno").max(100_000_000)),
  taxRate: z.preprocess(
    (v) => Number(v),
    z.number().refine((r) => (TAX_RATES as readonly number[]).includes(r), "Ungültiger Steuersatz"),
  ),
});

export const invoiceSchema = z.object({
  recipientName: zf.text("Empfänger", 200),
  recipientAddress: zf.optText(500),
  recipientEmail: z.preprocess((v) => (v === "" ? null : v), zf.email().nullable()),
  recipientVatId: zf.optText(30),
  servicePeriod: zf.optText(120),
  intro: zf.optText(2000),
  notes: zf.optText(2000),
  items: z.array(itemSchema).min(1, "Mindestens eine Position"),
});

/** Reads items[0][description] … from the form into an array. */
export function parseInvoiceForm(formData: FormData) {
  const raw = formObject(formData) as Record<string, string>;
  const items: Record<string, string>[] = [];
  for (const [key, value] of Object.entries(raw)) {
    const m = key.match(/^items\[(\d+)\]\[(\w+)\]$/);
    if (m) (items[Number(m[1])] ??= {})[m[2]] = value;
  }
  return invoiceSchema.safeParse({ ...raw, items: items.filter(Boolean) });
}

/** Invoicing settings of an issuer (platform or club). */
export const billingSchema = z.object({
  taxMode: z.enum(["KLEINUNTERNEHMER", "STEUERPFLICHTIG", "NICHT_STEUERBAR"]),
  invoicePrefix: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9-]{1,12}$/, "1–12 Zeichen: Buchstaben, Ziffern, Bindestrich"),
  paymentTermsDays: z.preprocess((v) => Number(v), z.number().int().min(0).max(120)),
  iban: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() || null : v),
    z
      .string()
      .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, "IBAN ungültig")
      .nullable(),
  ),
  bic: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() || null : v),
    z
      .string()
      .regex(/^[A-Z]{6}[A-Z0-9]{2}([A-Z0-9]{3})?$/, "BIC ungültig")
      .nullable(),
  ),
  bankName: zf.optText(100),
  invoiceFooter: zf.optText(500),
});
