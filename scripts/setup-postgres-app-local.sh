#!/usr/bin/env bash
# Winunio — Postgres.app a projekt mappában (tools/Postgres.app vagy ./Postgres.app)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${WINUNIO_DB_NAME:-winunio}"
DB_USER="${WINUNIO_DB_USER:-$(whoami)}"
DB_HOST="${WINUNIO_DB_HOST:-localhost}"
DB_PORT="${WINUNIO_DB_PORT:-5432}"

red() { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }

find_postgres_app() {
  local candidates=(
    "$ROOT_DIR/tools/Postgres.app"
    "$ROOT_DIR/Postgres.app"
    "/Applications/Postgres.app"
  )
  for app in "${candidates[@]}"; do
    if [[ -d "$app/Contents/MacOS/Postgres" ]]; then
      echo "$app"
      return 0
    fi
  done
  return 1
}

find_psql_for_app() {
  local app="$1"
  local latest="$app/Contents/Versions/latest/bin/psql"
  if [[ -x "$latest" ]]; then
    echo "$latest"
    return 0
  fi
  local versioned
  versioned="$(find "$app/Contents/Versions" -maxdepth 2 -name psql -type f 2>/dev/null | head -1)"
  if [[ -n "$versioned" && -x "$versioned" ]]; then
    echo "$versioned"
    return 0
  fi
  return 1
}

server_running() {
  if command -v pg_isready >/dev/null 2>&1; then
    pg_isready -h "$DB_HOST" -p "$DB_PORT" -q
    return $?
  fi
  local psql_bin="$1"
  "$psql_bin" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "SELECT 1" >/dev/null 2>&1
}

main() {
  echo "Winunio — Postgres.app (projekt mappa)"
  echo "========================================"

  local app
  if ! app="$(find_postgres_app)"; then
    red "Nem találom a Postgres.app-et."
    echo
    yellow "Tedd ide (ajánlott):"
    echo "  $ROOT_DIR/tools/Postgres.app"
    echo
    yellow "Vagy ide:"
    echo "  $ROOT_DIR/Postgres.app"
    echo
    yellow "Letöltés: https://postgresapp.com/downloads.html (PostgreSQL 16, Universal)"
    exit 1
  fi

  green "✓ Postgres.app: $app"

  local bin_dir
  bin_dir="$(dirname "$(find_psql_for_app "$app")")"
  export PATH="$bin_dir:$PATH"

  yellow "PATH ehhez a munkamenethez: $bin_dir"

  if ! server_running "$bin_dir/psql"; then
    red "A Postgres szerver NEM fut."
    echo
    yellow "1. Nyisd meg dupla kattintással:"
    echo "   open \"$app\""
    echo
    yellow "2. Az ablakban kattints: Initialize (első alkalom) vagy Start"
    echo "   (Menüsorban elefánt ikon = fut)"
    echo
    yellow "3. Futtasd újra:"
    echo "   bash scripts/setup-postgres-app-local.sh"
    echo
    open "$app" 2>/dev/null || true
    exit 1
  fi

  green "✓ Postgres szerver fut"

  if ! createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null; then
    if psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
      "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
      green "✓ Adatbázis már létezik: $DB_NAME"
    else
      red "createdb sikertelen. Próbáld manuálisan: createdb $DB_NAME"
      exit 1
    fi
  else
    green "✓ Adatbázis létrehozva: $DB_NAME"
  fi

  local url="postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"
  psql "$url" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/db/migrations/000001_initial_schema.up.sql"
  psql "$url" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/db/migrations/000002_seed_round_unlock_rules.up.sql"
  green "✓ Migrációk kész"

  yellow "Egyszer add hozzá a PATH-hoz (~/.zprofile):"
  echo "  echo 'export PATH=\"${bin_dir}:\$PATH\"' >> ~/.zprofile"

  echo
  green "DATABASE_URL=$url"
  echo
  psql "$url" -c "\dt"
}

main "$@"
