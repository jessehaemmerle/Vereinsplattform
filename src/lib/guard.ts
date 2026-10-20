import "server-only";
import { notFound } from "next/navigation";
import type { Module } from "@prisma/client";
import { requirePermission } from "@/lib/auth";
import { assertLicensed, LicenseError } from "@/lib/license";
import { flash } from "@/lib/flash";
import type { Permission } from "@/lib/permissions";

/** Staff user with permission; the module must be enabled for the club. */
export async function staff(permission: Permission, module?: Module) {
  const user = await requirePermission(permission);
  if (module && !user.club.modules.includes(module)) notFound();
  return user;
}

/** Like staff(), but also requires an active license because data is changed. */
export async function writer(permission: Permission, module?: Module) {
  const user = await staff(permission, module);
  await assertLicensed(user.clubId);
  return user;
}

/** For button-style actions without a form state: license problems become a flash message. */
export async function guarded(fn: () => Promise<void>) {
  try {
    await fn();
  } catch (error) {
    if (error instanceof LicenseError) {
      await flash(error.message, "error");
      return;
    }
    throw error;
  }
}
