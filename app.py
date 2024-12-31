import os
from datetime import date
from flask import Flask, render_template, request, redirect, url_for, flash
from models import db, Mitglied, Event, Finanzbuchung, Notiz, User
from forms import MitgliedForm, EventForm, FinanzForm, NotizForm, RegisterForm, LoginForm
from flask_login import LoginManager, UserMixin, login_user, logout_user, login_required, current_user

# Flask-Login konfigurieren
login_manager = LoginManager()
login_manager.login_view = 'login'  # Ziel-View, falls der User nicht eingeloggt ist
login_manager.login_message = "Bitte logge dich ein, um fortzufahren."

app = Flask(__name__)
app.config['SECRET_KEY'] = 'SUPER_GEHEIM'  # In Produktion in Umgebungsvariablen auslagern
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///verein.db'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

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
def index():
    # Evtl. einige Kennzahlen anzeigen
    anzahl_mitglieder = Mitglied.query.count()
    anzahl_events = Event.query.count()
    anzahl_notizen = Notiz.query.count()
    sum_einnahmen = db.session.query(db.func.sum(Finanzbuchung.betrag))\
        .filter(Finanzbuchung.typ=='Einnahme').scalar() or 0
    sum_ausgaben = db.session.query(db.func.sum(Finanzbuchung.betrag))\
        .filter(Finanzbuchung.typ=='Ausgabe').scalar() or 0
    saldo = sum_einnahmen - sum_ausgaben

    return render_template('index.html',
                           anzahl_mitglieder=anzahl_mitglieder,
                           anzahl_events=anzahl_events,
                           anzahl_notizen=anzahl_notizen,
                           saldo=saldo)


# ----------------------------------
# Mitglieder
# ----------------------------------
@app.route('/mitglieder')
@login_required  # Beispiel: Zugriff nur für eingeloggte User
def mitglieder_liste():
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
            status=form.status.data
        )
        db.session.add(neues_mitglied)
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
        neues_event = Event(
            titel=form.titel.data,
            beschreibung=form.beschreibung.data,
            datum=form.datum.data,
            ort=form.ort.data
        )
        db.session.add(neues_event)
        db.session.commit()
        return redirect(url_for('events_liste'))
    return render_template('event_edit.html', form=form, titel="Neues Event")

@app.route('/event/<int:event_id>/edit', methods=['GET', 'POST'])
@login_required
def event_edit(event_id):
    event = Event.query.get_or_404(event_id)
    form = EventForm(obj=event)
    if form.validate_on_submit():
        event.titel = form.titel.data
        event.beschreibung = form.beschreibung.data
        event.datum = form.datum.data
        event.ort = form.ort.data
        db.session.commit()
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
        .filter(Finanzbuchung.typ=='Einnahme').scalar() or 0
    sum_ausgaben = db.session.query(db.func.sum(Finanzbuchung.betrag))\
        .filter(Finanzbuchung.typ=='Ausgabe').scalar() or 0
    saldo = sum_einnahmen - sum_ausgaben
    return render_template('finanzen.html', buchungen=buchungen, saldo=saldo)

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
        return redirect(url_for('finanzen_liste'))
    return render_template('finanzen_edit.html', form=form, titel="Neue Finanzbuchung")

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
        return redirect(url_for('finanzen_liste'))
    return render_template('finanzen_edit.html', form=form, titel="Buchung bearbeiten")

@app.route('/finanzen/<int:buchung_id>/delete', methods=['POST'])
@login_required
def finanzen_delete(buchung_id):
    buchung = Finanzbuchung.query.get_or_404(buchung_id)
    db.session.delete(buchung)
    db.session.commit()
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
# App starten
# ----------------------------------
if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
