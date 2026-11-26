# Vereinsplattform

Mandantenfähige Vereinsverwaltung: Mitglieder, Beiträge, Kassabuch, Termine, Dokumente und Rundschreiben – für beliebig viele Vereine auf einer Installation, verwaltet über einen Plattform-Admin mit Lizenzen.

**Stack:** Next.js 16 (App Router, Server Actions) · React 19 · TypeScript · Tailwind CSS 4 · Prisma 6 · PostgreSQL 17 · Caddy (HTTPS) · Docker Compose

## Funktionen

| Bereich | Was es kann |
|---|---|
| **Mitglieder** | Anlegen, bearbeiten, Status (aktiv, passiv, Ehrenmitglied, ausgetreten), Suche und Filter, CSV-Import (Strichpunkt oder Komma, deutsche Datums- und Betragsformate) und CSV-Export, Geburtstagsliste |
| **Beiträge** | Jahresbeitrag pro Mitglied, „bezahlt“ bucht automatisch eine Einnahme, Zurücknehmen entfernt sie wieder; Filter „Beitrag offen“ |
| **Finanzen** | Kassabuch mit Einnahmen und Ausgaben, Kategorien, Jahresübertrag (Endbestand → Anfangsbestand des Folgejahres), CSV-Export, PDF-Berichte: Jahresabschluss, Buchungsjournal mit laufendem Stand, Summen nach Kategorie, Jahressalden |
| **Termine** | Termine mit Ort und Kosten (Kosten werden als Ausgabe gebucht und synchron gehalten), Einladung per E-Mail an Mitgliedergruppen, **iCal-Abo** für Google/Outlook/Apple |
| **Notizen** | Vorstandsnotizen, anheftbar |
| **Dokumente** | Upload bis 20 MB, optional für Mitglieder freigeben |
| **Nachrichten** | Rundschreiben an Gruppen oder nur an Mitglieder mit offenem Beitrag, Vorlagen mit Platzhaltern (`{{vorname}}`, `{{beitrag}}`, `{{iban}}` …), Versandprotokoll; jede Person erhält eine eigene E-Mail |
| **Mitgliederbereich** | Mitglieder fordern selbst einen Zugang an (Link an die beim Verein hinterlegte Adresse) oder werden eingeladen; sehen Beitragsstatus mit Bankdaten, Termine, freigegebene Dokumente und pflegen ihre Kontaktdaten |
| **Rechnungen** | Rechnungen an Dritte mit Empfänger-Adressbuch (oder an Mitglieder), fortlaufende Nummern `RE-2026-0001`, PDF mit SEPA-QR-Code, Versand per E-Mail, Zahlungserinnerung, Storno per Stornorechnung, „bezahlt“ bucht eine Einnahme ins Kassabuch |
| **Plattform** | Vereine samt erstem Vereins-Admin anlegen (Einladungslink statt Passwort), Module je Verein ein-/ausschalten, Lizenzen (Status, Laufzeit, max. Mitglieder, max. Zugänge) erstellen und zuweisen, Aktivitätsprotokoll, Verein löschen |

### Rollen im Verein

| Rolle | Darf |
|---|---|
| Vereins-Admin | alles, inkl. Vereinsdaten, Logo, Zugänge |
| Kassier | Finanzen und Beiträge bearbeiten, alles andere ansehen |
| Schriftführer | Mitglieder, Termine, Notizen, Dokumente, Nachrichten bearbeiten; Finanzen ansehen |
| Vorstand | alles ansehen, nichts ändern |
| Mitglied | nur der eigene Mitgliederbereich |

Ohne gültige Lizenz ist ein Verein schreibgeschützt; Limits der Lizenz werden beim Anlegen und Importieren geprüft.

## Startseite und Rechtliches

Auf der Hauptdomain (`<BASE_DOMAIN>`) läuft die Startseite mit:

- Funktionen und echten Screenshots aus der App
- Preisliste: Pakete mit Haken „In der Preisliste anzeigen“, Preis pro Jahr und optionaler Empfehlung
- Anfrageformular und Vereinssuche

