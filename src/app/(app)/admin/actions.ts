"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma, type Module } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { requirePlatformAdmin } from "@/lib/auth";
import { formObject, fromZod, handleError, zf, type FormState } from "@/lib/form";
import { generateLicenseKey } from "@/lib/license";
import { createLicenseFromPlan, describeChanges, extendedUntil, logLicense } from "@/lib/license-ops";
import { slugify } from "@/lib/format";
import { clubUrl, isValidSlug } from "@/lib/hosts";
import { issueToken } from "@/lib/tokens";
import { assignOneTimePassword } from "@/lib/initial-password";
import { ONE_TIME_PASSWORD_DAYS } from "@/lib/one-time-password";
import { randomToken, sha256 } from "@/lib/crypto";
import { describeMailError, sendMail, trySendMail, verifyMailSetup } from "@/lib/mail";
import { mailBrand } from "@/lib/branding";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";
import { deleteStoredFile } from "@/lib/storage";
import { clearTenantCache } from "@/lib/tenant-cache";
import { resetMfa } from "@/lib/mfa-reset";
import { draftForLicense } from "@/lib/invoices";

const MODULES = ["MITGLIEDER", "FINANZEN", "EVENTS", "NOTIZEN", "DOKUMENTE", "KOMMUNIKATION"] as const;
const SLUG_GRACE_DAYS = 90;

/** A subdomain is taken by another club's current slug or by a still-redirecting previous slug. */
async function slugTaken(slug: string, exceptClubId?: string) {
  const graceStart = new Date(Date.now() - SLUG_GRACE_DAYS * 86_400_000);
  const clash = await db.club.findFirst({
    where: {
      id: exceptClubId ? { not: exceptClubId } : undefined,
      OR: [{ slug }, { previousSlug: slug, slugChangedAt: { gte: graceStart } }],
    },
  });
  return !!clash;
}

async function suggestSlug(name: string) {
  const base = (slugify(name) || "verein").slice(0, 36).replace(/-+$/, "");
  let slug = isValidSlug(base) ? base : `verein-${base}`.slice(0, 36);
  for (let i = 2; await slugTaken(slug); i++) slug = `${base}-${i}`;
  return slug;
}

const slugField = z
  .string()
  .trim()
  .toLowerCase()
  .refine(isValidSlug, "Nur Kleinbuchstaben, Ziffern und Bindestriche (2–40 Zeichen); reservierte Namen wie admin oder www sind nicht erlaubt");

