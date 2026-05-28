Projektname: Vereinsverwaltung
Inhaltsverzeichnis
Überblick
Funktionen
Technologien
Installation
Verwendung
Dateistruktur
Datenbankmodell
Lizenz
Überblick
Die Vereinsverwaltungssoftware bietet eine benutzerfreundliche Plattform zur Verwaltung von Mitgliedern, Finanzen, Events und Notizen. Ziel ist es, Vereinsarbeit effizient und zentralisiert zu organisieren.

Funktionen
Mitgliederverwaltung:
Hinzufügen, Bearbeiten und Löschen von Mitgliedern
CSV-Import von Mitgliederdaten
Finanzmanagement:
Einnahmen und Ausgaben verwalten
Jahresabschluss erstellen und als PDF exportieren
Finanzdaten als CSV exportieren
Eventmanagement:
Erstellung und Verwaltung von Events
Automatische Verknüpfung von Eventkosten mit Finanzen
Notizen:
Erstellen, Bearbeiten und Löschen von Vereinsnotizen
Dokumentenmanagement:
Hochladen und Verwalten von Dokumenten
Benutzermanagement:
Benutzerregistrierung und -authentifizierung
Rollenbasierte Rechteverwaltung (z. B. Admin, Kassierer)
Einstellungen:
Anpassung von Themen und Integration mit Kalenderdiensten (Google, Outlook)
Technologien
Backend:
Python (Flask)
SQLite für Datenbankmanagement
Frontend:
HTML, CSS (Bootstrap 5), JavaScript
Sonstiges:
Flask-WTF für Formulare
FPDF für PDF-Generierung
Flask-Login für Benutzerverwaltung
Installation
Systemanforderungen:

Python 3.8 oder höher
Pip (Python-Paketmanager)
Schritte:

Repository klonen:
bash
Copy code
git clone <repository-url>
cd vereinsverwaltung
Abhängigkeiten installieren:
bash
Copy code
pip install -r requirements.txt
Datenbank initialisieren:
bash
Copy code
flask db init
flask db migrate
flask db upgrade
Anwendung starten:
bash
Copy code
flask run
Zugriff auf die Anwendung unter http://localhost:5000.
Verwendung
Registrieren Sie sich als Admin und richten Sie Ihre Vereinsdaten ein.
Fügen Sie Mitglieder hinzu oder importieren Sie sie über die CSV-Importfunktion.
Verwalten Sie Finanzen, Events und Notizen direkt im Dashboard.
Exportieren Sie Berichte und Jahresabschlüsse für Ihre Unterlagen.
Dateistruktur
app.py: Hauptanwendung mit Routen und Logik
models.py: Datenbankmodelle
forms.py: Formulare für Benutzerinteraktionen
templates/: HTML-Templates
static/: Statische Dateien wie CSS, JS und Bilder
Datenbankmodell
Die Software verwendet eine relationale Datenbankstruktur:

Mitglieder:
Vorname, Nachname, E-Mail, Status, Funktion, Eintrittsdatum
Finanzen:
Typ (Einnahme/Ausgabe), Betrag, Kategorie, Datum, Beschreibung
Events:
Titel, Beschreibung, Datum, Ort, Preis
Notizen:
Titel, Inhalt
Dokumente:
Originalname, Beschreibung, Hochladedatum
Lizenz
Dieses Projekt ist lizenziert unter der MIT-Lizenz. Weitere Informationen finden Sie in der Datei LICENSE.

Plattform-Admin und Lizenzen
Die Lizenzverwaltung ist direkt in die Flask-App integriert. Es wird kein separater Lizenzserver benoetigt.

Beim Start kann die App einen Standard-Admin aus der `.env` erstellen oder aktualisieren. Dieser Benutzer
hat die Rolle `system_admin` und ist nicht an einen Verein gebunden. Nach dem Login landet er direkt im
Plattform-Adminbereich und kann dort einen eigenen Vereins-Admin inklusive Verein anlegen.

Beispiel:
DEFAULT_ADMIN_EMAIL=admin@example.com
DEFAULT_ADMIN_USERNAME=standard_admin
DEFAULT_ADMIN_PASSWORD=ein-sicheres-passwort

Wenn E-Mail, Benutzername oder Passwort in der `.env` geaendert werden, wird der Standard-Admin beim
naechsten App-Start entsprechend synchronisiert. Mit `DEFAULT_ADMIN_ENABLED=false` kann diese Synchronisierung
deaktiviert werden.

Neue Vereins-Admins erhalten beim Anlegen keinen fremd vergebenen Passwortwert. Die App erzeugt stattdessen
einen Passwort-Link, ueber den die Person ihr Passwort selbst festlegt. Der Link ist standardmaessig sieben
Tage gueltig; die Dauer kann mit `PASSWORD_SETUP_TOKEN_MAX_AGE` in Sekunden angepasst werden.

Beim Erstellen eines Vereins wird keine Lizenz automatisch erzeugt. Lizenzschluessel werden separat im
Plattform-Adminbereich erstellt und danach einem Verein zugewiesen.

Ein Plattform-Admin wird ueber die Rolle `system_admin` oder ueber die Umgebungsvariable
`SYSTEM_ADMIN_EMAILS` freigeschaltet. Mehrere E-Mail-Adressen koennen kommasepariert hinterlegt werden.

Beispiel:
SYSTEM_ADMIN_EMAILS=admin@example.com,ops@example.com

Nach dem Login erscheint fuer diese Benutzer der Navigationspunkt `Admin`. Dort koennen Lizenzen erstellt,
Vereinen zugeordnet, bearbeitet und geloescht werden. Die Nutzung wird pro Lizenz aus den zugeordneten
Vereinsdaten und protokollierten Schreib-/Login-Aktivitaeten dargestellt.
