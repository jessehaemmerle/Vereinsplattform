"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { User } from "@prisma/client";
import { db } from "@/lib/db";
import { createSession, destroySession, getCurrentUser, hashPassword, homeFor, usablePasskeys, verifyPassword } from "@/lib/auth";
import { fromZod, zf, type FormState } from "@/lib/form";
import { rateLimit, resetRateLimit } from "@/lib/rate-limit";
import { findValidToken, issueToken } from "@/lib/tokens";
import { sendMail } from "@/lib/mail";
import { mailBrand } from "@/lib/branding";
import { adminUrl, clubUrl } from "@/lib/hosts";
import { getTenant } from "@/lib/tenant";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";

/** Same-site path only: no "//host", no backslash tricks, no whitespace. */
const SAFE_PATH = /^\/(?![\/\\])[^\\\s]*$/;

async function clientIp() {
  const h = await headers();
  // X-Real-IP is set by Caddy from the TCP peer; the last X-Forwarded-For entry is the one added by our own proxy
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",").pop()?.trim() ?? "local";
}

/** A login belongs to exactly one host: its club's subdomain, or the admin host for platform admins. */
async function belongsHere(user: Pick<User, "clubId" | "isPlatformAdmin">) {
  const tenant = await getTenant();
  if (tenant.kind === "admin") return user.isPlatformAdmin;
  if (tenant.kind === "club") return !!tenant.club && user.clubId === tenant.club.id;
  return false;
}

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: zf.email(), password: z.string().min(1, "Passwort fehlt") }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const { email, password } = parsed.data;
  const limitKey = `login:${await clientIp()}:${email}`;
  // per IP+address, plus a per-address cap that cannot be bypassed by changing IPs
  if (!rateLimit(limitKey, 8) || !rateLimit(`login-mail:${email}`, 30, 60 * 60_000)) {
    return { error: "Zu viele Anmeldeversuche. Bitte warte 15 Minuten." };
  }
  const user = await db.user.findUnique({ where: { email }, include: { member: true } });
  const valid = await verifyPassword(password, user?.passwordHash ?? null);
  // same message for "wrong password" and "account of another club" – no information about other tenants
  if (!user || !valid || !(await belongsHere(user))) return { error: "E-Mail oder Passwort stimmen nicht." };
  if (user.role === "MITGLIED" && user.member?.status === "AUSGETRETEN") return { error: "Dieser Mitgliedszugang ist nicht mehr aktiv." };
  resetRateLimit(limitKey); // only failed attempts count
  const next = formData.get("next");
  const target = typeof next === "string" && SAFE_PATH.test(next) ? next : homeFor(user);
  if (user.totpEnabledAt || (await usablePasskeys(user.id)) > 0) {
    await createSession(user.id, { mfaPending: true });
    redirect(`/login/mfa?next=${encodeURIComponent(target)}`);
  }
  await createSession(user.id);
  await logActivity({ clubId: user.clubId, userId: user.id, action: "login" });
  redirect(target);
}

export async function logout() {
  const user = await getCurrentUser();
  await destroySession();
  // leaving a club the admin was acting in brings them back to the platform administration
  if (user?.impersonating) redirect(adminUrl(`/admin/vereine/${user.clubId}`));
  redirect("/login");
}

export async function requestPasswordReset(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: zf.email() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const ok = { ok: "Wenn ein Zugang mit dieser Adresse existiert, ist ein Link zum Zurücksetzen unterwegs. Er ist zwei Stunden gültig." };
  if (!rateLimit(`reset:${await clientIp()}`, 5)) return ok;
  const tenant = await getTenant();
  const user = await db.user.findUnique({ where: { email: parsed.data.email } });
  if (user && (await belongsHere(user))) {
    const token = await issueToken(user.id, "PASSWORD_RESET");
    const club = tenant.kind === "club" ? tenant.club : null;
    const link = club ? clubUrl(club.slug, `/passwort/${token}`) : adminUrl(`/passwort/${token}`);
    await sendMail({
      to: user.email,
      subject: "Passwort zurücksetzen",
      text: `Hallo ${user.name},\n\nüber diesen Link legst du ein neues Passwort fest:\n${link}\n\nDer Link ist zwei Stunden gültig. Wenn du das nicht angefordert hast, kannst du diese E-Mail ignorieren.`,
      brand: club ? mailBrand(club) : null,
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
  if (!token || !(await belongsHere(token.user))) return { error: "Dieser Link ist abgelaufen oder wurde schon verwendet. Fordere einen neuen an." };
  await db.$transaction([
    db.user.update({ where: { id: token.userId }, data: { passwordHash: await hashPassword(parsed.data.password) } }),
    db.token.update({ where: { id: token.id }, data: { usedAt: new Date() } }),
    db.session.deleteMany({ where: { userId: token.userId } }),
  ]);
  await flash("Passwort gespeichert.");
  // a password reset must not bypass the second factor
  if (token.user.totpEnabledAt || (await usablePasskeys(token.userId)) > 0) {
    await createSession(token.userId, { mfaPending: true });
    redirect(`/login/mfa?next=${encodeURIComponent(homeFor(token.user))}`);
  }
  await createSession(token.userId);
  redirect(homeFor(token.user));
}

/** Member self-service on the club's subdomain: a member already recorded by the club requests an activation link. */
export async function requestMemberAccess(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = z.object({ email: zf.email() }).safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fromZod(parsed.error);
  const ok = {
    ok: "Danke! Wenn deine Adresse beim Verein hinterlegt ist, bekommst du gleich eine E-Mail mit einem Link zum Festlegen deines Passworts.",
  };
  const tenant = await getTenant();
  if (tenant.kind !== "club" || !tenant.club) return { error: "Bitte öffne die Seite über die Adresse deines Vereins." };
  if (!rateLimit(`member-access:${await clientIp()}`, 5)) return ok;
  const club = tenant.club;

  const member = await db.member.findFirst({
    where: { clubId: club.id, email: parsed.data.email, status: { not: "AUSGETRETEN" } },
    include: { user: true },
  });
  if (!member) return ok;

  let user = member.user;
  if (!user) {
    const existing = await db.user.findUnique({ where: { email: member.email } });
    if (existing) {
      // Address already has a login (e.g. a board account). Never issue a token for it here – "Passwort vergessen" covers that.
      if (existing.clubId === member.clubId) await db.member.update({ where: { id: member.id }, data: { userId: existing.id } });
      return ok;
    }
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
  // only first-time activation of a plain member login, and only to the login's own address
  if (user.role !== "MITGLIED" || user.passwordHash || user.email !== member.email) return ok;
  const token = await issueToken(user.id, "MEMBER_ACTIVATION");
  await sendMail({
    to: user.email,
    subject: `Dein Zugang beim ${club.name}`,
    text: `Hallo ${member.firstName},\n\nüber diesen Link legst du dein Passwort für den Mitgliederbereich des ${club.name} fest:\n${clubUrl(club.slug, `/passwort/${token}`)}\n\nDer Link ist drei Tage gültig.`,
    brand: mailBrand(club),
  }).catch((e) => console.error(e));
  await logActivity({ clubId: member.clubId, userId: user.id, action: "member_access_requested" });
  return ok;
}
