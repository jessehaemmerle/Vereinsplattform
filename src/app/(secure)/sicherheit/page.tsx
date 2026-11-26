import { notFound } from "next/navigation";
import { KeyRound, ShieldCheck, Smartphone } from "lucide-react";
import { db } from "@/lib/db";
import { mfaRequired, requireUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/format";
import { relyingParty } from "@/lib/webauthn";
import { Badge, Notice, PageHeader, Panel } from "@/components/ui/misc";
import { DeletePasskeyForm, DisableTotpForm, PasskeySetup, RecoveryCodesForm, TotpSetup } from "./forms";

export const metadata = { title: "Sicherheit" };

const POLICY_TEXT = {
  admin: "Für Plattform-Administratoren ist ein zweiter Faktor Pflicht.",
  club: "Dein Verein verlangt für deinen Zugang einen zweiten Faktor.",
};

export default async function SecurityPage() {
  const user = await requireUser({ allowMfaSetup: true });
  if (user.impersonating) notFound();
  const { rpID } = await relyingParty();
  const passkeys = await db.passkey.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
  const required = mfaRequired(user, user.club);

  return (
    <>
      <PageHeader
        title="Sicherheit"
        description="Ein zweiter Faktor schützt deinen Zugang, auch wenn jemand dein Passwort kennt. Bei der Anmeldung bestätigst du zusätzlich mit deinem Handy oder einem Passkey."
      />
      {user.mfaSetupRequired && (
        <div className="mb-6">
          <Notice tone="warn">
            <strong>Bitte richte jetzt einen zweiten Faktor ein.</strong> {user.club ? POLICY_TEXT.club : POLICY_TEXT.admin} Danach kannst du wie gewohnt
            weiterarbeiten.
          </Notice>
        </div>
      )}
      <div className="mb-6 flex items-center gap-3">
        <ShieldCheck className={user.mfaEnabled ? "text-ok size-6" : "text-muted size-6"} />
        <p className="font-medium">
          {user.mfaEnabled ? "Zwei-Faktor-Anmeldung ist aktiv." : "Zwei-Faktor-Anmeldung ist nicht aktiv."}{" "}
          {required && <Badge tone="loden">Pflicht für deinen Zugang</Badge>}
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Authenticator-App">
          <div className="text-muted mb-4 flex items-start gap-3 text-sm">
            <Smartphone className="mt-0.5 size-4 shrink-0" />
            <p>
              Zum Beispiel Google Authenticator, Microsoft Authenticator, Aegis oder 1Password. Die App zeigt alle 30 Sekunden einen neuen 6-stelligen Code.
            </p>
          </div>
          {user.totpEnabledAt ? (
            <>
              <p className="mb-4 text-sm">
                <Badge tone="ok">aktiv</Badge> seit {formatDateTime(user.totpEnabledAt)}
              </p>
              <DisableTotpForm />
            </>
          ) : (
            <TotpSetup />
          )}
        </Panel>
        <Panel title="Passkeys">
          <div className="text-muted mb-4 flex items-start gap-3 text-sm">
            <KeyRound className="mt-0.5 size-4 shrink-0" />
            <p>Fingerabdruck, Gesichtserkennung oder ein Sicherheitsschlüssel. Ein Passkey gilt nur für diese Adresse ({rpID}).</p>
          </div>
          {passkeys.length > 0 && (
            <ul className="divide-line mb-4 divide-y text-sm">
              {passkeys.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span>
                    <span className="font-medium">{p.name}</span>
                    <span className="text-muted block text-xs">
                      {p.rpId !== rpID ? `für ${p.rpId} · ` : ""}hinzugefügt {formatDateTime(p.createdAt)}
                      {p.lastUsedAt ? ` · zuletzt ${formatDateTime(p.lastUsedAt)}` : ""}
                    </span>
                  </span>
                  <DeletePasskeyForm id={p.id} name={p.name} />
                </li>
              ))}
            </ul>
          )}
          <PasskeySetup />
        </Panel>
        {user.mfaEnabled && (
          <Panel title="Wiederherstellungscodes" className="lg:col-span-2">
            <p className="text-muted mb-4 text-sm">
              Für den Fall, dass Handy oder Passkey verloren gehen: Jeder Code funktioniert einmal anstelle des zweiten Faktors. Noch{" "}
              <strong className="text-ink">{user.recoveryHashes.length}</strong> von 10 übrig.
            </p>
            <RecoveryCodesForm />
          </Panel>
        )}
      </div>
    </>
  );
}
