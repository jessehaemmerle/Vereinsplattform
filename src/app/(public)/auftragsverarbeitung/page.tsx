import { getPlatformSettings, show } from "@/lib/legal";
import { platformName } from "@/lib/platform";
import { LegalPage } from "@/components/public/legal";

export const metadata = { title: "Auftragsverarbeitung" };

export default async function DpaPage() {
  const s = await getPlatformSettings();
  const name = platformName();
  return (
    <LegalPage title="Vereinbarung zur Auftragsverarbeitung" updated="November 2026">
      <p>
        nach Art. 28 Abs. 3 DSGVO zwischen dem Verein, der {name} nutzt (Verantwortlicher, im Folgenden „Verein“), und {show(s.operatorName, "Betreiber")}{" "}
        (Auftragsverarbeiter, im Folgenden „Anbieter“). Sie wird mit Abschluss des Nutzungsvertrags vereinbart und gilt für dessen Dauer.
      </p>

      <h2>1. Gegenstand und Zweck</h2>
      <p>
        Der Anbieter betreibt für den Verein die Software {name} zur Vereinsverwaltung und verarbeitet dabei personenbezogene Daten ausschließlich zur
        Erbringung dieser Leistung und nach den dokumentierten Weisungen des Vereins. Weisungen erteilt der Verein durch die Nutzung der Funktionen, im Übrigen
        schriftlich oder per E-Mail.
      </p>

      <h2>2. Art der Daten und betroffene Personen</h2>
      <ul>
        <li>Mitglieder: Name, Kontaktdaten, Geburtsdatum, Adresse, Mitgliedsstatus, Funktion, Beitrags- und Zahlungsdaten, Notizen des Vorstands.</li>
        <li>Vorstand und Mitglieder mit Zugang: Name, E-Mail-Adresse, Zugangs- und Sicherheitsdaten, Aktivitätsprotokoll.</li>
        <li>Weitere Personen in Buchungen, Terminen, Notizen und hochgeladenen Dokumenten, soweit der Verein sie dort erfasst.</li>
      </ul>
      <p>Besondere Kategorien nach Art. 9 DSGVO sind nicht vorgesehen; der Verein speichert solche Daten nur, wenn er dafür eine Rechtsgrundlage hat.</p>

      <h2>3. Pflichten des Anbieters</h2>
      <ul>
        <li>Verarbeitung nur auf dokumentierte Weisung; ist eine Weisung aus seiner Sicht rechtswidrig, informiert der Anbieter den Verein.</li>
        <li>Alle mit der Verarbeitung befassten Personen sind zur Vertraulichkeit verpflichtet.</li>
        <li>Er trifft die technischen und organisatorischen Maßnahmen nach Punkt 5.</li>
        <li>
          Er unterstützt den Verein bei Anfragen betroffener Personen (Art. 15–22 DSGVO), bei der Meldung von Datenschutzverletzungen und bei
          Datenschutz-Folgenabschätzungen.
        </li>
        <li>Er meldet Verletzungen des Schutzes personenbezogener Daten unverzüglich, spätestens binnen 48 Stunden nach Kenntnis.</li>
        <li>Er stellt alle Informationen zum Nachweis dieser Pflichten zur Verfügung und ermöglicht Überprüfungen nach angemessener Vorankündigung.</li>
      </ul>

      <h2>4. Weitere Auftragsverarbeiter</h2>
      <p>Der Verein stimmt dem Einsatz folgender Unterauftragsverarbeiter zu:</p>
      <ul>
        <li>Hosting: {show(s.hostingProvider, "Hosting-Anbieter und Standort")}</li>
        <li>E-Mail-Versand: {show(s.mailProvider, "E-Mail-Dienstleister")}</li>
      </ul>
      <p>
        Über beabsichtigte Änderungen informiert der Anbieter den Verein vorab per E-Mail; der Verein kann binnen 30 Tagen widersprechen und in diesem Fall den
        Vertrag beenden. Der Anbieter verpflichtet Unterauftragsverarbeiter vertraglich zu denselben Datenschutzpflichten.
      </p>

      <h2>5. Technische und organisatorische Maßnahmen</h2>
      <ul>
        <li>Verschlüsselte Übertragung (TLS) für alle Verbindungen, HSTS.</li>
        <li>
          Logische Trennung der Vereine: eigene Adresse je Verein, jede Datenbankabfrage ist auf den Verein beschränkt, Anmeldungen gelten nur für den eigenen
          Verein.
        </li>
        <li>Rollen- und Rechtekonzept (Vereins-Admin, Kassier, Schriftführer, Vorstand, Mitglied).</li>
        <li>Passwörter mit bcrypt gespeichert; Zwei-Faktor-Anmeldung (App, Passkey), für Plattform-Administratoren verpflichtend.</li>
        <li>Begrenzung von Anmeldeversuchen, Protokollierung sicherheitsrelevanter Aktionen im Aktivitätsprotokoll.</li>
        <li>Server in der Europäischen Union; Betrieb in abgeschotteten Containern, Datenbank nicht aus dem Internet erreichbar.</li>
        <li>Regelmäßige Datensicherung und zeitnahe Sicherheitsupdates der eingesetzten Software.</li>
      </ul>

      <h2>6. Ende der Verarbeitung</h2>
      <p>
        Nach Vertragsende kann der Verein seine Daten 30 Tage lang exportieren. Danach löscht der Anbieter alle personenbezogenen Daten des Vereins,
        einschließlich hochgeladener Dateien, sofern keine gesetzliche Pflicht zur Aufbewahrung besteht. Datensicherungen werden im Rahmen ihres regulären
        Zyklus überschrieben.
      </p>

      <h2>7. Schlussbestimmungen</h2>
      <p>
        Es gilt österreichisches Recht. Bei Widersprüchen zwischen dieser Vereinbarung und anderen Vertragsbestandteilen geht diese Vereinbarung in
        Datenschutzfragen vor.
      </p>
    </LegalPage>
  );
}
