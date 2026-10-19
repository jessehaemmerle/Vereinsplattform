import { z } from "zod";
import { zf } from "@/lib/form";

export const memberSchema = z.object({
  firstName: zf.text("Vorname", 80),
  lastName: zf.text("Nachname", 80),
  email: zf.email(),
  phone: zf.optText(50),
  birthday: zf.optDate(),
  street: zf.optText(200),
  zip: zf.optText(20),
  city: zf.optText(120),
  joinedAt: zf.optDate(),
  leftAt: zf.optDate(),
  status: z.enum(["AKTIV", "PASSIV", "EHRENMITGLIED", "AUSGETRETEN"]),
  function: zf.optText(80),
  fee: zf.money("Mitgliedsbeitrag"),
  notes: zf.optText(5000),
});

export const STATUS_LABELS = { AKTIV: "Aktiv", PASSIV: "Passiv", EHRENMITGLIED: "Ehrenmitglied", AUSGETRETEN: "Ausgetreten" } as const;
export const STATUS_TONES = { AKTIV: "ok", PASSIV: "neutral", EHRENMITGLIED: "loden", AUSGETRETEN: "danger" } as const;
