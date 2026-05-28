import csv
import io
import json
import os
import re
import uuid
from datetime import date, datetime, timedelta
from functools import wraps

import requests
from dotenv import load_dotenv
from flask import (
    Flask,
    abort,
    flash,
    g,
    make_response,
    redirect,
    render_template,
    request,
    send_file,
    send_from_directory,
    session,
    url_for,
)
from flask_login import LoginManager, current_user, login_required, login_user, logout_user
from flask_wtf.csrf import CSRFProtect
from fpdf import FPDF
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from sqlalchemy import case, extract
from sqlalchemy.exc import IntegrityError
from werkzeug.utils import secure_filename

from forms import (
    DeleteDocumentForm,
    DeleteEventForm,
    DeleteFinanzForm,
    DeleteLicenseForm,
    DeleteMitgliedForm,
    DeleteNotizForm,
    DeleteTemplateForm,
    DocumentForm,
    EmptyForm,
    EventForm,
    FeedbackForm,
    FinanzForm,
    ImportMitgliedForm,
    LicenseForm,
    LoginForm,
    MemberPasswordForm,
    MitgliedForm,
    NotizForm,
    PlatformAdminUserForm,
    RegisterForm,
    RegisterMemberVereinChooseForm,
    SendMessageForm,
    ToggleBeitragForm,
    UpdateKontoForm,
)
from models import (
    Document,
    Event,
    Finanzbuchung,
    License,
    LicenseUsageEvent,
    Mitglied,
    Nachrichtenvorlage,
    Notiz,
    User,
    Verein,
    VereinFeature,
    db,
)
from services import zahlung_erstellen


load_dotenv()

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
DATABASE_FOLDER = os.getenv("DATABASE_FOLDER", os.path.join(BASE_DIR, "databases"))
UPLOAD_FOLDER = os.getenv("UPLOAD_FOLDER", os.path.join(BASE_DIR, "uploads"))
DATABASE_PATH = os.getenv("DATABASE_PATH", os.path.join(DATABASE_FOLDER, "verein.db"))

DEFAULT_FEATURES = ["Mitgliederverwaltung", "Finanzen", "Events", "Dokumente", "Notizen"]
FEATURE_CHOICES = DEFAULT_FEATURES

os.makedirs(DATABASE_FOLDER, exist_ok=True)
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

app = Flask(__name__)
app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key-change-me")
app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{DATABASE_PATH}"
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
app.config["UPLOAD_FOLDER"] = UPLOAD_FOLDER

db.init_app(app)
csrf = CSRFProtect(app)

login_manager = LoginManager()
login_manager.login_view = "login"
login_manager.login_message = "Bitte logge dich ein, um fortzufahren."
login_manager.init_app(app)


@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))


@app.before_request
def load_active_features():
    if current_user.is_authenticated and current_user.verein_id:
        g.active_features = [
            row.feature
            for row in VereinFeature.query.filter_by(verein_id=current_user.verein_id).order_by(VereinFeature.feature).all()
        ]
    else:
        g.active_features = []


@app.context_processor
def inject_template_helpers():
    return {"delete_form": EmptyForm(), "is_platform_admin": is_platform_admin_user()}


def configured_system_admin_emails():
    raw = os.getenv("SYSTEM_ADMIN_EMAILS", "")
    return {email.strip().lower() for email in raw.split(",") if email.strip()}


def default_admin_config():
    if os.getenv("DEFAULT_ADMIN_ENABLED", "true").strip().lower() in {"0", "false", "no", "off"}:
        return None

    email = os.getenv("DEFAULT_ADMIN_EMAIL", "").strip().lower()
    password = os.getenv("DEFAULT_ADMIN_PASSWORD", "")
    username = os.getenv("DEFAULT_ADMIN_USERNAME", "standard_admin").strip() or "standard_admin"
    if not email or not password:
        return None
    return {"email": email, "password": password, "username": username}


def bootstrap_default_admin():
    config = default_admin_config()
    if not config:
        return

    if len(config["password"]) < 8:
        app.logger.warning("DEFAULT_ADMIN_PASSWORD muss mindestens 8 Zeichen lang sein.")
        return
    if "@" not in config["email"]:
        app.logger.warning("DEFAULT_ADMIN_EMAIL ist keine gueltige E-Mail-Adresse.")
        return

    user = User.query.filter_by(username=config["username"]).first()
    if not user:
        user = User.query.filter_by(email=config["email"]).first()

    email_owner = User.query.filter_by(email=config["email"]).first()
    if email_owner and user and email_owner.id != user.id:
        app.logger.warning("DEFAULT_ADMIN_EMAIL ist bereits einem anderen Benutzer zugeordnet.")
        return

    username_owner = User.query.filter_by(username=config["username"]).first()
    if username_owner and user and username_owner.id != user.id:
        app.logger.warning("DEFAULT_ADMIN_USERNAME ist bereits einem anderen Benutzer zugeordnet.")
        return

    if not user:
        user = User(username=config["username"], email=config["email"], role="system_admin")
        db.session.add(user)

    user.username = config["username"]
    user.email = config["email"]
    user.role = "system_admin"
    user.set_password(config["password"])

    try:
        db.session.commit()
    except IntegrityError:
        db.session.rollback()
        app.logger.warning("Standard-Admin konnte wegen eines Datenbankkonflikts nicht synchronisiert werden.")


def is_platform_admin_user():
    if not current_user.is_authenticated:
        return False
    if getattr(current_user, "is_system_admin", False):
        return True
    return current_user.email.lower() in configured_system_admin_emails()


def platform_admin_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if not is_platform_admin_user():
            flash("Dieser Bereich ist nur fuer Plattform-Administratoren verfuegbar.", "warning")
            return redirect(url_for("index"))
        return view(*args, **kwargs)

    return wrapped


def admin_required(view):
    @wraps(view)
    @login_required
    def wrapped(*args, **kwargs):
        if not current_user.is_admin:
            flash("Dieser Bereich ist nur fuer Vereinsadministratoren gedacht.", "warning")
            return redirect(url_for("user_dashboard"))
        if not current_user.verein_id:
            flash("Bitte richte zuerst deinen Verein ein.", "warning")
            return redirect(url_for("setup"))
        return view(*args, **kwargs)

    return wrapped


def current_verein_id():
    if not current_user.is_authenticated or not current_user.verein_id:
        abort(403)
    return current_user.verein_id


def safe_float(value, default=0.0):
    try:
        return float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return default


def safe_date(value, default=None):
    if not value:
        return default
    try:
        return datetime.strptime(value, "%Y-%m-%d").date()
    except ValueError:
        return default


def pdf_response(pdf, filename):
    response = make_response(pdf.output(dest="S").encode("latin1", errors="replace"))
    response.headers["Content-Type"] = "application/pdf"
    response.headers["Content-Disposition"] = f"attachment; filename={filename}"
    return response


def add_default_features(verein_id):
    for feature in DEFAULT_FEATURES:
        db.session.add(VereinFeature(verein_id=verein_id, feature=feature))


def generate_license_key():
    return f"MW-{uuid.uuid4().hex[:8].upper()}-{uuid.uuid4().hex[:8].upper()}"


def create_trial_license(verein):
    db.session.add(
        License(
            license_key=generate_license_key(),
            name=f"Testlizenz - {verein.name}",
            status="trial",
            max_users=5,
            max_members=100,
            valid_from=date.today(),
            valid_until=date.today() + timedelta(days=30),
            verein_id=verein.id,
        )
    )


def create_verein_admin(verein_name, username, email, password, role=None):
    verein = Verein(name=verein_name)
    db.session.add(verein)
    db.session.flush()

    user = User(
        username=username,
        email=email,
        role=role or ("system_admin" if email in configured_system_admin_emails() else "admin"),
        verein_id=verein.id,
    )
    user.set_password(password)
    db.session.add(user)
    add_default_features(verein.id)
    create_trial_license(verein)
    return user


