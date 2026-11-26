"use server";

import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { generateRegistrationOptions, verifyRegistrationResponse, type RegistrationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { getActiveSession, requireUser, verifyPassword } from "@/lib/auth";
import { open, seal } from "@/lib/secret-box";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/lib/totp";
import { generateRecoveryCodes, hashRecoveryCode } from "@/lib/recovery-codes";
import { relyingParty } from "@/lib/webauthn";
import { rateLimit } from "@/lib/rate-limit";
import { logActivity } from "@/lib/activity";

export type SecurityState = { error?: string; ok?: string; codes?: string[] } | undefined;

async function me() {
  const user = await requireUser({ allowMfaSetup: true });
  if (user.impersonating) throw new Error("Im Vereins-Modus können keine Sicherheitseinstellungen geändert werden.");
  return user;
}

/** Fresh recovery codes when the first factor is added; returns them once for display. */
async function ensureRecoveryCodes(userId: string, existing: string[]) {
  if (existing.length) return undefined;
  const codes = generateRecoveryCodes();
  await db.user.update({ where: { id: userId }, data: { recoveryHashes: codes.map(hashRecoveryCode) } });
  return codes;
}

/** Removing a factor or replacing codes needs the password again (protects against a hijacked open session). */
async function checkPassword(userId: string, hash: string | null, password: FormDataEntryValue | null) {
  if (!rateLimit(`reauth:${userId}`, 10)) return "Zu viele Versuche. Bitte warte 15 Minuten.";
  if (typeof password !== "string" || !(await verifyPassword(password, hash))) return "Das Passwort stimmt nicht.";
  return null;
}

export async function startTotpSetup() {
  const user = await me();
  if (user.totpEnabledAt) return null;
  const secret = generateTotpSecret();
  await db.user.update({ where: { id: user.id }, data: { totpSecretEnc: seal(secret) } });
  const issuer = user.club?.name ?? "Vereinsplattform";
  const uri = otpauthUri(issuer, user.email, secret);
  return { secret, qr: await QRCode.toDataURL(uri, { margin: 1, width: 220 }) };
}

export async function confirmTotpSetup(_: SecurityState, formData: FormData): Promise<SecurityState> {
  const user = await me();
  if (user.totpEnabledAt) return { error: "Die Authenticator-App ist bereits eingerichtet." };
  if (!user.totpSecretEnc) return { error: "Bitte starte die Einrichtung neu." };
  if (!rateLimit(`totp-setup:${user.id}`, 10)) return { error: "Zu viele Versuche. Bitte warte 15 Minuten." };
  const step = verifyTotp(open(user.totpSecretEnc), String(formData.get("code") ?? ""), null);
  if (step === null) return { error: "Der Code stimmt nicht. Prüfe, ob die Uhrzeit am Handy stimmt, und versuche den nächsten Code." };
  await db.user.update({ where: { id: user.id }, data: { totpEnabledAt: new Date(), totpLastStep: step } });
  await logActivity({ clubId: user.clubId, userId: user.id, action: "mfa_enabled", detail: "Authenticator-App" });
  const codes = await ensureRecoveryCodes(user.id, user.recoveryHashes);
  // no revalidate here: the page would replace this form before the recovery codes were seen (client refreshes on "Fertig")
  return { ok: "Authenticator-App eingerichtet.", codes };
}

export async function disableTotp(_: SecurityState, formData: FormData): Promise<SecurityState> {
  const user = await me();
  const wrong = await checkPassword(user.id, user.passwordHash, formData.get("password"));
  if (wrong) return { error: wrong };
  const passkeys = await db.passkey.count({ where: { userId: user.id } });
  if (!passkeys && (await mustKeepMfa(user))) return { error: "Für deinen Zugang ist ein zweiter Faktor Pflicht. Richte zuerst einen Passkey ein." };
  await db.user.update({
    where: { id: user.id },
    data: { totpSecretEnc: null, totpEnabledAt: null, totpLastStep: null, ...(passkeys ? {} : { recoveryHashes: [] }) },
  });
  await logActivity({ clubId: user.clubId, userId: user.id, action: "mfa_disabled", detail: "Authenticator-App" });
  revalidatePath("/", "layout");
  return { ok: "Authenticator-App entfernt." };
}

async function mustKeepMfa(user: Awaited<ReturnType<typeof me>>) {
  const { mfaRequired } = await import("@/lib/auth");
  return mfaRequired(user, user.club);
}

type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

export async function passkeyRegisterOptions() {
  const user = await me();
  const active = await getActiveSession();
  if (!active) return null;
  const { rpID, rpName } = await relyingParty();
  const existing = await db.passkey.findMany({ where: { userId: user.id, rpId: rpID } });
  const options = await generateRegistrationOptions({
    rpName,
    rpID,
    userName: user.email,
    userDisplayName: user.name,
    userID: new TextEncoder().encode(user.id),
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({ id: p.id, transports: p.transports as AuthenticatorTransport[] })),
    authenticatorSelection: { residentKey: "preferred", userVerification: "preferred" },
  });
  await db.session.update({ where: { id: active.session.id }, data: { webauthnChallenge: options.challenge } });
  return options;
}

