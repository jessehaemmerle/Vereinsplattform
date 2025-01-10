import os
from datetime import date
from flask import Flask, render_template, request, redirect, url_for, flash, send_file, abort, make_response, g
from models import db, Mitglied, Event, Finanzbuchung, Notiz, User, Document, Nachrichtenvorlage, Verein, VereinFeature
from forms import MitgliedForm, EventForm, FinanzForm, NotizForm, RegisterForm, LoginForm, DocumentForm, FeedbackForm, ValidateMemberForm, ToggleBeitragForm,DeleteMitgliedForm
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user
from flask_mail import Mail, Message
from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField, EmailField, SubmitField
from wtforms.validators import DataRequired, Email
from werkzeug.utils import secure_filename
from datetime import datetime, timedelta
import uuid # Für Eindeutige Dateinamen in der Struktur.
import csv
import json
import io
from fpdf import FPDF
from googleapiclient.discovery import build
from google.oauth2.credentials import Credentials
from services import zahlung_erstellen
import webbrowser
from models import db
import requests
from dotenv import load_dotenv
from sqlalchemy import create_engine
from flask_wtf.csrf import CSRFProtect
# Erweiterung des Mitglieder-Portals
from flask import Flask, render_template, request, redirect, url_for, flash
from werkzeug.security import generate_password_hash
from models import db, Mitglied, User
from flask_login import login_user


if not os.path.exists('uploads'):
    os.makedirs('uploads')

# Ordner für die Datenbank sicherstellen
DATABASE_FOLDER = os.path.join(os.getcwd(), 'databases')
if not os.path.exists(DATABASE_FOLDER):
    os.makedirs(DATABASE_FOLDER)


# Umgebungsdatei laden
load_dotenv()

# Flask-Login konfigurieren
login_manager = LoginManager()
login_manager.login_view = 'login'  # Ziel-View, falls der User nicht eingeloggt ist
login_manager.login_message = "Bitte logge dich ein, um fortzufahren."

app = Flask(__name__)
app.config['SECRET_KEY'] = 'SUPER_GEHEIM'  # In Produktion in Umgebungsvariablen auslagern
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///verein.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['UPLOAD_FOLDER'] = os.path.join(os.getcwd(), 'uploads')
csrf = CSRFProtect(app)


db.init_app(app)
login_manager.init_app(app)

# Auswahl der Datenbank
@app.before_request
def set_db_connection():
    if current_user.is_authenticated:
        if not current_user.verein_id:
            # Kein Verein verknüpft, leite zur Registrierung weiter
            flash("Bitte registriere dich, um einen Verein zu erstellen.", "warning")
            return redirect(url_for('register_user'))

        verein = Verein.query.get(current_user.verein_id)
        if verein:
            db.session.bind = create_engine(f'sqlite:///{verein.db_path}')
        else:
            abort(403, description="Ungültiger Zugriff. Kein Verein verknüpft.")


def init_verein_db(db_path):
    """
    Initialisiert die SQLite-Datenbank für einen neuen Verein.
    """
    full_db_path = os.path.join(DATABASE_FOLDER, db_path)
    engine = create_engine(f'sqlite:///{full_db_path}')
    db.metadata.create_all(engine)  # Nutzt db.metadata für Tabellen

# ----------------------------------
# Setup für Mitglieder-Selfservice
# ----------------------------------

# Neue Route: E-Mail-Validierung und Vereinssuche
@app.route('/validate_member', methods=['GET', 'POST'])
def validate_member():
    form = ValidateMemberForm()  # Instanziere das Formular
    if form.validate_on_submit():
        email = form.email.data
        verein = form.verein.data

        # Prüfen, ob E-Mail existiert
        mitglied = Mitglied.query.filter_by(email=email).first()
        if not mitglied:
            flash('Mitglied nicht gefunden.', 'danger')
            return render_template('validate_member.html', form=form)

        # Prüfen, ob der Verein mit dem Mitglied übereinstimmt
        # Annahme: Die Zuordnung erfolgt über ein Feld wie `mitglied.verein_id`
        zugeordnet_verein = Verein.query.filter_by(id=mitglied.verein_id, name=verein).first()
        if not zugeordnet_verein:
            flash('E-Mail oder Verein stimmt nicht überein.', 'danger')
            return render_template('validate_member.html', form=form)

        # Mitglied ist validiert
        flash('Mitglied gefunden! Bitte ein Passwort setzen.', 'success')
        return redirect(url_for('set_password', email=email))

    return render_template('validate_member.html', form=form)



# Neue Route: Passwort setzen
@app.route('/set_password/<email>', methods=['GET', 'POST'])
def set_password(email):
    mitglied = Mitglied.query.filter_by(email=email).first()
    if not mitglied:
        flash('Ungültiger Zugriff.', 'danger')
        return redirect(url_for('validate_member'))

    if request.method == 'POST':
        password = request.form.get('password')

        # Benutzer in der User-Tabelle erstellen
        new_user = User(
            email=mitglied.email,
            role='mitglied'  # Standardrolle
        )
        new_user.password = generate_password_hash(password)
        db.session.add(new_user)
        db.session.commit()

        flash('Passwort erfolgreich gesetzt! Bitte einloggen.', 'success')
        return redirect(url_for('login'))

    return render_template('set_password.html', email=email)

