"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { createSession, destroySession, hashPassword, homeFor, verifyPassword } from "@/lib/auth";
import { fromZod, zf, type FormState } from "@/lib/form";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { appUrl, findValidToken, issueToken } from "@/lib/tokens";
import { sendMail } from "@/lib/mail";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: zf.email(), password: z.string().min(1, "Passwort fehlt") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { email, password } = parsed.data;
  const limitKey = `login:${await clientIp()}:${email}`;
  if (!rateLimit(limitKey, 8)) {
    return { error: "Zu viele Anmeldeversuche. Bitte warte 15 Minuten." };
  }
  const user = await db.user.findUnique({ where: { email }, include: { member: true } });
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  if (!user || !valid) return { error: "E-Mail oder Passwort stimmen nicht." };
  if (!user.isPlatformAdmin && !user.clubId) return { error: "Dieser Zugang ist keinem Verein zugeordnet." };
  if (user.role === "MITGLIED" && user.member?.status === "AUSGETRETEN") return { error: "Dieser Mitgliedszugang ist nicht mehr aktiv." };
  resetRateLimit(limitKey); // only failed attempts count
  await createSession(user.id);
  await logActivity({ clubId: user.clubId, userId: user.id, action: "login" });
  const next = formData.get("next");
  redirect(typeof next === "string" && /^\/(?![\/\\])[^\\\s]*$/.test(next) ? next : homeFor(user));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: zf.email() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const ok = { ok: "Wenn ein Zugang mit dieser Adresse existiert, ist ein Link zum Zurücksetzen unterwegs. Er ist zwei Stunden gültig." };
  if (!rateLimit(`reset:${await clientIp()}`, 5)) return ok;
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user) {
    const token = await issueToken(user.id, "PASSWORD_RESET");
    await sendMail({
      to: user.email,
      subject: "Passwort zurücksetzen",
      text: `Hallo ${user.name},\n\nüber diesen Link legst du ein neues Passwort fest:\n${appUrl(`/passwort/${token}`)}\n\nDer Link ist zwei Stunden gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
    }).catch((e) => console.error(e));
  }
  return ok;
}

export async function setPassword(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z
    .object({ token: z.string().min(10), password: zf.password(), confirm: z.string() })
    .refine((d) => d.password === d.confirm, { message: "Die Passwörter stimmen nicht überein", path: ["confirm"] })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const token = await findValidToken(parsed.data.token);
  if (!token) return { error: "Dieser Link ist abgelaufen oder wurde schon verwendet. Fordere einen neuen an." };
  await db.$transaction([
    db.user.update({ where: { id: token.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    db.token.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: token.userId } }),
  ]);
  await createSession(token.userId);
  await flash("Passwort gespeichert. Willkommen!");
  redirect(homeFor(token.user));
}

/** Member self-service: a member already recorded by the club requests an activation link. */
export async function requestMemberAccess(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ club: z.string().min(1, "Bitte wähle deinen Verein"), email: zf.email() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const ok = {
    ok: "Danke! Wenn deine Adresse beim Verein hinterlegt ist, bekommst du gleich eine E-Mail mit einem Link zum Festlegen deines Passworts.",
  };
  if (!rateLimit(`member-access:${await clientIp()}`, 5)) return ok;

  const member = await db.member.findFirst({
    where: { club: { slug: parsed.data.club }, email: parsed.data.email, status: { not: "AUSGETRETEN" } },
    include: { club: true, user: true },
  });
  if (!member) return ok;

  let user = member.user;
  if (!user) {
    const existing = await db.user.findUnique({ where: { email: member.email } });
    if (existing) {
      // Address already has a login (e.g. a board account). Never issue a token for it here – "Passwort vergessen" covers that.
      if (existing.clubId === member.clubId) await db.member.update({ where: { id: member.id }, data: { userId: existing.id } });
      return ok;
    } else {
      user = await db.user.create({
        data: {
          email: member.email,
          name: `${member.firstName} ${member.lastName}`,
          role: "MITGLIED",
          clubId: member.clubId,
          member: { connect: { id: member.id } },
        },
      });
    }
  }
  // only first-time activation of a plain member login, and only to the login's own address
  if (user.role !== "MITGLIED" || user.passwordHash || user.email !== member.email) return ok;
  const token = await issueToken(user.id, "MEMBER_ACTIVATION");
  await sendMail({
    to: user.email,
    subject: `Dein Zugang beim ${member.club.name}`,
    text: `Hallo ${member.firstName},\n\nüber diesen Link legst du dein Passwort für den Mitgliederbereich des ${member.club.name} fest:\n${appUrl(`/passwort/${token}`)}\n\nDer Link ist drei Tage gültig.`,
  }).catch((e) => console.error(e));
  await logActivity({ clubId: member.clubId, userId: user.id, action: "member_access_requested" });
  return ok;
}
