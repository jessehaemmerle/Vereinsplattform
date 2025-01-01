import os
from datetime import date
from flask import Flask, render_template, request, redirect, url_for, flash, send_file, abort, make_response
from models import db, Mitglied, Event, Finanzbuchung, Notiz, User, Document
from forms import MitgliedForm, EventForm, FinanzForm, NotizForm, RegisterForm, LoginForm, DocumentForm
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import uuid # Für Eindeutige Dateinamen in der Struktur.
import csv
import io
from fpdf import FPDF
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials

# Flask-Login konfigurieren
login_manager = LoginManager()
login_manager.login_view = 'login'  # Ziel-View, falls der User nicht eingeloggt ist
login_manager.login_message = "Bitte logge dich ein, um fortzufahren."

app = Flask(__name__)
app.config['SECRET_KEY'] = 'SUPER_GEHEIM'  # In Produktion in Umgebungsvariablen auslagern
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///verein.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')

if not os.path.exists('uploads'):
    os.makedirs('uploads')

db.init_app(app)
login_manager.init_app(app)


# ----------------------------------
# User Loader für Flask-Login
# ----------------------------------
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ----------------------------------
# Registrierung
# ----------------------------------
@app.route('/register', methods=['GET', 'POST'])
def register():
    if current_user.is_authenticated:
        return redirect(url_for('index'))  # Nutzer ist schon eingeloggt

    form = RegisterForm()
    if form.validate_on_submit():
        # Prüfen, ob E-Mail bereits existiert
        existing_user = User.query.filter_by(email=form.email.data).first()
        if existing_user:
            flash("E-Mail bereits registriert.")
            return redirect(url_for('register'))

        # Neuen Benutzer anlegen
        new_user = User(
            username=form.username.data,
            email=form.email.data,
            role='mitglied'  # Default-Rolle
        )
        new_user.set_password(form.password.data)
        db.session.add(new_user)
        db.session.commit()

        flash("Registrierung erfolgreich. Bitte melde dich jetzt an.")
        return redirect(url_for('login'))

    return render_template('register.html', form=form)


# ----------------------------------
# Login
# ----------------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        return redirect(url_for('index'))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            flash("Erfolgreich eingeloggt.")
            return redirect(url_for('index'))
        else:
            flash("Falsche E-Mail oder falsches Passwort.")
            return redirect(url_for('login'))

    return render_template('login.html', form=form)


# ----------------------------------
# Logout
# ----------------------------------
@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash("Erfolgreich ausgeloggt.")
    return redirect(url_for('index'))


# ----------------------------------
# Startseite / Dashboard
# ----------------------------------
@app.route('/')
@login_required
def index():
    # Berechnung für Einnahmen und Ausgaben
    sum_einnahmen = db.session.query(db.func.sum(Finanzbuchung.betrag))\
        .filter(Finanzbuchung.typ == 'Einnahme').scalar() or 0
    sum_ausgaben = db.session.query(db.func.sum(Finanzbuchung.betrag))\
        .filter(Finanzbuchung.typ == 'Ausgabe').scalar() or 0
    
    # Rundung auf 2 Nachkommastellen
    sum_einnahmen = round(sum_einnahmen, 2)
    sum_ausgaben = round(sum_ausgaben, 2)

    # Mitgliederstatus
    mitglieder_aktiv = Mitglied.query.filter_by(status='aktiv').count()
    mitglieder_inaktiv = Mitglied.query.filter_by(status='inaktiv').count()

    # Events pro Monat
    events = Event.query.all()
    events_monate = [0] * 12
    for event in events:
        if event.datum:
            events_monate[event.datum.month - 1] += 1

    # Anzahlen und Saldo
    anzahl_mitglieder = Mitglied.query.count()
    anzahl_events = Event.query.count()
    anzahl_notizen = Notiz.query.count()
    saldo = sum_einnahmen - sum_ausgaben

    saldo = round(saldo, 2)

    return render_template('index.html',
                           anzahl_mitglieder=anzahl_mitglieder,
                           anzahl_events=anzahl_events,
                           anzahl_notizen=anzahl_notizen,
                           saldo=saldo,
                           sum_einnahmen=sum_einnahmen,
                           sum_ausgaben=sum_ausgaben,
                           mitglieder_aktiv=mitglieder_aktiv,
                           mitglieder_inaktiv=mitglieder_inaktiv,
                           events_monate=[str(month) for month in range(1, 13)],
                           events_anzahl=events_monate)