Das Formular arbeitet ohne Cookies und ohne fremde Captchas: verstecktes Feld, signierter Zeitstempel und Rate-Limit. Anfragen landen per Mail und unter *Plattform → Anfragen*; mit „Verein anlegen“ wird das Anlegeformular vorausgefüllt.

Rechtliche Seiten: `/impressum`, `/datenschutz`, `/nutzungsbedingungen`, `/auftragsverarbeitung` (AVV nach Art. 28 DSGVO).

- Die Betreiberangaben werden unter *Plattform → Rechtliches* gepflegt; bis die Pflichtangaben ausgefüllt sind, zeigen die Seiten markierte Platzhalter.
- Die Texte sind Vorlagen nach österreichischem Recht und **ersetzen keine Rechtsberatung**. Vor dem Livegang prüfen lassen.
- Was die Texte zusagen, muss der Betrieb auch einhalten, vor allem regelmäßige Backups und die Löschung 30 Tage nach Vertragsende.
- Die Screenshots der Startseite erzeugt `npx tsx scripts/landing-screenshots.ts` aus den Demo-Daten neu.

## Mandanten und White Label

Jeder Verein hat eine eigene Subdomain und ein eigenes Erscheinungsbild:

| Adresse | Inhalt |
|---|---|
| `<BASE_DOMAIN>` | Startseite: Verein über seine Adresse finden (keine öffentliche Vereinsliste) |
| `admin.<BASE_DOMAIN>` | Super-Admin-Panel: Vereine, Lizenzen, Pakete |
| `<verein>.<BASE_DOMAIN>` | Anmeldung, Vereinsverwaltung und Mitgliederbereich des Vereins |

- **Getrennte Sitzungen:** Ein Login gilt nur auf der eigenen Subdomain. Zugangsdaten eines Vereins funktionieren bei keinem anderen Verein, und das Super-Admin-Panel gibt es nur auf `admin.`.
- **Erscheinungsbild** (*Einstellungen → Erscheinungsbild*, Vereins-Admin):
  - Haupt- und Akzentfarbe mit Live-Vorschau. Zu helle Farben werden automatisch auf lesbaren Kontrast (WCAG AA) abgedunkelt, der Dunkelmodus wird abgeleitet.
  - Schrift aus fünf geprüften Schriften.
  - Logo hell und dunkel, Browser-Symbol.
  - Anmeldeseite mit Überschrift, Text und Hintergrundbild.
  - E-Mails mit Absendername, Logo, Farbe und Fußzeile; PDF-Berichte mit Briefkopf.
  - Ein dezentes „powered by Vereinsplattform“ bleibt sichtbar.
- **Subdomain ändern** kann nur der Super-Admin. Die alte Adresse leitet 90 Tage weiter.

### Zwei-Faktor-Anmeldung

- **Verfahren:** Authenticator-App (TOTP) und Passkeys, dazu 10 Wiederherstellungscodes, die nur einmal angezeigt werden. Jede Person verwaltet das unter **Sicherheit** (Link in der Seitenleiste).
- **Pflicht:** Für Super-Admins immer. Jeder Verein wählt unter *Einstellungen → Vorstand und Zugänge*, ob niemand, der Vorstand oder alle MFA verwenden müssen. Wer betroffen ist und noch keinen zweiten Faktor hat, kann bis zur Einrichtung nur die Seite „Sicherheit“ nutzen.
- **Zurücksetzen bei verlorenem Handy:** Der Vereins-Admin (für seinen Verein) oder der Super-Admin setzt MFA zurück. Die Person wird abgemeldet und per E-Mail informiert, der Vorgang landet im Protokoll.
- **Missbrauchsschutz:** Ein Passwort-Reset umgeht MFA nicht. Nach 5 Fehlversuchen pro Anmeldung bzw. 10 pro Zugang in 15 Minuten wird gesperrt.

Das letzte Sicherheits-Audit liegt unter [docs/security-audit.md](docs/security-audit.md).

### Super-Admin-Panel

