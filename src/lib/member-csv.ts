import Papa from "papaparse";
import { z } from "zod";

export const CSV_COLUMNS = [
  "Vorname",
  "Nachname",
  "Email",
  "Telefon",
  "Geburtstag",
  "Strasse",
  "PLZ",
  "Ort",
  "Eintrittsdatum",
  "Status",
  "Funktion",
  "Mitgliedsbeitrag",
] as const;

const STATUS_MAP: Record<string, "AKTIV" | "PASSIV" | "EHRENMITGLIED" | "AUSGETRETEN"> = {
  aktiv: "AKTIV",
  passiv: "PASSIV",
  ehrenmitglied: "EHRENMITGLIED",
  ausgetreten: "AUSGETRETEN",
  inaktiv: "PASSIV",
};

/** Accepts yyyy-mm-dd or dd.mm.yyyy. */
export function parseFlexibleDate(value: string | undefined): Date | null {
  const v = value?.trim();
  if (!v) return null;
  let parts: [number, number, number];
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) parts = [+m[1], +m[2], +m[3]];
  else if ((m = v.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/))) parts = [+m[3], +m[2], +m[1]];
  else return null;
  const [y, mo, d] = parts;
  const date = new Date(Date.UTC(y, mo - 1, d));
  return date.getUTCMonth() === mo - 1 && date.getUTCDate() === d ? date : null;
}

export function parseAmount(value: string | undefined): number {
  const v = (value ?? "").trim().replace(/[€\s]/g, "");
  if (!v) return 0;
  const normalized = v.includes(",") || /^\d{1,3}(\.\d{3})+$/.test(v) ? v.replace(/\./g, "").replace(",", ".") : v;
  const n = Number(normalized);
  return Number.isFinite(n) ? n : NaN;
}

const rowSchema = z.object({
  firstName: z.string().min(1, "Vorname fehlt"),
  lastName: z.string().min(1, "Nachname fehlt"),
  email: z.string().email("E-Mail ungültig"),
});

export type ImportedMember = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  birthday: Date | null;
  street: string | null;
  zip: string | null;
  city: string | null;
  joinedAt: Date | null;
  status: "AKTIV" | "PASSIV" | "EHRENMITGLIED" | "AUSGETRETEN";
  function: string | null;
  fee: number;
};

export function parseMemberCsv(text: string) {
  const result = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    skipEmptyLines: true,
    delimiter: "",
    transformHeader: (h) =>
      h
        .trim()
        .toLowerCase()
        .replace(/[\s_-]/g, ""),
  });
  const rows: ImportedMember[] = [];
  const errors: string[] = [];
  result.data.forEach((raw, index) => {
    const line = index + 2;
    const get = (...keys: string[]) => {
      for (const k of keys) if (raw[k]?.trim()) return raw[k].trim();
      return undefined;
    };
    const base = rowSchema.safeParse({
      firstName: get("vorname") ?? "",
      lastName: get("nachname") ?? "",
      email: (get("email", "mail") ?? "").toLowerCase(),
    });
    if (!base.success) {
      errors.push(`Zeile ${line}: ${base.error.issues.map((i) => i.message).join(", ")}`);
      return;
    }
    const fee = parseAmount(get("mitgliedsbeitrag", "beitrag"));
    if (Number.isNaN(fee) || fee < 0) {
      errors.push(`Zeile ${line}: Mitgliedsbeitrag ungültig`);
      return;
    }
    rows.push({
      ...base.data,
      phone: get("telefon", "telefonnummer") ?? null,
      birthday: parseFlexibleDate(get("geburtstag", "geburtsdatum")),
      street: get("strasse", "straße", "adresse") ?? null,
      zip: get("plz") ?? null,
      city: get("ort") ?? null,
      joinedAt: parseFlexibleDate(get("eintrittsdatum", "eintritt")),
      status: STATUS_MAP[(get("status") ?? "aktiv").toLowerCase()] ?? "AKTIV",
      function: get("funktion") ?? null,
      fee,
    });
  });
  return { rows, errors };
}

export const CSV_TEMPLATE =
  CSV_COLUMNS.join(";") + "\nMax;Mustermann;max@example.com;0664 1234567;15.05.1990;Hauptstraße 1;1010;Wien;01.01.2023;aktiv;Mitglied;50,00\n";
