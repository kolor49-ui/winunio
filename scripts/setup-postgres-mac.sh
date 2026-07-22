#!/usr/bin/env bash
# Winunio — Postgres helyi beállítás (macOS)
# Használat: bash scripts/setup-postgres-mac.sh

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DB_NAME="${WINUNIO_DB_NAME:-winunio}"
DB_USER="${WINUNIO_DB_USER:-$(whoami)}"
DB_HOST="${WINUNIO_DB_HOST:-localhost}"
DB_PORT="${WINUNIO_DB_PORT:-5432}"

red() { printf '\033[0;31m%s\033[0m\n' "$*"; }
green() { printf '\033[0;32m%s\033[0m\n' "$*"; }
yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }

find_brew() {
  if command -v brew >/dev/null 2>&1; then
    command -v brew
    return 0
  fi
  for candidate in /usr/local/bin/brew /opt/homebrew/bin/brew; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

find_psql() {
  if command -v psql >/dev/null 2>&1; then
    command -v psql
    return 0
  fi
  for candidate in \
    /usr/local/opt/postgresql@16/bin/psql \
    /usr/local/opt/postgresql@17/bin/psql \
    /opt/homebrew/opt/postgresql@16/bin/psql \
    /opt/homebrew/opt/postgresql@17/bin/psql \
    /Applications/Postgres.app/Contents/Versions/latest/bin/psql; do
    if [[ -x "$candidate" ]]; then
      echo "$candidate"
      return 0
    fi
  done
  return 1
}

ensure_homebrew() {
  if find_brew >/dev/null; then
    green "✓ Homebrew megvan: $(find_brew)"
    return 0
  fi

  red "Homebrew nincs telepítve."
  echo
  yellow "Telepítsd a Terminalban (jelszó kell):"
  echo '  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  echo
  yellow "Intel Mac után add hozzá a PATH-hoz (ha a telepítő kéri):"
  echo '  echo '"'"'eval "$(/usr/local/bin/brew shellenv)"'"'"' >> ~/.zprofile'
  echo '  eval "$(/usr/local/bin/brew shellenv)"'
  echo
  yellow "Majd futtasd újra:"
  echo "  bash scripts/setup-postgres-mac.sh"
  exit 1
}

ensure_postgresql() {
  local brew_bin
  brew_bin="$(find_brew)"

  if find_psql >/dev/null; then
    green "✓ psql megvan: $(find_psql)"
    return 0
  fi

  yellow "PostgreSQL telepítése Homebrew-val..."
  "$brew_bin" install postgresql@16
  "$brew_bin" services start postgresql@16

  local pg_bin
  pg_bin="$("$brew_bin" --prefix postgresql@16)/bin"
  yellow "Add hozzá a PATH-hoz (egyszer):"
  echo "  echo 'export PATH=\"${pg_bin}:\$PATH\"' >> ~/.zprofile"
  echo "  export PATH=\"${pg_bin}:\$PATH\""
  echo
  export PATH="${pg_bin}:$PATH"

  if ! find_psql >/dev/null; then
    red "psql még mindig nem elérhető. Nyiss új Terminal ablakot, majd futtasd újra a scriptet."
    exit 1
  fi
}

ensure_database() {
  local psql_bin
  psql_bin="$(find_psql)"

  yellow "Adatbázis ellenőrzése: ${DB_NAME}"
  if "$psql_bin" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -tAc \
    "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
    green "✓ Adatbázis már létezik: ${DB_NAME}"
  else
    createdb -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" "$DB_NAME" 2>/dev/null \
      || "$psql_bin" -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d postgres -c "CREATE DATABASE ${DB_NAME};"
    green "✓ Adatbázis létrehozva: ${DB_NAME}"
  fi
}

run_migrations() {
  local psql_bin
  psql_bin="$(find_psql)"
  local url="postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"

  yellow "Migrációk futtatása..."
  "$psql_bin" "$url" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/db/migrations/000001_initial_schema.up.sql"
  "$psql_bin" "$url" -v ON_ERROR_STOP=1 -f "$ROOT_DIR/db/migrations/000002_seed_round_unlock_rules.up.sql"
  green "✓ Migrációk kész."

  if [[ ! -f "$ROOT_DIR/.env" ]]; then
    cp "$ROOT_DIR/.env.example" "$ROOT_DIR/.env"
    # shellcheck disable=SC2016
    sed -i '' "s|postgres://user:pass@localhost:5432/winunio|postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}|" "$ROOT_DIR/.env" 2>/dev/null \
      || sed -i "s|postgres://user:pass@localhost:5432/winunio|postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}|" "$ROOT_DIR/.env"
    green "✓ .env létrehozva (.env.example alapján)"
  fi

  echo
  green "Kész. DATABASE_URL:"
  echo "  postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable"
  echo
  yellow "Ellenőrzés:"
  echo "  psql \"postgres://${DB_USER}@${DB_HOST}:${DB_PORT}/${DB_NAME}?sslmode=disable\" -c \"\\dt\""
}

main() {
  echo "Winunio Postgres setup (macOS)"
  echo "=============================="
  ensure_homebrew
  ensure_postgresql
  ensure_database
  run_migrations
}

main "$@"
