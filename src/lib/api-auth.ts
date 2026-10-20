import "server-only";
import type { Module } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { can, type Permission } from "@/lib/permissions";

/** For route handlers: returns the club user or null instead of redirecting. */
export async function apiUser(permission: Permission, module?: Module) {
  const user = await getCurrentUser();
  if (!user?.club || !can(user.role, permission)) return null;
  if (module && !user.club.modules.includes(module)) return null;
  return user as typeof user & { clubId: string; club: NonNullable<typeof user.club> };
}

export const forbidden = () => new Response("Kein Zugriff", { status: 403 });