- **Pakete** (z. B. Basis/Plus/Premium): Limits für Mitglieder und Zugänge, Laufzeit, enthaltene Module.
- **Lizenzen:** aus Paket erzeugen oder individuell anlegen, mit einem Klick verlängern (ab dem bisherigen Ende, bei abgelaufenen ab heute). Ein Verlauf protokolliert jede Änderung.
- **Ablauf-Erinnerungen:** 30, 7 und 1 Tag vor Ablauf an die Vereins-Admins und die Super-Admins. Ein Job im App-Container läuft alle 6 h und verschickt jede Erinnerung nur einmal. Abschalten mit `LICENSE_REMINDERS=off`.
- **Als Verein einloggen:** Einmal-Link auf die Vereins-Subdomain, Sitzung 1 h. Ein rotes Banner zeigt den Modus an, Beginn und alle Aktionen stehen im Aktivitätsprotokoll des Vereins. „Zurück zur Plattform“ beendet die Sitzung.

### Rechnungen

Vereine (Admin und Kassier, Modul Finanzen) und der Super-Admin stellen Rechnungen aus.

- **Ablauf:** Entwurf → Ausstellen (vergibt die Nummer, friert Aussteller- und Empfängerdaten ein) → Senden → Bezahlt. Ausgestellte Rechnungen werden nicht gelöscht, sondern per Stornorechnung storniert; nur Entwürfe lassen sich löschen.
- **Nummern:** Präfix-Jahr-Laufnummer, je Aussteller und Jahr lückenlos. Das Präfix ist einstellbar.
- **Umsatzsteuer:** je Aussteller unter *Rechnungen → Einstellungen*: Kleinunternehmer (§ 6 Abs. 1 Z 27 UStG), steuerpflichtig mit Steuersätzen je Position und UID oder nicht steuerbar (typisch für Vereine). Welche Variante zutrifft, mit der Steuerberatung klären.
- **Zahlung:** IBAN/BIC und Verwendungszweck stehen auf der Rechnung, dazu ein SEPA-QR-Code (EPC) für Banking-Apps. Bezahlte Vereinsrechnungen landen als Einnahme „Rechnungen“ im Kassabuch.
- **Beitragsrechnungen (Soll-Rechnungen):** *Rechnungen → Beitragsrechnungen* schreibt den Jahresbeitrag vor, für alle offenen Mitglieder auf einmal oder einzeln, wahlweise als Entwurf, ausgestellt oder gleich per E-Mail. Wird die Rechnung bezahlt, gilt der Beitrag als bezahlt und wird nur einmal gebucht; „Als bezahlt buchen“ beim Mitglied schließt die offene Rechnung mit.
- **Abrechnung (Super-Admin):** Der Menüpunkt *Abrechnung* zeigt alle Lizenzen, deren aktuelle Laufzeit noch nicht verrechnet ist (unbefristete Lizenzen: das laufende Kalenderjahr), und erzeugt die Rechnungen per Knopf, einzeln oder gesammelt. Test-, gesperrte und abgelaufene Lizenzen werden nicht verrechnet.
- **Abo-Rechnungen der Plattform:** Beim Erzeugen oder Verlängern einer Lizenz aus einem Paket entsteht automatisch ein Rechnungsentwurf an den Verein. Der Super-Admin prüft und stellt aus. Vor der ersten Rechnung unter *Plattform → Rechnungen → Einstellungen* Bankverbindung und Steuerstatus eintragen; die Anschrift kommt aus *Rechtliches*. Vereine sehen ihre Rechnungen unter *Einstellungen → Rechnungen der Plattform*.

## Betrieb mit Docker

```bash
cp .env.example .env      # mindestens BASE_DOMAIN, POSTGRES_PASSWORD, DEFAULT_ADMIN_*, SMTP_* setzen
docker compose up -d --build
```

**DNS:** zwei Einträge auf den Server, `<BASE_DOMAIN>` und `*.<BASE_DOMAIN>` (Wildcard). Zugang zur DNS-API ist nicht nötig. Caddy holt beim ersten Aufruf je Subdomain ein Let's-Encrypt-Zertifikat (On-Demand-TLS) und fragt vorher die App (`/api/tls-check`). Zertifikate gibt es also nur für die Startseite, `admin.` und existierende Vereine.

