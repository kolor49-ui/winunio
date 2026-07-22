# Database migrations

Postgres séma a [docs/DATA_MODEL.md](../docs/DATA_MODEL.md) alapján.

## Fájlok

| Migráció | Tartalom |
|----------|----------|
| `000001_initial_schema` | Táblák, enumok, constraint-ek, indexek |
| `000002_seed_round_unlock_rules` | MVP küszöb + jutalom seed (1→25/1000 … 5→500/12000) |

## Előfeltétel

- PostgreSQL 14+ (ajánlott)
- `DATABASE_URL` — pl. `postgres://user:pass@localhost:5432/winunio?sslmode=disable`

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
