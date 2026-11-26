import "server-only";
import { db } from "@/lib/db";
import { sendMail } from "@/lib/mail";
import { mailBrand } from "@/lib/branding";
import { logActivity } from "@/lib/activity";

/**
 * Removes all second factors of a user (lost phone). Ends their sessions, informs them by e-mail and logs it,
 * so a misuse of this function cannot stay unnoticed.
 */
export async function resetMfa(targetId: string, actor: { id: string; name: string }) {
  const target = await db.user.findUnique({ where: { id: targetId }, include: { club: true } });
  if (!target) return false;
  await db.$transaction([
    db.passkey.deleteMany({ where: { userId: targetId } }),
    db.user.update({ where: { id: targetId }, data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, recoveryHashes: [] } }),
    db.session.deleteMany({ where: { userId: targetId } }),
  ]);
  await logActivity({ clubId: target.clubId, userId: actor.id, action: "mfa_reset", detail: `${target.name} (durch ${actor.name})` });
  await sendMail({
    to: target.email,
    subject: "Deine Zwei-Faktor-Anmeldung wurde zurückgesetzt",
    text: `Hallo ${target.name},\n\n${actor.name} hat die Zwei-Faktor-Anmeldung deines Zugangs zurückgesetzt. Du wurdest überall abgemeldet. Bei der nächsten Anmeldung kannst du unter „Sicherheit“ einen neuen zweiten Faktor einrichten.\n\nWenn du das nicht veranlasst hast, melde dich bitte sofort bei deinem Vorstand.`,
    brand: target.club ? mailBrand(target.club) : null,
  }).catch((e) => console.error("[mfa-reset]", e));
  return true;
}
