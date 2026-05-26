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

Ein Plattform-Admin wird ueber die Rolle `system_admin` oder ueber die Umgebungsvariable
`SYSTEM_ADMIN_EMAILS` freigeschaltet. Mehrere E-Mail-Adressen koennen kommasepariert hinterlegt werden.

Beispiel:
SYSTEM_ADMIN_EMAILS=admin@example.com,ops@example.com

Nach dem Login erscheint fuer diese Benutzer der Navigationspunkt `Admin`. Dort koennen Lizenzen erstellt,
Vereinen zugeordnet, bearbeitet und geloescht werden. Die Nutzung wird pro Lizenz aus den zugeordneten
Vereinsdaten und protokollierten Schreib-/Login-Aktivitaeten dargestellt.