export async function createClub(_: FormState, formData: FormData): Promise<FormState> {
  let clubId = "";
  let mailSent = true;
  let oneTime = false;
  try {
    const admin = await requirePlatformAdmin();
    const parsed = z
      .object({
        name: zf.text("Vereinsname", 100),
        slug: z.preprocess((v) => (v === "" ? undefined : v), slugField.optional()),
        adminName: zf.text("Name", 100),
        adminEmail: zf.email(),
        license: z.string().optional(),
        access: z.enum(["invite", "oneTime"]).catch("invite"),
      })
      .safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const { name, adminName, adminEmail, license } = parsed.data;
    if (await db.user.findUnique({ where: { email: adminEmail } }))
      return { error: "Für diese E-Mail-Adresse gibt es schon einen Zugang.", fieldErrors: { adminEmail: "Bereits vergeben" } };
    const slug = parsed.data.slug ?? (await suggestSlug(name));
    if (await slugTaken(slug)) return { error: "Diese Subdomain ist bereits vergeben.", fieldErrors: { slug: "Bereits vergeben" } };

    const plan = license?.startsWith("plan:") ? await db.licensePlan.findUnique({ where: { id: license.slice(5) } }) : null;
    // club, first admin and license: all or nothing
    const club = await db.$transaction(async (tx) => {
      const created = await tx.club.create({
        data: { name, slug, email: adminEmail, users: { create: { name: adminName, email: adminEmail, role: "ADMIN" } } },
        include: { users: true },
      });
      if (license?.startsWith("license:")) {
        await tx.license.updateMany({ where: { id: license.slice(8), clubId: null }, data: { clubId: created.id } });
      }
      return created;
    });
    clubId = club.id;
    clearTenantCache();
    if (plan) await createLicenseFromPlan(plan, { clubId: club.id, name: `${plan.name} – ${name}`, userId: admin.id });
    else if (license?.startsWith("license:")) await logLicense(license.slice(8), admin.id, "zugewiesen", name);
    oneTime = parsed.data.access === "oneTime";
    if (oneTime) {
      // no e-mail: the password is shown in the admin console and handed over personally
      await assignOneTimePassword(club.users[0].id);
      await logActivity({ clubId: club.id, userId: admin.id, action: "one_time_password_created", detail: adminEmail });
    } else {
      const token = await issueToken(club.users[0].id, "PASSWORD_SETUP");
      mailSent = await trySendMail({
        to: adminEmail,
        subject: `Dein Zugang für ${name}`,
        text: `Hallo ${adminName},\n\nfür ${name} wurde ein eigener Bereich eingerichtet, du bist Vereins-Admin. Er ist erreichbar unter ${clubUrl(slug)}\n\nLege über diesen Link dein Passwort fest:\n${clubUrl(slug, `/passwort/${token}`)}\n\nDer Link ist sieben Tage gültig. Unter Einstellungen → Erscheinungsbild kannst du Farben, Logo und Schrift eures Vereins festlegen.`,
        brand: mailBrand(club),
      });
    }
    await logActivity({ userId: admin.id, action: "club_created", detail: name });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: "Ein Verein mit diesem Namen existiert bereits.", fieldErrors: { name: "Bereits vergeben" } };
    return handleError(e);
  }
  await flash(
    oneTime
      ? "Verein angelegt. Das Einmal-Passwort für den Vereins-Admin steht unten bei den Vorstands-Zugängen."
      : mailSent
        ? "Verein angelegt, die Einladung an den Vereins-Admin ist unterwegs."
        : "Verein angelegt. Die Einladungs-E-Mail konnte aber nicht gesendet werden – bitte unter „Rechtliches“ den Mailversand testen und danach hier „Einladung erneut senden“ wählen.",
    mailSent ? "success" : "error",
  );
  revalidatePath("/admin");
  redirect(`/admin/vereine/${clubId}`);
}

export async function changeSlug(clubId: string, _: FormState, formData: FormData): Promise<FormState> {
  try {
    const admin = await requirePlatformAdmin();
    const parsed = z.object({ slug: slugField }).safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    const club = await db.club.findUnique({ where: { id: clubId } });
    if (!club) return { error: "Verein nicht gefunden." };
    const slug = parsed.data.slug;
    if (slug === club.slug) return { ok: "Die Subdomain ist unverändert." };
    if (await slugTaken(slug, clubId)) return { error: "Diese Subdomain ist bereits vergeben.", fieldErrors: { slug: "Bereits vergeben" } };
    await db.$transaction([
      // a club re-using a name another club gave up ends that club's redirect
      db.club.updateMany({ where: { previousSlug: slug, id: { not: clubId } }, data: { previousSlug: null, slugChangedAt: null } }),
      db.club.update({ where: { id: clubId }, data: { slug, previousSlug: club.slug, slugChangedAt: new Date() } }),
    ]);
    clearTenantCache();
    await logActivity({ clubId, userId: admin.id, action: "slug_changed", detail: `${club.slug} → ${slug}` });
    revalidatePath(`/admin/vereine/${clubId}`);
    return { ok: `Neue Adresse: ${clubUrl(slug)}. Die alte leitet ${SLUG_GRACE_DAYS} Tage lang weiter.` };
  } catch (e) {
    return handleError(e);
  }
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
  if (user?.club && !user.passwordHash) {
    const token = await issueToken(user.id, "PASSWORD_SETUP");
    const sent = await trySendMail({
      to: user.email,
      subject: `Dein Zugang für ${user.club.name}`,
      text: `Hallo ${user.name},\n\nhier ist dein neuer Link zum Festlegen des Passworts:\n${clubUrl(user.club.slug, `/passwort/${token}`)}`,
      brand: mailBrand(user.club),
    });
    await flash(
      sent ? `Einladung erneut an ${user.email} gesendet.` : `Die E-Mail konnte nicht gesendet werden – bitte den Mailversand (SMTP) prüfen.`,
      sent ? "success" : "error",
    );
  }
  redirect(`/admin/vereine/${user?.clubId ?? ""}`);
}