# Erweiterung des Dashboards
@app.route('/dashboard')
def dashboard():
    user = User.query.filter_by(id=current_user.id).first()
    mitglied = Mitglied.query.filter_by(email=user.email).first()
    if not mitglied:
        flash('Keine Mitgliedsdaten gefunden.', 'danger')
        return redirect(url_for('login'))

    return render_template('dashboard.html', mitglied=mitglied)

# ----------------------------------
# Nutzersetup für Web-App
# ----------------------------------
# Setup-Route erweitern
@app.route('/setup', methods=['GET', 'POST'])
@login_required
def setup():
    if not current_user.verein_id:
        flash("Kein Verein verknüpft! Bitte registriere dich erneut.", "danger")
        return redirect(url_for('register_user'))

    verein = Verein.query.get(current_user.verein_id)
    if not verein:
        flash("Kein gültiger Verein gefunden.", "danger")
        return redirect(url_for('register_user'))

    if request.method == 'POST':
        verein.name = request.form.get('verein_name', verein.name)
        logo_file = request.files.get('logo')

        # Logo speichern
        if logo_file and logo_file.filename != '':
            if logo_file.filename.lower().endswith(('.png', '.jpg', '.jpeg')):
                logo_filename = f"logo_{verein.id}.png"
                logo_path = os.path.join('uploads', logo_filename)
                logo_file.save(logo_path)
                verein.logo_path = f'uploads/{logo_filename}'
            else:
                flash("Nur PNG- oder JPG-Dateien sind erlaubt.", "danger")

        # Features speichern
        selected_features = request.form.getlist('features')
        VereinFeature.query.filter_by(verein_id=verein.id).delete()
        for feature in selected_features:
            db.session.add(VereinFeature(verein_id=verein.id, feature=feature))
        db.session.commit()

        flash("Setup abgeschlossen!", "success")
        return redirect(url_for('index'))

    # Standardfeatures
    features = [
        {'name': 'Mitgliederverwaltung', 'checked': 'checked'},
        {'name': 'Finanzen', 'checked': 'checked'},
        {'name': 'Events', 'checked': ''},
        {'name': 'Notizen', 'checked': ''}
    ]

    return render_template('setup.html', verein=verein, features=features)


@app.before_request
def load_active_features():
    if current_user.is_authenticated and current_user.verein_id:
        g.active_features = [
            feature.feature for feature in VereinFeature.query.filter_by(verein_id=current_user.verein_id).all()
        ]
    else:
        g.active_features = []



@app.route('/register', methods=['GET', 'POST'])
def register_user():
    form = RegisterForm()
    if form.validate_on_submit():
        # Verein erstellen
        new_verein = Verein(name=f"Verein von {form.username.data}", db_path=f"{form.username.data.lower()}_db.sqlite")
        db.session.add(new_verein)
        db.session.commit()

        # Benutzer erstellen und mit Verein verknüpfen
        new_user = User(
            username=form.username.data,
            email=form.email.data,
            role='admin',
            verein_id=new_verein.id
        )
        new_user.set_password(form.password.data)
        try:
            db.session.add(new_user)
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            flash(f"Fehler bei der Registrierung: {str(e)}", "danger")
            return redirect(url_for('register_user'))

        # Datenbank für den Verein initialisieren
        init_verein_db(new_verein.db_path)

        # Automatisch einloggen und zum Setup weiterleiten
        login_user(new_user)
        flash("Registrierung erfolgreich! Richte deinen Verein ein.", "success")
        return redirect(url_for('setup'))

    return render_template('register.html', form=form)



@app.route('/register_verein', methods=['GET', 'POST'])
def register_verein():  # Neue Route für Vereinsregistrierung
    form = RegisterForm()
    if form.validate_on_submit():
        new_verein = Verein(name=form.verein_name.data, db_path=f"{form.verein_name.data}.db")
        db.session.add(new_verein)
        db.session.commit()

        new_user = User(
            username=form.username.data,
            email=form.email.data,
            verein_id=new_verein.id
        )
        new_user.set_password(form.password.data)
        db.session.add(new_user)
        db.session.commit()

        init_verein_db(new_verein.db_path)

        flash("Verein erfolgreich registriert!")
        return redirect(url_for('setup'))

    return render_template('register.html', form=form)

# ----------------------------------
# User Loader für Flask-Login
# ----------------------------------
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


# ----------------------------------
# Login
# ----------------------------------
@app.route('/login', methods=['GET', 'POST'])
def login():
    if current_user.is_authenticated:
        # Überprüfen, ob der Nutzer ein Admin ist
        if current_user.role == 'admin':
            return redirect(url_for('index'))
        else:
            return redirect(url_for('dashboard'))  # Nutzer-Dashboard

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            flash("Erfolgreich eingeloggt.")
            # Weiterleitung basierend auf der Rolle
            if user.role == 'admin':
                return redirect(url_for('index'))  # Admin-Dashboard
            else:
                return redirect(url_for('dashboard'))  # Nutzer-Dashboard
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
    flash("Erfolgreich ausgeloggt.", "success")
    return redirect(url_for('login'))

