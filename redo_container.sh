#!/bin/bash

# Skript-Version: 1.0
# Author: Jesse Hämmerle
# Purpose: Sicherung der Datenbank und Neuerstellung von Docker-Container aus aktuellen Github-Daten

# Aktuelles Problem:
# Wenn ich vom aktuellen Verzeichnis etwas kopiere, dann werden immer die leeren Dateien kopiert.
# Es muss einen Weg geben, die Datenbanken aus dem Docker-Container zu exportieren.
# TODO: Docker-Datenbanken exportieren.

# In den aktuellen Vereinsplanung-Ordner wechseln
cd /home/jesse/Vereinsplanung

# Datenbanken in das Backup-Verzeichnis kopieren
cp databases /home/Backup

# Uploads in das Backup-Verzeichnis kopieren
cp uploads /home/Backup

# Wechseln in den Nutzer-Ordner
cd /home/jesse

# Löschen des Vereinsplanung-Ordners
rm -r -y Vereinsplanung

# Klonen der aktuellen Daten auf Github
git clone https://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@github.com/jessehaemmerle/Vereinsplattform.git

# Wechseln in den Vereinsplanung-Ordner
cd Vereinsplanung

# Datenbanken wieder in das Verzeichnis kopieren
cp /home/Backup/databases /home/jesse/Vereinsplanung

# Uploads wieder in das Verzeichnis kopieren
cp /home/Backup/uploads /home/jesse/Vereinsplanung

# Docker-Container aus dem Dockerfile bauen
sudo docker buildx build -t vereinsplanung .

# Den aktuellen Container stoppen
sudo docker stop Vereinsplanung

# Den aktuellen Container löschen
sudo docker rm Vereinsplanung

# Den neuen Container starten und den Port 5000 mitgeben für den Reverse Proxy
sudo docker run -d -p 5000:5000 --name Vereinsplanung vereinsplanung