/** "Als Verein einloggen": one-time ticket redeemed on the club's own host, valid for one hour. */
export async function startImpersonation(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const club = await db.club.findUnique({ where: { id: String(formData.get("clubId")) } });
  if (!club) redirect("/admin");
  const token = randomToken();
  await db.impersonationTicket.create({ data: { tokenHash: sha256(token), adminId: admin.id, clubId: club.id, expiresAt: new Date(Date.now() + 2 * 60_000) } });
  redirect(clubUrl(club.slug, `/api/impersonate?t=${token}`));
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
  await db.user.updateMany({ where: { clubId: id, isPlatformAdmin: true }, data: { clubId: null } });
  await db.club.delete({ where: { id } });
  clearTenantCache();
  const files = [...club.documents.map((d) => d.storageName), club.logoPath, club.logoDarkPath, club.faviconPath, club.loginImagePath].filter(
    Boolean,
  ) as string[];
  await Promise.all(files.map(deleteStoredFile));
  await logActivity({ userId: admin.id, action: "club_deleted", detail: club.name });
  await flash(`${club.name} und alle Daten wurden gelöscht.`);
  revalidatePath("/admin");
  redirect("/admin");
}

// ---------- License plans ----------

const planSchema = z.object({
  priceCents: z.preprocess(
    (v) => (typeof v === "string" ? (v.trim() === "" ? null : Math.round(Number(v.replace(/\s/g, "").replace(",", ".")) * 100)) : v),
    z.number({ error: "Preis ist keine Zahl" }).int().min(0).max(100_000_00).nullable(),
  ),
  publicListed: zf.checkbox(),
  highlighted: zf.checkbox(),
  sortOrder: zf.optInt(),
  name: zf.text("Name", 80),
  description: zf.optText(500),
  maxUsers: zf.optInt(),
  maxMembers: zf.optInt(),
  durationMonths: zf.optInt(),
  active: zf.checkbox(),
});

export async function savePlan(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  try {
    await requirePlatformAdmin();
    const parsed = planSchema.safeParse({ active: "false", publicListed: "false", highlighted: "false", ...formObject(formData) });
    if (!parsed.success) return fromZod(parsed.error);
    const modules = formData.getAll("modules").filter((m) => (MODULES as readonly string[]).includes(String(m))) as Module[];
    const data = { ...parsed.data, sortOrder: parsed.data.sortOrder ?? 0, modules };
    if (id) await db.licensePlan.update({ where: { id }, data });
    else await db.licensePlan.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002")
      return { error: "Ein Paket mit diesem Namen existiert bereits.", fieldErrors: { name: "Bereits vergeben" } };
    return handleError(e);
  }
  await flash("Paket gespeichert.");
  revalidatePath("/admin/pakete");
  redirect("/admin/pakete");
}

export async function deletePlan(formData: FormData) {
  await requirePlatformAdmin();
  await db.licensePlan.delete({ where: { id: String(formData.get("id")) } }).catch(() => undefined);
  await flash("Paket gelöscht. Bestehende Lizenzen bleiben unverändert.");
  redirect("/admin/pakete");
}

