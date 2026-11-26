"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma, type Role } from "@prisma/client";
import { db } from "@/lib/db";
import { guarded, writer } from "@/lib/guard";
import { hashPassword, requireUser, verifyPassword } from "@/lib/auth";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { assertUserCapacity } from "@/lib/license";
import { deleteStoredFile, storeImage } from "@/lib/storage";
import { buildTheme, HEX_PATTERN } from "@/lib/color";
import { FONT_OPTIONS, type FontKey } from "@/lib/font-options";
import { issueToken } from "@/lib/tokens";
import { clubUrl } from "@/lib/hosts";
import { mailBrand } from "@/lib/branding";
import { sendMail } from "@/lib/mail";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";
import { ROLE_LABELS } from "@/lib/permissions";
import { resetMfa } from "@/lib/mfa-reset";

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

const IMAGE_RULES = {
  logo: { field: "logoPath", types: ["png", "jpg"], max: 2 },
  logoDark: { field: "logoDarkPath", types: ["png", "jpg"], max: 2 },
  favicon: { field: "faviconPath", types: ["png", "ico"], max: 0.5 },
  loginImage: { field: "loginImagePath", types: ["jpg", "png", "webp"], max: 5 },
} as const;

const brandingSchema = z.object({
  primaryColor: z
    .string()
    .regex(HEX_PATTERN, "Farbe als #rrggbb angeben")
    .transform((v) => v.toLowerCase()),
  accentColor: z
    .string()
    .regex(HEX_PATTERN, "Farbe als #rrggbb angeben")
    .transform((v) => v.toLowerCase()),
  fontKey: z.enum(Object.keys(FONT_OPTIONS) as [FontKey, ...FontKey[]]),
  loginTitle: zf.optText(120),
  loginText: zf.optText(600),
  emailSenderName: zf.optText(80),
  emailFooter: zf.optText(600),
});

/** White label: colours, font, images, login page and e-mail look of the club. */
export async function updateBranding(_: FormState, formData: FormData): Promise<FormState> {
  const stored: string[] = [];
  try {
    const user = await writer("club:manage");
    const parsed = brandingSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);

    const files: Partial<Record<(typeof IMAGE_RULES)[keyof typeof IMAGE_RULES]["field"], string | null>> = {};
    const obsolete: string[] = [];
    for (const [input, rule] of Object.entries(IMAGE_RULES)) {
      const current = user.club[rule.field];
      const file = formData.get(input);
      if (file instanceof File && file.size > 0) {
        const name = await storeImage(file, [...rule.types], rule.max * 1024 * 1024);
        stored.push(name);
        files[rule.field] = name;
        if (current) obsolete.push(current);
      } else if (formData.get(`${input}Remove`) === "on" && current) {
        files[rule.field] = null;
        obsolete.push(current);
      }
    }
    await db.club.update({ where: { id: user.clubId }, data: { ...parsed.data, ...files } });
    await Promise.all(obsolete.map(deleteStoredFile));
    await logActivity({ clubId: user.clubId, userId: user.id, action: "branding_updated" });
    revalidatePath("/", "layout");
    const { warnings } = buildTheme(parsed.data.primaryColor, parsed.data.accentColor);
    return { ok: ["Erscheinungsbild gespeichert.", ...warnings].join(" ") };
  } catch (e) {
    await Promise.all(stored.map(deleteStoredFile));
    return handleError(e);
  }
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
        text: `Hallo ${name},\n\n${user.name} hat dir einen Zugang als ${ROLE_LABELS[role]} für ${user.club.name} eingerichtet. Lege über diesen Link dein Passwort fest:\n${clubUrl(user.club.slug, `/passwort/${token}`)}\n\nDer Link ist sieben Tage gültig.`,
        brand: mailBrand(user.club),
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

export async function updateMfaPolicy(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const user = await writer("club:manage");
    const policy = z.enum(["OPTIONAL", "BOARD", "ALL"]).safeParse(formData.get("mfaPolicy"));
    if (!policy.success) return { error: "Ungültige Auswahl." };
    await db.club.update({ where: { id: user.clubId }, data: { mfaPolicy: policy.data } });
    await logActivity({ clubId: user.clubId, userId: user.id, action: "settings_updated", detail: `Zwei-Faktor-Pflicht: ${policy.data}` });
    revalidatePath("/", "layout");
    return {
      ok:
        policy.data === "OPTIONAL"
          ? "Zwei-Faktor-Anmeldung ist freiwillig."
          : "Gespeichert. Betroffene Zugänge werden beim nächsten Seitenaufruf zur Einrichtung aufgefordert.",
    };
  } catch (e) {
    return handleError(e);
  }
}

/** Club admin resets the second factor of another login of the same club (lost phone). */
export async function resetUserMfa(formData: FormData) {
  await guarded(async () => {
    const user = await writer("club:manage");
    const targetId = String(formData.get("id"));
    if (targetId === user.id) {
      await flash("Deinen eigenen zweiten Faktor verwaltest du unter „Sicherheit“.", "error");
      return;
    }
    const target = await db.user.findFirst({ where: { id: targetId, clubId: user.clubId, isPlatformAdmin: false } });
    if (!target) return;
    await resetMfa(target.id, user);
    await flash(`Zwei-Faktor-Anmeldung von ${target.name} zurückgesetzt. Die Person wurde per E-Mail informiert.`);
  });
  revalidatePath("/einstellungen");
}
