# services.py
from datetime import datetime
from models import db, Mitglied, Finanzbuchung

def zahlung_erstellen(mitglied_id, typ, kategorie, betrag, beschreibung):
    mitglied = Mitglied.query.get(mitglied_id)
    if not mitglied:
        raise ValueError("Ungültige Mitglied-ID.")
    
    neue_buchung = Finanzbuchung(
        mitglied_id=mitglied.id,
        typ=typ,
        kategorie=kategorie,
        betrag=betrag,
        datum=datetime.utcnow(),
        beschreibung=beschreibung
    )
    db.session.add(neue_buchung)
    db.session.commit()
    return neue_buchung