// ---------- Licenses ----------

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
    planId: z.preprocess((v) => (v ? v : null), z.string().nullable()),
    applyPlanModules: zf.checkbox(),
  })
  .refine((d) => !d.validFrom || !d.validUntil || d.validUntil >= d.validFrom, { message: "Ende liegt vor dem Beginn", path: ["validUntil"] });

export async function saveLicense(id: string | null, _: FormState, formData: FormData): Promise<FormState> {
  let licenseId = id;
  try {
    const admin = await requirePlatformAdmin();
    const parsed = licenseSchema.safeParse({ applyPlanModules: "false", ...formObject(formData) });
    if (!parsed.success) return fromZod(parsed.error);
    const { applyPlanModules, ...data } = parsed.data;
    if (id) {
      const before = await db.license.findUnique({ where: { id } });
      if (!before) return { error: "Lizenz nicht gefunden." };
      const untilChanged = before.validUntil?.getTime() !== data.validUntil?.getTime();
      await db.license.update({ where: { id }, data: { ...data, ...(untilChanged ? { remindersSent: [] } : {}) } });
      const changes = describeChanges(before, data);
      if (changes) await logLicense(id, admin.id, "geändert", changes);
    } else {
      const created = await db.license.create({ data: { ...data, key: generateLicenseKey() } });
      licenseId = created.id;
      await logLicense(created.id, admin.id, "erstellt");
    }
    if (applyPlanModules && data.planId && data.clubId) {
      const plan = await db.licensePlan.findUnique({ where: { id: data.planId } });
      if (plan) await db.club.update({ where: { id: data.clubId }, data: { modules: plan.modules } });
    }
  } catch (e) {
    return handleError(e);
  }
  await flash("Lizenz gespeichert.");
  revalidatePath("/admin");
  redirect(`/admin/lizenzen/${licenseId}`);
}

export async function extendLicense(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const months = Math.min(120, Math.max(1, Number(formData.get("months")) || 12));
  const license = await db.license.findUnique({ where: { id } });
  if (!license) redirect("/admin/lizenzen");
  const validUntil = extendedUntil(license.validUntil, months);
  await db.license.update({
    where: { id },
    data: { validUntil, remindersSent: [], status: license.status === "EXPIRED" ? "ACTIVE" : license.status },
  });
  await logLicense(id, admin.id, "verlängert", describeChanges(license, { validUntil }) + ` (+${months} Monate)`);
  const plan = license.planId ? await db.licensePlan.findUnique({ where: { id: license.planId } }) : null;
  const draft = plan ? await draftForLicense({ ...license, validUntil }, plan, license.validUntil ?? undefined) : null;
  if (draft) await logLicense(id, admin.id, "Rechnungsentwurf erstellt");
  await flash(draft ? "Lizenz verlängert – ein Rechnungsentwurf liegt unter „Rechnungen“ bereit." : "Lizenz verlängert.");
  revalidatePath(`/admin/lizenzen/${id}`);
  redirect(`/admin/lizenzen/${id}`);
}

export async function createLicenseForPlan(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const plan = await db.licensePlan.findUnique({ where: { id: String(formData.get("planId")) } });
  const clubId = String(formData.get("clubId") ?? "") || null;
  if (!plan) redirect("/admin/lizenzen");
  const club = clubId ? await db.club.findUnique({ where: { id: clubId } }) : null;
  const license = await createLicenseFromPlan(plan, { clubId: club?.id ?? null, name: club ? `${plan.name} – ${club.name}` : plan.name, userId: admin.id });
  await flash("Lizenz aus Paket erstellt.");
  redirect(`/admin/lizenzen/${license.id}`);
}

export async function deleteLicense(formData: FormData) {
  await requirePlatformAdmin();
  await db.license.delete({ where: { id: String(formData.get("id")) } }).catch(() => undefined);
  await flash("Lizenz gelöscht.");
  revalidatePath("/admin");
  redirect("/admin/lizenzen");
}

