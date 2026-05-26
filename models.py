from datetime import datetime

from flask_login import UserMixin
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import UniqueConstraint
from werkzeug.security import check_password_hash, generate_password_hash


db = SQLAlchemy()


class Verein(db.Model):
    __tablename__ = "verein"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    logo_path = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    users = db.relationship("User", back_populates="verein", lazy=True)
    features = db.relationship(
        "VereinFeature",
        back_populates="verein",
        cascade="all, delete-orphan",
        lazy=True,
    )
    mitglieder = db.relationship("Mitglied", back_populates="verein", lazy=True)
    events = db.relationship("Event", back_populates="verein", lazy=True)
    finanzen = db.relationship("Finanzbuchung", back_populates="verein", lazy=True)
    notizen = db.relationship("Notiz", back_populates="verein", lazy=True)
    documents = db.relationship("Document", back_populates="verein", lazy=True)
    nachrichtenvorlagen = db.relationship(
        "Nachrichtenvorlage",
        back_populates="verein",
        lazy=True,
    )
    licenses = db.relationship("License", back_populates="verein", lazy=True)

    def __repr__(self):
        return f"<Verein {self.name}>"


class VereinFeature(db.Model):
    __tablename__ = "verein_features"
    __table_args__ = (UniqueConstraint("verein_id", "feature", name="uq_verein_feature"),)

    id = db.Column(db.Integer, primary_key=True)
    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=False)
    feature = db.Column(db.String(50), nullable=False)

    verein = db.relationship("Verein", back_populates="features")

    def __repr__(self):
        return f"<Feature {self.feature} for Verein {self.verein_id}>"


class User(db.Model, UserMixin):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(50), default="mitglied", nullable=False)
    calendar_integration = db.Column(db.String(20), default="disabled", nullable=False)
    calendar_api_key = db.Column(db.String(255), nullable=True)
    theme = db.Column(db.String(20), default="light", nullable=False)
    email_notifikationen = db.Column(db.Boolean, default=False, nullable=False)
    konto_nummer = db.Column(db.String(100), nullable=True)
    konto_bezeichnung = db.Column(db.String(255), nullable=True)
    anfangsbestand = db.Column(db.Float, default=0.0, nullable=False)

    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=True)
    verein = db.relationship("Verein", back_populates="users")
    documents = db.relationship("Document", back_populates="user", lazy=True)

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    @property
    def is_admin(self):
        return self.role in {"admin", "system_admin"}

    @property
    def is_system_admin(self):
        return self.role == "system_admin"

    def __repr__(self):
        return f"<User {self.username}>"


class Mitglied(db.Model):
    __tablename__ = "mitglieder"
    __table_args__ = (UniqueConstraint("verein_id", "email", name="uq_mitglied_email_verein"),)

    id = db.Column(db.Integer, primary_key=True)
    vorname = db.Column(db.String(50), nullable=False)
    nachname = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), nullable=False)
    eintrittsdatum = db.Column(db.Date, nullable=True)
    austritt_datum = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="aktiv")
    funktion = db.Column(db.String(40), nullable=True)
    mitgliedsbeitrag = db.Column(db.Float, default=0.0, nullable=False)
    beitrag_bezahlt = db.Column(db.Boolean, default=False, nullable=False)
    telefonnummer = db.Column(db.String(50), nullable=True)
    geburtstag = db.Column(db.Date, nullable=True)
    adresse = db.Column(db.String(255), nullable=True)
    plz = db.Column(db.String(20), nullable=True)
    ort = db.Column(db.String(255), nullable=True)

    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=False)
    verein = db.relationship("Verein", back_populates="mitglieder")
    finanzbuchungen = db.relationship(
        "Finanzbuchung",
        back_populates="mitglied",
        lazy=True,
        cascade="all, delete-orphan",
    )

    def reset_beitrag_bezahlt(self):
        self.beitrag_bezahlt = False

    def __repr__(self):
        return f"<Mitglied {self.vorname} {self.nachname}>"


