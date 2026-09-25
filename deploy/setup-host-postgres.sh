#!/usr/bin/env bash
set -euo pipefail

# Run once on the VPS as root. Reuses the random password already stored in
# /opt/psi/.env and touches only this application's role and database.
source /opt/psi/.env
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD must be set in /opt/psi/.env}"

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='psi_maria_cristina'" | grep -q 1; then
  printf "CREATE ROLE psi_maria_cristina LOGIN PASSWORD '%s';\n" "$POSTGRES_PASSWORD" |
    sudo -u postgres psql -v ON_ERROR_STOP=1
fi

printf "ALTER ROLE psi_maria_cristina PASSWORD '%s';\n" "$POSTGRES_PASSWORD" |
  sudo -u postgres psql -v ON_ERROR_STOP=1

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='psi_maria_cristina'" | grep -q 1; then
  sudo -u postgres createdb -O psi_maria_cristina psi_maria_cristina
fi

if ! grep -q '^DATABASE_URL=' /opt/psi/.env; then
  printf 'DATABASE_URL=postgresql://psi_maria_cristina:%s@127.0.0.1:5432/psi_maria_cristina\n' \
    "$POSTGRES_PASSWORD" >> /opt/psi/.env
fi
if ! grep -q '^NEXT_PUBLIC_URL=' /opt/psi/.env; then
  printf 'NEXT_PUBLIC_URL=https://cristinapsi.online\n' >> /opt/psi/.env
fi
if ! grep -q '^DOCUMENTOS_DIR=' /opt/psi/.env; then
  printf 'DOCUMENTOS_DIR=/opt/psi/documentos\n' >> /opt/psi/.env
fi
chmod 600 /opt/psi/.env
ln -sfn /opt/psi/.env /opt/psi/app/.env

PGPASSWORD="$POSTGRES_PASSWORD" psql -h 127.0.0.1 -p 5432 \
  -U psi_maria_cristina -d psi_maria_cristina -Atc 'SELECT current_database()'
