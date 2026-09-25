#!/usr/bin/env bash
set -euo pipefail

cd /opt/psi/app
export PATH="/root/.nvm/versions/node/v24.18.1/bin:$PATH"

set -a
source /opt/psi/.env
set +a
export NODE_ENV=production
: "${DATABASE_URL:?DATABASE_URL must be set in /opt/psi/.env}"
: "${JWT_SECRET:?JWT_SECRET must be set in /opt/psi/.env}"

npm ci --include=dev
npx prisma generate
npm run build
npx prisma migrate deploy

pm2 startOrReload deploy/ecosystem.config.cjs --only psi-maria-cristina --update-env
curl --fail --silent --show-error --retry 12 --retry-delay 5 --retry-connrefused http://127.0.0.1:3010/ > /dev/null
pm2 save
