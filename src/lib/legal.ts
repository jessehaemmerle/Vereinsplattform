import "server-only";
import { cache } from "react";
import type { PlatformSettings } from "@prisma/client";
import { db } from "@/lib/db";

export const getPlatformSettings = cache(async (): Promise<PlatformSettings> => {
  return (await db.platformSettings.findUnique({ where: { id: "default" } })) ?? (await db.platformSettings.create({ data: { id: "default" } }));
});

/** Fields an Austrian imprint (§ 5 ECG, § 25 MedienG) cannot do without. */
export const REQUIRED_FIELDS = ["operatorName", "street", "zipCity", "email", "businessPurpose", "hostingProvider"] as const;

export function missingFields(s: PlatformSettings) {
  return REQUIRED_FIELDS.filter((f) => !s[f]?.trim());
}

/** Value or a clearly visible placeholder. */
export function show(value: string | null | undefined, label: string) {
  return value?.trim() || `[${label} fehlt]`;
}