def slugify(value):
    slug = re.sub(r"[^a-zA-Z0-9_-]+", "_", value.strip().lower()).strip("_")
    return slug or "mitglied"


def unique_member_username(email, verein_id):
    base = f"mitglied_{verein_id}_{slugify(email.split('@')[0])}"
    username = base
    counter = 2
    while User.query.filter_by(username=username).first():
        username = f"{base}_{counter}"
        counter += 1
    return username


def create_member_fee_booking(mitglied, typ="Einnahme", kategorie="Mitgliedsbeitrag", beschreibung=None):
    if not mitglied.mitgliedsbeitrag or mitglied.mitgliedsbeitrag <= 0:
        return
    db.session.add(
        Finanzbuchung(
            verein_id=mitglied.verein_id,
            mitglied_id=mitglied.id,
            typ=typ,
            kategorie=kategorie,
            betrag=mitglied.mitgliedsbeitrag,
            datum=date.today(),
            beschreibung=beschreibung or f"Mitgliedsbeitrag von {mitglied.vorname} {mitglied.nachname}",
        )
    )


def license_for_verein(verein_id):
    if not verein_id:
        return None
    return (
        License.query.filter_by(verein_id=verein_id)
        .order_by(
            case(
                (License.status == "active", 0),
                (License.status == "trial", 1),
                else_=2,
            ),
            License.created_at.desc(),
        )
        .first()
    )


def record_license_usage(event_type, metadata=None):
    if not current_user.is_authenticated or not current_user.verein_id:
        return

    license_obj = license_for_verein(current_user.verein_id)
    if not license_obj:
        return

    db.session.add(
        LicenseUsageEvent(
            license_id=license_obj.id,
            verein_id=current_user.verein_id,
            user_id=current_user.id,
            event_type=event_type,
            endpoint=request.endpoint,
            path=request.path[:255],
            event_metadata=json.dumps(metadata or {}, ensure_ascii=False),
        )
    )
    db.session.commit()


@app.after_request
def track_license_usage(response):
    endpoint = request.endpoint or ""
    ignored_prefixes = ("static", "uploaded_file", "platform_admin")
    if (
        response.status_code < 400
        and request.method in {"POST", "PUT", "PATCH", "DELETE"}
        and not endpoint.startswith(ignored_prefixes)
        and not request.path.startswith("/platform-admin")
    ):
        try:
            record_license_usage("write_action", {"method": request.method})
        except Exception:
            db.session.rollback()
    return response


def send_brevo_email(subject, html_content, recipient_emails):
    api_key = os.getenv("BREVO_API_KEY")
    if not api_key:
        raise RuntimeError("Kein Brevo API-Schluessel konfiguriert.")

    headers = {"api-key": api_key, "Content-Type": "application/json"}
    data = {
        "sender": {"name": "Vereinsverwaltung", "email": "info@memberworks.at"},
        "to": [{"email": email} for email in recipient_emails],
        "subject": subject,
        "htmlContent": html_content,
    }
    response = requests.post("https://api.brevo.com/v3/smtp/email", headers=headers, json=data, timeout=20)
    if response.status_code not in (200, 201, 202):
        raise RuntimeError(f"Brevo meldet {response.status_code}: {response.text}")


def post_login_endpoint(user):
    if user.is_system_admin and not user.verein_id:
        return "platform_admin_dashboard"
    return "index" if user.is_admin else "user_dashboard"


def add_event_to_google_calendar(event, user):
    if user.calendar_integration != "google" or not user.calendar_api_key:
        return

    credentials = Credentials(token=user.calendar_api_key)
    service = build("calendar", "v3", credentials=credentials)
    start_date = event.datum.isoformat()
    body = {
        "summary": event.titel,
        "location": event.ort,
        "description": event.beschreibung,
        "start": {"date": start_date, "timeZone": "Europe/Vienna"},
        "end": {"date": (event.datum + timedelta(days=1)).isoformat(), "timeZone": "Europe/Vienna"},
    }
    service.events().insert(calendarId="primary", body=body).execute()


@app.route("/uploads/<path:filename>")
@login_required
def uploaded_file(filename):
    return send_from_directory(app.config["UPLOAD_FOLDER"], filename)


@app.route("/register", methods=["GET", "POST"])
def register_user():
    if current_user.is_authenticated:
        return redirect(url_for("index"))

    form = RegisterForm()
    if form.validate_on_submit():
        verein_name = form.verein_name.data.strip()
        username = form.username.data.strip()
        email = form.email.data.strip().lower()

        if User.query.filter((User.email == email) | (User.username == username)).first():
            flash("Dieser Benutzername oder diese E-Mail-Adresse ist bereits vergeben.", "danger")
            return redirect(url_for("register_user"))
        if Verein.query.filter_by(name=verein_name).first():
            flash("Ein Verein mit diesem Namen existiert bereits.", "danger")
            return redirect(url_for("register_user"))

        user = create_verein_admin(verein_name, username, email, form.password.data)
        db.session.commit()

        login_user(user)
        flash("Registrierung erfolgreich. Richte deinen Verein ein.", "success")
        return redirect(url_for("setup"))

    return render_template("register.html", form=form)


@app.route("/register_verein", methods=["GET", "POST"])
def register_verein():
    return register_user()


@app.route("/register_member_verein", methods=["GET", "POST"])
def register_member_verein():
    step = request.args.get("step", "choose")

    if step == "choose":
        form = RegisterMemberVereinChooseForm()
        form.verein_id.choices = [(v.id, v.name) for v in Verein.query.order_by(Verein.name).all()]
        if not form.verein_id.choices:
            flash("Es gibt noch keinen registrierten Verein.", "warning")
            return redirect(url_for("register_user"))

        if form.validate_on_submit():
            email = form.email.data.strip().lower()
            verein_id = form.verein_id.data
            mitglied = Mitglied.query.filter_by(email=email, verein_id=verein_id).first()
            if not mitglied:
                flash("Diese E-Mail ist in diesem Verein nicht als Mitglied hinterlegt.", "danger")
                return redirect(url_for("register_member_verein", step="choose"))

            session["tmp_member_email"] = email
            session["tmp_member_verein_id"] = verein_id
            return redirect(url_for("register_member_verein", step="set_password"))

        return render_template("register_member_verein_choose.html", form=form)

    if step == "set_password":
        email = session.get("tmp_member_email")
        verein_id = session.get("tmp_member_verein_id")
        verein = Verein.query.get(verein_id) if verein_id else None
        if not email or not verein:
            flash("Bitte waehle zuerst E-Mail und Verein aus.", "warning")
            return redirect(url_for("register_member_verein", step="choose"))

        form = MemberPasswordForm()
        if form.validate_on_submit():
            if User.query.filter_by(email=email).first():
                flash("Es existiert bereits ein Benutzer mit dieser E-Mail. Bitte logge dich ein.", "warning")
                return redirect(url_for("login"))

            user = User(
                username=unique_member_username(email, verein.id),
                email=email,
                role="mitglied",
                verein_id=verein.id,
            )
            user.set_password(form.password.data)
            db.session.add(user)
            db.session.commit()
            session.pop("tmp_member_email", None)
            session.pop("tmp_member_verein_id", None)

            login_user(user)
            flash("Registrierung erfolgreich.", "success")
            return redirect(url_for("user_dashboard"))

        return render_template("register_member_Verein_set_password.html", form=form, email=email, verein_name=verein.name)

    return redirect(url_for("register_member_verein", step="choose"))


