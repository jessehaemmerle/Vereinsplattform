# Basis-Image mit Python 3.9
FROM python:3.9-slim

# Umgebungsvariablen setzen
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Arbeitsverzeichnis setzen
WORKDIR /app

# Systemabhängigkeiten installieren
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    libssl-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Python-Paketmanager aktualisieren
RUN pip install --upgrade pip

# Abhängigkeiten installieren
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# App-Code kopieren
COPY . /app/

# Port freigeben
EXPOSE 5000

# Startbefehl
CMD ["python", "app-neu.py"]
