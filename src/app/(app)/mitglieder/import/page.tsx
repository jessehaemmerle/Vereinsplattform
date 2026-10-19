import { staff } from "@/lib/guard";
import { CSV_COLUMNS } from "@/lib/member-csv";
import { PageHeader, Panel } from "@/components/ui/misc";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { buttonClass } from "@/components/ui/button";
import { importMembers } from "../actions";

export const metadata = { title: "Mitglieder importieren" };

export default async function ImportPage() {
  await staff("members:write", "MITGLIEDER");
  return (
    <>
      <PageHeader
        title="Mitglieder importieren"
        description="Aus Excel oder einer anderen Vereinssoftware als CSV gespeichert. Mitglieder mit bereits vorhandener E-Mail-Adresse werden übersprungen."
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Datei hochladen">
          <ActionForm action={importMembers}>
            <input
              type="file"
              name="file"
              accept=".csv,text/csv"
              required
              aria-label="CSV-Datei"
              className="file:bg-loden-soft file:text-loden block w-full text-sm file:mr-4 file:rounded-md file:border-0 file:px-4 file:py-2"
            />
            <SubmitButton pendingText="Wird importiert …">Importieren</SubmitButton>
          </ActionForm>
        </Panel>
        <Panel title="Aufbau der Datei">
          <p className="text-muted mb-3 text-sm">
            Trennzeichen Strichpunkt oder Komma. Pflichtspalten sind Vorname, Nachname und Email; die Reihenfolge ist egal. Datumswerte als 31.12.2024 oder
            2024-12-31.
          </p>
          <p className="mb-4 font-mono text-xs break-words">{CSV_COLUMNS.join(";")}</p>
          <a href="/api/mitglieder/vorlage" className={buttonClass("secondary", "sm")}>
            Vorlage herunterladen
          </a>
        </Panel>
      </div>
    </>
  );
}
