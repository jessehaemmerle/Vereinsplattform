"use server";

import { viennaYear } from "@/lib/format";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { guarded, writer } from "@/lib/guard";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { fillPlaceholders, sendBulk } from "@/lib/mail";
import { formatEur } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";

export async function sendCircular(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("mail:send", "KOMMUNIKATION");
    const parsed = z
      .object({
        subject: zf.text("Betreff", 200),
        body: zf.text("Nachricht", 20_000),
        statuses: z.array(z.enum(["AKTIV", "PASSIV", "EHRENMITGLIED"])).min(1, "Wähle mindestens eine Gruppe"),
        onlyUnpaid: zf.checkbox(),
      })
      .safeParse({ onlyUnpaid: "false", ...formObject(formData), statuses: formData.getAll("statuses") });
    if (!parsed.success) return fromZod(parsed.error);
    const year = viennaYear();
    const where: Prisma.MemberWhereInput = { clubId: user.clubId, status: { in: parsed.data.statuses } };
    if (parsed.data.onlyUnpaid) Object.assign(where, { fee: { gt: 0 }, OR: [{ feePaidYear: null }, { feePaidYear: { not: year } }] });
    const members = await db.member.findMany({ where });
    if (!members.length) return { error: "Niemand entspricht der Auswahl." };
    const result = await sendBulk(
      members.map((m) => {
        const values = { vorname: m.firstName, nachname: m.lastName, verein: user.club.name, beitrag: formatEur(m.fee), iban: user.club.iban ?? "" };
        return {
          to: m.email,
          subject: fillPlaceholders(parsed.data.subject, values),
          text: fillPlaceholders(parsed.data.body, values),
          replyTo: user.club.email ?? user.email,
        };
      }),
    );
    await db.emailLog.create({ data: { clubId: user.clubId, subject: parsed.data.subject, recipients: result.sent, failed: result.failed } });
    await logActivity({ clubId: user.clubId, userId: user.id, action: "circular_sent", detail: `${result.sent} Empfänger` });
    revalidatePath("/nachrichten");
    return result.failed
      ? {
          error: `${result.failed} von ${members.length} E-Mails konnten nicht zugestellt werden. Prüfe die SMTP-Einstellungen.`,
          ok: `${result.sent} gesendet.`,
        }
      : { ok: `Nachricht an ${result.sent} Mitglieder gesendet.` };
  } catch (e) {
    return handleError(e);
  }
}

const templateSchema = z.object({ name: zf.text("Name", 100), subject: zf.text("Betreff", 200), body: zf.text("Text", 20_000) });

export async function saveTemplate(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("mail:send", "KOMMUNIKATION");
    const parsed = templateSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    if (id) {
      const { count } = await db.emailTemplate.updateMany({ where: { id, clubId: user.clubId }, data: parsed.data });
      if (!count) return { error: "Vorlage nicht gefunden." };
    } else await db.emailTemplate.create({ data: { ...parsed.data, clubId: user.clubId } });
  } catch (e) {
    return handleError(e);
  }
  await flash("Vorlage gespeichert.");
  redirect("/nachrichten");
}

export async function deleteTemplate(formData: FormData) {
  await guarded(async () => {
    const user = await writer("mail:send", "KOMMUNIKATION");
    await db.emailTemplate.deleteMany({ where: { id: String(formData.get("id")), clubId: user.clubId } });
    await flash("Vorlage gelöscht.");
  });
  redirect("/nachrichten");
}
