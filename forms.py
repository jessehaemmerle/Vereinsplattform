from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField, DateField, FloatField, SelectField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, Optional
from flask_wtf.file import FileField, FileRequired, FileAllowed

class MitgliedForm(FlaskForm):
    vorname = StringField('Vorname', validators=[DataRequired()])
    nachname = StringField('Nachname', validators=[DataRequired()])
    email = StringField('E-Mail', validators=[DataRequired(), Email()])
    eintrittsdatum = DateField('Eintrittsdatum', format='%Y-%m-%d')
    status = SelectField('Status', choices=[('aktiv', 'Aktiv'), ('inaktiv', 'Inaktiv')])
    funktion = SelectField('Funktion', choices=[('leitung', 'Leitung'), ('kassier', 'Kassier'), ('normal', 'Normales Mitglied'), ('vorstand', 'Vorstand'), ('pruefer', 'Rechnungsprüfer'), ('schrift', 'Schriftführer')])

class EventForm(FlaskForm):
    titel = StringField('Titel', validators=[DataRequired()])
    beschreibung = TextAreaField('Beschreibung')
    datum = DateField('Datum', format='%Y-%m-%d')
    ort = StringField('Ort')

class FinanzForm(FlaskForm):
    typ = SelectField('Typ', choices=[('Einnahme', 'Einnahme'), ('Ausgabe', 'Ausgabe')])
    kategorie = StringField('Kategorie')
    betrag = FloatField('Betrag', validators=[DataRequired()])
    datum = DateField('Datum', format='%Y-%m-%d')
    beschreibung = TextAreaField('Beschreibung')

class NotizForm(FlaskForm):
    titel = StringField('Titel', validators=[DataRequired()])
    inhalt = TextAreaField('Inhalt', validators=[DataRequired()])

class RegisterForm(FlaskForm):
    username = StringField('Nutzername', validators=[DataRequired()])
    email = StringField('E-Mail', validators=[DataRequired(), Email()])
    password = PasswordField('Passwort', validators=[DataRequired()])
    confirm_password = PasswordField(
        'Passwort bestätigen',
        validators=[
            DataRequired(),
            EqualTo('password', message='Passwörter stimmen nicht überein')
        ]
    )
    submit = SubmitField('Registrieren')

class LoginForm(FlaskForm):
    email = StringField('E-Mail', validators=[DataRequired(), Email()])
    password = PasswordField('Passwort', validators=[DataRequired()])
    submit = SubmitField('Einloggen')

class DocumentForm(FlaskForm):
    file = FileField(
        'Datei',
        validators=[
            FileRequired(message='Bitte wähle eine Datei aus.'),
            FileAllowed(['pdf', 'doc', 'docx', 'jpg', 'png'], 'Nur PDF, DOC, DOCX, JPG, PNG erlaubt!')
        ]
    )
    description = TextAreaField('Beschreibung', validators=[DataRequired()])
    submit = SubmitField('Hochladen')

    from wtforms import FloatField

class EventForm(FlaskForm):
    titel = StringField('Titel', validators=[DataRequired()])
    beschreibung = TextAreaField('Beschreibung')
    datum = DateField('Datum', format='%Y-%m-%d')
    ort = StringField('Ort')
    preis = FloatField('Preis (EUR)', validators=[Optional()])  # Neues Preisfeld
