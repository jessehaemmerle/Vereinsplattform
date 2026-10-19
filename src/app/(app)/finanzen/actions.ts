"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { guarded, writer } from "@/lib/guard";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";

const txSchema = z.object({
  type: z.enum(["EINNAHME", "AUSGABE"]),
  category: zf.text("Kategorie", 80),
  amount: zf.money("Betrag").refine((v) => v > 0, "Betrag muss größer als 0 sein"),
  date: zf.date("Datum"),
  description: zf.optText(500),
  memberId: z.preprocess((v) => (v ? v : null), z.string().nullable()),
});

export async function saveTransaction(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("finance:write", "FINANZEN");
    const parsed = txSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const data = parsed.data;
    if (data.memberId && !(await db.member.findFirst({ where: { id: data.memberId, clubId: user.clubId } }))) {
      return { error: "Mitglied nicht gefunden." };
    }
    if (id) {
      const existing = await db.transaction.findFirst({ where: { id, clubId: user.clubId } });
      if (!existing) return { error: "Buchung nicht gefunden." };
      if (existing.eventId) return { error: "Diese Buchung gehört zu einem Termin. Ändere die Kosten direkt beim Termin." };
      if (existing.feeYear) return { error: "Das ist eine automatische Beitragsbuchung. Nimm die Zahlung beim Mitglied zurück und buche sie neu." };
      await db.transaction.update({ where: { id }, data });
    } else {
      await db.transaction.create({ data: { ...data, clubId: user.clubId } });
    }
    await logActivity({
      clubId: user.clubId,
      userId: user.id,
      action: id ? "transaction_updated" : "transaction_created",
      detail: `${data.category} ${data.amount}`,
    });
  } catch (e) {
    return handleError(e);
  }
  await flash(id ? "Buchung gespeichert." : "Buchung angelegt.");
  revalidatePath("/finanzen");
  redirect("/finanzen");
}

export async function deleteTransaction(formData: FormData) {
  const id = String(formData.get("id"));
  await guarded(async () => {
    const user = await writer("finance:write", "FINANZEN");
    const tx = await db.transaction.findFirst({ where: { id, clubId: user.clubId } });
    if (!tx) return;
    if (tx.eventId) {
      await flash("Diese Buchung gehört zu einem Termin. Entferne die Kosten direkt beim Termin.", "error");
      return;
    }
    await db.transaction.delete({ where: { id } });
    if (tx.memberId && tx.feeYear) {
      await db.member.updateMany({ where: { id: tx.memberId, feePaidYear: tx.feeYear }, data: { feePaidYear: null } });
    }
    await logActivity({ clubId: user.clubId, userId: user.id, action: "transaction_deleted", detail: `${tx.category} ${tx.amount}` });
    await flash("Buchung gelöscht.");
  });
  revalidatePath("/finanzen");
  redirect("/finanzen");
}