@app.route("/login_member_verein", methods=["GET", "POST"])
def login_member_verein():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        verein_name = request.form.get("verein", "").strip()
        password = request.form.get("password", "")

        verein = Verein.query.filter_by(name=verein_name).first()
        user = User.query.filter_by(email=email, verein_id=verein.id).first() if verein else None
        if not user or user.is_admin or not user.check_password(password):
            flash("Login fehlgeschlagen. Bitte pruefe Verein, E-Mail und Passwort.", "danger")
            return redirect(url_for("login_member_verein"))

        login_user(user)
        return redirect(url_for("user_dashboard"))

    return render_template("login_member_verein.html")


@app.route("/login", methods=["GET", "POST"])
def login():
    if current_user.is_authenticated:
        return redirect(url_for("index"))

    form = LoginForm()
    if form.validate_on_submit():
        user = User.query.filter_by(email=form.email.data.strip().lower()).first()
        if user and user.check_password(form.password.data):
            login_user(user)
            flash("Erfolgreich eingeloggt.", "success")
            return redirect(url_for(post_login_endpoint(user)))

        flash("Falsche E-Mail oder falsches Passwort.", "danger")
    return render_template("login.html", form=form)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    flash("Erfolgreich ausgeloggt.", "success")
    return redirect(url_for("login"))


@app.route("/setup", methods=["GET", "POST"])
@login_required
def setup():
    if not current_user.is_admin:
        return redirect(url_for("user_dashboard"))
    if not current_user.verein:
        flash("Kein Verein mit deinem Benutzerkonto verknuepft.", "danger")
        return redirect(url_for("register_user"))

    verein = current_user.verein
    if request.method == "POST":
        verein.name = request.form.get("verein_name", verein.name).strip() or verein.name
        logo_file = request.files.get("logo")
        if logo_file and logo_file.filename:
            if not logo_file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
                flash("Nur PNG- oder JPG-Dateien sind erlaubt.", "danger")
            else:
                ext = os.path.splitext(secure_filename(logo_file.filename))[1].lower()
                filename = f"logo_{verein.id}_{uuid.uuid4().hex}{ext}"
                logo_file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
                verein.logo_path = filename

        selected_features = request.form.getlist("features") or DEFAULT_FEATURES
        VereinFeature.query.filter_by(verein_id=verein.id).delete()
        for feature in selected_features:
            if feature in FEATURE_CHOICES:
                db.session.add(VereinFeature(verein_id=verein.id, feature=feature))
        db.session.commit()

        flash("Setup gespeichert.", "success")
        return redirect(url_for("index"))

    active = {feature.feature for feature in verein.features}
    features = [{"name": name, "checked": "checked" if name in active else ""} for name in FEATURE_CHOICES]
    return render_template("setup.html", verein=verein, features=features)


@app.route("/user_dashboard")
@login_required
def user_dashboard():
    mitglied = Mitglied.query.filter_by(email=current_user.email, verein_id=current_user.verein_id).first()
    if not mitglied:
        flash("Keine Mitgliedsdaten gefunden.", "warning")
        return redirect(url_for("logout"))
    return render_template("user_templates/user-dashboard.html", user=current_user, mitglied=mitglied)


@app.route("/")
@login_required
def index():
    if not current_user.is_admin:
        return redirect(url_for("user_dashboard"))
    if current_user.is_system_admin and not current_user.verein_id:
        return redirect(url_for("platform_admin_dashboard"))

    verein_id = current_verein_id()
    sum_einnahmen = (
        db.session.query(db.func.sum(Finanzbuchung.betrag))
        .filter(Finanzbuchung.verein_id == verein_id, Finanzbuchung.typ == "Einnahme")
        .scalar()
        or 0
    )
    sum_ausgaben = (
        db.session.query(db.func.sum(Finanzbuchung.betrag))
        .filter(Finanzbuchung.verein_id == verein_id, Finanzbuchung.typ == "Ausgabe")
        .scalar()
        or 0
    )
    mitglieder_aktiv = Mitglied.query.filter_by(verein_id=verein_id, status="aktiv").count()
    mitglieder_inaktiv = Mitglied.query.filter_by(verein_id=verein_id, status="inaktiv").count()
    events = Event.query.filter_by(verein_id=verein_id).all()
    events_monate = [0] * 12
    for event in events:
        if event.datum:
            events_monate[event.datum.month - 1] += 1

    saldo = round((current_user.anfangsbestand or 0) + sum_einnahmen - sum_ausgaben, 2)
    return render_template(
        "index.html",
        anzahl_mitglieder=Mitglied.query.filter_by(verein_id=verein_id).count(),
        anzahl_events=len(events),
        anzahl_notizen=Notiz.query.filter_by(verein_id=verein_id).count(),
        saldo=saldo,
        sum_einnahmen=round(sum_einnahmen, 2),
        sum_ausgaben=round(sum_ausgaben, 2),
        mitglieder_aktiv=mitglieder_aktiv,
        mitglieder_inaktiv=mitglieder_inaktiv,
        events_monate=[str(month) for month in range(1, 13)],
        events_anzahl=events_monate,
    )


@app.route("/mitglieder")
@admin_required
def mitglieder_liste():
    verein_id = current_verein_id()
    query = Mitglied.query.filter_by(verein_id=verein_id)
    search = request.args.get("search", "").strip()
    if search:
        like = f"%{search}%"
        query = query.filter(
            db.or_(
                Mitglied.vorname.ilike(like),
                Mitglied.nachname.ilike(like),
                Mitglied.email.ilike(like),
                Mitglied.plz.ilike(like),
                Mitglied.ort.ilike(like),
            )
        )
    return render_template("mitglieder.html", mitglieder=query.order_by(Mitglied.nachname, Mitglied.vorname).all(), form=ToggleBeitragForm())


@app.route("/mitglied/new", methods=["GET", "POST"])
@admin_required
def mitglied_new():
    form = MitgliedForm()
    if form.validate_on_submit():
        mitglied = Mitglied(
            verein_id=current_verein_id(),
            vorname=form.vorname.data.strip(),
            nachname=form.nachname.data.strip(),
            email=form.email.data.strip().lower(),
            eintrittsdatum=form.eintrittsdatum.data or date.today(),
            austritt_datum=form.austritt_datum.data if form.status.data == "inaktiv" else None,
            status=form.status.data,
            funktion=form.funktion.data,
            telefonnummer=form.telefonnummer.data,
            geburtstag=form.geburtstag.data,
            adresse=form.adresse.data,
            plz=form.plz.data,
            ort=form.ort.data,
            mitgliedsbeitrag=form.mitgliedsbeitrag.data or 0.0,
            beitrag_bezahlt=form.beitrag_bezahlt.data == "ja",
        )
        db.session.add(mitglied)
        try:
            db.session.flush()
            if mitglied.beitrag_bezahlt:
                create_member_fee_booking(mitglied)
            db.session.commit()
            flash("Mitglied erfolgreich erstellt.", "success")
            return redirect(url_for("mitglieder_liste"))
        except IntegrityError:
            db.session.rollback()
            flash("Diese E-Mail-Adresse ist in diesem Verein bereits vorhanden.", "danger")

    return render_template("mitglied_edit.html", form=form, titel="Neues Mitglied", mitglied=None)


