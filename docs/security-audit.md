# Sicherheits-Audit Vereinsplattform

Stand: 27.11.2026 · Umfang: gesamtes Repository (Next.js 16.4.6, Prisma 6.19, PostgreSQL 17, Docker/Caddy), inkl. Git-History.
Methode: Code-Review entlang der Einstiegspunkte, mechanische Prüfung aller Server Actions auf Guards, Gegenprüfung mit laufender App und E2E-Tests.

## 1. Angriffsfläche

| Einstieg | Schutz |
|---|---|
| 58 Server Actions in 13 Dateien | jede beginnt mit `requirePlatformAdmin` / `writer` / `staff` / `requireUser` / `getPendingMfa` – außer den absichtlich öffentlichen (Login, Logout, Passwort-Reset, Zugang anfordern, MFA abbrechen, Vereinssuche) |
| 10 Route Handler (`/api/*`) | Downloads über `apiUser` (Host + Rolle + MFA), Kalender über geheimen Token, Branding/Health/TLS-Check öffentlich |
| `proxy.ts` | nur Routing (404, Weiterleitungen), **keine** Autorisierung – die liegt im Server-Code |
| Mandant | aus dem Host (`x-forwarded-host` von Caddy), Sitzung nur auf dem eigenen Host gültig |
| Uploads | Dokumente (20 MB, Auslieferung mit `CSP: sandbox`, `nosniff`), Bilder (Magic-Bytes-Prüfung, kein SVG), CSV-Import (2 MB) |
| Hintergrund | Lizenz-Erinnerungen (Intervall im App-Prozess) |
| Externe Dienste | nur SMTP; keine serverseitigen Abrufe von Nutzer-URLs |

## 2. Befunde

| # | Schwere | Befund | Status |
|---|---|---|---|
| 1 | **Hoch** | Geheimnisse in der Git-History | **Handlung nötig** (siehe unten) |
| 2 | Mittel | Keine Content-Security-Policy | behoben |
| 3 | Mittel | Zweiter Faktor über viele Anmeldungen hinweg durchprobierbar | behoben |
| 4 | Mittel | Passwortänderung beendet andere Sitzungen nicht | behoben |
| 5 | Niedrig | Ohne SMTP landen Reset-Links im Server-Log | behoben |
| 6 | Niedrig | Standard-Admin-Passwort wird bei jedem Start aus `.env` überschrieben | behoben |
| 7 | Niedrig | Wiederherstellungscode bei parallelen Anfragen doppelt nutzbar | behoben |
| 8 | Niedrig | Kalender-Token teilweise vorhersagbar (`cuid`) | behoben |
| 9 | Niedrig | Profil/Passwort im „Als Verein“-Modus ändert das Admin-Konto | behoben |
| 10 | Niedrig | Rate-Limits nur im Speicher (Neustart setzt zurück, nur eine Instanz) | dokumentiert |
| 11 | Info | Bekannte Lücken in Prisma-CLI-Abhängigkeiten (`deepmerge-ts`, `effect`) | dokumentiert |
| 12 | Info | GitHub Actions nicht auf Commit-SHA gepinnt; Lizenzlimit-Prüfung nicht atomar | dokumentiert |
| 13 | Mittel | Zweiten Faktor hinzufügen ging ohne Passwort | behoben (Review MFA) |
| 14 | Niedrig | Vereins-Admins konnten sich gegenseitig MFA zurücksetzen | behoben (Review MFA) |
| 15 | Niedrig | Passkeys einer früheren Subdomain zählten als Faktor | behoben (Review MFA) |
| 16 | Niedrig | 404-Seite durch CSP blockiert (fehlende Nonce) | behoben (Review MFA) |

