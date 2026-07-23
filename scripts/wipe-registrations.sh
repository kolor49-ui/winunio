#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL nincs beállítva (.env)" >&2
  exit 1
fi

echo "Figyelem: minden felhasználó és vita törlődik (küszöb szabályok maradnak)."
read -r -p "Biztosan? (igen): " confirm
if [[ "$confirm" != "igen" ]]; then
  echo "Megszakítva."
  exit 0
fi

find_psql() {
  if command -v psql >/dev/null 2>&1; then command -v psql; return; fi
  for c in \
    /Applications/Postgres.app/Contents/Versions/latest/bin/psql \
    /usr/local/opt/postgresql@16/bin/psql; do
    [[ -x "$c" ]] && echo "$c" && return
  done
  echo "psql not found" >&2
  exit 1
}

PSQL="$(find_psql)"
"$PSQL" "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/scripts/wipe-registrations.sql"
echo "Kész — törölve."