@app.route("/mitglied/<int:mitglied_id>/edit", methods=["GET", "POST"])
@admin_required
def mitglied_edit(mitglied_id):
    mitglied = Mitglied.query.filter_by(id=mitglied_id, verein_id=current_verein_id()).first_or_404()
    form = MitgliedForm(obj=mitglied)
    if request.method == "GET":
        form.beitrag_bezahlt.data = "ja" if mitglied.beitrag_bezahlt else "nein"

    if form.validate_on_submit():
        vorheriger_status = mitglied.beitrag_bezahlt
        mitglied.vorname = form.vorname.data.strip()
        mitglied.nachname = form.nachname.data.strip()
        mitglied.email = form.email.data.strip().lower()
        mitglied.eintrittsdatum = form.eintrittsdatum.data
        mitglied.status = form.status.data
        mitglied.funktion = form.funktion.data
        mitglied.telefonnummer = form.telefonnummer.data
        mitglied.geburtstag = form.geburtstag.data
        mitglied.adresse = form.adresse.data
        mitglied.plz = form.plz.data
        mitglied.ort = form.ort.data
        mitglied.austritt_datum = form.austritt_datum.data if form.status.data == "inaktiv" else None
        mitglied.mitgliedsbeitrag = form.mitgliedsbeitrag.data or 0.0
        mitglied.beitrag_bezahlt = form.beitrag_bezahlt.data == "ja"

        try:
            if mitglied.beitrag_bezahlt and not vorheriger_status:
                create_member_fee_booking(mitglied)
            db.session.commit()
            flash("Mitglied erfolgreich bearbeitet.", "success")
            return redirect(url_for("mitglieder_liste"))
        except IntegrityError:
            db.session.rollback()
            flash("Diese E-Mail-Adresse ist in diesem Verein bereits vorhanden.", "danger")

    return render_template("mitglied_edit.html", form=form, titel="Mitglied bearbeiten", mitglied=mitglied)


@app.route("/mitglied/<int:mitglied_id>/delete", methods=["POST"])
@admin_required
def mitglied_delete(mitglied_id):
    mitglied = Mitglied.query.filter_by(id=mitglied_id, verein_id=current_verein_id()).first_or_404()
    db.session.delete(mitglied)
    db.session.commit()
    flash("Mitglied geloescht.", "success")
    return redirect(url_for("mitglieder_liste"))


@app.route("/mitglieder/import", methods=["POST"])
@admin_required
def mitglieder_import():
    file = request.files.get("file")
    if not file or not file.filename:
        flash("Keine Datei ausgewaehlt.", "danger")
        return redirect(url_for("mitglieder_liste"))
    if not file.filename.lower().endswith(".csv"):
        flash("Bitte eine CSV-Datei hochladen.", "danger")
        return redirect(url_for("mitglieder_liste"))

    try:
        stream = io.StringIO(file.stream.read().decode("utf-8-sig"), newline=None)
        csv_reader = csv.DictReader(stream)
    except UnicodeDecodeError:
        flash("Die CSV-Datei muss im UTF-8-Format vorliegen.", "danger")
        return redirect(url_for("mitglieder_liste"))

    required = {"Vorname", "Nachname", "Email"}
    if not required.issubset(csv_reader.fieldnames or []):
        flash(f"Die CSV-Datei muss folgende Spalten enthalten: {', '.join(sorted(required))}.", "danger")
        return redirect(url_for("mitglieder_liste"))

    imported = 0
    skipped = 0
    verein_id = current_verein_id()
    for row in csv_reader:
        email = row.get("Email", "").strip().lower()
        if not email or Mitglied.query.filter_by(verein_id=verein_id, email=email).first():
            skipped += 1
            continue

        mitglied = Mitglied(
            verein_id=verein_id,
            vorname=row.get("Vorname", "").strip(),
            nachname=row.get("Nachname", "").strip(),
            email=email,
            eintrittsdatum=safe_date(row.get("Eintrittsdatum"), date.today()),
            geburtstag=safe_date(row.get("Geburtstag")),
            status=row.get("Status", "aktiv").strip() or "aktiv",
            funktion=row.get("Funktion", "normal").strip() or "normal",
            telefonnummer=row.get("Telefonnummer", "").strip(),
            adresse=row.get("Adresse", "").strip(),
            plz=row.get("PLZ", "").strip(),
            ort=row.get("Ort", "").strip(),
            mitgliedsbeitrag=safe_float(row.get("Mitgliedsbeitrag"), 0.0),
            beitrag_bezahlt=row.get("Beitrag_Bezahlt", "").strip().lower() in {"true", "ja", "1", "x"},
        )
        db.session.add(mitglied)
        db.session.flush()
        if mitglied.beitrag_bezahlt:
            create_member_fee_booking(mitglied)
        imported += 1

    db.session.commit()
    flash(f"{imported} Mitglieder importiert, {skipped} uebersprungen.", "success")
    return redirect(url_for("mitglieder_liste"))


@app.route("/mitglied/<int:mitglied_id>/update_beitrag", methods=["POST"])
@admin_required
def mitglied_update_beitrag(mitglied_id):
    mitglied = Mitglied.query.filter_by(id=mitglied_id, verein_id=current_verein_id()).first_or_404()
    if mitglied.beitrag_bezahlt:
        mitglied.beitrag_bezahlt = False
        create_member_fee_booking(
            mitglied,
            typ="Ausgabe",
            kategorie="Mitgliedsbeitrag Storno",
            beschreibung=f"Rueckerstattung Mitgliedsbeitrag von {mitglied.vorname} {mitglied.nachname}",
        )
        flash("Mitgliedsbeitrag zurueckgesetzt.", "warning")
    else:
        mitglied.beitrag_bezahlt = True
        create_member_fee_booking(mitglied)
        flash("Mitgliedsbeitrag als bezahlt markiert.", "success")
    db.session.commit()
    return redirect(url_for("mitglieder_liste"))


@app.route("/mitglied/<int:mitglied_id>")
@admin_required
def mitglied_detail(mitglied_id):
    mitglied = Mitglied.query.filter_by(id=mitglied_id, verein_id=current_verein_id()).first_or_404()
    alter = None
    if mitglied.geburtstag:
        today = date.today()
        alter = today.year - mitglied.geburtstag.year - ((today.month, today.day) < (mitglied.geburtstag.month, mitglied.geburtstag.day))
    return render_template("mitglied_detail.html", mitglied=mitglied, alter=alter, zahlungen=mitglied.finanzbuchungen)


@app.route("/mitglied/<int:mitglied_id>/zahlung_hinzufuegen", methods=["POST"])
@admin_required
def zahlung_hinzufuegen(mitglied_id):
    mitglied = Mitglied.query.filter_by(id=mitglied_id, verein_id=current_verein_id()).first_or_404()
    try:
        zahlung_erstellen(mitglied.id, "Einnahme", "Mitgliedsbeitrag", mitglied.mitgliedsbeitrag or 0.0, f"Mitgliedsbeitrag von {mitglied.vorname} {mitglied.nachname}")
        flash("Zahlung hinzugefuegt.", "success")
    except ValueError as exc:
        flash(str(exc), "danger")
    return redirect(url_for("mitglied_detail", mitglied_id=mitglied.id))


@app.route("/mitglied/<int:mitglied_id>/send_message", methods=["GET", "POST"])
@admin_required
def send_message_member(mitglied_id):
    mitglied = Mitglied.query.filter_by(id=mitglied_id, verein_id=current_verein_id()).first_or_404()
    vorlagen = Nachrichtenvorlage.query.filter_by(verein_id=current_verein_id()).all()
    vorlagen_json = json.dumps([{"id": v.id, "betreff": v.betreff, "inhalt": v.inhalt} for v in vorlagen])
    form = SendMessageForm()
    if form.validate_on_submit():
        try:
            send_brevo_email(form.subject.data, form.body.data, [mitglied.email])
            flash("Nachricht gesendet.", "success")
        except RuntimeError as exc:
            flash(str(exc), "danger")
        return redirect(url_for("mitglied_detail", mitglied_id=mitglied.id))
    return render_template("send_email_member.html", mitglied=mitglied, vorlagen=vorlagen, vorlagen_json=vorlagen_json, form=form)


@app.route("/events")
@admin_required
def events_liste():
    events = Event.query.filter_by(verein_id=current_verein_id()).order_by(Event.datum.desc()).all()
    return render_template("events.html", events=events, form=DeleteEventForm())