# ----------------------------------
# Startseite / Dashboard
# ----------------------------------
@app.route('/')
@login_required
def index():
    if not current_user.verein_id:
        flash("Bitte richte deinen Verein ein.", "info")
        return redirect(url_for('setup'))

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

    # Unser neues Formular instanzieren
    form = ToggleBeitragForm()

    search_query = request.args.get('search', '').strip()
    if search_query:
        mitglieder = Mitglied.query.filter(
            db.or_(
                Mitglied.vorname.ilike(f"%{search_query}%"),
                Mitglied.nachname.ilike(f"%{search_query}%"),
                Mitglied.email.ilike(f"%{search_query}%"),
                Mitglied.plz.ilike(f"%{search_query}%"),
                Mitglied.ort.ilike(f"%{search_query}%")
            )
        ).all()
    else:
        mitglieder = Mitglied.query.all()

    return render_template('mitglieder.html', mitglieder=mitglieder, form=form)


@app.route('/mitglied/new', methods=['GET', 'POST'])
@login_required
def mitglied_new():
    form = MitgliedForm()
    if form.validate_on_submit():
        try:
            # Use the verein_id from the currently logged-in user
            if not current_user.verein_id:
                flash("Es ist kein Verein mit Ihrem Benutzerkonto verknüpft.", "danger")
                return render_template('mitglied_edit.html', form=form, titel="Neues Mitglied")

            neues_mitglied = Mitglied(
                vorname=form.vorname.data,
                nachname=form.nachname.data,
                email=form.email.data,
                eintrittsdatum=form.eintrittsdatum.data or date.today(),
                status=form.status.data,
                funktion=form.funktion.data,
                telefonnummer=form.telefonnummer.data,
                geburtstag=form.geburtstag.data,
                adresse=form.adresse.data,
                plz=form.plz.data,
                ort=form.ort.data,
                mitgliedsbeitrag=form.mitgliedsbeitrag.data or 0.0,
                beitrag_bezahlt=form.beitrag_bezahlt.data == 'true',
                austritt_datum=form.austritt_datum.data if form.status.data == 'inaktiv' else None,
                verein_id=current_user.verein_id  # Associate with the user's Verein
            )
            db.session.add(neues_mitglied)
            db.session.flush()  # damit neues_mitglied.id schon bekannt ist
        
            # Falls bereits bezahlt, Finanzbuchung anlegen
            if neues_mitglied.beitrag_bezahlt and neues_mitglied.mitgliedsbeitrag > 0:
                finanzbuchung = Finanzbuchung(
                    typ='Einnahme',
                    kategorie='Mitgliedsbeitrag',
                    betrag=neues_mitglied.mitgliedsbeitrag,
                    datum=date.today(),
                    beschreibung=f"Mitgliedsbeitrag von {neues_mitglied.vorname} {neues_mitglied.nachname}",
                    mitglied_id=neues_mitglied.id  # jetzt verfügbar nach flush
                )
                db.session.add(finanzbuchung)
            db.session.commit()
            flash("Neues Mitglied erfolgreich erstellt.", "success")
            return redirect(url_for('mitglieder_liste'))
        except Exception as e:
            db.session.rollback()
            print(f"Fehler: {e}")
            flash("Fehler beim Erstellen des Mitglieds.", "danger")
    else:
        print(form.errors)  # Debugging for form validation issues

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
        mitglied.telefonnummer = form.telefonnummer.data
        mitglied.geburtstag = form.geburtstag.data
        mitglied.adresse = form.adresse.data
        mitglied.plz = form.plz.data
        mitglied.ort = form.ort.data
        mitglied.austritt_datum = form.austritt_datum.data if form.status.data == 'inaktiv' else None
        # Wichtig: mitgliedsbeitrag und ggf. beitrag_bezahlt ergänzen
        mitglied.mitgliedsbeitrag = form.mitgliedsbeitrag.data or 0.0
        mitglied.beitrag_bezahlt  = (form.beitrag_bezahlt.data == 'true')
        db.session.commit()
        flash("Mitglied erfolgreich bearbeitet.")
        return redirect(url_for('mitglieder_liste'))
    return render_template('mitglied_edit.html', form=form, titel="Mitglied bearbeiten")


