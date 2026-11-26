import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import bcrypt from "bcryptjs";
import type { MfaPolicy, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { can, type Permission } from "@/lib/permissions";
import { getTenant } from "@/lib/tenant";
import { protocol, requestHost } from "@/lib/hosts";

const COOKIE = "vp_session";
const SESSION_DAYS = 30;
const dummyHash = bcrypt.hash("timing-dummy", 12);

export async function hashPassword(password: string) {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string | null) {
  if (!hash) {
    // keep timing similar for unknown users
    await bcrypt.compare(password, await dummyHash);
    return false;
  }
  return bcrypt.compare(password, hash);
}

const MFA_PENDING_MINUTES = 10;

function setCookie(jar: Awaited<ReturnType<typeof cookies>>, token: string, expiresAt: Date) {
  jar.set(COOKIE, token, { httpOnly: true, sameSite: "lax", secure: protocol() === "https", path: "/", expires: expiresAt });
}

export async function createSession(userId: string, opts: { impersonatedClubId?: string; hours?: number; mfaPending?: boolean } = {}) {
  const token = randomToken();
  const ms = opts.mfaPending ? MFA_PENDING_MINUTES * 60_000 : opts.hours ? opts.hours * 3_600_000 : SESSION_DAYS * 86_400_000;
  const expiresAt = new Date(Date.now() + ms);
  await db.session.create({
    data: { id: sha256(token), userId, expiresAt, impersonatedClubId: opts.impersonatedClubId ?? null, mfaPending: !!opts.mfaPending },
  });
  if (!opts.impersonatedClubId && !opts.mfaPending) await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  setCookie(await cookies(), token, expiresAt);
}

/** Second factor confirmed: the pending session becomes a full one (new token, so a leaked pending cookie is useless). */
export async function completeMfa(sessionId: string, userId: string) {
  await db.session.delete({ where: { id: sessionId } });
  await createSession(userId);
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

/** Session of this request with its user, already checked against the host (tenant). */
const loadSession = cache(async () => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { club: true, member: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  const tenant = await getTenant();
  const base = session.user;
  const mfaEnabled = !!base.totpEnabledAt || (await usablePasskeys(base.id)) > 0;

  if (session.impersonatedClubId) {
    // platform admin acting as club admin – only valid on that club's host; MFA was done on the admin host
    if (!base.isPlatformAdmin || tenant.kind !== "club" || tenant.club?.id !== session.impersonatedClubId) return null;
    const user = {
      ...base,
      clubId: tenant.club.id,
      club: tenant.club,
      role: "ADMIN" as const,
      member: null,
      impersonating: { until: session.expiresAt },
      mfaEnabled,
      mfaSetupRequired: false,
    };
    return { session, user };
  }

  const valid = tenant.kind === "admin" ? base.isPlatformAdmin : tenant.kind === "club" ? !!tenant.club && base.clubId === tenant.club.id : false;
  if (!valid) return null;
  const user = { ...base, impersonating: null as null | { until: Date }, mfaEnabled, mfaSetupRequired: !mfaEnabled && mfaRequired(base, base.club) };
  return { session, user };
});

/** Passkeys are bound to the host they were created on (WebAuthn RP ID); only those of this host can be used here. */
export async function usablePasskeys(userId: string) {
  const host = requestHost(await headers());
  if (!host) return 0;
  return db.passkey.count({ where: { userId, rpId: host.replace(/:\d+$/, "") } });
}

/** Platform admins always; club members according to the club's policy. */
export function mfaRequired(user: { isPlatformAdmin: boolean; role: Role }, club: { mfaPolicy: MfaPolicy } | null) {
  if (user.isPlatformAdmin && !club) return true;
  if (!club) return false;
  return club.mfaPolicy === "ALL" || (club.mfaPolicy === "BOARD" && user.role !== "MITGLIED");
}

/** The signed-in user. Null while the second factor is still outstanding. */
export const getCurrentUser = cache(async () => {
  const loaded = await loadSession();
  if (!loaded || loaded.session.mfaPending) return null;
  return loaded.user;
});

/** Password accepted, waiting for the second factor (only for the /login/mfa step). */
export async function getPendingMfa() {
  const loaded = await loadSession();
  return loaded?.session.mfaPending ? loaded : null;
}

/** Full session including its id (for passkey ceremonies and sensitive changes). */
export async function getActiveSession() {
  const loaded = await loadSession();
  return loaded && !loaded.session.mfaPending ? loaded : null;
}

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

/**
 * Signed-in user. Users who must use MFA but have not set it up are sent to /sicherheit until they have –
 * enforced here so that Server Actions cannot bypass it either.
 */
export async function requireUser(opts: { allowMfaSetup?: boolean } = {}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.mfaSetupRequired && !opts.allowMfaSetup) redirect("/sicherheit");
  return user;
}

/** A user who belongs to a club (staff or member). */
export async function requireClubUser() {
  const user = await requireUser();
  if (!user.club) redirect("/login");
  return user as CurrentUser & { club: NonNullable<CurrentUser["club"]>; clubId: string };
}

/** A club user who holds the given permission. Members are sent to their own area. */
export async function requirePermission(permission: Permission) {
  const user = await requireClubUser();
  if (!can(user.role, permission)) {
    if (user.role === "MITGLIED") redirect("/mein-bereich");
    notFound();
  }
  return user;
}

/** Platform administration is only reachable on the admin host, never while acting inside a club. */
export async function requirePlatformAdmin() {
  const tenant = await getTenant();
  if (tenant.kind !== "admin") notFound();
  const user = await requireUser();
  if (!user.isPlatformAdmin || user.impersonating) notFound();
  return user;
}

export function homeFor(user: { isPlatformAdmin: boolean; clubId: string | null; role: Role }) {
  if (!user.clubId) return user.isPlatformAdmin ? "/admin" : "/login";
  return user.role === "MITGLIED" ? "/mein-bereich" : "/dashboard";
}

export function userCan(user: { role: Role } | null, permission: Permission) {
  return !!user && can(user.role, permission);
}