@app.route("/event/new", methods=["GET", "POST"])
@admin_required
def event_new():
    form = EventForm()
    if form.validate_on_submit():
        event = Event(
            verein_id=current_verein_id(),
            titel=form.titel.data.strip(),
            beschreibung=form.beschreibung.data,
            datum=form.datum.data,
            ort=form.ort.data,
            preis=form.preis.data,
        )
        db.session.add(event)
        db.session.flush()
        if event.preis and event.preis > 0:
            db.session.add(
                Finanzbuchung(
                    verein_id=current_verein_id(),
                    typ="Ausgabe",
                    kategorie="Eventkosten",
                    betrag=event.preis,
                    datum=event.datum,
                    beschreibung=f"Kosten fuer Event: {event.titel}",
                )
            )
        try:
            add_event_to_google_calendar(event, current_user)
        except Exception as exc:
            flash(f"Kalendersynchronisierung fehlgeschlagen: {exc}", "warning")
        db.session.commit()
        flash("Event erstellt.", "success")
        return redirect(url_for("events_liste"))
    return render_template("event_edit.html", form=form, titel="Neues Event")


@app.route("/event/<int:event_id>/edit", methods=["GET", "POST"])
@admin_required
def event_edit(event_id):
    event = Event.query.filter_by(id=event_id, verein_id=current_verein_id()).first_or_404()
    form = EventForm(obj=event)
    if form.validate_on_submit():
        old_title = event.titel
        event.titel = form.titel.data.strip()
        event.beschreibung = form.beschreibung.data
        event.datum = form.datum.data
        event.ort = form.ort.data
        event.preis = form.preis.data

        buchung = Finanzbuchung.query.filter(
            Finanzbuchung.verein_id == current_verein_id(),
            Finanzbuchung.kategorie == "Eventkosten",
            Finanzbuchung.beschreibung == f"Kosten fuer Event: {old_title}",
        ).first()
        if event.preis and event.preis > 0:
            if not buchung:
                buchung = Finanzbuchung(verein_id=current_verein_id(), typ="Ausgabe", kategorie="Eventkosten")
                db.session.add(buchung)
            buchung.betrag = event.preis
            buchung.datum = event.datum
            buchung.beschreibung = f"Kosten fuer Event: {event.titel}"
        elif buchung:
            db.session.delete(buchung)

        db.session.commit()
        flash("Event aktualisiert.", "success")
        return redirect(url_for("events_liste"))
    return render_template("event_edit.html", form=form, titel="Event bearbeiten")


@app.route("/event/<int:event_id>/delete", methods=["POST"])
@admin_required
def event_delete(event_id):
    event = Event.query.filter_by(id=event_id, verein_id=current_verein_id()).first_or_404()
    db.session.delete(event)
    db.session.commit()
    flash("Event geloescht.", "success")
    return redirect(url_for("events_liste"))


@app.route("/event/<int:event_id>/send_email", methods=["GET", "POST"])
@admin_required
def send_email_event(event_id):
    event = Event.query.filter_by(id=event_id, verein_id=current_verein_id()).first_or_404()
    mitglieder = Mitglied.query.filter_by(verein_id=current_verein_id(), status="aktiv").order_by(Mitglied.nachname).all()
    form = SendMessageForm()
    if form.validate_on_submit():
        selected = request.form.getlist("member_ids")
        recipients = [m.email for m in mitglieder if "all" in selected or str(m.id) in selected]
        if not recipients:
            flash("Keine Mitglieder ausgewaehlt.", "danger")
            return redirect(url_for("send_email_event", event_id=event.id))
        try:
            send_brevo_email(form.subject.data, form.body.data, recipients)
            flash("E-Mails gesendet.", "success")
        except RuntimeError as exc:
            flash(str(exc), "danger")
        return redirect(url_for("events_liste"))
    return render_template("send_email_event.html", event=event, mitglieder=mitglieder, form=form)


@app.route("/finanzen")
@admin_required
def finanzen_liste():
    verein_id = current_verein_id()
    buchungen = Finanzbuchung.query.filter_by(verein_id=verein_id).order_by(Finanzbuchung.datum.desc(), Finanzbuchung.id.desc()).all()
    einnahmen = sum(b.betrag for b in buchungen if b.typ == "Einnahme")
    ausgaben = sum(b.betrag for b in buchungen if b.typ == "Ausgabe")
    saldo = (current_user.anfangsbestand or 0.0) + einnahmen - ausgaben
    return render_template("finanzen.html", buchungen=buchungen, saldo=round(saldo, 2), current_year=datetime.now().year, form=DeleteFinanzForm())


@app.route("/finanzen/export")
@admin_required
def finanzen_export():
    buchungen = Finanzbuchung.query.filter_by(verein_id=current_verein_id()).order_by(Finanzbuchung.datum).all()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Typ", "Kategorie", "Betrag", "Datum", "Beschreibung"])
    for b in buchungen:
        writer.writerow([b.id, b.typ, b.kategorie, b.betrag, b.datum, b.beschreibung])

    response = make_response(output.getvalue())
    response.headers["Content-Disposition"] = "attachment; filename=finanzen.csv"
    response.headers["Content-Type"] = "text/csv; charset=utf-8"
    return response


@app.route("/finanzen/new", methods=["GET", "POST"])
@admin_required
def finanzen_new():
    form = FinanzForm()
    if form.validate_on_submit():
        buchung = Finanzbuchung(
            verein_id=current_verein_id(),
            typ=form.typ.data,
            kategorie=form.kategorie.data.strip(),
            betrag=form.betrag.data,
            datum=form.datum.data or date.today(),
            beschreibung=form.beschreibung.data,
        )
        db.session.add(buchung)
        db.session.commit()
        flash("Buchung hinzugefuegt.", "success")
        return redirect(url_for("finanzen_liste"))
    return render_template("finanzen_edit.html", form=form, titel="Neue Buchung")


@app.route("/finanzen/<int:buchung_id>/edit", methods=["GET", "POST"])
@admin_required
def finanzen_edit(buchung_id):
    buchung = Finanzbuchung.query.filter_by(id=buchung_id, verein_id=current_verein_id()).first_or_404()
    form = FinanzForm(obj=buchung)
    if form.validate_on_submit():
        buchung.typ = form.typ.data
        buchung.kategorie = form.kategorie.data.strip()
        buchung.betrag = form.betrag.data
        buchung.datum = form.datum.data or date.today()
        buchung.beschreibung = form.beschreibung.data
        db.session.commit()
        flash("Buchung aktualisiert.", "success")
        return redirect(url_for("finanzen_liste"))
    return render_template("finanzen_edit.html", form=form, titel="Buchung bearbeiten")


@app.route("/finanzen/<int:buchung_id>/delete", methods=["POST"])
@admin_required
def finanzen_delete(buchung_id):
    buchung = Finanzbuchung.query.filter_by(id=buchung_id, verein_id=current_verein_id()).first_or_404()
    db.session.delete(buchung)
    db.session.commit()
    flash("Buchung geloescht.", "success")
    return redirect(url_for("finanzen_liste"))


def finance_rows_for_current_verein():
    return Finanzbuchung.query.filter_by(verein_id=current_verein_id()).order_by(Finanzbuchung.datum.asc()).all()


