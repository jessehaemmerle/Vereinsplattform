"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { guarded, writer } from "@/lib/guard";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { fromDateTimeInput, formatDateTime, viennaDay } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";
import { fillPlaceholders, sendBulk } from "@/lib/mail";

const dt = (label: string, required: boolean) =>
  z.preprocess(
    (v) => (typeof v === "string" && v ? fromDateTimeInput(v) : required ? undefined : null),
    required ? z.date({ error: `${label} fehlt` }) : z.date().nullable(),
  );

const eventSchema = z
  .object({
    title: zf.text("Titel", 120),
    description: zf.optText(5000),
    location: zf.optText(200),
    startsAt: dt("Beginn", true),
    endsAt: dt("Ende", false),
    cost: zf.optMoney("Kosten"),
    public: zf.checkbox(),
  })
  .refine((d) => !d.endsAt || d.endsAt >= (d.startsAt as Date), { message: "Ende liegt vor dem Beginn", path: ["endsAt"] });

export async function saveEvent(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("events:write", "EVENTS");
    const parsed = eventSchema.safeParse({ public: "false", ...formObject(formData) });
    if (!parsed.success) return fromZod(parsed.error);
    const data = {
      ...parsed.data,
      startsAt: parsed.data.startsAt as Date,
      endsAt: parsed.data.endsAt as Date | null,
      cost: parsed.data.cost && parsed.data.cost > 0 ? parsed.data.cost : null,
    };
    if (id && !(await db.event.findFirst({ where: { id, clubId: user.clubId } }))) return { error: "Termin nicht gefunden." };

    await db.$transaction(async (tx) => {
      const event = id ? await tx.event.update({ where: { id }, data }) : await tx.event.create({ data: { ...data, clubId: user.clubId } });
      // keep the linked expense booking in sync with the event cost
      const booking = {
        type: "AUSGABE" as const,
        category: "Eventkosten",
        amount: data.cost ?? 0,
        date: viennaDay(data.startsAt),
        description: `Kosten für Termin: ${data.title}`,
      };
      if (data.cost) {
        await tx.transaction.upsert({ where: { eventId: event.id }, create: { ...booking, clubId: user.clubId, eventId: event.id }, update: booking });
      } else {
        await tx.transaction.deleteMany({ where: { eventId: event.id } });
      }
    });
    await logActivity({ clubId: user.clubId, userId: user.id, action: id ? "event_updated" : "event_created", detail: data.title });
  } catch (e) {
    return handleError(e);
  }
  await flash(id ? "Termin gespeichert." : "Termin angelegt.");
  revalidatePath("/events");
  redirect("/events");
}

export async function deleteEvent(formData: FormData) {
  const id = String(formData.get("id"));
  await guarded(async () => {
    const user = await writer("events:write", "EVENTS");
    const event = await db.event.findFirst({ where: { id, clubId: user.clubId } });
    if (!event) return;
    await db.event.delete({ where: { id } }); // the cost booking stays in the books (eventId becomes null)
    await logActivity({ clubId: user.clubId, userId: user.id, action: "event_deleted", detail: event.title });
    await flash("Termin gelöscht.");
  });
  revalidatePath("/events");
  redirect("/events");
}

export async function inviteToEvent(eventId: string, _: FormState, formData: FormData): Promise<FormState> {
  let summary = "";
  try {
    const user = await writer("mail:send", "KOMMUNIKATION");
    const parsed = z
      .object({
        subject: zf.text("Betreff", 200),
        body: zf.text("Nachricht", 20_000),
        statuses: z.array(z.enum(["AKTIV", "PASSIV", "EHRENMITGLIED"])).min(1, "Wähle mindestens eine Gruppe"),
      })
      .safeParse({ ...formObject(formData), statuses: formData.getAll("statuses") });
    if (!parsed.success) return fromZod(parsed.error);
    const event = await db.event.findFirst({ where: { id: eventId, clubId: user.clubId } });
    if (!event) return { error: "Termin nicht gefunden." };
    const members = await db.member.findMany({ where: { clubId: user.clubId, status: { in: parsed.data.statuses } } });
    if (!members.length) return { error: "In den gewählten Gruppen gibt es keine Mitglieder." };
    const extra = { termin: event.title, datum: formatDateTime(event.startsAt), ort: event.location ?? "" };
    const result = await sendBulk(
      members.map((m) => {
        const values = { vorname: m.firstName, nachname: m.lastName, verein: user.club.name, ...extra };
        return {
          to: m.email,
          subject: fillPlaceholders(parsed.data.subject, values),
          text: fillPlaceholders(parsed.data.body, values),
          replyTo: user.club.email ?? user.email,
        };
      }),
    );
    await db.emailLog.create({ data: { clubId: user.clubId, subject: parsed.data.subject, recipients: result.sent, failed: result.failed } });
    summary = result.failed ? `${result.sent} E-Mails gesendet, ${result.failed} fehlgeschlagen.` : `${result.sent} E-Mails gesendet.`;
  } catch (e) {
    return handleError(e);
  }
  await flash(summary);
  redirect("/events");
}
