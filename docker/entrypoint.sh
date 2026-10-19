#!/bin/sh
set -e
echo "Datenbank-Migrationen werden angewendet …"
prisma migrate deploy --schema=./prisma/schema.prisma
exec node server.js