@app.route("/finanzen/jahresabschluss/<int:jahr>/download")
@admin_required
def jahresabschluss_pdf(jahr):
    buchungen = [
        b for b in finance_rows_for_current_verein()
        if b.datum and b.datum.year == jahr
    ]
    einnahmen = sum(b.betrag for b in buchungen if b.typ == "Einnahme")
    ausgaben = sum(b.betrag for b in buchungen if b.typ == "Ausgabe")
    saldo = (current_user.anfangsbestand or 0) + einnahmen - ausgaben

    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(190, 10, f"Jahresabschluss {jahr}", ln=True, align="C")
    pdf.ln(8)
    pdf.cell(190, 8, f"Einnahmen: {einnahmen:.2f} EUR", ln=True)
    pdf.cell(190, 8, f"Ausgaben: {ausgaben:.2f} EUR", ln=True)
    pdf.cell(190, 8, f"Saldo: {saldo:.2f} EUR", ln=True)
    pdf.ln(8)
    pdf.set_font("Arial", size=9)
    for b in buchungen:
        pdf.cell(30, 8, b.datum.strftime("%d.%m.%Y"), border=1)
        pdf.cell(25, 8, b.typ, border=1)
        pdf.cell(55, 8, b.kategorie, border=1)
        pdf.cell(30, 8, f"{b.betrag:.2f}", border=1)
        pdf.cell(50, 8, (b.beschreibung or "")[:32], border=1)
        pdf.ln(8)
    return pdf_response(pdf, f"jahresabschluss_{jahr}.pdf")


@app.route("/finanzen/summenliste/pdf")
@admin_required
def summenliste_pdf():
    kategorien = (
        db.session.query(Finanzbuchung.kategorie, Finanzbuchung.typ, db.func.sum(Finanzbuchung.betrag).label("summe"))
        .filter(Finanzbuchung.verein_id == current_verein_id())
        .group_by(Finanzbuchung.kategorie, Finanzbuchung.typ)
        .all()
    )
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(190, 10, "Summenliste - Finanzen", ln=True, align="C")
    pdf.ln(8)
    pdf.set_font("Arial", size=10)
    for kategorie, typ, summe in kategorien:
        pdf.cell(90, 8, kategorie, border=1)
        pdf.cell(40, 8, typ, border=1)
        pdf.cell(40, 8, f"{summe:.2f}", border=1)
        pdf.ln(8)
    return pdf_response(pdf, "summenliste.pdf")


@app.route("/finanzen/journal/pdf")
@admin_required
def buchungsjournal_pdf():
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(190, 10, "Buchungsjournal", ln=True, align="C")
    pdf.ln(8)
    pdf.set_font("Arial", size=9)
    for b in finance_rows_for_current_verein():
        pdf.cell(28, 8, b.datum.strftime("%d.%m.%Y"), border=1)
        pdf.cell(25, 8, b.typ, border=1)
        pdf.cell(50, 8, b.kategorie, border=1)
        pdf.cell(25, 8, f"{b.betrag:.2f}", border=1)
        pdf.cell(62, 8, (b.beschreibung or "")[:42], border=1)
        pdf.ln(8)
    return pdf_response(pdf, "buchungsjournal.pdf")


@app.route("/finanzen/jahressaldo/pdf")
@admin_required
def jahressaldo_pdf():
    salden = (
        db.session.query(
            extract("year", Finanzbuchung.datum).label("jahr"),
            db.func.sum(case((Finanzbuchung.typ == "Einnahme", Finanzbuchung.betrag), else_=0)).label("einnahmen"),
            db.func.sum(case((Finanzbuchung.typ == "Ausgabe", Finanzbuchung.betrag), else_=0)).label("ausgaben"),
        )
        .filter(Finanzbuchung.verein_id == current_verein_id())
        .group_by(extract("year", Finanzbuchung.datum))
        .order_by(extract("year", Finanzbuchung.datum))
        .all()
    )
    pdf = FPDF()
    pdf.add_page()
    pdf.set_font("Arial", size=12)
    pdf.cell(190, 10, "Jahressaldo", ln=True, align="C")
    pdf.ln(8)
    pdf.set_font("Arial", size=10)
    for jahr, einnahmen, ausgaben in salden:
        anfang = current_user.anfangsbestand or 0.0
        endbestand = anfang + (einnahmen or 0) - (ausgaben or 0)
        pdf.cell(30, 8, str(int(jahr)), border=1)
        pdf.cell(45, 8, f"Start {anfang:.2f}", border=1)
        pdf.cell(45, 8, f"Ein {einnahmen:.2f}", border=1)
        pdf.cell(45, 8, f"Aus {ausgaben:.2f}", border=1)
        pdf.cell(25, 8, f"{endbestand:.2f}", border=1)
        pdf.ln(8)
    return pdf_response(pdf, "jahressaldo.pdf")


@app.route("/finanzen/kategorie/pdf")
@admin_required
def finanzen_kategorie_pdf():
    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=15)
    kategorien = (
        db.session.query(Finanzbuchung.kategorie)
        .filter(Finanzbuchung.verein_id == current_verein_id())
        .distinct()
        .order_by(Finanzbuchung.kategorie)
        .all()
    )
    for (kategorie,) in kategorien:
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.cell(190, 10, f"Kategorie: {kategorie}", ln=True, align="C")
        pdf.ln(8)
        pdf.set_font("Arial", size=9)
        for b in Finanzbuchung.query.filter_by(verein_id=current_verein_id(), kategorie=kategorie).order_by(Finanzbuchung.datum).all():
            pdf.cell(30, 8, b.datum.strftime("%d.%m.%Y"), border=1)
            pdf.cell(25, 8, b.typ, border=1)
            pdf.cell(25, 8, f"{b.betrag:.2f}", border=1)
            pdf.cell(110, 8, (b.beschreibung or "")[:75], border=1)
            pdf.ln(8)
    if not kategorien:
        pdf.add_page()
        pdf.set_font("Arial", size=12)
        pdf.cell(190, 10, "Keine Buchungen vorhanden", ln=True, align="C")
    return pdf_response(pdf, "finanzen_kategorien.pdf")


@app.route("/notizen")
@admin_required
def notizen_liste():
    notizen = Notiz.query.filter_by(verein_id=current_verein_id()).order_by(Notiz.id.desc()).all()
    return render_template("notizen.html", notizen=notizen, form=DeleteNotizForm())


@app.route("/notiz/new", methods=["GET", "POST"])
@admin_required
def notiz_new():
    form = NotizForm()
    if form.validate_on_submit():
        db.session.add(Notiz(verein_id=current_verein_id(), titel=form.titel.data.strip(), inhalt=form.inhalt.data))
        db.session.commit()
        flash("Notiz erstellt.", "success")
        return redirect(url_for("notizen_liste"))
    return render_template("notiz_edit.html", form=form, titel="Neue Notiz")


@app.route("/notiz/<int:notiz_id>/edit", methods=["GET", "POST"])
@admin_required
def notiz_edit(notiz_id):
    notiz = Notiz.query.filter_by(id=notiz_id, verein_id=current_verein_id()).first_or_404()
    form = NotizForm(obj=notiz)
    if form.validate_on_submit():
        notiz.titel = form.titel.data.strip()
        notiz.inhalt = form.inhalt.data
        db.session.commit()
        flash("Notiz aktualisiert.", "success")
        return redirect(url_for("notizen_liste"))
    return render_template("notiz_edit.html", form=form, titel="Notiz bearbeiten")


@app.route("/notiz/<int:notiz_id>/delete", methods=["POST"])
@admin_required
def notiz_delete(notiz_id):
    notiz = Notiz.query.filter_by(id=notiz_id, verein_id=current_verein_id()).first_or_404()
    db.session.delete(notiz)
    db.session.commit()
    flash("Notiz geloescht.", "success")
    return redirect(url_for("notizen_liste"))


@app.route("/jahresabschluss/<int:jahr>")
@admin_required
def jahresabschluss(jahr):
    buchungen = [b for b in finance_rows_for_current_verein() if b.datum and b.datum.year == jahr]
    einnahmen = sum(b.betrag for b in buchungen if b.typ == "Einnahme")
    ausgaben = sum(b.betrag for b in buchungen if b.typ == "Ausgabe")
    mitgliedsbeitraege_summe = sum(b.betrag for b in buchungen if b.kategorie == "Mitgliedsbeitrag")
    saldo = (current_user.anfangsbestand or 0.0) + einnahmen - ausgaben
    return render_template(
        "jahresabschluss.html",
        jahr=jahr,
        buchungen=buchungen,
        mitgliedsbeitraege_summe=mitgliedsbeitraege_summe,
        einnahmen=einnahmen,
        ausgaben=ausgaben,
        saldo=saldo,
    )