# ----------------------------------
# Mitglieder
# ----------------------------------
@app.route('/mitglieder')
@login_required
def mitglieder_liste():
    search_query = request.args.get('search', '').strip()
    if search_query:
        mitglieder = Mitglied.query.filter(
            db.or_(
                Mitglied.vorname.ilike(f"%{search_query}%"),
                Mitglied.nachname.ilike(f"%{search_query}%"),
                Mitglied.email.ilike(f"%{search_query}%")
            )
        ).all()
    else:
        mitglieder = Mitglied.query.all()

    return render_template('mitglieder.html', mitglieder=mitglieder)


@app.route('/mitglied/new', methods=['GET', 'POST'])
@login_required
def mitglied_new():
    form = MitgliedForm()
    if form.validate_on_submit():
        neues_mitglied = Mitglied(
            vorname=form.vorname.data,
            nachname=form.nachname.data,
            email=form.email.data,
            eintrittsdatum=form.eintrittsdatum.data or date.today(),
            status=form.status.data,
            funktion=form.funktion.data,
            mitgliedsbeitrag=form.mitgliedsbeitrag.data or 0.0,
            beitrag_bezahlt=form.beitrag_bezahlt.data == 'true'
        )
        db.session.add(neues_mitglied)
        if form.beitrag_bezahlt.data == 'true' and neues_mitglied.mitgliedsbeitrag > 0:
            db.session.add(Finanzbuchung(
                typ='Einnahme',
                kategorie='Mitgliedsbeitrag',
                betrag=neues_mitglied.mitgliedsbeitrag,
                datum=date.today(),
                beschreibung=f"Mitgliedsbeitrag von {neues_mitglied.vorname} {neues_mitglied.nachname}"
            ))
        db.session.commit()
        return redirect(url_for('mitglieder_liste'))
    return render_template('mitglied_edit.html', form=form, titel="Neues Mitglied")


@app.route('/mitglied/<int:mitglied_id>/edit', methods=['GET', 'POST'])
@login_required
def mitglied_edit(mitglied_id):
    mitglied = Mitglied.query.get_or_404(mitglied_id)
    form = MitgliedForm(obj=mitglied)
    if form.validate_on_submit():
        mitglied.vorname = form.vorname.data
        mitglied.nachname = form.nachname.data
        mitglied.email = form.email.data
        mitglied.eintrittsdatum = form.eintrittsdatum.data
        mitglied.status = form.status.data
        mitglied.funktion = form.funktion.data
        db.session.commit()
        return redirect(url_for('mitglieder_liste'))
    return render_template('mitglied_edit.html', form=form, titel="Mitglied bearbeiten")

@app.route('/mitglied/<int:mitglied_id>/delete', methods=['POST'])
@login_required
def mitglied_delete(mitglied_id):
    mitglied = Mitglied.query.get_or_404(mitglied_id)
    db.session.delete(mitglied)
    db.session.commit()
    return redirect(url_for('mitglieder_liste'))

@app.route('/mitglieder/import', methods=['GET', 'POST'])
@login_required
def mitglieder_import():
    if request.method == 'POST':
        file = request.files.get('file')
        if not file:
            flash('Keine Datei ausgewählt.', 'danger')
            return redirect(url_for('mitglieder_liste'))

        try:
            stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_reader = csv.DictReader(stream)

            for row in csv_reader:
                neues_mitglied = Mitglied(
                    vorname=row['Vorname'],
                    nachname=row['Nachname'],
                    email=row['Email'],
                    eintrittsdatum=row.get('Eintrittsdatum', date.today()),
                    status=row.get('Status', 'aktiv'),
                    funktion=row.get('Funktion', 'Mitglied')
                )
                db.session.add(neues_mitglied)
            db.session.commit()

            flash('Mitglieder erfolgreich importiert.', 'success')
        except Exception as e:
            flash(f'Fehler beim Importieren der CSV: {e}', 'danger')

    return redirect(url_for('mitglieder_liste'))

