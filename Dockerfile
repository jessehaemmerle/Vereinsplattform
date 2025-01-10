# Basis-Image mit Python 3.9
FROM python:3.13.1-slim-bookworm

# Umgebungsvariablen setzen
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Arbeitsverzeichnis setzen
WORKDIR /app

# Anforderungen hinzufügen und installieren
COPY ./requirements.txt ./requirements.txt
RUN python3 -m pip install --no-cache-dir -r requirements.txt

# Notwendige Dateien und Verzeichnisse hinzufügen
COPY ./databases ./databases
COPY ./static ./static
COPY ./templates ./templates
COPY ./.env ./.env
COPY ./forms.py ./forms.py
COPY ./models.py ./models.py
COPY ./services.py ./services.py

# Hauptdatei hinzufügen
COPY ./app.py ./app.py

# Port freigeben
EXPOSE 5000

# Startbefehl
CMD ["python", "app.py"]
