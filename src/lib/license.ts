import "server-only";
import { db } from "@/lib/db";
import { LicenseError } from "@/lib/errors";

type LicenseLike = { status: string; validFrom: Date | null; validUntil: Date | null };

export function isLicenseActive(license: LicenseLike, today = new Date()) {
  if (license.status !== "ACTIVE" && license.status !== "TRIAL") return false;
  const day = new Date(today.toISOString().slice(0, 10));
  if (license.validFrom && license.validFrom > day) return false;
  if (license.validUntil && license.validUntil < day) return false;
  return true;
}

export async function activeLicense(clubId: string) {
  const licenses = await db.license.findMany({ where: { clubId }, orderBy: { createdAt: "desc" } });
  return licenses.find((l) => isLicenseActive(l)) ?? null;
}

export { LicenseError };

/** Throws if the club has no active license. Reading stays allowed; writing is blocked. */
export async function assertLicensed(clubId: string) {
  const license = await activeLicense(clubId);
  if (!license)
    throw new LicenseError("Für diesen Verein ist keine gültige Lizenz hinterlegt. Änderungen sind gesperrt – bitte wende dich an den Plattform-Betreiber.");
  return license;
}

export async function assertMemberCapacity(clubId: string, adding = 1) {
  const license = await assertLicensed(clubId);
  if (license.maxMembers == null) return;
  const count = await db.member.count({ where: { clubId } });
  if (count + adding > license.maxMembers) {
    throw new LicenseError(`Die Lizenz erlaubt höchstens ${license.maxMembers} Mitglieder (aktuell ${count}).`);
  }
}

export async function assertUserCapacity(clubId: string) {
  const license = await assertLicensed(clubId);
  if (license.maxUsers == null) return;
  const count = await db.user.count({ where: { clubId, role: { not: "MITGLIED" } } });
  if (count + 1 > license.maxUsers) {
    throw new LicenseError(`Die Lizenz erlaubt höchstens ${license.maxUsers} Vorstands-Zugänge (aktuell ${count}).`);
  }
}

export function generateLicenseKey() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  const chars = Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
  return `VP-${chars.match(/.{4}/g)!.join("-")}`;
}
