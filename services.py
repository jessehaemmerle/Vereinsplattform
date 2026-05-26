from datetime import date

from models import Finanzbuchung, Mitglied, db


def zahlung_erstellen(mitglied_id, typ, kategorie, betrag, beschreibung):
    mitglied = Mitglied.query.get(mitglied_id)
    if not mitglied:
        raise ValueError("Ungueltige Mitglied-ID.")

    neue_buchung = Finanzbuchung(
        verein_id=mitglied.verein_id,
        mitglied_id=mitglied.id,
        typ=typ,
        kategorie=kategorie,
        betrag=betrag,
        datum=date.today(),
        beschreibung=beschreibung,
    )
    db.session.add(neue_buchung)
    db.session.commit()
    return neue_buchung