@app.route('/mitglied/<int:mitglied_id>/update_beitrag', methods=['POST'])
@login_required
def mitglied_update_beitrag(mitglied_id):
    mitglied = Mitglied.query.get_or_404(mitglied_id)
    mitglied.beitrag_bezahlt = not mitglied.beitrag_bezahlt

    # Bei Bezahlung eine Finanzbuchung erstellen
    if mitglied.beitrag_bezahlt:
        db.session.add(Finanzbuchung(
            typ='Einnahme',
            kategorie='Mitgliedsbeitrag',
            betrag=mitglied.mitgliedsbeitrag,
            datum=date.today(),
            beschreibung=f"Mitgliedsbeitrag von {mitglied.vorname} {mitglied.nachname}"
        ))
    db.session.commit()
    flash(f"Der Status des Mitgliedsbeitrags für {mitglied.vorname} {mitglied.nachname} wurde aktualisiert.", "success")
    return redirect(url_for('mitglieder_liste'))


# ----------------------------------
# Events
# ----------------------------------
@app.route('/events')
@login_required
def events_liste():
    events = Event.query.all()
    return render_template('events.html', events=events)

@app.route('/event/new', methods=['GET', 'POST'])
@login_required
def event_new():
    form = EventForm()
    if form.validate_on_submit():
        # Neues Event erstellen
        neues_event = Event(
            titel=form.titel.data,
            beschreibung=form.beschreibung.data,
            datum=form.datum.data,
            ort=form.ort.data,
            preis=form.preis.data  # Eventpreis
        )
        db.session.add(neues_event)
        db.session.commit()

        # Automatische Finanzbuchung für Eventkosten
        if neues_event.preis and neues_event.preis > 0:
            finanzbuchung = Finanzbuchung(
                typ='Ausgabe',
                kategorie='Eventkosten',
                betrag=neues_event.preis,
                datum=neues_event.datum or date.today(),
                beschreibung=f"Kosten für Event: {neues_event.titel}"
            )
            db.session.add(finanzbuchung)
            db.session.commit()

        # Event mit Google Kalender synchronisieren
        add_event_to_google_calendar(neues_event, current_user)

        flash('Neues Event erfolgreich erstellt, Kosten wurden in Finanzen erfasst.', 'success')
        return redirect(url_for('events_liste'))
    return render_template('event_edit.html', form=form, titel="Neues Event")


@app.route('/event/<int:event_id>/edit', methods=['GET', 'POST'])
@login_required
def event_edit(event_id):
    event = Event.query.get_or_404(event_id)
    form = EventForm(obj=event)
    if form.validate_on_submit():
        # Update des Events
        event.titel = form.titel.data
        event.beschreibung = form.beschreibung.data
        event.datum = form.datum.data
        event.ort = form.ort.data
        event.preis = form.preis.data
        db.session.commit()

        # Finanzbuchung aktualisieren
        finanzbuchung = Finanzbuchung.query.filter_by(
            beschreibung=f"Kosten für Event: {event.titel}"
        ).first()

        if finanzbuchung:
            finanzbuchung.betrag = event.preis
            finanzbuchung.datum = event.datum
        else:
            # Falls keine Buchung existiert, neu erstellen
            finanzbuchung = Finanzbuchung(
                typ='Ausgabe',
                kategorie='Eventkosten',
                betrag=event.preis,
                datum=event.datum or date.today(),
                beschreibung=f"Kosten für Event: {event.titel}"
            )
            db.session.add(finanzbuchung)

        db.session.commit()
        flash('Event und zugehörige Finanzbuchung erfolgreich aktualisiert.', 'success')
        return redirect(url_for('events_liste'))
    return render_template('event_edit.html', form=form, titel="Event bearbeiten")



