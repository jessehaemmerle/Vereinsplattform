from flask_wtf import FlaskForm
from wtforms import StringField, TextAreaField, DateField, FloatField, EmailField, SelectField, RadioField, PasswordField, SubmitField
from wtforms.validators import DataRequired, Email, EqualTo, Optional, Length
from flask_wtf.file import FileField, FileRequired, FileAllowed

class MitgliedForm(FlaskForm):
    vorname = StringField('Vorname', validators=[DataRequired()])
    nachname = StringField('Nachname', validators=[DataRequired()])
    email = StringField('E-Mail', validators=[DataRequired(), Email()])
    eintrittsdatum = DateField('Eintrittsdatum', format='%Y-%m-%d')
    austritt_datum = DateField('Austrittsdatum', format='%Y-%m-%d', validators=[Optional()])
    status = SelectField('Status', choices=[('aktiv', 'Aktiv'), ('inaktiv', 'Inaktiv')])
    funktion = SelectField('Funktion', choices=[('leitung', 'Leitung'), ('kassier', 'Kassier'), ('normal', 'Normales Mitglied'), ('vorstand', 'Vorstand'), ('pruefer', 'Rechnungsprüfer'), ('schrift', 'Schriftführer')])
    mitgliedsbeitrag = FloatField('Mitgliedsbeitrag (EUR)', validators=[Optional()])
    beitrag_bezahlt = RadioField(
        choices=[('ja', 'Ja'), ('nein', 'Nein')],
        validators=[DataRequired()]
    )
    telefonnummer = StringField('Telefonnummer', validators=[Optional()])  # Neues Feld
    geburtstag = DateField('Geburtstag', validators=[Optional()])           # Neues Feld
    adresse = StringField('Adresse', validators=[Optional()])               # Neues Feld
    plz = FloatField('Postleitzahl', validators=[Optional()])
    ort = StringField('Ort', validators=[Optional()])
    submit = SubmitField('Speichern')

class ValidateMemberForm(FlaskForm):
    email = StringField('E-Mail-Adresse', validators=[DataRequired(), Email()])
    verein = StringField('Verein', validators=[DataRequired()])
    submit = SubmitField('Überprüfen')

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


class EventForm(FlaskForm):
    titel = StringField('Titel', validators=[DataRequired()])
    beschreibung = TextAreaField('Beschreibung')
    datum = DateField('Datum', format='%Y-%m-%d')
    ort = StringField('Ort')
    preis = FloatField('Preis (EUR)', validators=[Optional()])  # Neues Preisfeld

class FeedbackForm(FlaskForm):
    name = StringField(
        'Name',
        validators=[
            DataRequired(message="Bitte geben Sie Ihren Namen ein."),
            Length(max=50, message="Der Name darf maximal 50 Zeichen lang sein.")
        ]
    )
    email = EmailField(
        'E-Mail',
        validators=[
            DataRequired(message="Bitte geben Sie Ihre E-Mail-Adresse ein."),
            Email(message="Bitte geben Sie eine gültige E-Mail-Adresse ein.")
        ]
    )
    message = TextAreaField(
        'Nachricht',
        validators=[
            DataRequired(message="Bitte geben Sie Ihre Nachricht ein."),
            Length(min=10, max=1000, message="Die Nachricht muss zwischen 10 und 1000 Zeichen lang sein.")
        ]
    )
    submit = SubmitField('Senden')

class SendMessageForm(FlaskForm):
    subject = StringField('Betreff', validators=[DataRequired()])
    body = TextAreaField('Nachricht', validators=[DataRequired()])
    submit = SubmitField('Senden')

class ToggleBeitragForm(FlaskForm):
    """Leeres Formular für das Umschalten von 'beitrag_bezahlt',
    damit wir form.hidden_tag() verwenden können."""
    pass

class DeleteMitgliedForm(FlaskForm):
    """Leeres Formular für das Umschalten von 'beitrag_bezahlt',
    damit wir form.hidden_tag() verwenden können."""
    pass

class UpdateKontoForm(FlaskForm):
    konto_nummer = StringField('Kontonummer')
    submit = SubmitField('Speichern')

class ImportMitgliedForm(FlaskForm):
    """Leeres Formular für das Umschalten von 'beitrag_bezahlt',
    damit wir form.hidden_tag() verwenden können."""
    pass

class DeleteFinanzForm(FlaskForm):
    pass

class DeleteEventForm(FlaskForm):
    pass

class MemberRegisterForm(FlaskForm):
    email = StringField('E-Mail', validators=[DataRequired(), Email()])
    password = PasswordField('Passwort', validators=[
        DataRequired(),
        Length(min=8, message="Das Passwort muss mindestens 8 Zeichen lang sein.")
    ])
    confirm_password = PasswordField('Passwort bestätigen', validators=[
        DataRequired(),
        EqualTo('password', message="Passwörter müssen übereinstimmen.")
    ])
    vorname = StringField('Vorname', validators=[DataRequired()])
    nachname = StringField('Nachname', validators=[DataRequired()])
    
    # Beispiel: Verein auswählen (falls du eine Liste aller Vereine hast)
    verein_id = SelectField('Verein', coerce=int)  
    # Falls du keinen Select möchtest, nimm stattdessen:
    # verein_name = StringField('Vereinsname', validators=[DataRequired()])

    submit = SubmitField('Registrieren')

class MemberEmailForm(FlaskForm):
    email = EmailField('E-Mail', validators=[DataRequired(), Email()])
    submit_search = SubmitField('Vereine suchen')

class MemberSelectVereinForm(FlaskForm):
    verein_id = SelectField('Bitte Verein auswählen', coerce=int)
    password = PasswordField('Passwort', validators=[
        DataRequired(),
        Length(min=8, message="Das Passwort muss mindestens 8 Zeichen lang sein.")
    ])
    password_confirm = PasswordField('Passwort bestätigen', validators=[
        DataRequired(),
        EqualTo('password', message="Passwörter müssen übereinstimmen.")
    ])
    submit_register = SubmitField('Registrieren')

class RegisterMemberVereinChooseForm(FlaskForm):
    email = EmailField('E-Mail', validators=[DataRequired(), Email()])
    verein_id = SelectField('Verein', coerce=int, validators=[DataRequired()])
    submit = SubmitField('Weiter')