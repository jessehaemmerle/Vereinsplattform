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

## Betrieb mit Docker

```bash
cp .env.example .env      # Werte anpassen – mindestens POSTGRES_PASSWORD, DEFAULT_ADMIN_*, APP_URL, DOMAIN, SMTP_*
docker compose up -d --build
```

- Caddy übernimmt Port 80/443. Mit `DOMAIN=verein.example.at` (DNS zeigt auf den Server) holt Caddy automatisch ein Let's-Encrypt-Zertifikat. Mit `DOMAIN=localhost` gibt es ein lokales, selbstsigniertes Zertifikat.
- `APP_URL` muss die öffentliche Adresse sein (z. B. `https://verein.example.at`) – sie steht in Einladungslinks und im Kalender-Abo; bei `https://` werden Session-Cookies als `Secure` gesetzt.
- Datenbank-Migrationen laufen beim Start des App-Containers automatisch.
- Beim Start wird der Plattform-Admin aus `DEFAULT_ADMIN_EMAIL` / `DEFAULT_ADMIN_PASSWORD` (mind. 12 Zeichen) angelegt bzw. sein Passwort aktualisiert.
- Daten liegen in den Volumes `db_data` (PostgreSQL) und `uploads` (Dokumente, Logos) – beide sichern.
- E-Mails testen ohne echten Mailserver: `docker compose --profile mailtest up -d` und `SMTP_HOST=mailpit`, `SMTP_PORT=1025`; Postfach unter http://localhost:8025.

Backup-Beispiel:

```bash
docker compose exec db pg_dump -U verein verein > backup.sql
docker run --rm -v vereinsplattform_uploads:/data -v "$PWD":/backup alpine tar czf /backup/uploads.tgz -C /data .
```

### Erste Schritte

1. Als Plattform-Admin anmelden → **Plattform → Lizenzen → Lizenz erstellen**.
2. **Vereine → Verein anlegen**, Vereins-Admin eintragen und Lizenz zuweisen. Der Vereins-Admin bekommt einen Link und legt sein Passwort fest.
3. Der Vereins-Admin importiert die Mitgliederliste (Vorlage unter *Mitglieder → Importieren*), lädt weitere Vorstandsmitglieder unter *Einstellungen* ein und verteilt den Link zur Zugangsanforderung an die Mitglieder.

## Entwicklung

Voraussetzungen: Node.js 22, PostgreSQL 16+.

```bash
npm install
cp .env.example .env      # DATABASE_URL auf die lokale Datenbank setzen, SMTP_HOST leer lassen = Mails landen im Log
npm run db:migrate        # Schema anlegen
npm run db:seed           # Demo-Verein „Musikverein Grünbach“
npm run dev
```

Demo-Zugänge nach dem Seed (Passwort `demo-passwort-123`): `obfrau@demo.at` (Admin), `kassier@demo.at` (Kassier), `mitglied@demo.at` (Mitglied).

| Befehl | Zweck |
|---|---|
| `npm run lint` / `npm run typecheck` | ESLint, TypeScript |
| `npm test` | Unit-Tests (Vitest) |
| `npm run test:e2e` | End-to-End-Tests (Playwright) gegen eine laufende App mit Seed-Daten; `E2E_BASE_URL` zum Umstellen |
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