@app.route('/event/<int:event_id>/delete', methods=['POST'])
@login_required
def event_delete(event_id):
    event = Event.query.get_or_404(event_id)
    db.session.delete(event)
    db.session.commit()
    return redirect(url_for('events_liste'))


# ----------------------------------
# Finanzen
# ----------------------------------
@app.route('/finanzen')
@login_required
def finanzen_liste():
    buchungen = Finanzbuchung.query.all()
    sum_einnahmen = db.session.query(db.func.sum(Finanzbuchung.betrag))\
        .filter(Finanzbuchung.typ == 'Einnahme').scalar() or 0
    sum_ausgaben = db.session.query(db.func.sum(Finanzbuchung.betrag))\
        .filter(Finanzbuchung.typ == 'Ausgabe').scalar() or 0
    saldo = sum_einnahmen - sum_ausgaben

    current_year = datetime.now().year  # Aktuelles Jahr

    return render_template('finanzen.html',
                           buchungen=buchungen,
                           saldo=saldo,
                           current_year=current_year)

@app.route('/finanzen/export')
@login_required
def finanzen_export():
    buchungen = Finanzbuchung.query.all()
    output = []
    output.append(['ID', 'Typ', 'Kategorie', 'Betrag', 'Datum', 'Beschreibung'])
    for b in buchungen:
        output.append([b.id, b.typ, b.kategorie, b.betrag, b.datum, b.beschreibung])

    si = io.StringIO()
    writer = csv.writer(si)
    writer.writerows(output)

    response = make_response(si.getvalue())
    response.headers['Content-Disposition'] = 'attachment; filename=finanzen.csv'
    response.headers['Content-type'] = 'text/csv'
    return response


@app.route('/finanzen/jahresabschluss/<int:jahr>/download', methods=['GET'])
@login_required
def jahresabschluss_pdf(jahr):
    # Buchungen des Jahres filtern
    buchungen = Finanzbuchung.query.filter(db.extract('year', Finanzbuchung.datum) == jahr).all()

    # Summen berechnen
    einnahmen = sum(b.betrag for b in buchungen if b.typ == 'Einnahme')
    ausgaben = sum(b.betrag for b in buchungen if b.typ == 'Ausgabe')
    saldo = einnahmen - ausgaben

    # PDF erstellen
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Titel
    pdf.cell(200, 10, f"Jahresabschluss {jahr}", ln=True, align="C")

    # Summen
    pdf.cell(200, 10, f"Einnahmen: {einnahmen:.2f} EUR", ln=True)
    pdf.cell(200, 10, f"Ausgaben: {ausgaben:.2f} EUR", ln=True)
    pdf.cell(200, 10, f"Saldo: {saldo:.2f} EUR", ln=True)

    # Tabellenüberschrift
    pdf.ln(10)
    pdf.cell(30, 10, "ID", border=1)
    pdf.cell(30, 10, "Typ", border=1)
    pdf.cell(50, 10, "Kategorie", border=1)
    pdf.cell(40, 10, "Betrag", border=1)
    pdf.cell(40, 10, "Datum", border=1)
    pdf.ln(10)

    # Tabelleninhalt
    for b in buchungen:
        pdf.cell(30, 10, str(b.id), border=1)
        pdf.cell(30, 10, b.typ, border=1)
        pdf.cell(50, 10, b.kategorie, border=1)
        pdf.cell(40, 10, f"{b.betrag:.2f}", border=1)
        pdf.cell(40, 10, b.datum.strftime('%d.%m.%Y'), border=1)
        pdf.ln(10)

    # PDF als Antwort zurückgeben
    response = make_response(pdf.output(dest='S').encode('latin1'))
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = f'attachment; filename=jahresabschluss_{jahr}.pdf'
    return response