@app.route("/documents")
@admin_required
def documents_list():
    documents = Document.query.filter_by(verein_id=current_verein_id()).order_by(Document.uploaded_at.desc()).all()
    return render_template("documents.html", documents=documents, form=DeleteDocumentForm())


@app.route("/documents/new", methods=["GET", "POST"])
@admin_required
def documents_new():
    form = DocumentForm()
    if form.validate_on_submit():
        uploaded = form.file.data
        original_filename = secure_filename(uploaded.filename)
        ext = os.path.splitext(original_filename)[1]
        unique_name = f"{uuid.uuid4().hex}{ext}"
        uploaded.save(os.path.join(app.config["UPLOAD_FOLDER"], unique_name))
        db.session.add(
            Document(
                verein_id=current_verein_id(),
                user_id=current_user.id,
                filename=unique_name,
                original_filename=original_filename,
                description=form.description.data,
            )
        )
        db.session.commit()
        flash("Dokument hochgeladen.", "success")
        return redirect(url_for("documents_list"))
    return render_template("documents_new.html", form=form)


@app.route("/documents/<int:doc_id>/download")
@admin_required
def documents_download(doc_id):
    document = Document.query.filter_by(id=doc_id, verein_id=current_verein_id()).first_or_404()
    path = os.path.join(app.config["UPLOAD_FOLDER"], document.filename)
    if not os.path.isfile(path):
        flash("Die Datei wurde nicht gefunden.", "danger")
        return redirect(url_for("documents_list"))
    return send_file(path, as_attachment=True, download_name=document.original_filename)


@app.route("/documents/<int:doc_id>/delete", methods=["POST"])
@admin_required
def documents_delete(doc_id):
    document = Document.query.filter_by(id=doc_id, verein_id=current_verein_id()).first_or_404()
    path = os.path.join(app.config["UPLOAD_FOLDER"], document.filename)
    if os.path.exists(path):
        os.remove(path)
    db.session.delete(document)
    db.session.commit()
    flash("Dokument geloescht.", "success")
    return redirect(url_for("documents_list"))


@app.route("/einstellungen", methods=["GET", "POST"])
@admin_required
def einstellungen():
    form = UpdateKontoForm()
    if request.method == "GET":
        form.konto_nummer.data = current_user.konto_nummer

    if request.method == "POST":
        current_user.theme = request.form.get("theme", "light")
        current_user.email_notifikationen = request.form.get("email_notifikationen") == "an"
        db.session.commit()
        flash("Einstellungen gespeichert.", "success")
        return redirect(url_for("einstellungen"))

    logo_url = url_for("uploaded_file", filename=current_user.verein.logo_path) if current_user.verein and current_user.verein.logo_path else None
    return render_template(
        "einstellungen.html",
        titel="Einstellungen",
        theme=current_user.theme or "light",
        calendar_enabled=current_user.calendar_integration or "disabled",
        calendar_api_key=current_user.calendar_api_key or "",
        logo_url=logo_url,
        form=form,
    )


@app.route("/einstellungen/logo", methods=["POST"])
@admin_required
def logo_upload():
    file = request.files.get("logo")
    if not file or not file.filename:
        flash("Keine Datei ausgewaehlt.", "danger")
        return redirect(url_for("einstellungen"))
    if not file.filename.lower().endswith((".png", ".jpg", ".jpeg")):
        flash("Ungueltiges Dateiformat.", "danger")
        return redirect(url_for("einstellungen"))

    ext = os.path.splitext(secure_filename(file.filename))[1].lower()
    filename = f"logo_{current_verein_id()}_{uuid.uuid4().hex}{ext}"
    file.save(os.path.join(app.config["UPLOAD_FOLDER"], filename))
    current_user.verein.logo_path = filename
    db.session.commit()
    flash("Vereinslogo aktualisiert.", "success")
    return redirect(url_for("einstellungen"))


@app.route("/update_calendar_settings", methods=["POST"])
@admin_required
def update_calendar_settings():
    current_user.calendar_integration = request.form.get("calendar_integration", "disabled")
    current_user.calendar_api_key = request.form.get("calendar_api_key", "").strip() or None
    db.session.commit()
    flash("Kalendereinstellungen gespeichert.", "success")
    return redirect(url_for("einstellungen"))


@app.route("/update_konto_settings", methods=["POST"])
@admin_required
def update_konto_settings():
    current_user.konto_nummer = request.form.get("konto_nummer", "").strip() or None
    db.session.commit()
    flash("Kontonummer gespeichert.", "success")
    return redirect(url_for("einstellungen"))


@app.route("/update_konto_details", methods=["POST"])
@admin_required
def update_konto_details():
    current_user.konto_bezeichnung = request.form.get("konto_bezeichnung", "").strip() or None
    current_user.anfangsbestand = safe_float(request.form.get("anfangsbestand"), 0.0)
    db.session.commit()
    flash("Kontoeinstellungen gespeichert.", "success")
    return redirect(url_for("einstellungen"))


@app.route("/about")
def about():
    return render_template("about.html")


@app.route("/feedback", methods=["GET", "POST"])
def send_feedback():
    form = FeedbackForm()
    if form.validate_on_submit():
        try:
            send_brevo_email(
                f"Feedback von {form.name.data}",
                f"<h3>Neues Feedback</h3><p><strong>Name:</strong> {form.name.data}</p><p><strong>E-Mail:</strong> {form.email.data}</p><p>{form.message.data}</p>",
                ["feedback@memberworks.at"],
            )
            flash("Vielen Dank fuer Ihr Feedback.", "success")
        except RuntimeError as exc:
            flash(str(exc), "danger")
        return redirect(url_for("send_feedback"))
    return render_template("feedback.html", form=form)


@app.route("/send_email", methods=["GET", "POST"])
@admin_required
def send_email():
    mitglieder = Mitglied.query.filter_by(verein_id=current_verein_id(), status="aktiv").order_by(Mitglied.nachname).all()
    vorlagen = Nachrichtenvorlage.query.filter_by(verein_id=current_verein_id()).order_by(Nachrichtenvorlage.titel).all()
    vorlagen_json = json.dumps([{"id": v.id, "betreff": v.betreff, "inhalt": v.inhalt} for v in vorlagen])
    form = SendMessageForm()
    if form.validate_on_submit():
        selected = request.form.getlist("member_ids")
        recipients = [m.email for m in mitglieder if "all" in selected or str(m.id) in selected]
        if not recipients:
            flash("Keine Mitglieder ausgewaehlt.", "danger")
            return redirect(url_for("send_email"))
        try:
            send_brevo_email(form.subject.data, form.body.data, recipients)
            flash("E-Mails gesendet.", "success")
        except RuntimeError as exc:
            flash(str(exc), "danger")
        return redirect(url_for("send_email"))
    return render_template("send_email.html", mitglieder=mitglieder, vorlagen=vorlagen, vorlagen_json=vorlagen_json, form=form)


def populate_license_form_choices(form):
    form.verein_id.choices = [(0, "Nicht zugeordnet")]
    form.verein_id.choices.extend((verein.id, verein.name) for verein in Verein.query.order_by(Verein.name).all())


