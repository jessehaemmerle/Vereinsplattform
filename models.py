from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import create_engine

db = SQLAlchemy()

def init_verein_db(db_path):
    """
    Initialize the SQLite database for a new club.

    Args:
        db_path (str): Path to the new SQLite database.
    """
    engine = create_engine(f'sqlite:///{db_path}')
    db.metadata.create_all(engine)  # Create tables based on the models


class Verein(db.Model):
    __tablename__ = 'verein'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    db_path = db.Column(db.String(255), nullable=False)
    logo_path = db.Column(db.String(255), nullable=True)  # Path for the logo file

    # Relationships
    users = db.relationship('User', back_populates='verein', lazy=True)
    features = db.relationship('VereinFeature', back_populates='verein', lazy=True)

    def __repr__(self):
        return f"<Verein {self.name}>"


class VereinFeature(db.Model):
    __tablename__ = 'verein_features'
    id = db.Column(db.Integer, primary_key=True)
    verein_id = db.Column(db.Integer, db.ForeignKey('verein.id'), nullable=False)
    feature = db.Column(db.String(50), nullable=False)

    # Relationship
    verein = db.relationship('Verein', back_populates='features')

    def __repr__(self):
        return f"<Feature {self.feature} for Verein {self.verein_id}>"


class Mitglied(db.Model):
    __tablename__ = 'mitglieder'
    id = db.Column(db.Integer, primary_key=True)
    vorname = db.Column(db.String(50), nullable=False)
    nachname = db.Column(db.String(50), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    eintrittsdatum = db.Column(db.Date, nullable=True)
    austritt_datum = db.Column(db.Date, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="aktiv")  # e.g., 'aktiv', 'inaktiv'
    funktion = db.Column(db.String(20), nullable=True)
    mitgliedsbeitrag = db.Column(db.Float, default=0.0)
    beitrag_bezahlt = db.Column(db.Boolean, default=False)
    telefonnummer = db.Column(db.String(20), nullable=True)
    geburtstag = db.Column(db.Date, nullable=True)
    adresse = db.Column(db.String(255), nullable=True)
    plz = db.Column(db.Integer, nullable=True)
    ort = db.Column(db.String(255), nullable=True)

    # Relationship to Verein
    verein_id = db.Column(db.Integer, db.ForeignKey('verein.id'), nullable=False)
    verein = db.relationship('Verein', backref='mitglieder')

    # Relationships
    finanzbuchungen = db.relationship('Finanzbuchung', backref='mitglied', lazy=True)

    def reset_beitrag_bezahlt(self):
        self.beitrag_bezahlt = False

    def __repr__(self):
        return f"<Mitglied {self.vorname} {self.nachname}>"


class Finanzbuchung(db.Model):
    __tablename__ = 'finanzen'
    id = db.Column(db.Integer, primary_key=True)
    mitglied_id = db.Column(db.Integer, db.ForeignKey('mitglieder.id'), nullable=True)
    typ = db.Column(db.String(10), nullable=False)  # 'Einnahme' or 'Ausgabe'
    kategorie = db.Column(db.String(50), nullable=False)
    betrag = db.Column(db.Float, nullable=False)
    datum = db.Column(db.Date, nullable=False, default=datetime.utcnow)
    beschreibung = db.Column(db.Text, nullable=True)

    def __repr__(self):
        return f"<Finanzbuchung {self.id} {self.kategorie} {self.betrag}>"


class Notiz(db.Model):
    __tablename__ = 'notizen'
    id = db.Column(db.Integer, primary_key=True)
    titel = db.Column(db.String(100), nullable=False)
    inhalt = db.Column(db.Text, nullable=False)

    def __repr__(self):
        return f"<Notiz {self.titel}>"


class User(db.Model, UserMixin):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), default='mitglied')  # e.g., 'admin', 'mitglied'
    calendar_integration = db.Column(db.String(20), default='disabled')  # 'google', 'outlook', 'disabled'
    calendar_api_key = db.Column(db.String(255), nullable=True)
    theme = db.Column(db.String(20), default='light')  # Default theme
    email_notifikationen = db.Column(db.Boolean, default=False)
    konto_nummer = db.Column(db.String(100), nullable=True)
    konto_bezeichnung = db.Column(db.String(255), nullable=True)
    anfangsbestand = db.Column(db.Float, default=0.0)

    # Relationships
    verein_id = db.Column(db.Integer, db.ForeignKey('verein.id'), nullable=True)
    verein = db.relationship('Verein', back_populates='users')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username}>"


class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    original_filename = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    user = db.relationship('User', backref='documents')

    def __repr__(self):
        return f"<Document {self.id} {self.filename}>"


class Event(db.Model):
    __tablename__ = 'events'
    id = db.Column(db.Integer, primary_key=True)
    titel = db.Column(db.String(100), nullable=False)
    beschreibung = db.Column(db.Text, nullable=True)
    datum = db.Column(db.Date, nullable=False)
    ort = db.Column(db.String(100), nullable=True)
    preis = db.Column(db.Float, nullable=True)

    def __repr__(self):
        return f"<Event {self.titel}>"


class Nachrichtenvorlage(db.Model):
    __tablename__ = 'nachrichtenvorlagen'
    id = db.Column(db.Integer, primary_key=True)
    titel = db.Column(db.String(100), nullable=False)
    betreff = db.Column(db.String(200), nullable=False)
    inhalt = db.Column(db.Text, nullable=False)

    def __repr__(self):
        return f"<Nachrichtenvorlage {self.titel}>"