@app.route('/mitglied/<int:mitglied_id>/delete', methods=['POST'])
@login_required
def mitglied_delete(mitglied_id):
    form = DeleteMitgliedForm()
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

        if not file.filename.endswith('.csv'):
            flash('Bitte laden Sie eine gültige CSV-Datei hoch.', 'danger')
            return redirect(url_for('mitglieder_liste'))

        try:
            stream = io.StringIO(file.stream.read().decode("UTF8"), newline=None)
            csv_reader = csv.DictReader(stream)

            required_fields = {'Vorname', 'Nachname', 'Email', 'Mitgliedsbeitrag', 'Beitrag_Bezahlt'}
            if not required_fields.issubset(csv_reader.fieldnames):
                flash(f'Die CSV-Datei muss folgende Spalten enthalten: {", ".join(required_fields)}', 'danger')
                return redirect(url_for('mitglieder_liste'))

            for row in csv_reader:
                # Konvertiere Datumfelder in datetime.date-Objekte
                eintrittsdatum = None
                geburtstag = None
                try:
                    if row.get('Eintrittsdatum'):
                        eintrittsdatum = datetime.strptime(row['Eintrittsdatum'], '%Y-%m-%d').date()
                except ValueError:
                    flash(f"Ungültiges Eintrittsdatum für {row['Vorname']} {row['Nachname']}.", 'warning')

                try:
                    if row.get('Geburtstag'):
                        geburtstag = datetime.strptime(row['Geburtstag'], '%Y-%m-%d').date()
                except ValueError:
                    flash(f"Ungültiges Geburtsdatum für {row['Vorname']} {row['Nachname']}.", 'warning')

                # Konvertiere Beitrag_Bezahlt in ein Boolean
                beitrag_bezahlt = row.get('Beitrag_Bezahlt', '').strip().lower() in ['true', 'ja', '1']

                # Mitgliedsbeitrag als Float verarbeiten
                mitgliedsbeitrag = float(row.get('Mitgliedsbeitrag', 0.0))

                # Neues Mitglied erstellen
                neues_mitglied = Mitglied(
                    vorname=row['Vorname'].strip(),
                    nachname=row['Nachname'].strip(),
                    email=row['Email'].strip(),
                    eintrittsdatum=eintrittsdatum or date.today(),
                    status=row.get('Status', 'aktiv').strip(),
                    funktion=row.get('Funktion', 'Mitglied').strip(),
                    telefonnummer=row.get('Telefonnummer', '').strip(),
                    geburtstag=geburtstag,
                    adresse=row.get('Adresse', '').strip(),
                    plz=row.get('PLZ', '').strip(),
                    ort=row.get('Ort', '').strip(),
                    mitgliedsbeitrag=mitgliedsbeitrag,
                    beitrag_bezahlt=beitrag_bezahlt
                )
                db.session.add(neues_mitglied)
                db.session.flush()  # Mitglied-ID direkt verfügbar machen

                # Finanzbuchung erstellen, falls Beitrag bereits bezahlt ist
                if beitrag_bezahlt and mitgliedsbeitrag > 0:
                    finanzbuchung = Finanzbuchung(
                        typ='Einnahme',
                        kategorie='Mitgliedsbeitrag',
                        betrag=mitgliedsbeitrag,
                        datum=date.today(),
                        beschreibung=f"Mitgliedsbeitrag von {neues_mitglied.vorname} {neues_mitglied.nachname}",
                        mitglied_id=neues_mitglied.id
                    )
                    db.session.add(finanzbuchung)

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
            beschreibung=f"Mitgliedsbeitrag von {mitglied.vorname} {mitglied.nachname}",
            mitglied_id=mitglied.id
        ))
    db.session.commit()
    flash(f"Der Status des Mitgliedsbeitrags für {mitglied.vorname} {mitglied.nachname} wurde aktualisiert.", "success")
    return redirect(url_for('mitglieder_liste'))

@app.route('/mitglied/<int:mitglied_id>')
@login_required
def mitglied_detail(mitglied_id):
    mitglied = Mitglied.query.get_or_404(mitglied_id)
    alter = None
    if mitglied.geburtstag:
        heute = date.today()
        alter = (
            heute.year - mitglied.geburtstag.year -
            ((heute.month, heute.day) < (mitglied.geburtstag.month, mitglied.geburtstag.day))
        )
    
    # Zahlungen über die Beziehung abrufen
    zahlungen = mitglied.finanzbuchungen
    return render_template('mitglied_detail.html', mitglied=mitglied, alter=alter, zahlungen=zahlungen)


@app.route('/mitglied/<int:mitglied_id>/zahlung_hinzufuegen', methods=['POST'])
@login_required
def zahlung_hinzufuegen(mitglied_id):
    try:
        zahlung_erstellen(
            mitglied_id=mitglied_id,
            typ='Einnahme',
            kategorie='Mitgliedsbeitrag',
            betrag=50.00,
            beschreibung=f'Mitgliedsbeitrag von Mitglied {mitglied_id}'
        )
        flash('Zahlung erfolgreich hinzugefügt.', 'success')
    except ValueError as e:
        flash(str(e), 'danger')
    return redirect(url_for('mitglied_detail', mitglied_id=mitglied_id))

@app.route('/mitglied/<int:mitglied_id>/send_message', methods=['GET', 'POST'])
@login_required
def send_message_member(mitglied_id):
    mitglied = Mitglied.query.get_or_404(mitglied_id)
    vorlagen = Nachrichtenvorlage.query.all()
    vorlagen_json = json.dumps([{'id': v.id, 'betreff': v.betreff, 'inhalt': v.inhalt} for v in vorlagen])

    BREVO_API_KEY = os.getenv('BREVO_API_KEY')
    if not BREVO_API_KEY:
        flash("Fehler: Kein Brevo API-Schlüssel gefunden.", "danger")
        return redirect(url_for('mitglied_detail', mitglied_id=mitglied_id))

    if request.method == 'POST':
        subject = request.form['subject']
        body = request.form['body']

        headers = {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
        }
        data = {
            "sender": {"name": "Vereinsverwaltung", "email": "info@memberworks.at"},
            "to": [{"email": mitglied.email}],
            "subject": subject,
            "htmlContent": body
        }

        try:
            response = requests.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=data)
            if response.status_code == 201:
                flash("Nachricht erfolgreich gesendet.", "success")
            else:
                flash(f"Fehler beim Senden der Nachricht: {response.status_code} - {response.text}", "danger")
        except Exception as e:
            flash(f"Fehler beim Senden der Nachricht: {e}", "danger")

        return redirect(url_for('mitglied_detail', mitglied_id=mitglied_id))

    return render_template('send_email_member.html', mitglied=mitglied, vorlagen=vorlagen, vorlagen_json=vorlagen_json)



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

