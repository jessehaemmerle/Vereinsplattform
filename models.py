from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from sqlalchemy import create_engine

db = SQLAlchemy()

def init_verein_db(db_path):
    """
    Initialisiert die SQLite-Datenbank für einen neuen Verein.
    
    Args:
        db_path (str): Pfad zur neuen SQLite-Datenbank.
    """
    engine = create_engine(f'sqlite:///{db_path}')
    db.metadata.create_all(engine)  # Erstellt Tabellen basierend auf den Modellen


class Verein(db.Model):
    __tablename__ = 'verein'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    db_path = db.Column(db.String(255), nullable=False)
    logo_path = db.Column(db.String(255), nullable=True)  # Neues Feld für das Logo

    # Beziehung zu User
    users = db.relationship('User', backref='verein', lazy=True)

    # Beziehung zu Features
    features = db.relationship('VereinFeature', backref='verein', lazy=True)

class VereinFeature(db.Model):
    __tablename__ = 'verein_features'
    id = db.Column(db.Integer, primary_key=True)
    verein_id = db.Column(db.Integer, db.ForeignKey('verein.id'), nullable=False)
    feature = db.Column(db.String(50), nullable=False)

    def __repr__(self):
        return f'<Feature {self.feature} für Verein {self.verein_id}>'



class Mitglied(db.Model):
    __tablename__ = 'mitglieder'
    id = db.Column(db.Integer, primary_key=True)
    vorname = db.Column(db.String(50))
    nachname = db.Column(db.String(50))
    email = db.Column(db.String(120), unique=True)
    eintrittsdatum = db.Column(db.Date)
    austritt_datum = db.Column(db.Date)
    status = db.Column(db.String(20))  # z.B. 'aktiv', 'inaktiv'
    funktion = db.Column(db.String(20))
    mitgliedsbeitrag = db.Column(db.Float, default=0.0)
    beitrag_bezahlt = db.Column(db.Boolean, default=False)
    telefonnummer = db.Column(db.String(20))  # Neue Spalte
    geburtstag = db.Column(db.Date)          # Neue Spalte
    adresse = db.Column(db.String(255))      # Neue Spalte
    plz = db.Column(db.Integer)
    ort = db.Column(db.String(255))
    finanzbuchungen = db.relationship('Finanzbuchung', backref='mitglied', lazy=True)

    def reset_beitrag_bezahlt(self):
        self.beitrag_bezahlt = False

    def __repr__(self):
        return f"<Mitglied {self.vorname} {self.nachname}>"

class Finanzbuchung(db.Model):
    __tablename__ = 'finanzen'
    id = db.Column(db.Integer, primary_key=True)
    mitglied_id = db.Column(db.Integer, db.ForeignKey('mitglieder.id'), nullable=True)  # Verknüpfung sicherstellen
    typ = db.Column(db.String(10))       # 'Einnahme' oder 'Ausgabe'
    kategorie = db.Column(db.String(50))
    betrag = db.Column(db.Float)
    datum = db.Column(db.Date)
    beschreibung = db.Column(db.Text)

    def __repr__(self):
        return f"<Finanzbuchung {self.id} {self.kategorie} {self.betrag}>"


class Notiz(db.Model):
    __tablename__ = 'notizen'
    id = db.Column(db.Integer, primary_key=True)
    titel = db.Column(db.String(100))
    inhalt = db.Column(db.Text)

    def __repr__(self):
        return f"<Notiz {self.titel}>"
    
class User(db.Model, UserMixin):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(50), unique=True, nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password_hash = db.Column(db.String(200), nullable=False)
    role = db.Column(db.String(50), default='admin')  # z.B. 'admin', 'mitglied'
    calendar_integration = db.Column(db.String(20), default='disabled')  # 'google', 'outlook', 'disabled'
    calendar_api_key = db.Column(db.String(255), nullable=True)
    theme = db.Column(db.String(20), default='light')  # Standardwert 'light'
    email_notifikationen = db.Column(db.Boolean, default=False)
    konto_nummer = db.Column(db.String(100), nullable=True)  # Feld für Kontonummer
    konto_bezeichnung = db.Column(db.String(255), nullable=True)  # Bezeichnung für das Konto
    anfangsbestand = db.Column(db.Float, default=0.0)             # Anfangsbestand
    verein_id = db.Column(db.Integer, db.ForeignKey('verein.id'), nullable=True)  # Fremdschlüssel zu Verein

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username}>"

    
class Document(db.Model):
    __tablename__ = 'documents'
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)          # z. B. auf dem Server gespeicherter Dateiname
    original_filename = db.Column(db.String(255), nullable=False) # Ursprünglicher Dateiname
    description = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow) # Zeitstempel Upload

    # Optional: Verknüpfung mit dem User, der hochgeladen hat
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'))
    user = db.relationship('User', backref='documents')

    def __repr__(self):
        return f"<Document {self.id} {self.filename}>"

class Event(db.Model):
    __tablename__ = 'events'
    id = db.Column(db.Integer, primary_key=True)
    titel = db.Column(db.String(100))
    beschreibung = db.Column(db.Text)
    datum = db.Column(db.Date)
    ort = db.Column(db.String(100))
    preis = db.Column(db.Float, nullable=True)  # Neues Preisfeld

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