class Finanzbuchung(db.Model):
    __tablename__ = "finanzen"

    id = db.Column(db.Integer, primary_key=True)
    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=False)
    mitglied_id = db.Column(db.Integer, db.ForeignKey("mitglieder.id"), nullable=True)
    typ = db.Column(db.String(10), nullable=False)
    kategorie = db.Column(db.String(80), nullable=False)
    betrag = db.Column(db.Float, nullable=False)
    datum = db.Column(db.Date, nullable=False)
    beschreibung = db.Column(db.Text, nullable=True)

    verein = db.relationship("Verein", back_populates="finanzen")
    mitglied = db.relationship("Mitglied", back_populates="finanzbuchungen")

    def __repr__(self):
        return f"<Finanzbuchung {self.id} {self.kategorie} {self.betrag}>"


class Event(db.Model):
    __tablename__ = "events"

    id = db.Column(db.Integer, primary_key=True)
    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=False)
    titel = db.Column(db.String(100), nullable=False)
    beschreibung = db.Column(db.Text, nullable=True)
    datum = db.Column(db.Date, nullable=False)
    ort = db.Column(db.String(100), nullable=True)
    preis = db.Column(db.Float, nullable=True)

    verein = db.relationship("Verein", back_populates="events")

    def __repr__(self):
        return f"<Event {self.titel}>"


class Notiz(db.Model):
    __tablename__ = "notizen"

    id = db.Column(db.Integer, primary_key=True)
    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=False)
    titel = db.Column(db.String(100), nullable=False)
    inhalt = db.Column(db.Text, nullable=False)

    verein = db.relationship("Verein", back_populates="notizen")

    def __repr__(self):
        return f"<Notiz {self.titel}>"


class Document(db.Model):
    __tablename__ = "documents"

    id = db.Column(db.Integer, primary_key=True)
    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    verein = db.relationship("Verein", back_populates="documents")
    user = db.relationship("User", back_populates="documents")

    def __repr__(self):
        return f"<Document {self.id} {self.filename}>"


class Nachrichtenvorlage(db.Model):
    __tablename__ = "nachrichtenvorlagen"

    id = db.Column(db.Integer, primary_key=True)
    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=False)
    titel = db.Column(db.String(100), nullable=False)
    betreff = db.Column(db.String(200), nullable=False)
    inhalt = db.Column(db.Text, nullable=False)

    verein = db.relationship("Verein", back_populates="nachrichtenvorlagen")

    def __repr__(self):
        return f"<Nachrichtenvorlage {self.titel}>"


class License(db.Model):
    __tablename__ = "licenses"

    id = db.Column(db.Integer, primary_key=True)
    license_key = db.Column(db.String(64), nullable=False, unique=True)
    name = db.Column(db.String(120), nullable=False)
    status = db.Column(db.String(20), default="active", nullable=False)
    max_users = db.Column(db.Integer, nullable=True)
    max_members = db.Column(db.Integer, nullable=True)
    valid_from = db.Column(db.Date, nullable=True)
    valid_until = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=True)
    verein = db.relationship("Verein", back_populates="licenses")
    usage_events = db.relationship(
        "LicenseUsageEvent",
        back_populates="license",
        cascade="all, delete-orphan",
        lazy=True,
    )

    @property
    def is_active(self):
        today = datetime.utcnow().date()
        if self.status not in {"active", "trial"}:
            return False
        if self.valid_from and self.valid_from > today:
            return False
        if self.valid_until and self.valid_until < today:
            return False
        return True

    def __repr__(self):
        return f"<License {self.license_key}>"


class LicenseUsageEvent(db.Model):
    __tablename__ = "license_usage_events"

    id = db.Column(db.Integer, primary_key=True)
    license_id = db.Column(db.Integer, db.ForeignKey("licenses.id"), nullable=False)
    verein_id = db.Column(db.Integer, db.ForeignKey("verein.id"), nullable=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    event_type = db.Column(db.String(50), nullable=False)
    endpoint = db.Column(db.String(120), nullable=True)
    path = db.Column(db.String(255), nullable=True)
    event_metadata = db.Column(db.Text, nullable=True)
    occurred_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)

    license = db.relationship("License", back_populates="usage_events")
    verein = db.relationship("Verein")
    user = db.relationship("User")

    def __repr__(self):
        return f"<LicenseUsageEvent {self.event_type} {self.occurred_at}>"