@app.route('/finanzen/new', methods=['GET', 'POST'])
@login_required
def finanzen_new():
    form = FinanzForm()
    if form.validate_on_submit():
        buchung = Finanzbuchung(
            typ=form.typ.data,
            kategorie=form.kategorie.data,
            betrag=form.betrag.data,
            datum=form.datum.data or date.today(),
            beschreibung=form.beschreibung.data
        )
        db.session.add(buchung)
        db.session.commit()
        flash('Neue Buchung erfolgreich hinzugefügt.')
        return redirect(url_for('finanzen_liste'))
    return render_template('finanzen_edit.html', form=form, titel="Neue Buchung")

@app.route('/finanzen/<int:buchung_id>/edit', methods=['GET', 'POST'])
@login_required
def finanzen_edit(buchung_id):
    buchung = Finanzbuchung.query.get_or_404(buchung_id)
    form = FinanzForm(obj=buchung)
    if form.validate_on_submit():
        buchung.typ = form.typ.data
        buchung.kategorie = form.kategorie.data
        buchung.betrag = form.betrag.data
        buchung.datum = form.datum.data
        buchung.beschreibung = form.beschreibung.data
        db.session.commit()
        flash('Buchung erfolgreich aktualisiert.', 'success')
        return redirect(url_for('finanzen_liste'))
    return render_template('finanzen_edit.html', form=form, titel="Buchung bearbeiten")

@app.route('/finanzen/<int:buchung_id>/delete', methods=['POST'])
@login_required
def finanzen_delete(buchung_id):
    # Abrufen der Buchung aus der Datenbank
    buchung = Finanzbuchung.query.get_or_404(buchung_id)

    # Die Buchung aus der Datenbank entfernen
    db.session.delete(buchung)
    db.session.commit()

    # Erfolgsnachricht und Weiterleitung zur Finanzübersicht
    flash('Buchung erfolgreich gelöscht.', 'success')
    return redirect(url_for('finanzen_liste'))


# ----------------------------------
# Notizen
# ----------------------------------
@app.route('/notizen')
@login_required
def notizen_liste():
    notizen = Notiz.query.all()
    return render_template('notizen.html', notizen=notizen)

@app.route('/notiz/new', methods=['GET', 'POST'])
@login_required
def notiz_new():
    form = NotizForm()
    if form.validate_on_submit():
        notiz = Notiz(
            titel=form.titel.data,
            inhalt=form.inhalt.data
        )
        db.session.add(notiz)
        db.session.commit()
        return redirect(url_for('notizen_liste'))
    return render_template('notiz_edit.html', form=form, titel="Neue Notiz")

@app.route('/notiz/<int:notiz_id>/edit', methods=['GET', 'POST'])
@login_required
def notiz_edit(notiz_id):
    notiz = Notiz.query.get_or_404(notiz_id)
    form = NotizForm(obj=notiz)
    if form.validate_on_submit():
        notiz.titel = form.titel.data
        notiz.inhalt = form.inhalt.data
        db.session.commit()
        return redirect(url_for('notizen_liste'))
    return render_template('notiz_edit.html', form=form, titel="Notiz bearbeiten")

@app.route('/notiz/<int:notiz_id>/delete', methods=['POST'])
@login_required
def notiz_delete(notiz_id):
    notiz = Notiz.query.get_or_404(notiz_id)
    db.session.delete(notiz)
    db.session.commit()
    return redirect(url_for('notizen_liste'))


# ----------------------------------
# Jahresabschluss (Beispiel)
# ----------------------------------
@app.route('/jahresabschluss/<int:jahr>')
@login_required
def jahresabschluss(jahr):
    # Filtere Finanzbuchungen nach Jahr
    buchungen_jahr = Finanzbuchung.query.filter(
        db.extract('year', Finanzbuchung.datum) == jahr
    ).all()

    sum_einnahmen = 0
    sum_ausgaben = 0
    for b in buchungen_jahr:
        if b.typ == 'Einnahme':
            sum_einnahmen += b.betrag
        else:
            sum_ausgaben += b.betrag

    saldo = sum_einnahmen - sum_ausgaben

    return render_template('jahresabschluss.html',
                           jahr=jahr,
                           buchungen=buchungen_jahr,
                           einnahmen=sum_einnahmen,
                           ausgaben=sum_ausgaben,
                           saldo=saldo)