/** Platform admin resets the second factor of a club login (lost phone). */
export async function resetClubUserMfa(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const target = await db.user.findFirst({ where: { id: String(formData.get("userId")), isPlatformAdmin: false } });
  if (target) {
    await resetMfa(target.id, admin);
    await flash(`Zwei-Faktor-Anmeldung von ${target.name} zurückgesetzt. Die Person wurde per E-Mail informiert.`);
  }
  redirect(`/admin/vereine/${target?.clubId ?? ""}`);
}

/** One-time password for a board account of a club, shown in the admin console (e.g. first admin, lost password). */
export async function createOneTimePassword(formData: FormData) {
  const admin = await requirePlatformAdmin();
  const target = await db.user.findFirst({
    where: { id: String(formData.get("userId")), isPlatformAdmin: false, clubId: { not: null }, role: { not: "MITGLIED" } },
  });
  if (target) {
    await assignOneTimePassword(target.id);
    await logActivity({ clubId: target.clubId, userId: admin.id, action: "one_time_password_created", detail: target.email });
    await flash(`Einmal-Passwort für ${target.name} erstellt. Es steht bei den Vorstands-Zugängen und gilt ${ONE_TIME_PASSWORD_DAYS} Tage.`);
  }
  revalidatePath(`/admin/vereine/${target?.clubId ?? ""}`);
  redirect(`/admin/vereine/${target?.clubId ?? ""}`);
}

const optional = (max = 300) => zf.optText(max);

export async function saveLegal(_: FormState, formData: FormData): Promise<FormState> {
  try {
    const admin = await requirePlatformAdmin();
    const parsed = z
      .object({
        operatorName: optional(200),
        legalForm: optional(100),
        street: optional(200),
        zipCity: optional(200),
        country: optional(100),
        email: z.preprocess((v) => (v === "" ? null : v), zf.email().nullable()),
        phone: optional(60),
        vatId: optional(40),
        companyRegister: optional(200),
        businessPurpose: optional(300),
        authority: optional(200),
        chamber: optional(300),
        representative: optional(200),
        hostingProvider: optional(300),
        mailProvider: optional(300),
        contactEmail: z.preprocess((v) => (v === "" ? null : v), zf.email().nullable()),
      })
      .safeParse(formObject(formData));
    if (!parsed.success) return fromZod(parsed.error);
    await db.platformSettings.upsert({ where: { id: "default" }, create: { id: "default", ...parsed.data }, update: parsed.data });
    await logActivity({ userId: admin.id, action: "legal_updated" });
    revalidatePath("/", "layout");
    return { ok: "Angaben gespeichert. Impressum und Datenschutzerklärung sind aktualisiert." };
  } catch (e) {
    return handleError(e);
  }
}

export async function markRequestHandled(formData: FormData) {
  await requirePlatformAdmin();
  const id = String(formData.get("id"));
  const req = await db.contactRequest.findUnique({ where: { id } });
  if (req) await db.contactRequest.update({ where: { id }, data: { handledAt: req.handledAt ? null : new Date() } });
  revalidatePath("/admin/anfragen");
}

/** Checks the SMTP connection and sends a test mail to the signed-in platform admin. */
export async function sendTestMail(): Promise<FormState> {
  const admin = await requirePlatformAdmin();
  const check = await verifyMailSetup();
  if (!check.ok) return { error: check.message };
  try {
    await sendMail({ to: admin.email, subject: "Test-E-Mail", text: `Hallo ${admin.name},\n\nder Mailversand der Plattform funktioniert.` });
    return { ok: `Test-E-Mail an ${admin.email} gesendet. Kommt sie nicht an, Spam-Ordner und SPF/DKIM der Absenderdomain prüfen.` };
  } catch (error) {
    return { error: describeMailError(error) };
  }
}
