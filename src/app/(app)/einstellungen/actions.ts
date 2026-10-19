"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { guarded, writer } from "@/lib/guard";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { assertUserCapacity } from "@/lib/license";
import { deleteStoredFile, storeFile } from "@/lib/storage";
import { issueToken, appUrl } from "@/lib/tokens";
import { sendMail } from "@/lib/mail";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";
import { ROLE_LABELS } from "@/lib/permissions";

const clubSchema = z.object({
  name: zf.text("Vereinsname", 100),
  email: z.preprocess((v) => (v === "" ? null : v), zf.email().nullable()),
  address: zf.optText(300),
  iban: z.preprocess(
    (v) => (typeof v === "string" ? v.replace(/\s/g, "").toUpperCase() || null : v),
    z
      .string()
      .regex(/^[A-Z]{2}\d{2}[A-Z0-9]{10,30}$/, "IBAN ungültig")
      .nullable(),
  ),
  bankName: zf.optText(100),
  openingBalance: z.preprocess((v) => (typeof v === "string" ? Number(v.replace(/\s/g, "").replace(",", ".")) : v), z.number({ error: "Keine Zahl" })),
});

export async function updateClub(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("club:manage");
    const parsed = clubSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    await db.club.update({ where: { id: user.clubId }, data: parsed.data });
    await logActivity({ clubId: user.clubId, userId: user.id, action: "settings_updated" });
    revalidatePath("/", "layout");
    return { ok: "Vereinsdaten gespeichert." };
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { error: "Ein Verein mit diesem Namen existiert bereits." };
    return handleError(e);
  }
}

export async function uploadLogo(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("club:manage");
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) return { error: "Bitte wähle ein Bild aus." };
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) return { error: "Erlaubt sind PNG, JPG und WebP." };
    if (file.size > 2 * 1024 * 1024) return { error: "Das Logo darf höchstens 2 MB groß sein." };
    const storageName = await storeFile(file);
    if (user.club.logoPath) await deleteStoredFile(user.club.logoPath);
    await db.club.update({ where: { id: user.clubId }, data: { logoPath: storageName } });
    revalidatePath("/", "layout");
    return { ok: "Logo gespeichert." };
  } catch (e) {
    return handleError(e);
  }
}

export async function removeLogo() {
  await guarded(async () => {
    const user = await writer("club:manage");
    if (user.club.logoPath) await deleteStoredFile(user.club.logoPath);
    await db.club.update({ where: { id: user.clubId }, data: { logoPath: null } });
  });
  revalidatePath("/", "layout");
}

const STAFF_ROLES = ["ADMIN", "KASSIER", "SCHRIFTFUEHRER", "VORSTAND"] as const;

export async function inviteUser(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("club:manage");
    const parsed = z.object({ name: zf.text("Name", 100), email: zf.email(), role: z.enum(STAFF_ROLES) }).safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const { name, email, role } = parsed.data;
    const existing = await db.user.findUnique({ where: { email } });
    if (existing && existing.clubId !== user.clubId)
      return { error: "Diese E-Mail-Adresse gehört zu einem Zugang in einem anderen Verein.", fieldErrors: { email: "Bereits vergeben" } };
    if (existing && existing.role !== "MITGLIED")
      return { error: "Diese Person hat bereits einen Vorstandszugang.", fieldErrors: { email: "Bereits vorhanden" } };
    await assertUserCapacity(user.clubId);
    const target = existing
      ? await db.user.update({ where: { id: existing.id }, data: { role } }) // promote a member login
      : await db.user.create({ data: { name, email, role, clubId: user.clubId } });
    const member = await db.member.findFirst({ where: { clubId: user.clubId, email, userId: null } });
    if (member) await db.member.update({ where: { id: member.id }, data: { userId: target.id } });
    if (!target.passwordHash) {
      const token = await issueToken(target.id, "PASSWORD_SETUP");
      await sendMail({
        to: email,
        subject: `Dein Zugang für ${user.club.name}`,
        text: `Hallo ${name},\n\n${user.name} hat dir einen Zugang als ${ROLE_LABELS[role]} für ${user.club.name} eingerichtet. Lege über diesen Link dein Passwort fest:\n${appUrl(`/passwort/${token}`)}\n\nDer Link ist sieben Tage gültig.`,
      });
    }
    await logActivity({ clubId: user.clubId, userId: user.id, action: "user_invited", detail: `${name} (${ROLE_LABELS[role]})` });
    revalidatePath("/einstellungen");
    return { ok: target.passwordHash ? `${name} ist jetzt ${ROLE_LABELS[role]}.` : `Einladung an ${email} gesendet.` };
  } catch (e) {
    return handleError(e);
  }
}

export async function changeRole(formData: FormData) {
  await guarded(async () => {
    const user = await writer("club:manage");
    const id = String(formData.get("id"));
    const role = String(formData.get("role")) as Role;
    if (!(STAFF_ROLES as readonly string[]).includes(role) && role !== "MITGLIED") return;
    if (id === user.id) {
      await flash("Deine eigene Rolle kannst du nicht ändern.", "error");
      return;
    }
    const target = await db.user.findFirst({ where: { id, clubId: user.clubId }, include: { member: true } });
    if (!target) return;
    if (role === "MITGLIED" && !target.member) {
      // a board login without member record cannot become a plain member – remove access instead
      await db.user.delete({ where: { id } });
      await flash(`Zugang von ${target.name} entfernt.`);
      return;
    }
    await db.$transaction([db.user.update({ where: { id }, data: { role } }), db.session.deleteMany({ where: { userId: id } })]);
    await flash(role === "MITGLIED" ? `${target.name} hat nur noch Zugang zum Mitgliederbereich.` : `${target.name} ist jetzt ${ROLE_LABELS[role]}.`);
  });
  revalidatePath("/einstellungen");
}

export async function updateProfile(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ name: zf.text("Name", 100), emailNotifications: zf.checkbox() })
    .safeParse({ emailNotifications: "false", ...formObject(formData) });
  if (!parsed.success) return fromZod(parsed.error);
  await db.user.update({ where: { id: user.id }, data: parsed.data });
  revalidatePath("/", "layout");
  return { ok: "Profil gespeichert." };
}

export async function changePassword(_: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const parsed = z
    .object({ current: z.string().min(1, "Aktuelles Passwort fehlt"), password: zf.password(), confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Die Passwörter stimmen nicht überein", path: ["confirm"] })
    .safeParse(formObject(formData));
  if (!parsed.success) return fromZod(parsed.error);
  if (!(await verifyPassword(parsed.data.current, user.passwordHash)))
    return { error: "Das aktuelle Passwort stimmt nicht.", fieldErrors: { current: "Falsch" } };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(parsed.data.password) } });
  return { ok: "Passwort geändert." };
}

export async function regenerateCalendarToken() {
  await guarded(async () => {
    const user = await writer("club:manage");
    await db.club.update({ where: { id: user.clubId }, data: { calendarToken: crypto.randomUUID().replace(/-/g, "") } });
    await flash("Neuer Kalender-Link erstellt. Der alte funktioniert nicht mehr.");
  });
  revalidatePath("/einstellungen");
}
