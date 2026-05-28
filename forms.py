from flask_wtf import FlaskForm
from flask_wtf.file import FileAllowed, FileField, FileRequired
from wtforms import (
    BooleanField,
    DateField,
    EmailField,
    FloatField,
    IntegerField,
    PasswordField,
    RadioField,
    SelectField,
    StringField,
    SubmitField,
    TextAreaField,
)
from wtforms.validators import DataRequired, Email, EqualTo, Length, Optional


class MitgliedForm(FlaskForm):
    vorname = StringField("Vorname", validators=[DataRequired()])
    nachname = StringField("Nachname", validators=[DataRequired()])
    email = EmailField("E-Mail", validators=[DataRequired(), Email()])
    eintrittsdatum = DateField("Eintrittsdatum", format="%Y-%m-%d", validators=[Optional()])
    austritt_datum = DateField("Austrittsdatum", format="%Y-%m-%d", validators=[Optional()])
    status = SelectField("Status", choices=[("aktiv", "Aktiv"), ("inaktiv", "Inaktiv")])
    funktion = SelectField(
        "Funktion",
        choices=[
            ("leitung", "Leitung"),
            ("kassier", "Kassier"),
            ("normal", "Normales Mitglied"),
            ("vorstand", "Vorstand"),
            ("pruefer", "Rechnungspruefer"),
            ("schrift", "Schriftfuehrer"),
        ],
    )
    mitgliedsbeitrag = FloatField("Mitgliedsbeitrag (EUR)", validators=[Optional()])
    beitrag_bezahlt = RadioField(
        "Mitgliedsbeitrag bezahlt",
        choices=[("ja", "Ja"), ("nein", "Nein")],
        default="nein",
        validators=[DataRequired()],
    )
    telefonnummer = StringField("Telefonnummer", validators=[Optional()])
    geburtstag = DateField("Geburtstag", format="%Y-%m-%d", validators=[Optional()])
    adresse = StringField("Adresse", validators=[Optional()])
    plz = StringField("Postleitzahl", validators=[Optional()])
    ort = StringField("Ort", validators=[Optional()])
    submit = SubmitField("Speichern")


class EventForm(FlaskForm):
    titel = StringField("Titel", validators=[DataRequired()])
    beschreibung = TextAreaField("Beschreibung", validators=[Optional()])
    datum = DateField("Datum", format="%Y-%m-%d", validators=[DataRequired()])
    ort = StringField("Ort", validators=[Optional()])
    preis = FloatField("Preis (EUR)", validators=[Optional()])
    submit = SubmitField("Speichern")


class FinanzForm(FlaskForm):
    typ = SelectField("Typ", choices=[("Einnahme", "Einnahme"), ("Ausgabe", "Ausgabe")])
    kategorie = StringField("Kategorie", validators=[DataRequired()])
    betrag = FloatField("Betrag", validators=[DataRequired()])
    datum = DateField("Datum", format="%Y-%m-%d", validators=[Optional()])
    beschreibung = TextAreaField("Beschreibung", validators=[Optional()])
    submit = SubmitField("Speichern")


class NotizForm(FlaskForm):
    titel = StringField("Titel", validators=[DataRequired()])
    inhalt = TextAreaField("Inhalt", validators=[DataRequired()])
    submit = SubmitField("Speichern")


class RegisterForm(FlaskForm):
    verein_name = StringField("Vereinsname", validators=[DataRequired(), Length(max=100)])
    username = StringField("Nutzername", validators=[DataRequired(), Length(max=50)])
    email = EmailField("E-Mail", validators=[DataRequired(), Email()])
    password = PasswordField(
        "Passwort",
        validators=[
            DataRequired(),
            Length(min=8, message="Das Passwort muss mindestens 8 Zeichen lang sein."),
        ],
    )
    confirm_password = PasswordField(
        "Passwort bestaetigen",
        validators=[DataRequired(), EqualTo("password", message="Passwoerter stimmen nicht ueberein")],
    )
    submit = SubmitField("Registrieren")


class PlatformAdminUserForm(FlaskForm):
    verein_name = StringField("Vereinsname", validators=[DataRequired(), Length(max=100)])
    username = StringField("Nutzername", validators=[DataRequired(), Length(max=50)])
    email = EmailField("E-Mail", validators=[DataRequired(), Email()])
    submit = SubmitField("Admin erstellen")


class LoginForm(FlaskForm):
    email = EmailField("E-Mail", validators=[DataRequired(), Email()])
    password = PasswordField("Passwort", validators=[DataRequired()])
    submit = SubmitField("Einloggen")


