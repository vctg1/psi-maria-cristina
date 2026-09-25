#!/usr/bin/env bash
set -euo pipefail

cd /opt/psi/app
export PATH="/root/.nvm/versions/node/v24.18.1/bin:$PATH"

# The password is generated as hex, so it is safe to use in a PostgreSQL URL.
set -a
source /opt/psi/.env
set +a
export NODE_ENV=production
export NEXT_PUBLIC_URL=https://cristinapsi.online
export DOCUMENTOS_DIR=/opt/psi/documentos
export DATABASE_URL="postgresql://psi:${POSTGRES_PASSWORD}@127.0.0.1:5436/psi_maria_cristina"

docker compose --env-file /opt/psi/.env -f deploy/compose.yml up -d db
npm ci
npx prisma generate
npm run build
npx prisma migrate deploy

# One-time transition from the earlier Docker app to PM2. The database is kept.
if docker container inspect psi_maria_cristina-app-1 >/dev/null 2>&1; then
  docker stop psi_maria_cristina-app-1
  docker rm psi_maria_cristina-app-1
fi

pm2 startOrReload deploy/ecosystem.config.cjs --only psi-maria-cristina --update-env
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-connrefused http://127.0.0.1:3010/ > /dev/null
pm2 save
