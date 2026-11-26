import { getPlatformSettings, show } from "@/lib/legal";
import { platformName } from "@/lib/platform";
import { LegalPage } from "@/components/public/legal";

export const metadata = { title: "Nutzungsbedingungen" };

export default async function TermsPage() {
  const s = await getPlatformSettings();
  const name = platformName();
  const operator = show(s.operatorName, "Betreiber");
  return (
    <LegalPage title="Nutzungsbedingungen" updated="November 2026">
      <h2>1. Geltungsbereich</h2>
      <p>
        Diese Bedingungen gelten für die Nutzung von {name} durch Vereine (im Folgenden „Verein“) und deren Vorstands- und Mitgliederzugänge. Anbieter ist{" "}
        {operator}. Zwingende Bestimmungen des Konsumentenschutzgesetzes bleiben unberührt, soweit der Verein Verbraucher ist.
      </p>

      <h2>2. Leistung</h2>
      <p>
        Der Verein erhält einen eigenen Bereich unter einer eigenen Adresse mit den Funktionen des gewählten Pakets (z. B. Mitglieder, Finanzen, Termine,
        Dokumente, Nachrichten). Umfang, Laufzeit und Limits ergeben sich aus der Lizenz. Wir entwickeln die Plattform weiter; wesentliche Funktionen eines
        laufenden Pakets fallen nicht ersatzlos weg.
      </p>

      <h2>3. Zugänge und Pflichten des Vereins</h2>
      <ul>
        <li>Der Verein benennt mindestens einen Vereins-Admin und vergibt weitere Zugänge selbst.</li>
        <li>Zugangsdaten sind geheim zu halten. Für den Vorstand empfehlen wir die Zwei-Faktor-Anmeldung.</li>
        <li>
          Der Verein ist dafür verantwortlich, dass er die gespeicherten Daten seiner Mitglieder rechtmäßig verarbeitet und seine Mitglieder darüber informiert.
        </li>
        <li>
          Unzulässig sind rechtswidrige Inhalte, Massen-E-Mails an Personen ohne Bezug zum Verein und Versuche, die Plattform oder andere Vereinsbereiche zu
          stören.
        </li>
      </ul>

      <h2>4. Laufzeit, Preise und Ende</h2>
      <p>
        Die Lizenz läuft für den vereinbarten Zeitraum und kann verlängert werden. Wir erinnern 30, 7 und 1 Tag vor Ablauf. Nach Ablauf bleiben die Daten lesbar
        und exportierbar, Änderungen sind gesperrt. Endet der Vertrag, kann der Verein seine Daten 30 Tage lang exportieren (CSV, PDF); danach werden sie
        gelöscht.
      </p>

      <h2>5. Verfügbarkeit und Datensicherung</h2>
      <p>
        Wir bemühen uns um einen möglichst unterbrechungsfreien Betrieb, können aber keine ununterbrochene Verfügbarkeit zusagen. Wartungsarbeiten kündigen wir
        nach Möglichkeit an. Die Daten werden regelmäßig gesichert.
      </p>

      <h2>6. Haftung</h2>
      <p>
        Wir haften für Schäden, die wir vorsätzlich oder grob fahrlässig verursachen. Für leichte Fahrlässigkeit haften wir nur bei Personenschäden und bei
        Verletzung wesentlicher Vertragspflichten, dann begrenzt auf den vorhersehbaren, typischen Schaden. Gegenüber Verbrauchern gelten die gesetzlichen
        Bestimmungen.
      </p>

      <h2>7. Datenschutz</h2>
      <p>
        Für die Daten im Vereinsbereich ist der Verein Verantwortlicher, wir sind Auftragsverarbeiter. Es gilt die{" "}
        <a href="/auftragsverarbeitung">Vereinbarung zur Auftragsverarbeitung</a>, die mit Abschluss des Vertrags vereinbart wird. Im Übrigen gilt die{" "}
        <a href="/datenschutz">Datenschutzerklärung</a>.
      </p>

      <h2>8. Änderungen</h2>
      <p>
        Änderungen dieser Bedingungen teilen wir dem Verein mindestens sechs Wochen vor Inkrafttreten per E-Mail mit. Widerspricht der Verein nicht bis dahin,
        gelten sie als vereinbart; auf diese Folge weisen wir in der Mitteilung hin. Bei Widerspruch kann jede Seite den Vertrag zum Änderungszeitpunkt beenden.
      </p>

      <h2>9. Recht und Gerichtsstand</h2>
      <p>
        Es gilt österreichisches Recht unter Ausschluss der Verweisungsnormen und des UN-Kaufrechts. Gerichtsstand ist, soweit zulässig, das für den Sitz des
        Anbieters sachlich zuständige Gericht.
      </p>
    </LegalPage>
  );
}