class DocumentForm(FlaskForm):
    file = FileField(
        "Datei",
        validators=[
            FileRequired(message="Bitte waehle eine Datei aus."),
            FileAllowed(["pdf", "doc", "docx", "jpg", "jpeg", "png"], "Nur PDF, DOC, DOCX, JPG, PNG erlaubt!"),
        ],
    )
    description = TextAreaField("Beschreibung", validators=[DataRequired()])
    submit = SubmitField("Hochladen")


class FeedbackForm(FlaskForm):
    name = StringField(
        "Name",
        validators=[
            DataRequired(message="Bitte geben Sie Ihren Namen ein."),
            Length(max=50, message="Der Name darf maximal 50 Zeichen lang sein."),
        ],
    )
    email = EmailField(
        "E-Mail",
        validators=[
            DataRequired(message="Bitte geben Sie Ihre E-Mail-Adresse ein."),
            Email(message="Bitte geben Sie eine gueltige E-Mail-Adresse ein."),
        ],
    )
    message = TextAreaField(
        "Nachricht",
        validators=[
            DataRequired(message="Bitte geben Sie Ihre Nachricht ein."),
            Length(min=10, max=1000, message="Die Nachricht muss zwischen 10 und 1000 Zeichen lang sein."),
        ],
    )
    submit = SubmitField("Senden")


class SendMessageForm(FlaskForm):
    subject = StringField("Betreff", validators=[DataRequired()])
    body = TextAreaField("Nachricht", validators=[DataRequired()])
    submit = SubmitField("Senden")


class RegisterMemberVereinChooseForm(FlaskForm):
    email = EmailField("E-Mail", validators=[DataRequired(), Email()])
    verein_id = SelectField("Verein", coerce=int, validators=[DataRequired()])
    submit = SubmitField("Weiter")


class MemberPasswordForm(FlaskForm):
    password = PasswordField(
        "Passwort",
        validators=[
            DataRequired(),
            Length(min=8, message="Das Passwort muss mindestens 8 Zeichen lang sein."),
        ],
    )
    confirm_password = PasswordField(
        "Passwort bestaetigen",
        validators=[DataRequired(), EqualTo("password", message="Passwoerter muessen uebereinstimmen.")],
    )
    submit = SubmitField("Registrieren")


class SettingsForm(FlaskForm):
    theme = SelectField("Theme", choices=[("light", "Hell"), ("dark", "Dunkel")])
    email_notifikationen = BooleanField("E-Mail-Benachrichtigungen")
    submit = SubmitField("Speichern")


class UpdateKontoForm(FlaskForm):
    konto_nummer = StringField("Kontonummer", validators=[Optional()])
    submit = SubmitField("Speichern")


class LicenseForm(FlaskForm):
    name = StringField("Name", validators=[DataRequired(), Length(max=120)])
    license_key = StringField("Lizenzschluessel", validators=[Optional(), Length(max=64)])
    verein_id = SelectField("Verein", coerce=int, validators=[Optional()])
    status = SelectField(
        "Status",
        choices=[
            ("active", "Aktiv"),
            ("trial", "Testlizenz"),
            ("suspended", "Gesperrt"),
            ("expired", "Abgelaufen"),
        ],
    )
    max_users = IntegerField("Max. Benutzer", validators=[Optional()])
    max_members = IntegerField("Max. Mitglieder", validators=[Optional()])
    valid_from = DateField("Gueltig ab", format="%Y-%m-%d", validators=[Optional()])
    valid_until = DateField("Gueltig bis", format="%Y-%m-%d", validators=[Optional()])
    notes = TextAreaField("Notizen", validators=[Optional()])
    submit = SubmitField("Speichern")


class EmptyForm(FlaskForm):
    pass


ToggleBeitragForm = EmptyForm
DeleteMitgliedForm = EmptyForm
ImportMitgliedForm = EmptyForm
DeleteFinanzForm = EmptyForm
DeleteEventForm = EmptyForm
DeleteNotizForm = EmptyForm
DeleteDocumentForm = EmptyForm
DeleteTemplateForm = EmptyForm
DeleteLicenseForm = EmptyForm

# Backwards-compatible names for older templates/routes that may still exist.
ValidateMemberForm = RegisterMemberVereinChooseForm
MemberRegisterForm = RegisterForm
MemberEmailForm = RegisterMemberVereinChooseForm
MemberSelectVereinForm = MemberPasswordForm
