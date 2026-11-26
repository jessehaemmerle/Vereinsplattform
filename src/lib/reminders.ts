import "server-only";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { mailBrand } from "@/lib/branding";
import { formatDate } from "@/lib/format";
import { adminUrl, clubUrl } from "@/lib/hosts";
import { logLicense } from "@/lib/license-ops";

export const REMINDER_DAYS = [30, 7, 1] as const;

/**
 * Which reminder (if any) is due. Thresholds already passed are skipped together, so a license
 * created 5 days before expiry gets one "7 days" mail, not three at once.
 */
export function dueReminder(daysLeft: number, sent: number[]) {
  if (daysLeft < 0) return null;
  const due = REMINDER_DAYS.filter((d) => daysLeft <= d && !sent.includes(d));
  if (!due.length) return null;
  return { send: Math.min(...due), markSent: due };
}

function daysLeft(validUntil: Date, now = new Date()) {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((validUntil.getTime() - today) / 86_400_000);
}

/** Sends due expiry reminders to club admins and platform admins. Idempotent: safe to run as often as wanted. */
export async function sendLicenseReminders(now = new Date()) {
  const horizon = new Date(now.getTime() + 31 * 86_400_000);
  const licenses = await db.license.findMany({
    where: { status: { in: ["ACTIVE", "TRIAL"] }, clubId: { not: null }, validUntil: { not: null, lte: horizon, gte: new Date(now.getTime() - 86_400_000) } },
    include: { club: { include: { users: { where: { role: "ADMIN", passwordHash: { not: null } } } } } },
  });
  const platformAdmins = await db.user.findMany({ where: { isPlatformAdmin: true }, select: { email: true } });
  let sent = 0;

  for (const license of licenses) {
    const club = license.club!;
    const left = daysLeft(license.validUntil!, now);
    const due = dueReminder(left, license.remindersSent);
    if (!due) continue;
    // claim first (optimistic lock), so parallel instances never mail twice
    const { count } = await db.license.updateMany({
      where: { id: license.id, remindersSent: { equals: license.remindersSent } },
      data: { remindersSent: [...new Set([...license.remindersSent, ...due.markSent])] },
    });
    if (!count) continue;

    const when = left === 0 ? "heute" : left === 1 ? "morgen" : `in ${left} Tagen`;
    const until = formatDate(license.validUntil);
    for (const admin of club.users) {
      await sendMail({
        to: admin.email,
        subject: `Eure Lizenz läuft ${when} ab`,
        text: `Hallo ${admin.name},\n\ndie Lizenz „${license.name}“ für ${club.name} läuft am ${until} ab. Danach könnt ihr eure Daten weiterhin ansehen, aber nichts mehr ändern.\n\nFür eine Verlängerung meldet euch bitte beim Plattform-Betreiber.\n\n${clubUrl(club.slug, "/einstellungen")}`,
        brand: mailBrand(club),
      }).catch((e) => console.error("[reminders]", e));
    }
    for (const admin of platformAdmins) {
      await sendMail({
        to: admin.email,
        subject: `Lizenz von ${club.name} läuft ${when} ab`,
        text: `Die Lizenz „${license.name}“ (${license.key}) von ${club.name} läuft am ${until} ab.\n\n${adminUrl(`/admin/lizenzen/${license.id}`)}`,
      }).catch((e) => console.error("[reminders]", e));
    }
    await logLicense(license.id, null, "Erinnerung gesendet", `${due.send} Tage vor Ablauf an ${club.users.length} Vereins-Admins`);
    sent++;
  }
  return sent;
}
