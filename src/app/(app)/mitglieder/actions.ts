"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { writer, guarded } from "@/lib/guard";
import { fromZod, handleError, formObject, zf, type FormState } from "@/lib/form";
import { assertMemberCapacity } from "@/lib/license";
import { parseMemberCsv } from "@/lib/member-csv";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";
import { fillPlaceholders, sendMail } from "@/lib/mail";
import { issueToken, appUrl } from "@/lib/tokens";
import { viennaDay, viennaYear } from "@/lib/format";
import { memberSchema } from "./schema";

function isUniqueViolation(e: unknown) {
  return e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002";
}

export async function saveMember(memberId: string | null, _: FormState, formData: FormData): Promise<FormState> {
  let id = memberId;
  try {
    const user = await writer("members:write", "MITGLIEDER");
    const parsed = memberSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const data = parsed.data;
    if (memberId) {
      const existing = await db.member.findFirst({ where: { id: memberId, clubId: user.clubId }, include: { user: true } });
      if (!existing) return { error: "Mitglied nicht gefunden." };
      const emailChanged = existing.email !== data.email;
      // The login email of a board account must never be changed from here (account takeover via password reset).
      if (emailChanged && existing.user && existing.user.role !== "MITGLIED" && existing.user.id !== user.id) {
        return { error: "Diese Person hat einen Vorstandszugang. Ihre E-Mail-Adresse kann nur sie selbst ändern.", fieldErrors: { email: "Gesperrt" } };
      }
      await db.$transaction(async (tx) => {
        await tx.member.update({ where: { id: memberId }, data });
        if (emailChanged && existing.userId) {
          await tx.user.update({ where: { id: existing.userId }, data: { email: data.email } });
          // invalidate links that were sent to the old address
          await tx.token.deleteMany({ where: { userId: existing.userId, usedAt: null } });
        }
      });
      await logActivity({ clubId: user.clubId, userId: user.id, action: "member_updated", detail: `${data.firstName} ${data.lastName}` });
    } else {
      await assertMemberCapacity(user.clubId);
      const created = await db.member.create({ data: { ...data, clubId: user.clubId } });
      id = created.id;
      await logActivity({ clubId: user.clubId, userId: user.id, action: "member_created", detail: `${data.firstName} ${data.lastName}` });
    }
  } catch (e) {
    if (isUniqueViolation(e))
      return { error: "Diese E-Mail-Adresse ist bereits bei einem anderen Mitglied hinterlegt.", fieldErrors: { email: "Bereits vergeben" } };
    return handleError(e);
  }
  await flash(memberId ? "Änderungen gespeichert." : "Mitglied angelegt.");
  revalidatePath("/mitglieder");
  redirect(`/mitglieder/${id}`);
}

export async function deleteMember(formData: FormData) {
  const id = String(formData.get("id"));
  await guarded(async () => {
    const user = await writer("members:write", "MITGLIEDER");
    const member = await db.member.findFirst({ where: { id, clubId: user.clubId } });
    if (!member) return;
    await db.$transaction(async (tx) => {
      await tx.member.delete({ where: { id } });
      if (member.userId) await tx.user.deleteMany({ where: { id: member.userId, role: "MITGLIED" } });
    });
    await logActivity({ clubId: user.clubId, userId: user.id, action: "member_deleted", detail: `${member.firstName} ${member.lastName}` });
    await flash("Mitglied gelöscht. Seine Buchungen bleiben in den Finanzen erhalten.");
  });
  revalidatePath("/mitglieder");
  redirect("/mitglieder");
}

/** Marks this year's fee as paid (books the income) or reverts it (removes the automatic booking). */
export async function toggleFee(formData: FormData) {
  const id = String(formData.get("id"));
  const back = String(formData.get("back") ?? `/mitglieder/${id}`);
  await guarded(async () => {
    const user = await writer("fees:write", "MITGLIEDER");
    const member = await db.member.findFirst({ where: { id, clubId: user.clubId } });
    if (!member) return;
    const year = viennaYear();
    if (member.feePaidYear === year) {
      await db.$transaction([
        db.member.update({ where: { id }, data: { feePaidYear: null } }),
        db.transaction.deleteMany({ where: { clubId: user.clubId, memberId: id, feeYear: year } }),
      ]);
      await flash(`Beitrag ${year} für ${member.firstName} ${member.lastName} wieder auf offen gesetzt.`);
    } else {
      await db.$transaction([
        db.member.update({ where: { id }, data: { feePaidYear: year } }),
        ...(Number(member.fee) > 0
          ? [
              db.transaction.upsert({
                where: { memberId_feeYear: { memberId: id, feeYear: year } },
                update: {},
                create: {
                  clubId: user.clubId,
                  memberId: id,
                  feeYear: year,
                  type: "EINNAHME",
                  category: "Mitgliedsbeitrag",
                  amount: member.fee,
                  date: viennaDay(),
                  description: `Beitrag ${year} – ${member.firstName} ${member.lastName}`,
                },
              }),
            ]
          : []),
      ]);
      await flash(`Beitrag ${year} verbucht.`);
    }
    await logActivity({ clubId: user.clubId, userId: user.id, action: "fee_toggled", detail: `${member.firstName} ${member.lastName}` });
  });
  revalidatePath("/mitglieder");
  revalidatePath("/finanzen");
  redirect(back.startsWith("/") ? back : `/mitglieder/${id}`);
}

