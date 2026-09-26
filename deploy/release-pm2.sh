#!/usr/bin/env bash
set -euo pipefail

APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
PROJECT_DIR=/root/projetos/psi-maria-cristina
DEPLOY_DIR="$PROJECT_DIR/.deploy"
ENV_FILE="$PROJECT_DIR/.env"
cd "$APP_DIR"
export PATH="/root/.nvm/versions/node/v24.18.1/bin:$PATH"

# Read dotenv values literally. Password hashes and tokens may contain '$',
# which Bash would expand if the file were sourced.
while IFS= read -r line || [[ -n "$line" ]]; do
  line="${line%$'\r'}"
  [[ -z "$line" || "$line" == \#* ]] && continue
  [[ "$line" == *=* ]] || continue
  key="${line%%=*}"
  [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
  value="${line#*=}"
  if [[ ${#value} -ge 2 ]]; then
    first="${value:0:1}"
    last="${value: -1}"
    if [[ ( "$first" == '"' && "$last" == '"' ) || ( "$first" == "'" && "$last" == "'" ) ]]; then
      value="${value:1:${#value}-2}"
    fi
  fi
  export "$key=$value"
done < "$ENV_FILE"
export NODE_ENV=production
export PSI_APP_DIR="$APP_DIR"
: "${DATABASE_URL:?DATABASE_URL must be set in $ENV_FILE}"
: "${JWT_SECRET:?JWT_SECRET must be set in $ENV_FILE}"
: "${DOCUMENTOS_DIR:?DOCUMENTOS_DIR must be set in $ENV_FILE}"
[[ "$DOCUMENTOS_DIR" = /* ]] || { echo 'DOCUMENTOS_DIR must be an absolute path' >&2; exit 1; }
install -d -m 700 "$DOCUMENTOS_DIR"
install -d -m 700 "$DEPLOY_DIR"

ln -sfn "$ENV_FILE" "$APP_DIR/.env"

npm ci --include=dev
npx prisma generate
npm run build
npx prisma migrate deploy

PREVIOUS_DIR="$(readlink -f "$DEPLOY_DIR/current" 2>/dev/null || true)"

rollback() {
  pm2 delete psi-maria-cristina >/dev/null 2>&1 || true
  if [[ -n "$PREVIOUS_DIR" && -f "$PREVIOUS_DIR/deploy/ecosystem.config.cjs" ]]; then
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

ln -sfn "$APP_DIR" "$DEPLOY_DIR/current.next"
mv -Tf "$DEPLOY_DIR/current.next" "$DEPLOY_DIR/current"
pm2 save
