# Database migrations

Postgres séma a [docs/DATA_MODEL.md](../docs/DATA_MODEL.md) alapján.

## Fájlok

| Migráció | Tartalom |
|----------|----------|
| `000001_initial_schema` | Táblák, enumok, constraint-ek, indexek |
| `000002_seed_round_unlock_rules` | MVP küszöb + jutalom seed (1→25/1000 … 5→500/12000) |
| `000003_add_user_password_hash` | E-mail + jelszó auth (`password_hash`) |

## Előfeltétel

- PostgreSQL 14+ (ajánlott)
- `DATABASE_URL` — pl. `postgres://user:pass@localhost:5432/winunio?sslmode=disable`

## Gyors setup (macOS)

### A) Homebrew (ajánlott, ha nincs még Postgres)

1. **Homebrew** (egyszer, Terminal — jelszó kell):

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
eval "$(/usr/local/bin/brew shellenv)"   # Intel Mac
```

2. **Automatikus setup** (Postgres telepítés + DB + migráció):

```bash
cd /Users/macbookair/Desktop/Winunio
bash scripts/setup-postgres-mac.sh
```

### B) Docker (ha van Docker Desktop)

```bash
cd /Users/macbookair/Desktop/Winunio
bash scripts/setup-postgres-docker.sh
```

`DATABASE_URL`: `postgres://winunio:winunio@localhost:5432/winunio?sslmode=disable`

### C) Postgres.app

1. Töltsd le: https://postgresapp.com/
2. Indítsd el, hozz létre egy `winunio` adatbázist
3. Add hozzá a PATH-hoz a Postgres.app bin mappát
4. Futtasd a psql parancsokat lent

## Futtatás (psql)

```bash
export DATABASE_URL="postgres://user:pass@localhost:5432/winunio?sslmode=disable"

psql "$DATABASE_URL" -f db/migrations/000001_initial_schema.up.sql
psql "$DATABASE_URL" -f db/migrations/000002_seed_round_unlock_rules.up.sql
```

## Futtatás ([golang-migrate](https://github.com/golang-migrate/migrate))

```bash
migrate -path db/migrations -database "$DATABASE_URL" up
```

A fájlnevek `golang-migrate` konvenciót követik (`NNNNNN_name.up.sql` / `.down.sql`).

## Visszavonás

```bash
migrate -path db/migrations -database "$DATABASE_URL" down 2
```

Vagy psql-lel fordított sorrendben a `.down.sql` fájlok.

## Megjegyzések

- **Nincs** `winner_id`, `likes_count` — spec szerint tiltott.
- `continuation_requests`: `UNIQUE(user_id, completed_round_id)` — 1 kérés / forduló / fiók.
- `debate_participants`: `UNIQUE(debate_id, side)` — A/B fix pozíció.
- `debate_rewards`: küszöb előtt nincs rekord → nincs jutalom UI.
- 6+ forduló `RoundUnlockRule`: küszöb duplázódik — seed csak 1–5; további szabályok későbbi lépés.
