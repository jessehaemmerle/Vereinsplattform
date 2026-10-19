"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type Module } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { generateLicenseKey } from "@/lib/license";
import { slugify } from "@/lib/format";
import { issueToken, appUrl } from "@/lib/tokens";
import { sendMail } from "@/lib/mail";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";
import { deleteStoredFile } from "@/lib/storage";

const MODULES = ["MITGLIEDER", "FINANZEN", "EVENTS", "NOTIZEN", "DOKUMENTE", "KOMMUNIKATION"] as const;

async function uniqueSlug(name: string) {
  const base = slugify(name) || "verein";
  let slug = base;
  for (let i = 2; await db.club.findUnique({ where: { slug } }); i++) slug = `${base}-${i}`;
  return slug;
}

export async function createClub(_: FormState, formData: FormData): Promise<FormState> {
  let clubId = "";
  try {
    const admin = await requirePlatformAdmin();
    const parsed = z
      .object({ name: zf.text("Vereinsname", 100), adminName: zf.text("Name", 100), adminEmail: zf.email(), licenseId: z.string().optional() })
      .safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const { name, adminName, adminEmail, licenseId } = parsed.data;
    if (await db.user.findUnique({ where: { email: adminEmail } }))
      return { error: "Für diese E-Mail-Adresse gibt es schon einen Zugang.", fieldErrors: { adminEmail: "Bereits vergeben" } };
    const club = await db.club.create({
      data: { name, slug: await uniqueSlug(name), email: adminEmail, users: { create: { name: adminName, email: adminEmail, role: "ADMIN" } } },
      include: { users: true },
    });
    clubId = club.id;
    if (licenseId) await db.license.updateMany({ where: { id: licenseId, clubId: null }, data: { clubId: club.id } });
    const token = await issueToken(club.users[0].id, "PASSWORD_SETUP");
    await sendMail({
      to: adminEmail,
      subject: `Dein Zugang zur Vereinsplattform für ${name}`,
      text: `Hallo ${adminName},\n\nfür ${name} wurde ein Bereich auf der Vereinsplattform eingerichtet, du bist Vereins-Admin. Lege über diesen Link dein Passwort fest:\n${appUrl(`/passwort/${token}`)}\n\nDer Link ist sieben Tage gültig.`,
    });
    await logActivity({ userId: admin.id, action: "club_created", detail: name });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: "Ein Verein mit diesem Namen existiert bereits.", fieldErrors: { name: "Bereits vergeben" } };
    return handleError(e);
  }
  await flash("Verein angelegt, die Einladung an den Vereins-Admin ist unterwegs.");
  revalidatePath("/admin");
  redirect(`/admin/vereine/${clubId}`);
}

export async function updateModules(clubId: string, _: FormState, formData: FormData): Promise<FormState> {
  await requirePlatformAdmin();
  const modules = formData.getAll("modules").filter((m): m is Module => (MODULES as readonly string[]).includes(String(m))) as Module[];
  await db.club.update({ where: { id: clubId }, data: { modules } });
  revalidatePath(`/admin/vereine/${clubId}`);
  return { ok: "Module gespeichert." };
}

export async function resendAdminInvite(formData: FormData) {
  await requirePlatformAdmin();
  const user = await db.user.findUnique({ where: { id: String(formData.get("userId")) }, include: { club: true } });
  if (user && !user.passwordHash) {
    const token = await issueToken(user.id, "PASSWORD_SETUP");
    await sendMail({
      to: user.email,
      subject: "Dein Zugang zur Vereinsplattform",
      text: `Hallo ${user.name},\n\nhier ist dein neuer Link zum Festlegen des Passworts:\n${appUrl(`/passwort/${token}`)}`,
    });
    await flash(`Einladung erneut an ${user.email} gesendet.`);
  }
  redirect(`/admin/vereine/${user?.clubId ?? ""}`);
}

export async function deleteClub(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const club = await db.club.findUnique({ where: { id }, include: { documents: true } });
  if (!club) redirect("/admin");
  if (String(formData.get("confirm")).trim() !== club.name) {
    await flash("Zum Löschen bitte den Vereinsnamen exakt eingeben.", "error");
    redirect(`/admin/vereine/${id}`);
  }
  // keep the platform admin account even if it was assigned to this club
  await db.user.updateMany({ where: { clubId: id, isPlatformAdmin: true }, data: { clubId: null } });
  await db.club.delete({ where: { id } });
  await Promise.all([...club.documents.map((d) => deleteStoredFile(d.storageName)), club.logoPath ? deleteStoredFile(club.logoPath) : null]);
  await logActivity({ userId: admin.id, action: "club_deleted", detail: club.name });
  await flash(`${club.name} und alle Daten wurden gelöscht.`);
  revalidatePath("/admin");
  redirect("/admin");
}

const licenseSchema = z
  .object({
    name: zf.text("Bezeichnung", 120),
    status: z.enum(["ACTIVE", "TRIAL", "SUSPENDED", "EXPIRED"]),
    maxUsers: zf.optInt(),
    maxMembers: zf.optInt(),
    validFrom: zf.optDate(),
    validUntil: zf.optDate(),
    notes: zf.optText(2000),
    clubId: z.preprocess((v) => (v ? v : null), z.string().nullable()),
  })
  .refine((d) => !d.validFrom || !d.validUntil || d.validUntil >= d.validFrom, { message: "Ende liegt vor dem Beginn", path: ["validUntil"] });

export async function saveLicense(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  try {
    const admin = await requirePlatformAdmin();
    const parsed = licenseSchema.safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    if (id) await db.license.update({ where: { id }, data: parsed.data });
    else await db.license.create({ data: { ...parsed.data, key: generateLicenseKey() } });
    await logActivity({ userId: admin.id, action: id ? "license_updated" : "license_created", detail: parsed.data.name });
  } catch (e) {
    return handleError(e);
  }
  await flash("Lizenz gespeichert.");
  revalidatePath("/admin");
  redirect("/admin/lizenzen");
}

export async function deleteLicense(formData: FormData) {
  await requirePlatformAdmin();
  await db.license.delete({ where: { id: String(formData.get("id")) } }).catch(() => undefined);
  await flash("Lizenz gelöscht.");
  revalidatePath("/admin");
  redirect("/admin/lizenzen");
}