@app.route('/event/<int:event_id>/send_email', methods=['GET', 'POST'])
@login_required
def send_email_event(event_id):
    event = Event.query.get_or_404(event_id)  # Hole das Event aus der Datenbank
    mitglieder = Mitglied.query.filter_by(status='aktiv').all()  # Nur aktive Mitglieder

    if request.method == 'POST':
        subject = request.form['subject']
        body = request.form['body']
        selected_ids = request.form.getlist('member_ids')

        BREVO_API_KEY = os.getenv('BREVO_API_KEY')
        if not BREVO_API_KEY:
            flash("Fehler: Kein Brevo API-Schlüssel gefunden.", "danger")
            return redirect(url_for('events_liste'))

        # Bestimme die Empfänger
        if "all" in selected_ids:
            recipient_emails = [mitglied.email for mitglied in mitglieder]
        else:
            recipient_emails = [mitglied.email for mitglied in mitglieder if str(mitglied.id) in selected_ids]

        if not recipient_emails:
            flash('Keine Mitglieder ausgewählt.', 'danger')
            return redirect(url_for('send_email_event', event_id=event_id))

        # Sende E-Mails über die Brevo API
        headers = {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
        }
        data = {
            "sender": {"name": "Vereinsverwaltung", "email": "info@memberworks.at"},
            "to": [{"email": email} for email in recipient_emails],
            "subject": subject,
            "htmlContent": body
        }

        try:
            response = requests.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=data)
            if response.status_code == 201:
                flash("E-Mails erfolgreich gesendet.", "success")
            else:
                flash(f"Fehler beim Senden der E-Mails: {response.status_code} - {response.text}", "danger")
        except Exception as e:
            flash(f"Fehler beim Senden der E-Mails: {e}", "danger")

        return redirect(url_for('events_liste'))

    return render_template('send_email_event.html', event=event, mitglieder=mitglieder)



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
    saldo = current_user.anfangsbestand + sum_einnahmen - sum_ausgaben

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
    anfangsbestand = current_user.anfangsbestand
    saldo = anfangsbestand + einnahmen - ausgaben

    # PDF erstellen
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Titel
    pdf.cell(200, 10, f"Jahresabschluss {jahr}", ln=True, align="C")
    pdf.ln(10)

    # Kontonummer
    pdf.set_font("Arial", size=10)
    if current_user.konto_nummer:
        pdf.cell(200, 10, f"Kontonummer: {current_user.konto_nummer}", ln=True)
    pdf.ln(10)

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

@app.route('/finanzen/summenliste/pdf', methods=['GET'])
@login_required
def summenliste_pdf():
    # Finanzbuchungen nach Kategorien gruppieren und Summen berechnen
    kategorien = db.session.query(
        Finanzbuchung.kategorie,
        Finanzbuchung.typ,
        db.func.sum(Finanzbuchung.betrag).label('summe')
    ).group_by(Finanzbuchung.kategorie, Finanzbuchung.typ).all()

    # Gesamtsummen berechnen
    sum_einnahmen = sum(k.summe for k in kategorien if k.typ == 'Einnahme')
    sum_ausgaben = sum(k.summe for k in kategorien if k.typ == 'Ausgabe')

    # PDF-Erstellung
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Titel
    pdf.cell(200, 10, "Summenliste - Finanzen", ln=True, align="C")
    pdf.ln(10)

    # Kontonummer hinzufügen, falls vorhanden
    if current_user.konto_nummer:
        pdf.set_font("Arial", size=10)
        pdf.cell(200, 10, f"Kontonummer: {current_user.konto_nummer}", ln=True)
        pdf.ln(10)

    # Tabellenüberschrift
    pdf.set_font("Arial", size=10, style="B")
    pdf.cell(80, 10, "Kategorie", border=1)
    pdf.cell(40, 10, "Typ", border=1)
    pdf.cell(40, 10, "Summe (EUR)", border=1)
    pdf.ln(10)

    # Tabelleninhalt
    pdf.set_font("Arial", size=10)
    for kategorie, typ, summe in kategorien:
        if typ == 'Ausgabe':
            pdf.set_text_color(255, 0, 0)  # Rot für Ausgaben
        else:
            pdf.set_text_color(0, 0, 0)    # Schwarz für Einnahmen

        pdf.cell(80, 10, kategorie, border=1)
        pdf.cell(40, 10, typ, border=1)
        pdf.cell(40, 10, f"{summe:.2f}", border=1)
        pdf.ln(10)

    # Gesamtsummen hinzufügen
    pdf.set_text_color(0, 0, 0)  # Zurücksetzen auf Schwarz
    pdf.set_font("Arial", size=10, style="B")
    pdf.cell(80, 10, "Gesamtsumme", border=1)
    pdf.cell(40, 10, "Einnahmen", border=1)
    pdf.cell(40, 10, f"{sum_einnahmen:.2f}", border=1)
    pdf.ln(10)

    pdf.cell(80, 10, "", border=0)
    pdf.cell(40, 10, "Ausgaben", border=1)
    pdf.cell(40, 10, f"{sum_ausgaben:.2f}", border=1, ln=1)
    pdf.ln(10)

    # PDF als Antwort zurückgeben
    response = make_response(pdf.output(dest='S').encode('latin1'))
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename=summenliste.pdf'
    return response

