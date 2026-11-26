import { requirePlatformAdmin } from "@/lib/auth";
import { getPlatformSettings, missingFields } from "@/lib/legal";
import { rootUrl } from "@/lib/hosts";
import { Notice, PageHeader } from "@/components/ui/misc";
import { LegalForm } from "./legal-form";

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
      <LegalForm s={settings} />
    </>
  );
}