def build_license_usage_rows():
    rows = []
    licenses = License.query.order_by(License.created_at.desc()).all()
    for license_obj in licenses:
        verein_id = license_obj.verein_id
        usage_count = LicenseUsageEvent.query.filter_by(license_id=license_obj.id).count()
        last_event = (
            LicenseUsageEvent.query.filter_by(license_id=license_obj.id)
            .order_by(LicenseUsageEvent.occurred_at.desc())
            .first()
        )
        rows.append(
            {
                "license": license_obj,
                "usage_count": usage_count,
                "last_used": last_event.occurred_at if last_event else None,
                "users_count": User.query.filter_by(verein_id=verein_id).count() if verein_id else 0,
                "members_count": Mitglied.query.filter_by(verein_id=verein_id).count() if verein_id else 0,
                "events_count": Event.query.filter_by(verein_id=verein_id).count() if verein_id else 0,
                "documents_count": Document.query.filter_by(verein_id=verein_id).count() if verein_id else 0,
                "bookings_count": Finanzbuchung.query.filter_by(verein_id=verein_id).count() if verein_id else 0,
            }
        )
    return rows


@app.route("/platform-admin")
@platform_admin_required
def platform_admin_dashboard():
    rows = build_license_usage_rows()
    totals = {
        "licenses": len(rows),
        "active": sum(1 for row in rows if row["license"].is_active),
        "assigned": sum(1 for row in rows if row["license"].verein_id),
        "usage_events": sum(row["usage_count"] for row in rows),
        "admins": User.query.filter(User.role.in_(["admin", "system_admin"])).count(),
    }
    return render_template("platform_admin.html", rows=rows, totals=totals, form=DeleteLicenseForm())


@app.route("/platform-admin/admins/new", methods=["GET", "POST"])
@platform_admin_required
def platform_admin_user_new():
    form = PlatformAdminUserForm()
    if form.validate_on_submit():
        verein_name = form.verein_name.data.strip()
        username = form.username.data.strip()
        email = form.email.data.strip().lower()

        if User.query.filter((User.email == email) | (User.username == username)).first():
            flash("Dieser Benutzername oder diese E-Mail-Adresse ist bereits vergeben.", "danger")
            return redirect(url_for("platform_admin_user_new"))
        if Verein.query.filter_by(name=verein_name).first():
            flash("Ein Verein mit diesem Namen existiert bereits.", "danger")
            return redirect(url_for("platform_admin_user_new"))

        try:
            create_verein_admin(verein_name, username, email, form.password.data, role="admin")
            db.session.commit()
            flash("Vereins-Admin wurde erstellt.", "success")
            return redirect(url_for("platform_admin_dashboard"))
        except IntegrityError:
            db.session.rollback()
            flash("Der Vereins-Admin konnte nicht erstellt werden.", "danger")

    return render_template("platform_admin_user_new.html", form=form)


@app.route("/platform-admin/licenses/new", methods=["GET", "POST"])
@platform_admin_required
def license_new():
    form = LicenseForm()
    populate_license_form_choices(form)
    if form.validate_on_submit():
        license_obj = License(
            license_key=(form.license_key.data or generate_license_key()).strip(),
            name=form.name.data.strip(),
            verein_id=form.verein_id.data or None,
            status=form.status.data,
            max_users=form.max_users.data,
            max_members=form.max_members.data,
            valid_from=form.valid_from.data,
            valid_until=form.valid_until.data,
            notes=form.notes.data,
        )
        db.session.add(license_obj)
        try:
            db.session.commit()
            flash("Lizenz erstellt.", "success")
            return redirect(url_for("platform_admin_dashboard"))
        except IntegrityError:
            db.session.rollback()
            flash("Dieser Lizenzschluessel existiert bereits.", "danger")
    return render_template("license_edit.html", form=form, license_obj=None, titel="Neue Lizenz")


@app.route("/platform-admin/licenses/<int:license_id>/edit", methods=["GET", "POST"])
@platform_admin_required
def license_edit(license_id):
    license_obj = License.query.get_or_404(license_id)
    form = LicenseForm(obj=license_obj)
    populate_license_form_choices(form)
    if request.method == "GET":
        form.verein_id.data = license_obj.verein_id or 0

    if form.validate_on_submit():
        license_obj.license_key = (form.license_key.data or license_obj.license_key).strip()
        license_obj.name = form.name.data.strip()
        license_obj.verein_id = form.verein_id.data or None
        license_obj.status = form.status.data
        license_obj.max_users = form.max_users.data
        license_obj.max_members = form.max_members.data
        license_obj.valid_from = form.valid_from.data
        license_obj.valid_until = form.valid_until.data
        license_obj.notes = form.notes.data
        try:
            db.session.commit()
            flash("Lizenz aktualisiert.", "success")
            return redirect(url_for("platform_admin_dashboard"))
        except IntegrityError:
            db.session.rollback()
            flash("Dieser Lizenzschluessel existiert bereits.", "danger")
    return render_template("license_edit.html", form=form, license_obj=license_obj, titel="Lizenz bearbeiten")


@app.route("/platform-admin/licenses/<int:license_id>/delete", methods=["POST"])
@platform_admin_required
def license_delete(license_id):
    license_obj = License.query.get_or_404(license_id)
    db.session.delete(license_obj)
    db.session.commit()
    flash("Lizenz geloescht.", "success")
    return redirect(url_for("platform_admin_dashboard"))


@app.route("/platform-admin/licenses/<int:license_id>/usage")
@platform_admin_required
def license_usage(license_id):
    license_obj = License.query.get_or_404(license_id)
    events = (
        LicenseUsageEvent.query.filter_by(license_id=license_obj.id)
        .order_by(LicenseUsageEvent.occurred_at.desc())
        .limit(200)
        .all()
    )
    by_type = (
        db.session.query(LicenseUsageEvent.event_type, db.func.count(LicenseUsageEvent.id))
        .filter(LicenseUsageEvent.license_id == license_obj.id)
        .group_by(LicenseUsageEvent.event_type)
        .order_by(db.func.count(LicenseUsageEvent.id).desc())
        .all()
    )
    return render_template("license_usage.html", license_obj=license_obj, events=events, by_type=by_type)


@app.route("/templates")
@admin_required
def templates_list():
    templates = Nachrichtenvorlage.query.filter_by(verein_id=current_verein_id()).order_by(Nachrichtenvorlage.titel).all()
    return render_template("templates_list.html", templates=templates, form=DeleteTemplateForm())


@app.route("/templates/new", methods=["GET", "POST"])
@admin_required
def templates_new():
    if request.method == "POST":
        db.session.add(
            Nachrichtenvorlage(
                verein_id=current_verein_id(),
                titel=request.form["titel"].strip(),
                betreff=request.form["betreff"].strip(),
                inhalt=request.form["inhalt"],
            )
        )
        db.session.commit()
        flash("Nachrichtenvorlage erstellt.", "success")
        return redirect(url_for("templates_list"))
    return render_template("templates_edit.html", titel="Neue Vorlage", vorlage=None)


@app.route("/templates/<int:template_id>/edit", methods=["GET", "POST"])
@admin_required
def templates_edit(template_id):
    vorlage = Nachrichtenvorlage.query.filter_by(id=template_id, verein_id=current_verein_id()).first_or_404()
    if request.method == "POST":
        vorlage.titel = request.form["titel"].strip()
        vorlage.betreff = request.form["betreff"].strip()
        vorlage.inhalt = request.form["inhalt"]
        db.session.commit()
        flash("Nachrichtenvorlage aktualisiert.", "success")
        return redirect(url_for("templates_list"))
    return render_template("templates_edit.html", vorlage=vorlage, titel="Vorlage bearbeiten")


@app.route("/templates/<int:template_id>/delete", methods=["POST"])
@admin_required
def templates_delete(template_id):
    vorlage = Nachrichtenvorlage.query.filter_by(id=template_id, verein_id=current_verein_id()).first_or_404()
    db.session.delete(vorlage)
    db.session.commit()
    flash("Nachrichtenvorlage geloescht.", "success")
    return redirect(url_for("templates_list"))


def init_database():
    with app.app_context():
        db.create_all()
        bootstrap_default_admin()


init_database()


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG", "false").lower() == "true")