# ----------------------------------
# Dokumente auflisten
# ----------------------------------
@app.route('/documents')
@login_required
def documents_list():
    documents = Document.query.order_by(Document.uploaded_at.desc()).all()
    return render_template('documents.html', documents=documents)

# ----------------------------------
# Hochladen
# ----------------------------------
@app.route('/documents/new', methods=['GET', 'POST'])
@login_required
def documents_new():
    # Initialisierung des Formulars
    form = DocumentForm()

    # Validierung des Formulars bei POST-Request
    if form.validate_on_submit():
        # Datei aus dem Formular holen
        file = form.file.data
        if not file:
            flash('Fehler: Keine Datei ausgewählt.', 'danger')
            return render_template('documents_new.html', form=form)

        try:
            # Original- und einzigartigen Dateinamen erstellen
            original_filename = secure_filename(file.filename)
            ext = os.path.splitext(original_filename)[1]  # Dateierweiterung
            unique_name = str(uuid.uuid4()) + ext

            # Datei speichern
            save_path = os.path.join(app.config['UPLOAD_FOLDER'], unique_name)
            file.save(save_path)

            # Dokument in der Datenbank speichern
            document = Document(
                filename=unique_name,
                original_filename=original_filename,
                description=form.description.data,
                user_id=current_user.id
            )
            db.session.add(document)
            db.session.commit()

            # Erfolgsnachricht und Weiterleitung
            flash('Dokument erfolgreich hochgeladen.', 'success')
            return redirect(url_for('documents_list'))

        except Exception as e:
            flash(f'Fehler beim Hochladen: {str(e)}', 'danger')

    # Bei GET-Request oder ungültigem Formular
    return render_template('documents_new.html', form=form)
# ----------------------------------
# Download
# ----------------------------------
@app.route('/documents/<int:doc_id>/download')
@login_required
def documents_download(doc_id):
    # Dokument aus der Datenbank abrufen
    document = Document.query.get_or_404(doc_id)
    
    # Absoluter Pfad zur Datei
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], document.filename)
    
    # Überprüfen, ob die Datei existiert
    if not os.path.isfile(file_path):
        flash('Die Datei wurde nicht gefunden.', 'danger')
        return redirect(url_for('documents_list'))
    
    try:
        # Datei als Download bereitstellen
        return send_file(
            file_path,
            as_attachment=True,
            download_name=document.original_filename  # Originaldateiname im Download-Dialog anzeigen
        )
    except Exception as e:
        # Fehler behandeln
        flash(f'Fehler beim Herunterladen: {str(e)}', 'danger')
        return redirect(url_for('documents_list'))

# ----------------------------------
# Löschen
# ----------------------------------
@app.route('/documents/<int:doc_id>/delete', methods=['POST'])
@login_required
def documents_delete(doc_id):
    document = Document.query.get_or_404(doc_id)

    # Optional: Falls nur Admin oder Uploader löschen darf, checken:
    # if not current_user.is_admin and document.user_id != current_user.id:
    #     abort(403)

    # Datei vom Server löschen
    file_path = os.path.join(app.config['UPLOAD_FOLDER'], document.filename)
    if os.path.exists(file_path):
        os.remove(file_path)

    # DB-Eintrag entfernen
    db.session.delete(document)
    db.session.commit()

    flash('Dokument gelöscht.')
    return redirect(url_for('documents_list'))

