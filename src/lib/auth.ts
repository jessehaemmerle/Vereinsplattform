import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/crypto";
import { can, type Permission } from "@/lib/permissions";

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

export async function createSession(userId: string) {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await db.session.create({ data: { id: sha256(token), userId, expiresAt } });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
  const jar = await cookies();
  jar.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https://"),
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

export const getCurrentUser = cache(async () => {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const session = await db.session.findUnique({
    where: { id: sha256(token) },
    include: { user: { include: { club: true, member: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export type CurrentUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/** A user who belongs to a club (staff or member). */
export async function requireClubUser() {
  const user = await requireUser();
  if (!user.club) redirect(user.isPlatformAdmin ? "/admin" : "/login");
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

export async function requirePlatformAdmin() {
  const user = await requireUser();
  if (!user.isPlatformAdmin) notFound();
  return user;
}

export function homeFor(user: { isPlatformAdmin: boolean; clubId: string | null; role: Role }) {
  if (!user.clubId) return user.isPlatformAdmin ? "/admin" : "/login";
  return user.role === "MITGLIED" ? "/mein-bereich" : "/dashboard";
}

export function userCan(user: { role: Role } | null, permission: Permission) {
  return !!user && can(user.role, permission);
}
