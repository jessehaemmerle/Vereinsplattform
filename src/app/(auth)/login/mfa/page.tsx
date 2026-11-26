import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getPendingMfa } from "@/lib/auth";
import { relyingParty } from "@/lib/webauthn";
import { ActionForm, Input, SubmitButton } from "@/components/ui/form";
import { cancelMfaLogin, verifyMfaCode } from "../../mfa-actions";
import { PasskeyLoginButton } from "./passkey-login";

export const metadata = { title: "Bestätigung" };

export default async function MfaPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const pending = await getPendingMfa();
  if (!pending) redirect("/login");
  const { next = "/" } = await searchParams;
  const { rpID } = await relyingParty();
  const passkeys = await db.passkey.count({ where: { userId: pending.user.id, rpId: rpID } });
  const hasTotp = !!pending.user.totpEnabledAt;

  return (
    <>
      <h1 className="text-[28px] font-semibold tracking-[-0.01em]">Anmeldung bestätigen</h1>
      <p className="text-muted mt-1 mb-8">
        {pending.user.email} ist mit einem zweiten Faktor geschützt.
        {hasTotp ? " Gib den Code aus deiner Authenticator-App ein" : ""}
        {hasTotp && passkeys ? " oder verwende deinen Passkey." : passkeys ? " Verwende deinen Passkey." : "."}
      </p>
      {passkeys > 0 && (
        <div className="mb-8">
          <PasskeyLoginButton next={next} />
        </div>
      )}
      <ActionForm action={verifyMfaCode}>
        <input type="hidden" name="next" value={next} />
        <Input
          label={hasTotp ? "Code aus der App oder Wiederherstellungscode" : "Wiederherstellungscode"}
          name="code"
          autoComplete="one-time-code"
          inputMode={hasTotp ? "numeric" : "text"}
          required
          autoFocus={!passkeys}
          maxLength={12}
        />
        <SubmitButton className="w-full" pendingText="Wird geprüft …">
          Bestätigen
        </SubmitButton>
      </ActionForm>
      <form action={cancelMfaLogin} className="border-line mt-8 border-t pt-6 text-sm">
        <button className="text-loden underline-offset-4 hover:underline">Abbrechen und neu anmelden</button>
        <p className="text-muted mt-2">
          Kein Zugriff auf App, Passkey und Wiederherstellungscodes? Dein Vereins-Admin kann die Zwei-Faktor-Anmeldung zurücksetzen.
        </p>
      </form>
    </>
  );
}