# ----------------------------------
# Einstellungen-Seite
# ----------------------------------
@app.route('/einstellungen', methods=['GET', 'POST'])
@login_required
def einstellungen():
    if request.method == 'POST':
        # Verarbeitung von Theme- und Benachrichtigungseinstellungen
        email_notifikationen = request.form.get('email_notifikationen', 'aus')
        theme = request.form.get('theme', 'light')

        # Benutzerdaten aktualisieren (Annahmen: entsprechende Felder im User-Modell vorhanden)
        current_user.email_notifikationen = (email_notifikationen == 'an')
        current_user.theme = theme

        # Verarbeitung der Kalendereinstellungen
        calendar_integration = request.form.get('calendar_integration', 'disabled')
        calendar_api_key = request.form.get('calendar_api_key', '').strip()

        current_user.calendar_integration = calendar_integration
        current_user.calendar_api_key = calendar_api_key

        # Änderungen in der Datenbank speichern
        db.session.commit()

        flash("Einstellungen wurden gespeichert.", "success")
        return redirect(url_for('einstellungen'))

    # Bestehende Einstellungen abrufen und an das Template übergeben
    return render_template(
        'einstellungen.html',
        titel="Einstellungen",
        theme=current_user.theme or 'light',
        calendar_enabled=current_user.calendar_integration or 'disabled',
        calendar_api_key=current_user.calendar_api_key or ''
    )


@app.route('/einstellungen/logo', methods=['POST'])
@login_required
def logo_upload():
    if 'logo' not in request.files:
        flash('Keine Datei hochgeladen.', 'danger')
        return redirect(url_for('einstellungen'))

    file = request.files['logo']
    if file.filename == '':
        flash('Keine Datei ausgewählt.', 'danger')
        return redirect(url_for('einstellungen'))

    # Sicherstellen, dass nur Bilddateien hochgeladen werden
    if not file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
        flash('Ungültiges Dateiformat. Bitte nur PNG- oder JPG-Dateien hochladen.', 'danger')
        return redirect(url_for('einstellungen'))

    try:
        # Speichern der Datei im static-Ordner als "logo.png"
        save_path = os.path.join(app.static_folder, 'logo.png')
        file.save(save_path)
        flash('Vereinslogo erfolgreich aktualisiert.', 'success')
    except Exception as e:
        flash(f'Fehler beim Hochladen des Logos: {e}', 'danger')

    return redirect(url_for('einstellungen'))

@app.route('/update_calendar_settings', methods=['POST'])
@login_required
def update_calendar_settings():
    # Kalenderintegration speichern
    calendar_integration = request.form.get('calendar_integration', 'disabled')
    calendar_api_key = request.form.get('calendar_api_key', '').strip()

    # Speichern der Einstellungen in der Datenbank (oder einer Konfigurationsdatei)
    current_user.calendar_integration = calendar_integration
    current_user.calendar_api_key = calendar_api_key
    db.session.commit()

    flash('Kalendereinstellungen wurden aktualisiert.', 'success')
    return redirect(url_for('einstellungen'))

def add_event_to_google_calendar(event, user):
    if user.calendar_integration != 'google' or not user.calendar_api_key:
        return

    # API-Zugriff konfigurieren
    credentials = Credentials(token=user.calendar_api_key)
    service = build('calendar', 'v3', credentials=credentials)

    # Event-Daten vorbereiten
    event_body = {
        'summary': event.titel,
        'location': event.ort,
        'description': event.beschreibung,
        'start': {
            'dateTime': event.datum.isoformat(),
            'timeZone': 'Europe/Vienna',
        },
        'end': {
            'dateTime': (event.datum + timedelta(hours=1)).isoformat(),
            'timeZone': 'Europe/Vienna',
        },
    }

    try:
        service.events().insert(calendarId='primary', body=event_body).execute()
    except Exception as e:
        print(f"Fehler bei der Kalenderintegration: {e}")


# ----------------------------------
# App starten
# ----------------------------------
if __name__ == '__main__':
    import webbrowser
    from models import db

    with app.app_context():
        db.create_all()  # Tabellen erstellen

    webbrowser.open('http://127.0.0.1:5000')
    app.run(host='127.0.0.1', port=5000, debug=True)