@app.route('/finanzen/journal/pdf', methods=['GET'])
@login_required
def buchungsjournal_pdf():
    # Alle Finanzbuchungen sortiert nach Datum abrufen
    buchungen = Finanzbuchung.query.order_by(Finanzbuchung.datum.asc()).all()

    # PDF erstellen
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Titel
    pdf.cell(200, 10, "Buchungsjournal", ln=True, align="C")
    pdf.ln(10)

    # Kontonummer hinzufügen, falls vorhanden
    if current_user.konto_nummer:
        pdf.set_font("Arial", size=10)
        pdf.cell(200, 10, f"Kontonummer: {current_user.konto_nummer}", ln=True)
        pdf.ln(10)

    # Tabellenüberschrift
    pdf.set_font("Arial", size=10, style="B")
    col_widths = [10, 25, 20, 35, 20, 80]  # Spaltenbreiten
    headers = ["ID", "Datum", "Typ", "Kategorie", "Betrag", "Beschreibung"]

    # Überschriften ausgeben
    for header, width in zip(headers, col_widths):
        pdf.cell(width, 10, header, border=1, align="C")
    pdf.ln(10)

    # Tabelleninhalt mit angepasster Höhe
    pdf.set_font("Arial", size=10)
    for buchung in buchungen:
        # Für Ausgaben rot markieren
        if buchung.typ == 'Ausgabe':
            pdf.set_text_color(255, 0, 0)
        else:
            pdf.set_text_color(0, 0, 0)

        # Daten der Zeile vorbereiten
        row_data = [
            str(buchung.id),
            buchung.datum.strftime('%d.%m.%Y'),
            buchung.typ,
            buchung.kategorie,
            f"{buchung.betrag:.2f}",
            buchung.beschreibung
        ]

        # Ermitteln der maximalen Zeilenhöhe
        line_heights = []
        for data, width in zip(row_data, col_widths):
            # Höhe für die jeweilige Zelle berechnen
            line_height = pdf.get_string_width(data) // width + 1
            line_heights.append(line_height * 10)

        max_height = max(line_heights)

        # Daten in Zellen mit einheitlicher Höhe schreiben
        x_start = pdf.get_x()
        for i, (data, width) in enumerate(zip(row_data, col_widths)):
            y_start = pdf.get_y()
            pdf.multi_cell(width, 10, data, border=1, align="L" if i in [3, 5] else "C")
            pdf.set_xy(x_start + width, y_start)
            x_start += width

        pdf.ln(max_height)

    # PDF als Antwort zurückgeben
    response = make_response(pdf.output(dest='S').encode('latin1'))
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename=buchungsjournal.pdf'
    return response

@app.route('/finanzen/jahressaldo/pdf', methods=['GET'])
@login_required
def jahressaldo_pdf():
    # Gruppierung der Buchungen nach Jahr
    salden = db.session.query(
        db.extract('year', Finanzbuchung.datum).label('jahr'),
        db.func.sum(db.case(
            (Finanzbuchung.typ == 'Einnahme', Finanzbuchung.betrag),
            else_=0
        )).label('einnahmen'),
        db.func.sum(db.case(
            (Finanzbuchung.typ == 'Ausgabe', Finanzbuchung.betrag),
            else_=0
        )).label('ausgaben')
    ).group_by(db.extract('year', Finanzbuchung.datum)).order_by(db.extract('year', Finanzbuchung.datum)).all()

    # PDF erstellen
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)

    # Titel
    pdf.cell(190, 10, "Jahressaldo", ln=True, align="C")
    pdf.ln(10)

    # Tabellenüberschrift
    pdf.set_font("Arial", size=10, style="B")
    headers = ["Jahr", "Kontonummer", "Kontobezeichnung", "Anfangsbestand", "Einnahmen", "Ausgaben", "Endbestand"]
    col_widths = [20, 40, 50, 25, 20, 20, 25]  # Angepasste Spaltenbreiten

    # Überschriften drucken
    for header, width in zip(headers, col_widths):
        pdf.cell(width, 10, header, border=1, align="C")
    pdf.ln()

    # Tabelleninhalt
    pdf.set_font("Arial", size=10)
    for jahr, einnahmen, ausgaben in salden:
        anfangsbestand = current_user.anfangsbestand
        endbestand = anfangsbestand + einnahmen - ausgaben

        # Daten für die Zeile vorbereiten
        row_data = [
            str(int(jahr)),
            current_user.konto_nummer or "Keine Kontonummer",
            current_user.konto_bezeichnung or "Keine Bezeichnung",
            f"{anfangsbestand:.2f}",
            f"{einnahmen:.2f}",
            f"{ausgaben:.2f}",
            f"{endbestand:.2f}",
        ]

        # Maximale Zeilenhöhe berechnen
        max_height = 10  # Standardhöhe
        line_heights = [
            pdf.get_string_width(data) // (width - 2) * 6 + 10 for data, width in zip(row_data, col_widths)
        ]
        max_height = max(line_heights)

        # Manuelle Zellenpositionierung
        x_start = pdf.get_x()
        y_start = pdf.get_y()
        for i, (data, width) in enumerate(zip(row_data, col_widths)):
            if i == 1:  # Schriftgröße für Kontonummer anpassen
                pdf.set_font("Arial", size=8)
            pdf.multi_cell(width, 6, data, border=1, align="C")
            pdf.set_xy(x_start + width, y_start)
            x_start += width
            pdf.set_font("Arial", size=10)  # Schriftgröße zurücksetzen

        pdf.ln(max_height)

    # PDF als Antwort zurückgeben
    response = make_response(pdf.output(dest='S').encode('latin1'))
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename=jahressaldo.pdf'
    return response

