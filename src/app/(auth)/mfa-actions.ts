"use server";

import { redirect } from "next/navigation";
import { generateAuthenticationOptions, verifyAuthenticationResponse, type AuthenticationResponseJSON } from "@simplewebauthn/server";
import { db } from "@/lib/db";
import { completeMfa, destroySession, getPendingMfa } from "@/lib/auth";
import { open } from "@/lib/secret-box";
import { verifyTotp } from "@/lib/totp";
import { hashRecoveryCode } from "@/lib/recovery-codes";
import { relyingParty } from "@/lib/webauthn";
import { logActivity } from "@/lib/activity";
import { flash } from "@/lib/flash";
import type { FormState } from "@/lib/form";

const MAX_ATTEMPTS = 5;
const SAFE_PATH = /^\/(?![\/\\])[^\\\s]*$/;

function target(next: unknown) {
  return typeof next === "string" && SAFE_PATH.test(next) ? next : "/";
}

/** Counts a failed attempt; after MAX_ATTEMPTS the pending session is dropped and the password is needed again. */
async function failAttempt(sessionId: string, attempts: number): Promise<FormState> {
  if (attempts + 1 >= MAX_ATTEMPTS) {
    await destroySession();
    await flash("Zu viele falsche Codes. Bitte melde dich erneut an.", "error");
    redirect("/login");
  }
  await db.session.update({ where: { id: sessionId }, data: { mfaAttempts: { increment: 1 } } });
  return { error: `Der Code stimmt nicht. Noch ${MAX_ATTEMPTS - attempts - 1} Versuche.`, fieldErrors: { code: "Ungültig" } };
}

async function finish(sessionId: string, user: { id: string; clubId: string | null }, method: string, next: unknown): Promise<never> {
  await completeMfa(sessionId, user.id);
  await logActivity({ clubId: user.clubId, userId: user.id, action: "login", detail: `mit ${method}` });
  redirect(target(next));
}

/** Code from the authenticator app, or a one-time recovery code. */
export async function verifyMfaCode(_: FormState, formData: FormData): Promise<FormState> {
  const pending = await getPendingMfa();
  if (!pending) redirect("/login");
  const { session, user } = pending;
  const code = String(formData.get("code") ?? "").trim();

  if (/^\d{3}\s?\d{3}$/.test(code)) {
    if (!user.totpEnabledAt || !user.totpSecretEnc) return failAttempt(session.id, session.mfaAttempts);
    const step = verifyTotp(open(user.totpSecretEnc), code, user.totpLastStep);
    if (step === null) return failAttempt(session.id, session.mfaAttempts);
    // compare-and-set on the last step: a code can be redeemed only once, even by parallel requests
    const { count } = await db.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: { totpLastStep: step },
    });
    if (!count) return failAttempt(session.id, session.mfaAttempts);
    return finish(session.id, user, "Authenticator-App", formData.get("next"));
  }

  const hash = hashRecoveryCode(code);
  if (code.length >= 8 && user.recoveryHashes.includes(hash)) {
    await db.user.update({ where: { id: user.id }, data: { recoveryHashes: user.recoveryHashes.filter((h) => h !== hash) } });
    await flash(
      `Wiederherstellungscode verwendet. Noch ${user.recoveryHashes.length - 1} übrig – erzeuge unter „Sicherheit“ neue, wenn es knapp wird.`,
      "info",
    );
    return finish(session.id, user, "Wiederherstellungscode", formData.get("next"));
  }
  return failAttempt(session.id, session.mfaAttempts);
}

export async function passkeyLoginOptions() {
  const pending = await getPendingMfa();
  if (!pending) return null;
  const { rpID } = await relyingParty();
  const passkeys = await db.passkey.findMany({ where: { userId: pending.user.id, rpId: rpID } });
  if (!passkeys.length) return null;
  const options = await generateAuthenticationOptions({
    rpID,
    userVerification: "preferred",
    allowCredentials: passkeys.map((p) => ({ id: p.id, transports: p.transports as AuthenticatorTransport[] })),
  });
  await db.session.update({ where: { id: pending.session.id }, data: { webauthnChallenge: options.challenge } });
  return options;
}

type AuthenticatorTransport = "ble" | "cable" | "hybrid" | "internal" | "nfc" | "smart-card" | "usb";

export async function passkeyLoginVerify(response: AuthenticationResponseJSON, next: string): Promise<{ error: string } | undefined> {
  const pending = await getPendingMfa();
  if (!pending) redirect("/login");
  const { session, user } = pending;
  const passkey = await db.passkey.findFirst({ where: { id: response.id, userId: user.id } });
  if (!passkey || !session.webauthnChallenge) return { error: "Dieser Passkey gehört nicht zu deinem Zugang." };
  const { rpID, origin } = await relyingParty();
  let verified = false;
  let newCounter = passkey.counter;
  try {
    const result = await verifyAuthenticationResponse({
      response,
      expectedChallenge: session.webauthnChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: new Uint8Array(passkey.publicKey),
        counter: passkey.counter,
        transports: passkey.transports as AuthenticatorTransport[],
      },
      requireUserVerification: false,
    });
    verified = result.verified;
    newCounter = result.authenticationInfo.newCounter;
  } catch (e) {
    console.warn("[passkey] Anmeldung abgelehnt", e);
  }
  await db.session.update({ where: { id: session.id }, data: { webauthnChallenge: null } }); // one challenge, one try
  if (!verified) {
    const state = await failAttempt(session.id, session.mfaAttempts);
    return { error: state?.error ?? "Passkey wurde nicht akzeptiert." };
  }
  await db.passkey.update({ where: { id: passkey.id }, data: { counter: newCounter, lastUsedAt: new Date() } });
  return finish(session.id, user, "Passkey", next);
}

export async function cancelMfaLogin() {
  await destroySession();
  redirect("/login");
}