export async function passkeyRegisterVerify(response: RegistrationResponseJSON, name: string): Promise<SecurityState> {
  const user = await me();
  const active = await getActiveSession();
  if (!active?.session.webauthnChallenge) return { error: "Bitte versuche es erneut." };
  const { rpID, origin } = await relyingParty();
  const challenge = active.session.webauthnChallenge;
  await db.session.update({ where: { id: active.session.id }, data: { webauthnChallenge: null } });
  try {
    const { verified, registrationInfo } = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
    if (!verified || !registrationInfo) return { error: "Der Passkey konnte nicht bestätigt werden." };
    const { credential } = registrationInfo;
    await db.passkey.create({
      data: {
        id: credential.id,
        userId: user.id,
        publicKey: Buffer.from(credential.publicKey),
        counter: credential.counter,
        transports: credential.transports ?? [],
        rpId: rpID,
        name: name.trim().slice(0, 60) || "Passkey",
      },
    });
  } catch (e) {
    console.warn("[passkey] Registrierung abgelehnt", e);
    return { error: "Der Passkey konnte nicht gespeichert werden." };
  }
  await logActivity({ clubId: user.clubId, userId: user.id, action: "mfa_enabled", detail: "Passkey" });
  const codes = await ensureRecoveryCodes(user.id, user.recoveryHashes);
  return { ok: "Passkey gespeichert.", codes };
}

export async function deletePasskey(_: SecurityState, formData: FormData): Promise<SecurityState> {
  const user = await me();
  const wrong = await checkPassword(user.id, user.passwordHash, formData.get("password"));
  if (wrong) return { error: wrong };
  const id = String(formData.get("id"));
  const remaining = await db.passkey.count({ where: { userId: user.id, id: { not: id } } });
  if (!remaining && !user.totpEnabledAt && (await mustKeepMfa(user)))
    return { error: "Für deinen Zugang ist ein zweiter Faktor Pflicht. Richte zuerst die Authenticator-App ein." };
  const { count } = await db.passkey.deleteMany({ where: { id, userId: user.id } });
  if (!count) return { error: "Passkey nicht gefunden." };
  if (!remaining && !user.totpEnabledAt) await db.user.update({ where: { id: user.id }, data: { recoveryHashes: [] } });
  await logActivity({ clubId: user.clubId, userId: user.id, action: "mfa_disabled", detail: "Passkey" });
  revalidatePath("/", "layout");
  return { ok: "Passkey entfernt." };
}

export async function regenerateRecoveryCodes(_: SecurityState, formData: FormData): Promise<SecurityState> {
  const user = await me();
  if (!user.mfaEnabled) return { error: "Richte zuerst einen zweiten Faktor ein." };
  const wrong = await checkPassword(user.id, user.passwordHash, formData.get("password"));
  if (wrong) return { error: wrong };
  const codes = generateRecoveryCodes();
  await db.user.update({ where: { id: user.id }, data: { recoveryHashes: codes.map(hashRecoveryCode) } });
  await logActivity({ clubId: user.clubId, userId: user.id, action: "mfa_recovery_regenerated" });
  return { ok: "Neue Wiederherstellungscodes erzeugt. Die alten gelten nicht mehr.", codes };
}