@app.route('/finanzen/kategorie/pdf', methods=['GET'])
@login_required
def finanzen_kategorie_pdf():
    # Finanzbuchungen gruppiert nach Kategorie abrufen
    kategorien = db.session.query(Finanzbuchung.kategorie).distinct().all()

    # PDF erstellen
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)

    for kategorie_row in kategorien:
        kategorie = kategorie_row[0]
        buchungen = Finanzbuchung.query.filter_by(kategorie=kategorie).all()

        # Neue Seite für jede Kategorie
        pdf.add_page()
        pdf.set_font("Arial", size=12)

        # Kategorie-Titel
        pdf.cell(190, 10, f"Kategorie: {kategorie}", ln=True, align="C")
        pdf.ln(10)

        # Tabellenüberschriften
        pdf.set_font("Arial", size=10, style="B")
        headers = ["Datum", "Typ", "Betrag (EUR)", "Beschreibung"]
        col_widths = [40, 30, 40, 80]  # Angepasste Spaltenbreiten

        for header, width in zip(headers, col_widths):
            pdf.cell(width, 10, header, border=1, align="C")
        pdf.ln()

        # Tabelleninhalt
        pdf.set_font("Arial", size=10)
        for buchung in buchungen:
            row_data = [
                buchung.datum.strftime('%d.%m.%Y') if buchung.datum else "-",
                buchung.typ,
                f"{buchung.betrag:.2f}",
                buchung.beschreibung
            ]

            for data, width in zip(row_data, col_widths):
                pdf.cell(width, 10, data, border=1, align="L")
            pdf.ln()

    # PDF als Antwort zurückgeben
    response = make_response(pdf.output(dest='S').encode('latin1'))
    response.headers['Content-Type'] = 'application/pdf'
    response.headers['Content-Disposition'] = 'attachment; filename=finanzen_kategorien.pdf'
    return response


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

@app.route('/update_konto_settings', methods=['POST'])
@login_required
def update_konto_settings():
    konto_nummer = request.form.get('konto_nummer', '').strip()
    current_user.konto_nummer = konto_nummer
    db.session.commit()
    flash("Kontonummer wurde gespeichert.", "success")
    return redirect(url_for('einstellungen'))

@app.route('/update_konto_details', methods=['POST'])
@login_required
def update_konto_details():
    # Daten aus dem Formular abrufen
    konto_bezeichnung = request.form.get('konto_bezeichnung', '').strip()
    anfangsbestand = request.form.get('anfangsbestand', 0.0)

    # Aktuelle Benutzerinformationen aktualisieren
    current_user.konto_bezeichnung = konto_bezeichnung
    current_user.anfangsbestand = float(anfangsbestand)
    db.session.commit()  # Änderungen speichern

    flash("Kontoeinstellungen wurden erfolgreich gespeichert.", "success")
    return redirect(url_for('einstellungen'))

@app.route('/about')
def about():
    return render_template('about.html')

# ----------------------------------
# Mailversand aus der App
# ----------------------------------
@app.route('/feedback', methods=['GET', 'POST'])
def send_feedback():
    form = FeedbackForm()
    if form.validate_on_submit():
        # Daten aus dem Formular
        sender_name = form.name.data
        sender_email = form.email.data
        message_content = form.message.data

        # Anfrage-Daten für Brevo
        BREVO_API_KEY = os.getenv('BREVO_API_KEY')
        if not BREVO_API_KEY:
            flash("Fehler: Kein Brevo API-Schlüssel gefunden.", "danger")
            return redirect(url_for('send_feedback'))

        headers = {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
        }
        data = {
            "sender": {"name": "Feedback Bot", "email": "feedback@memberworks.at"},  # Muss bei Brevo verifiziert sein
            "to": [{"email": "feedback@memberworks.at"}],  # Zieladresse
            "subject": f"Feedback von {sender_name}",
            "htmlContent": f"""
            <h3>Neues Feedback erhalten</h3>
            <p><strong>Name:</strong> {sender_name}</p>
            <p><strong>E-Mail:</strong> {sender_email}</p>
            <p><strong>Nachricht:</strong></p>
            <p>{message_content}</p>
            """
        }

        # Anfrage an die Brevo API senden
        try:
            response = requests.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=data)
            if response.status_code == 201:
                flash("Vielen Dank für Ihr Feedback! Ihre Nachricht wurde erfolgreich gesendet.", "success")
            else:
                flash(f"Fehler beim Senden der Nachricht: {response.status_code} - {response.text}", "danger")
        except Exception as e:
            flash(f"Es gab ein Problem beim Senden der Nachricht: {e}", "danger")
        return redirect(url_for('send_feedback'))

    return render_template('feedback.html', form=form)


