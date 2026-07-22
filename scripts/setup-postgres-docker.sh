#!/usr/bin/env bash
# Winunio — migrációk Docker Postgres ellen (docker compose szükséges)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker nincs telepítve."
  echo "Telepítsd: https://docs.docker.com/desktop/setup/install/mac-install/"
  exit 1
fi

echo "Postgres indítása (docker compose)..."
docker compose up -d postgres

echo "Várakozás healthcheck-re..."
for i in $(seq 1 30); do
  if docker compose exec -T postgres pg_isready -U winunio -d winunio >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

echo "Migrációk..."
docker compose exec -T postgres psql -U winunio -d winunio -v ON_ERROR_STOP=1 \
  < db/migrations/000001_initial_schema.up.sql
docker compose exec -T postgres psql -U winunio -d winunio -v ON_ERROR_STOP=1 \
  < db/migrations/000002_seed_round_unlock_rules.up.sql

if [[ ! -f .env ]]; then
  cp .env.example .env
  sed -i '' 's|postgres://user:pass@localhost:5432/winunio|postgres://winunio:winunio@localhost:5432/winunio|' .env 2>/dev/null \
    || sed -i 's|postgres://user:pass@localhost:5432/winunio|postgres://winunio:winunio@localhost:5432/winunio|' .env
fi

echo
echo "Kész."
echo "DATABASE_URL=postgres://winunio:winunio@localhost:5432/winunio?sslmode=disable"
echo
echo "psql a konténerben:"
echo "  docker compose exec postgres psql -U winunio -d winunio -c '\\dt'"