export async function importMembers(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("members:write", "MITGLIEDER");
    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0) return { error: "Bitte wähle eine CSV-Datei aus." };
    if (file.size > 2 * 1024 * 1024) return { error: "Die Datei ist größer als 2 MB." };
    const { rows, errors } = parseMemberCsv(await file.text());
    const existing = new Set((await db.member.findMany({ where: { clubId: user.clubId }, select: { email: true } })).map((m) => m.email));
    const seen = new Set<string>();
    const fresh = rows.filter((r) => {
      if (existing.has(r.email) || seen.has(r.email)) return false;
      seen.add(r.email);
      return true;
    });
    if (fresh.length) await assertMemberCapacity(user.clubId, fresh.length);
    await db.member.createMany({ data: fresh.map((r) => ({ ...r, clubId: user.clubId })), skipDuplicates: true });
    await logActivity({ clubId: user.clubId, userId: user.id, action: "members_imported", detail: `${fresh.length} importiert` });
    revalidatePath("/mitglieder");
    const skipped = rows.length - fresh.length;
    const parts = [`${fresh.length} Mitglieder importiert.`];
    if (skipped) parts.push(`${skipped} übersprungen, weil die E-Mail schon vorhanden ist.`);
    if (errors.length)
      return { ok: parts.join(" "), error: `${errors.length} Zeilen fehlerhaft: ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? " …" : ""}` };
    return { ok: parts.join(" ") };
  } catch (e) {
    return handleError(e);
  }
}

/** Sends the member a link to set up their self-service login. */
export async function inviteMember(formData: FormData) {
  const id = String(formData.get("id"));
  await guarded(async () => {
    const user = await writer("members:write", "MITGLIEDER");
    const member = await db.member.findFirst({ where: { id, clubId: user.clubId }, include: { user: true, club: true } });
    if (!member) return;
    let account = member.user;
    if (account && (account.role !== "MITGLIED" || account.passwordHash || account.email !== member.email)) {
      await flash("Diese Person hat bereits einen Zugang. Sie kann „Passwort vergessen“ verwenden.", "error");
      return;
    }
    if (!account) {
      const clash = await db.user.findUnique({ where: { email: member.email } });
      if (clash && (clash.clubId !== user.clubId || clash.role !== "MITGLIED" || clash.passwordHash)) {
        await flash("Für diese E-Mail-Adresse gibt es bereits einen Zugang. Die Person kann „Passwort vergessen“ verwenden.", "error");
        return;
      }
      account = clash
        ? await db.user.update({ where: { id: clash.id }, data: { member: { connect: { id } } } })
        : await db.user.create({
            data: { email: member.email, name: `${member.firstName} ${member.lastName}`, role: "MITGLIED", clubId: user.clubId, member: { connect: { id } } },
          });
    }
    const token = await issueToken(account.id, "MEMBER_ACTIVATION");
    await sendMail({
      to: member.email,
      subject: `Einladung in den Mitgliederbereich des ${member.club.name}`,
      text: `Hallo ${member.firstName},\n\ndu kannst ab sofort den Mitgliederbereich des ${member.club.name} nutzen. Lege über diesen Link dein Passwort fest:\n${appUrl(`/passwort/${token}`)}\n\nDer Link ist drei Tage gültig.`,
      replyTo: member.club.email,
    });
    await flash(`Einladung an ${member.email} gesendet.`);
  });
  redirect(`/mitglieder/${id}`);
}

export async function messageMember(memberId: string, _: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("mail:send", "KOMMUNIKATION");
    const parsed = z.object({ subject: zf.text("Betreff", 200), body: zf.text("Nachricht", 20_000) }).safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const member = await db.member.findFirst({ where: { id: memberId, clubId: user.clubId } });
    if (!member) return { error: "Mitglied nicht gefunden." };
    const values = { vorname: member.firstName, nachname: member.lastName, verein: user.club.name };
    await sendMail({
      to: member.email,
      subject: fillPlaceholders(parsed.data.subject, values),
      text: fillPlaceholders(parsed.data.body, values),
      replyTo: user.club.email ?? user.email,
    });
    await db.emailLog.create({ data: { clubId: user.clubId, subject: parsed.data.subject, recipients: 1 } });
  } catch (e) {
    return handleError(e);
  }
  await flash("Nachricht gesendet.");
  redirect(`/mitglieder/${memberId}`);
}
