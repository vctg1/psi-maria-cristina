#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
cd "$APP_DIR"
export PATH="/root/.nvm/versions/node/v24.18.1/bin:$PATH"

set -a
source /opt/psi/.env
set +a
export NODE_ENV=production
export PSI_APP_DIR="$APP_DIR"
: "${DATABASE_URL:?DATABASE_URL must be set in /opt/psi/.env}"
: "${JWT_SECRET:?JWT_SECRET must be set in /opt/psi/.env}"

ln -sfn /opt/psi/.env "$APP_DIR/.env"

npm ci --include=dev
npx prisma generate
npm run build
npx prisma migrate deploy

PREVIOUS_DIR="$(readlink -f /opt/psi/current 2>/dev/null || true)"
if [[ -z "$PREVIOUS_DIR" ]]; then
  PREVIOUS_DIR=/opt/psi/app
fi

rollback() {
  pm2 delete psi-maria-cristina >/dev/null 2>&1 || true
  if [[ -f "$PREVIOUS_DIR/deploy/ecosystem.config.cjs" ]]; then
    PSI_APP_DIR="$PREVIOUS_DIR" pm2 start "$PREVIOUS_DIR/deploy/ecosystem.config.cjs" --only psi-maria-cristina
    pm2 save
  fi
}

pm2 delete psi-maria-cristina >/dev/null 2>&1 || true
if ! pm2 start "$APP_DIR/deploy/ecosystem.config.cjs" --only psi-maria-cristina; then
  rollback
  exit 1
fi

if ! curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-connrefused http://127.0.0.1:3010/ > /dev/null; then
  rollback
  exit 1
fi
if ! curl --fail --silent --show-error "http://127.0.0.1:3010/api/disponibilidade?ano=$(date +%Y)&mes=$(date +%-m)" > /dev/null; then
  rollback
  exit 1
fi

ln -sfn "$APP_DIR" /opt/psi/current.next
mv -Tf /opt/psi/current.next /opt/psi/current
pm2 save
