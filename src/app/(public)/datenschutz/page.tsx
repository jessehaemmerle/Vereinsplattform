import { getPlatformSettings, show } from "@/lib/legal";
import { platformName } from "@/lib/platform";
import { Address, LegalPage } from "@/components/public/legal";

export const metadata = { title: "Datenschutzerklärung" };

export default async function PrivacyPage() {
  const s = await getPlatformSettings();
  const name = platformName();
  return (
    <LegalPage title="Datenschutzerklärung" updated="November 2026">
      <p>
        Hier erfährst du, welche personenbezogenen Daten bei der Nutzung von {name} verarbeitet werden, wofür und welche Rechte du hast. Grundlage sind die
        Datenschutz-Grundverordnung (DSGVO) und das österreichische Datenschutzgesetz (DSG).
      </p>

      <h2>1. Wer ist verantwortlich?</h2>
      <p>Für diese Website, das Anfrageformular und die Zugänge der Vereins-Administratoren ist verantwortlich:</p>
      <Address lines={[show(s.operatorName, "Name bzw. Firma"), show(s.street, "Straße"), show(s.zipCity, "PLZ Ort"), s.country]} />
      <p>E-Mail: {s.email ? <a href={`mailto:${s.email}`}>{s.email}</a> : show(null, "E-Mail")}</p>
      <p>
        <strong>Daten in den Vereinsbereichen:</strong> Für die Daten, die ein Verein über seine Mitglieder speichert (Mitgliederliste, Beiträge, Buchungen,
        Termine, Dokumente), ist der jeweilige Verein Verantwortlicher. Wir verarbeiten diese Daten ausschließlich in seinem Auftrag nach Art. 28 DSGVO (siehe{" "}
        <a href="/auftragsverarbeitung">Auftragsverarbeitung</a>). Fragen zu diesen Daten richtest du am besten direkt an deinen Verein.
      </p>

      <h2>2. Besuch der Website</h2>
      <p>
        Beim Aufruf der Seiten verarbeitet der Server technisch notwendige Daten: IP-Adresse, Zeitpunkt, aufgerufene Adresse, Browser-Kennung. Das dient der
        Auslieferung der Seiten, der Abwehr von Angriffen (z. B. Begrenzung von Anmeldeversuchen) und der Fehlersuche. Rechtsgrundlage ist unser berechtigtes
        Interesse an einem sicheren Betrieb (Art. 6 Abs. 1 lit. f DSGVO). IP-Adressen für die Missbrauchsabwehr werden nur im Arbeitsspeicher gehalten und nach
        Ablauf ihres Zeitfensters (höchstens eine Stunde) verworfen. Fehlerprotokolle des Servers sind in ihrer Größe begrenzt und werden laufend überschrieben.
      </p>
      <p>
        Wir verwenden <strong>keine Analyse- oder Werbedienste</strong>, keine Social-Media-Plugins und laden keine Schriften oder Skripte von fremden Servern.
      </p>

      <h2>3. Cookies und lokaler Speicher</h2>
      <p>Es werden ausschließlich technisch notwendige Cookies gesetzt, für die keine Einwilligung erforderlich ist (§ 165 Abs. 3 TKG 2021):</p>
      <ul>
        <li>
          <code>vp_session</code> – hält dich nach der Anmeldung angemeldet (höchstens 30 Tage, gilt nur für die Adresse deines Vereins).
        </li>
        <li>
          <code>vp_flash</code> – zeigt eine Bestätigungsmeldung nach einer Aktion an (wenige Sekunden).
        </li>
      </ul>
      <p>Zusätzlich merkt sich dein Browser lokal, ob du die helle oder dunkle Darstellung gewählt hast. Diese Einstellung verlässt dein Gerät nicht.</p>

      <h2>4. Anfrageformular</h2>
      <p>
        Wenn du über das Formular einen Zugang anfragst, verarbeiten wir Vereinsname, deinen Namen, E-Mail-Adresse und optional Telefonnummer, Mitgliederzahl
        und Nachricht, um die Anfrage zu beantworten und ein Angebot zu erstellen (Art. 6 Abs. 1 lit. b DSGVO). Kommt kein Vertrag zustande, löschen wir die
        Anfrage nach sechs Monaten.
      </p>

      <h2>5. Nutzung der Plattform</h2>
      <p>
        Für Zugänge (Vorstand und Mitglieder) speichern wir Name, E-Mail-Adresse, ein verschlüsseltes Passwort (bcrypt), die Rolle im Verein, Anmeldezeitpunkte
        sowie – falls eingerichtet – den verschlüsselten Schlüssel der Authenticator-App, Passkeys (nur öffentlicher Schlüssel) und gehashte
        Wiederherstellungscodes. Wichtige Aktionen (z. B. Anmeldung, Änderungen an Mitgliedern oder Buchungen) werden im Aktivitätsprotokoll des Vereins
        vermerkt. Zweck ist die Bereitstellung der Plattform und die Nachvollziehbarkeit im Verein (Art. 6 Abs. 1 lit. b und f DSGVO bzw. im Auftrag des
        Vereins).
      </p>

      <h2>6. E-Mails</h2>
      <p>
        Wir versenden E-Mails für Anmeldelinks, Passwort-Zurücksetzungen, Lizenz-Hinweise und im Auftrag der Vereine (Rundschreiben, Einladungen). Dafür setzen
        wir folgenden Dienstleister ein: {show(s.mailProvider, "E-Mail-Dienstleister")}.
      </p>

      <h2>7. Empfänger und Auftragsverarbeiter</h2>
      <ul>
        <li>Hosting: {show(s.hostingProvider, "Hosting-Anbieter und Standort")}</li>
        <li>E-Mail-Versand: {show(s.mailProvider, "E-Mail-Dienstleister")}</li>
      </ul>
      <p>
        Mit diesen Dienstleistern bestehen Verträge zur Auftragsverarbeitung. Eine Übermittlung in Länder außerhalb des EWR findet nur statt, wenn dafür ein
        Angemessenheitsbeschluss oder geeignete Garantien (Standardvertragsklauseln) bestehen. Darüber hinaus geben wir Daten nur weiter, wenn wir gesetzlich
        dazu verpflichtet sind.
      </p>

      <h2>8. Speicherdauer</h2>
      <p>
        Daten der Vereinsbereiche speichern wir für die Dauer des Vertrags mit dem Verein. Nach Vertragsende kann der Verein seine Daten 30 Tage lang
        exportieren, danach werden sie gelöscht. Buchungsdaten bewahrt der Verein in eigener Verantwortung nach den gesetzlichen Fristen auf (z. B. 7 Jahre nach
        § 132 BAO).
      </p>

      <h2>9. Sicherheit</h2>
      <p>
        Alle Verbindungen sind verschlüsselt (TLS). Vereinsbereiche sind technisch voneinander getrennt, Zugänge sind auf Rollen beschränkt, eine
        Zwei-Faktor-Anmeldung steht allen zur Verfügung. Die Server befinden sich in der Europäischen Union.
      </p>

      <h2>10. Deine Rechte</h2>
      <p>
        Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO). Wende
        dich dafür an uns – oder bei Daten aus einem Vereinsbereich an deinen Verein, den wir dabei unterstützen. Wenn du meinst, dass die Verarbeitung deiner
        Daten gegen Datenschutzrecht verstößt, kannst du dich bei der Aufsichtsbehörde beschweren: Österreichische Datenschutzbehörde, Barichgasse 40–42, 1030
        Wien,{" "}
        <a href="https://www.dsb.gv.at" rel="noreferrer">
          www.dsb.gv.at
        </a>
        .
      </p>
      <p>Eine automatisierte Entscheidungsfindung oder ein Profiling findet nicht statt.</p>
    </LegalPage>
  );
}
