import { z } from "zod";
import { LicenseError } from "@/lib/errors";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; ok?: string } | undefined;

export function fromZod(error: z.ZodError): FormState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join(".");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Bitte prüfe die markierten Felder.", fieldErrors };
}

/** Converts FormData into a plain object (repeated keys become arrays). */
export function formObject(formData: FormData) {
  const out: Record<string, FormDataEntryValue | FormDataEntryValue[]> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (key in out) out[key] = ([] as FormDataEntryValue[]).concat(out[key], value);
    else out[key] = value;
  }
  return out;
}

export function handleError(error: unknown): FormState {
  if (error instanceof LicenseError) return { error: error.message };
  if (isRedirect(error)) throw error;
  console.error(error);
  return { error: "Das hat nicht geklappt. Bitte versuche es erneut." };
}

function isRedirect(error: unknown) {
  return typeof error === "object" && error !== null && "digest" in error && String((error as { digest: unknown }).digest).startsWith("NEXT_");
}

// Reusable zod helpers for form fields
const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : typeof v === "string" ? v.trim() : v);

export const zf = {
  text: (label: string, max = 200) =>
    z
      .string({ error: `${label} fehlt` })
      .trim()
      .min(1, `${label} fehlt`)
      .max(max, `${label} ist zu lang`),
  optText: (max = 2000) => z.preprocess(emptyToNull, z.string().max(max, "Zu lang").nullable()),
  email: () => z.string().trim().toLowerCase().email("Bitte eine gültige E-Mail-Adresse eingeben"),
  optDate: () => z.preprocess((v) => (typeof v === "string" && v ? new Date(`${v}T00:00:00Z`) : null), z.date({ error: "Ungültiges Datum" }).nullable()),
  date: (label: string) => z.preprocess((v) => (typeof v === "string" && v ? new Date(`${v}T00:00:00Z`) : undefined), z.date({ error: `${label} fehlt` })),
  money: (label: string) =>
    z.preprocess(
      (v) => (typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : v),
      z
        .number({ error: `${label} ist keine Zahl` })
        .min(0, `${label} darf nicht negativ sein`)
        .max(10_000_000, `${label} ist zu hoch`),
    ),
  optMoney: (label: string) =>
    z.preprocess(
      (v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v.replace(/\s/g, "").replace(",", "."))) : v),
      z
        .number({ error: `${label} ist keine Zahl` })
        .min(0, `${label} darf nicht negativ sein`)
        .nullable(),
    ),
  optInt: () =>
    z.preprocess((v) => (typeof v === "string" ? (v.trim() === "" ? null : Number(v)) : v), z.number().int("Ganze Zahl erwartet").min(0).nullable()),
  checkbox: () => z.preprocess((v) => v === "on" || v === "true", z.boolean()),
  password: () => z.string().min(10, "Mindestens 10 Zeichen").max(200),
};