- Migrationen laufen beim Start des App-Containers automatisch.
- Der Super-Admin aus `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` (mind. 12 Zeichen) wird beim ersten Start angelegt. Er meldet sich auf `admin.<BASE_DOMAIN>` an und muss dort zuerst einen zweiten Faktor einrichten. Das Passwort aus `.env` gilt nur als Startwert. Zum Zurücksetzen einmalig `DEFAULT_ADMIN_RESET_PASSWORD=true` setzen und neu starten.
- `APP_SECRET` (mind. 32 Zeichen, z. B. `openssl rand -base64 48`) verschlüsselt die Zwei-Faktor-Schlüssel. Nach dem ersten Start nicht mehr ändern.
- Der App-Container hat keinen eigenen offenen Port. Er ist nur über Caddy erreichbar, das den `Host`/`X-Forwarded-Host` setzt, aus dem die App den Verein bestimmt. Den Port 3000 deshalb nie direkt veröffentlichen.
- Daten liegen in den Volumes `db_data` (PostgreSQL) und `uploads` (Dokumente, Logos, Bilder). Beide sichern.
- E-Mails ohne echten Mailserver testen: `docker compose --profile mailtest up -d` mit `SMTP_HOST=mailpit` und `SMTP_PORT=1025`; das Postfach liegt unter http://localhost:8025.

Backup-Beispiel:

```bash
docker compose exec db pg_dump -U verein verein > backup.sql
docker run --rm -v vereinsplattform_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tgz -C /data .
```

### Erste Schritte

1. Auf `admin.<BASE_DOMAIN>` anmelden → **Pakete** anlegen.
2. **Vereine → Verein anlegen:** Name, Subdomain, Vereins-Admin und „Neue Lizenz aus Paket“. Der Vereins-Admin bekommt eine E-Mail mit der Vereinsadresse und einem Link zum Festlegen des Passworts.
3. Der Vereins-Admin gestaltet unter *Einstellungen → Erscheinungsbild* Farben und Logo, importiert die Mitglieder und verteilt den Link `<verein>.<BASE_DOMAIN>/registrieren` an die Mitglieder.

## Entwicklung

Voraussetzungen: Node.js 22, PostgreSQL 16+.

```bash
npm install
cp .env.example .env      # DATABASE_URL auf die lokale Datenbank setzen, SMTP_HOST leer lassen = Mails landen im Log
npm run db:migrate        # Schema anlegen
npm run db:seed           # Demo-Verein „Musikverein Grünbach“
npm run dev
```

Lokal ist `BASE_DOMAIN=localhost:3000`. Browser lösen `*.localhost` ohne DNS auf:

- http://admin.localhost:3000: Super-Admin (`DEFAULT_ADMIN_*` aus `.env`)
- http://musikverein-gruenbach.localhost:3000: `obfrau@demo.at` (Admin), `kassier@demo.at`, `mitglied@demo.at`
- http://sportunion-tal.localhost:3000: `obmann@demo.at` (zweiter Verein mit anderem Erscheinungsbild)

Passwort jeweils `demo-passwort-123`.

| Befehl | Zweck |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint, TypeScript |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:e2e` | End-to-End-Tests (Playwright) gegen eine laufende App mit Seed-Daten; `E2E_BASE_DOMAIN`/`E2E_PROTOCOL` zum Umstellen |
| `npm run db:migrate` | neue Migration aus Schemaänderungen erzeugen |

### Aufbau

```
prisma/schema.prisma        Datenmodell
src/lib/                    Auth, Rechte, Lizenzen, Finanzlogik, PDF, iCal, CSV, Mail, Uploads
src/app/(auth)/             Anmelden, Passwort setzen/vergessen, Zugang anfordern
src/app/(app)/              Vereinsbereich, Mitgliederbereich, Plattform (/admin)
src/app/api/                Downloads: PDF/CSV, Dokumente, Logo, Kalender-Feed, Healthcheck
docker/                     Caddyfile, Entrypoint
e2e/                        Playwright-Tests
```

## Lizenz

MIT