# ----------------------------------
# Mailversand an Mitglieder
# ----------------------------------
@app.route('/send_email', methods=['GET', 'POST'])
@login_required
def send_email():
    mitglieder = Mitglied.query.all()
    vorlagen = Nachrichtenvorlage.query.all()
    vorlagen_json = json.dumps([{'id': v.id, 'betreff': v.betreff, 'inhalt': v.inhalt} for v in vorlagen])

    if request.method == 'POST':
        subject = request.form['subject']
        body = request.form['body']
        selected_ids = request.form.getlist('member_ids')

        BREVO_API_KEY = os.getenv('BREVO_API_KEY')
        if not BREVO_API_KEY:
            flash("Fehler: Kein Brevo API-Schlüssel gefunden.", "danger")
            return redirect(url_for('send_email'))

        headers = {
            "api-key": BREVO_API_KEY,
            "Content-Type": "application/json",
        }

        # Ziel-E-Mails abrufen
        if "all" in selected_ids:
            recipient_emails = [mitglied.email for mitglied in mitglieder]
        else:
            recipient_emails = [mitglied.email for mitglied in mitglieder if str(mitglied.id) in selected_ids]

        if not recipient_emails:
            flash('Keine Mitglieder ausgewählt.', 'danger')
            return redirect(url_for('send_email'))

        data = {
            "sender": {"name": "Vereinsverwaltung", "email": "info@memberworks.at"},  # Muss bei Brevo verifiziert sein
            "to": [{"email": email} for email in recipient_emails],
            "subject": subject,
            "htmlContent": body
        }

        # Anfrage an die Brevo API senden
        try:
            response = requests.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=data)
            if response.status_code == 201:
                flash('E-Mails erfolgreich gesendet.', 'success')
            else:
                flash(f"Fehler beim Senden der E-Mails: {response.status_code} - {response.text}", "danger")
        except Exception as e:
            flash(f"Fehler beim Senden der E-Mails: {e}", "danger")

        return redirect(url_for('send_email'))

    return render_template('send_email.html', mitglieder=mitglieder, vorlagen=vorlagen, vorlagen_json=vorlagen_json)

# ----------------------------------
# Vorlagen für Mailversand
# ----------------------------------
@app.route('/templates', methods=['GET', 'POST'])
@login_required
def templates_list():
    templates = Nachrichtenvorlage.query.all()
    return render_template('templates_list.html', templates=templates)

@app.route('/templates/new', methods=['GET', 'POST'])
@login_required
def templates_new():
    if request.method == 'POST':
        titel = request.form['titel']
        betreff = request.form['betreff']
        inhalt = request.form['inhalt']

        neue_vorlage = Nachrichtenvorlage(titel=titel, betreff=betreff, inhalt=inhalt)
        db.session.add(neue_vorlage)
        db.session.commit()
        flash('Nachrichtenvorlage erfolgreich erstellt.', 'success')
        return redirect(url_for('templates_list'))

    return render_template('templates_edit.html', titel="Neue Vorlage")

@app.route('/templates/<int:template_id>/edit', methods=['GET', 'POST'])
@login_required
def templates_edit(template_id):
    vorlage = Nachrichtenvorlage.query.get_or_404(template_id)
    if request.method == 'POST':
        vorlage.titel = request.form['titel']
        vorlage.betreff = request.form['betreff']
        vorlage.inhalt = request.form['inhalt']
        db.session.commit()
        flash('Nachrichtenvorlage erfolgreich aktualisiert.', 'success')
        return redirect(url_for('templates_list'))

    return render_template('templates_edit.html', vorlage=vorlage, titel="Vorlage bearbeiten")

@app.route('/templates/<int:template_id>/delete', methods=['POST'])
@login_required
def templates_delete(template_id):
    vorlage = Nachrichtenvorlage.query.get_or_404(template_id)
    db.session.delete(vorlage)
    db.session.commit()
    flash('Nachrichtenvorlage erfolgreich gelöscht.', 'success')
    return redirect(url_for('templates_list'))

# ----------------------------------
# App starten
# ----------------------------------
if __name__ == '__main__':
    with app.app_context():
        # Sicherstellen, dass das Datenbankverzeichnis existiert
        db_path = os.path.join(os.getcwd(), 'databases')
        if not os.path.exists(db_path):
            os.makedirs(db_path)
        
        # Datenbank initialisieren
        if not os.path.exists(os.path.join(db_path, 'verein.db')):
            db.create_all()  # Erstellt alle Tabellen
            print("Datenbank wurde erfolgreich erstellt.")
        else:
            print("Datenbank existiert bereits.")

        app.run(host='0.0.0.0', port='5000', debug=True) # Für Testzwecke auf 127.0.0.1 umstellen, Live immer 0.0.0.0, dass auch Docker funktioniert. 
