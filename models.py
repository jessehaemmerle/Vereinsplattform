from flask_sqlalchemy import SQLAlchemy
from flask_login import UserMixin
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()

class Mitglied(db.Model):
    __tablename__ = 'mitglieder'
    id = db.Column(db.Integer, primary_key=True)
    vorname = db.Column(db.String(50))
    nachname = db.Column(db.String(50))
    email = db.Column(db.String(120), unique=True)
    eintrittsdatum = db.Column(db.Date)
    status = db.Column(db.String(20))  # z.B. 'aktiv', 'inaktiv'
    funktion = db.Column(db.String(20))

    def __repr__(self):
        return f"<Mitglied {self.vorname} {self.nachname}>"

class Finanzbuchung(db.Model):
    __tablename__ = 'finanzen'
    id = db.Column(db.Integer, primary_key=True)
    typ = db.Column(db.String(10))       # 'Einnahme' oder 'Ausgabe'
    kategorie = db.Column(db.String(50))
    betrag = db.Column(db.Float)
    datum = db.Column(db.Date)
    beschreibung = db.Column(db.Text)

    def __repr__(self):
        return f"<Finanzbuchung {self.typ} {self.betrag}>"

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
    role = db.Column(db.String(50), default='mitglied')  # z.B. 'admin', 'kassenwart', 'eventmanager', 'mitglied'

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f"<User {self.username} role={self.role}>"
    
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
