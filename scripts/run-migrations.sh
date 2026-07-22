#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_USER="${WINUNIO_DB_USER:-$(whoami)}"
DB_HOST="${WINUNIO_DB_HOST:-localhost}"
DB_PORT="${WINUNIO_DB_PORT:-5432}"
DB_NAME="${WINUNIO_DB_NAME:-winunio}"

if [[ -f "$ROOT_DIR/.env" ]]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

URL="${DATABASE_URL:-postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable}"

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

"$PSQL" "$URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS schema_migrations (
  filename TEXT PRIMARY KEY,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
SQL

# Korábban kézzel futtatott migrációk (schema_migrations nélkül)
if "$PSQL" "$URL" -tAc "SELECT to_regclass('public.users') IS NOT NULL" | grep -q t; then
  for legacy in 000001_initial_schema.up.sql 000002_seed_round_unlock_rules.up.sql; do
    applied=$("$PSQL" "$URL" -tAc "SELECT 1 FROM schema_migrations WHERE filename = '${legacy}'" | tr -d '[:space:]')
    if [[ "$applied" != "1" ]]; then
      echo "↺ backfill $legacy"
      "$PSQL" "$URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename) VALUES ('${legacy}')"
    fi
  done
fi

for f in $(ls "$ROOT_DIR"/db/migrations/*.up.sql | sort); do
  base="$(basename "$f")"
  applied=$("$PSQL" "$URL" -tAc "SELECT 1 FROM schema_migrations WHERE filename = '${base}'" | tr -d '[:space:]')
  if [[ "$applied" == "1" ]]; then
    echo "⊘ skip $base"
    continue
  fi
  echo "→ $base"
  "$PSQL" "$URL" -v ON_ERROR_STOP=1 -f "$f"
  "$PSQL" "$URL" -v ON_ERROR_STOP=1 -c "INSERT INTO schema_migrations (filename) VALUES ('${base}')"
done

echo "Migrációk kész."
