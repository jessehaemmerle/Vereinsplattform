import { requirePlatformAdmin } from "@/lib/auth";
import { getPlatformSettings, missingFields } from "@/lib/legal";
import { rootUrl } from "@/lib/hosts";
import { Notice, PageHeader } from "@/components/ui/misc";
import { LegalForm } from "./legal-form";
import { MailTest } from "./mail-test";
import { mailConfigured } from "@/lib/mail";
import { Panel } from "@/components/ui/misc";

export const metadata = { title: "Rechtliches" };

export default async function LegalAdminPage() {
  await requirePlatformAdmin();
  const settings = await getPlatformSettings();
  const missing = missingFields(settings);
  return (
    <>
      <PageHeader
        title="Rechtliches"
        description={
          <>
            Diese Angaben erscheinen im{" "}
            <a href={rootUrl("/impressum")} className="text-loden hover:underline" target="_blank" rel="noreferrer">
              Impressum
            </a>
            , in der{" "}
            <a href={rootUrl("/datenschutz")} className="text-loden hover:underline" target="_blank" rel="noreferrer">
              Datenschutzerklärung
            </a>{" "}
            und im Muster-Auftragsverarbeitungsvertrag.
          </>
        }
      />
      <div className="mb-6 space-y-3">
        {missing.length > 0 && (
          <Notice tone="warn">
            Pflichtangaben fehlen noch ({missing.length}). Bis dahin zeigen die öffentlichen Seiten Platzhalter – vor dem Livegang ausfüllen.
          </Notice>
        )}
        <Notice>
          Die Texte sind Vorlagen nach österreichischem Recht und ersetzen keine Rechtsberatung. Lass sie vor dem Livegang von einer Fachperson prüfen.
        </Notice>
      </div>
      <Panel title="E-Mail-Versand" className="mb-8 max-w-3xl">
        <p className="text-muted mb-4 text-sm">
          {mailConfigured()
            ? "Einladungen, Passwort-Links und Rundschreiben laufen über den Mailserver aus SMTP_* in der .env. Hier prüfst du, ob er erreichbar ist."
            : "SMTP_HOST ist nicht gesetzt – E-Mails werden nicht verschickt, sondern nur ins Server-Log geschrieben."}
        </p>
        <MailTest />
      </Panel>
      <LegalForm s={settings} />
    </>
  );
}
