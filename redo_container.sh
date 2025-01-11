#!/bin/bash

# Name des Skripts: update.sh
# Ziel: Automatisiertes Pullen, Bauen und Neustarten von Docker-Containern mit docker compose

set -e  # Beendet das Skript bei einem Fehler

# Farben für die Ausgabe
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # Kein Farbcode

# Funktionen
log() {
  echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

error() {
  echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

# 1. Pull: Neueste Version von GitHub holen
log "Pulling latest changes from GitHub..."
git pull origin main || {
  error "Git pull failed. Aborting update."
  exit 1
}

# 2. Container stoppen und alte Images entfernen
log "Stopping and removing current containers..."
docker compose down || {
  error "Failed to stop containers. Aborting update."
  exit 1
}

# 3. Neues Docker-Image bauen
log "Building new Docker image..."
docker compose build || {
  error "Failed to build Docker image. Aborting update."
  exit 1
}

# 4. Container mit persistenten Volumes neu starten
log "Starting containers with persistent volumes..."
docker compose up -d --build || {
  error "Failed to start containers. Aborting update."
  exit 1
}

# 5. Alte, ungenutzte Docker-Images bereinigen
log "Cleaning up unused Docker images..."
docker image prune -f || {
  error "Failed to clean up images."
}

log "Update process completed successfully!"
