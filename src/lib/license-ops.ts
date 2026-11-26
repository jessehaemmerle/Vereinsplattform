import "server-only";
import type { License, LicensePlan } from "@prisma/client";
import { db } from "@/lib/db";
import { generateLicenseKey } from "@/lib/license";
import { formatDate } from "@/lib/format";

export async function logLicense(licenseId: string, userId: string | null, action: string, detail?: string) {
  await db.licenseEvent.create({ data: { licenseId, userId, action, detail } });
}

/** End date after adding `months` to the later of today and the current end. */
export function extendedUntil(validUntil: Date | null, months: number, today = new Date()) {
  const todayUtc = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = validUntil && validUntil > todayUtc ? validUntil : todayUtc;
  const end = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + months, start.getUTCDate()));
  // 31 Jan + 1 month must not overflow into March
  if (end.getUTCDate() !== start.getUTCDate()) end.setUTCDate(0);
  return end;
}

export async function createLicenseFromPlan(plan: LicensePlan, opts: { clubId?: string | null; name?: string; userId: string | null }) {
  const today = new Date();
  const license = await db.license.create({
    data: {
      key: generateLicenseKey(),
      name: opts.name ?? plan.name,
      planId: plan.id,
      status: "ACTIVE",
      maxUsers: plan.maxUsers,
      maxMembers: plan.maxMembers,
      validFrom: new Date(today.toISOString().slice(0, 10)),
      validUntil: plan.durationMonths ? extendedUntil(null, plan.durationMonths, today) : null,
      clubId: opts.clubId ?? null,
    },
  });
  await logLicense(license.id, opts.userId, "erstellt", `aus Paket „${plan.name}“`);
  // invoice draft for the platform admin to review and issue
  const { draftForLicense } = await import("@/lib/invoices");
  const draft = await draftForLicense(license, plan);
  if (draft) await logLicense(license.id, opts.userId, "Rechnungsentwurf erstellt");
  if (opts.clubId) await db.club.update({ where: { id: opts.clubId }, data: { modules: plan.modules } });
  return license;
}

const FIELD_LABELS: Partial<Record<keyof License, string>> = {
  name: "Bezeichnung",
  status: "Status",
  maxUsers: "Max. Zugänge",
  maxMembers: "Max. Mitglieder",
  validFrom: "Gültig ab",
  validUntil: "Gültig bis",
  clubId: "Verein",
  planId: "Paket",
};

function show(v: unknown) {
  if (v === null || v === undefined || v === "") return "–";
  if (v instanceof Date) return formatDate(v);
  return String(v);
}

/** Human-readable list of changed fields for the license history. */
export function describeChanges(before: License, after: Partial<License>) {
  const changes: string[] = [];
  for (const [key, label] of Object.entries(FIELD_LABELS) as [keyof License, string][]) {
    if (!(key in after)) continue;
    const a = before[key];
    const b = after[key];
    const same = a instanceof Date || b instanceof Date ? (a as Date | null)?.getTime() === (b as Date | null)?.getTime() : a === b;
    if (!same) changes.push(`${label}: ${show(a)} → ${show(b)}`);
  }
  return changes.join("; ");
}