### 1 · Hoch · Geheimnisse in der Git-History
- **Quelle:** frühere Commits von `.env` und `Anleitung.txt` (vor dem Neubau).
- **Inhalt:** GitHub-Token (`ghp_wwfC…`), Brevo-API-Key (`xkeysib-…`), ein Admin-Passwort (`Gs4…`), Flask-`SECRET_KEY`.
- **Auswirkung:** Jeder mit Lesezugriff auf das Repository (auch einem künftigen öffentlichen) kann damit auf GitHub, das Brevo-Konto (E-Mails im Namen des Vereins) und überall dort zugreifen, wo das Passwort noch gilt.
- **Behebung:**
  - Den Token auf GitHub widerrufen, den Brevo-Key neu erzeugen, das Passwort überall ändern, wo es verwendet wurde.
  - Die Dateien zu löschen genügt nicht.
  - Ein Umschreiben der History (`git filter-repo`) ist möglich, ändert aber alle Commit-IDs und erfordert einen Force-Push. Das ist eine bewusste Entscheidung des Repository-Eigentümers.

### 2 · Mittel · Keine Content-Security-Policy
- **Befund:** HTML-Seiten wurden ohne CSP ausgeliefert. Eine gefundene XSS-Lücke gibt es nicht: React escaped, und `dangerouslySetInnerHTML` gibt es nur für statischen Code und für validierte Hex-Farben.
- **Risiko:** Ohne CSP hätte aber jede künftige Lücke sofort volle Wirkung (Sitzungsaktionen, Datenabfluss).
- **Behebung:** Nonce-basierte CSP aus `proxy.ts` nach Next.js-Leitfaden mit `script-src 'nonce-…' 'strict-dynamic'`, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` und `form-action` auf die eigenen Hosts.

### 3 · Mittel · Zweiter Faktor durchprobierbar
- **Quelle → Senke:** `verifyMfaCode` (`src/app/(auth)/mfa-actions.ts`).
- **Befund:** Das Limit galt pro Zwischensitzung (5 Versuche). Wer das Passwort hat, kann sich bis zu 30-mal pro Stunde neu anmelden. Das sind 150 Code-Versuche pro Stunde bei 3 gültigen Codes je Zeitfenster, also etwa 1 % Erfolg pro Tag.
- **Behebung:** zusätzliches Limit pro Konto (10 Fehlversuche je 15 Minuten), unabhängig von der Sitzung.

### 4 · Mittel · Passwortänderung beendet andere Sitzungen nicht
- **Befund:** `changePassword` (`src/app/(app)/einstellungen/actions.ts`) setzte nur den Hash. Eine gestohlene Sitzung blieb nach der Passwortänderung 30 Tage gültig.
- **Behebung:** Alle anderen Sitzungen des Kontos werden gelöscht.

### 5 · Niedrig · Reset-Links im Log
- **Befund:** Ist kein `SMTP_HOST` gesetzt, schrieb `sendMail` den kompletten Mailtext ins Log, also auch Passwort-Links.
- **Risiko:** Wer Log-Zugriff hat, könnte Konten übernehmen.
- **Behebung:** Der Mailtext wird nur noch in der Entwicklung geloggt, in Produktion nur Empfänger und Betreff.

### 6 · Niedrig · Standard-Admin-Passwort wird überschrieben
- **Befund:** `ensureDefaultAdmin` setzte bei jedem Start das Passwort aus `.env`. Eine Passwortänderung in der Oberfläche wurde so stillschweigend zurückgedreht, und `.env` blieb dauerhaft ein gültiger Zugang.
- **Behebung:** Das Passwort wird nur beim Anlegen gesetzt. Zum Zurücksetzen gibt es `DEFAULT_ADMIN_RESET_PASSWORD=true`.

### 7 · Niedrig · Wiederherstellungscode doppelt nutzbar
- **Befund:** Das Einlösen las und schrieb nicht atomar. Zwei gleichzeitige Anfragen mit demselben Code konnten beide durchgehen.
- **Behebung:** Bedingtes Update; nur die Anfrage, die den Code tatsächlich entfernt, gilt.

### 8 · Niedrig · Kalender-Token teilweise vorhersagbar
- **Befund:** Der Standardwert war `cuid()` (Zeitstempel plus Zähler plus wenig Zufall). Der Feed zeigt nur für Mitglieder freigegebene Termine.
- **Behebung:** Neue Tokens sind zufällig (`gen_random_uuid()`), bestehende werden durch die Migration ersetzt. Vereine müssen den Kalender-Link einmal neu abonnieren.

### 9 · Niedrig · Konto-Änderungen im „Als Verein“-Modus
- **Befund:** `updateProfile` und `changePassword` wirkten während der Impersonation auf das Konto des Plattform-Admins.
- **Behebung:** In diesem Modus gesperrt.

### 13–16 · Unabhängiges Review der MFA-Änderungen
- **13 · Mittel:** Ein gestohlener Sitzungs-Cookie reichte, um einen eigenen Authenticator oder Passkey anzumelden. Dieser Zugang hätte auch eine Passwortänderung überdauert. Seit der Behebung braucht das Hinzufügen eines Faktors ebenso das Passwort wie das Entfernen.
- **14 · Niedrig:** Ein Vereins-Admin konnte die MFA eines anderen Vereins-Admins löschen. Das darf jetzt nur noch der Plattform-Betreiber.
- **15 · Niedrig:** Nach einem Subdomain-Wechsel galten Passkeys der alten Adresse weiter als Faktor, waren aber nicht nutzbar. Das konnte Konten aussperren. Jetzt zählen nur Passkeys der aktuellen Adresse; die alten müssen neu angelegt werden.
- **16 · Niedrig:** Die 404-Seite bekam keine Nonce und wurde von der CSP blockiert. Die Nonce wird jetzt auch dort übergeben.

### 10–12 · Dokumentiert
- **Rate-Limits im Speicher:** genügen für den Betrieb mit einer Instanz. Bei mehreren Instanzen müssen sie nach Redis oder PostgreSQL wandern.
- **Prisma-CLI:** Die Lücken betreffen das Laden der Prisma-Konfiguration beim Generieren und Migrieren, nicht Benutzereingaben. Behoben werden sie erst mit Prisma 7 (Major-Upgrade, eigene Aufgabe).
- **CI und Lizenzlimits:**
  - GitHub Actions auf Commit-SHA pinnen.
  - Das Lizenzlimit kann bei exakt gleichzeitigen Anlagen um wenige Mitglieder überschritten werden. Das ist kein Sicherheitsrisiko.

### Nachtrag · Einmal-Passwörter für Vereins-Admins
- **Funktion:** Der Plattform-Admin kann für Vorstands-Zugänge ein Einmal-Passwort erzeugen, das in der Konsole angezeigt wird.
- **Absicherung:** 60 Bit Zufall (12 Zeichen aus 32), Login-Rate-Limit wie gewohnt; gültig 7 Tage, danach abgelehnt. Der Klartext liegt nur bis zur ersten Anmeldung AES-256-GCM-verschlüsselt (Schlüssel aus `APP_SECRET`) vor und wird dann gelöscht. Bis zum eigenen Passwort sperrt `requireUser()` jede andere Seite und Server-Action, `apiUser()` jede API. Erzeugen beendet alle Sitzungen und entwertet offene Einladungs-/Reset-Links; das eigene Passwort darf nicht gleich dem Einmal-Passwort sein und beendet andere Sitzungen. Jeder Vorgang steht im Aktivitätsprotokoll des Vereins. Plattform-Admins und Mitglieder sind ausgenommen.
- **Restrisiko:** Wer die Admin-Konsole einsehen kann, sieht das Passwort bis zur ersten Anmeldung – die Konsole ist nur mit MFA erreichbar.

## 3. Geprüft und unauffällig
- **Mandantentrennung:**
  - Jede Abfrage in Server Actions und Route Handlern ist auf `clubId` des angemeldeten Benutzers eingeschränkt (Stichprobe aller ID-Parameter: Mitglieder, Buchungen, Termine, Dokumente, Notizen, Vorlagen, Benutzer).
  - Sitzungen gelten nur auf dem eigenen Host, Cookies sind host-only.
  - Zugangsdaten eines Vereins scheitern bei anderen Vereinen (E2E-Test).
- **Funktionsrechte:** Rollenmatrix serverseitig. Plattform-Aktionen nur auf `admin.` und nicht im Impersonation-Modus. Das MFA-Pflicht-Gate liegt in `requireUser`, `apiUser` und der Dokument-Route, gilt also auch für Server Actions und Downloads.
- **Massenzuweisung:** Alle Eingaben laufen über zod-Schemas mit expliziten Feldern. `role`, `clubId` und `isPlatformAdmin` sind nicht vom Client setzbar.
- **Injection:**
  - SQL: nur Prisma, `$queryRaw` nur als Tagged Template im Health-Check.
  - Befehlsausführung gibt es keine.
  - Pfad-Traversal ist durch `resolveSafe` ausgeschlossen.
  - SSRF: keine serverseitigen Abrufe von Nutzer-URLs.
  - CSV-Formeln werden neutralisiert.
  - Mail-Header sind gesäubert, Mail-HTML ist escaped.
  - PDF-Texte werden gefiltert.
- **XSS:** React-Escaping. `dangerouslySetInnerHTML` nur für ein statisches Theme-Skript und für Branding-CSS aus regex-geprüften und neu serialisierten Hex-Werten. Uploads werden mit `sandbox` und `nosniff` ausgeliefert.
- **Authentifizierung:**
  - bcrypt (Kosten 12), Sitzungs-IDs als SHA-256 von 256-Bit-Zufall, Cookies `HttpOnly`, `Secure` (unter https) und `SameSite=Lax`.
  - Neue Sitzung nach dem MFA-Schritt.
  - Reset-Tokens: 2 h gültig, einmalig, gehasht gespeichert.
  - Einheitliche Antworten gegen Account-Enumeration, Timing-Ausgleich für unbekannte Konten.
  - Ein Passwort-Reset umgeht MFA nicht.
- **MFA:**
  - TOTP nach RFC 6238 (gegen Testvektoren geprüft), ±1 Zeitfenster, Schutz gegen Wiederverwendung per Compare-and-Set.
  - Seed AES-256-GCM-verschlüsselt.
  - WebAuthn mit Challenge pro Sitzung, `expectedOrigin` und `expectedRPID`, Zähler-Update.
  - Entfernen eines Faktors verlangt das Passwort.
  - Zurücksetzen nur durch Vereins- oder Plattform-Admin, protokolliert und per Mail gemeldet.
- **Impersonation:** Einmal-Ticket (2 min, atomar eingelöst, an Verein und Host gebunden), Sitzung 1 h, Banner, Protokoll.
- **Open Redirects:** `next` per Regex auf Pfade beschränkt. Alle anderen Weiterleitungen werden aus `BASE_DOMAIN` und Werten aus der Datenbank gebaut.
- **CSRF:** Next.js prüft bei Server Actions `Origin` gegen den Host. Fremde Subdomains werden abgelehnt.
- **TLS:** Caddy On-Demand nur für Hosts, die die App bestätigt; Rate-Limit über `X-Real-IP` von Caddy.
- **Container:** läuft als Nicht-Root-Benutzer, App-Port nicht veröffentlicht, nur Caddy auf 80/443, HSTS gesetzt.
- **Abhängigkeiten zur Laufzeit:** keine bekannten Lücken außerhalb der Prisma-CLI. Next.js 16.4.6 ist ein Sicherheitsupdate.

## 4. Grenzen
- Kein Penetrationstest gegen ein Produktivsystem, keine Prüfung des Servers selbst (SSH, Firewall, Backups, Betriebssystem-Updates).
- Die Zustellbarkeit von E-Mails (SPF, DKIM, DMARC der Absenderdomain) muss beim Mailanbieter eingerichtet werden.
- Backups von `db_data` und `uploads` sollten verschlüsselt und außerhalb des Servers liegen; das ist nicht Teil des Repositories.
