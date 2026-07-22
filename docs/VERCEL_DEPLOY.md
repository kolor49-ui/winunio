# Vercel deploy

## 1. Environment Variables (Vercel → Project → Settings)

| Variable | Példa / megjegyzés |
|----------|-------------------|
| `DATABASE_URL` | Neon connection string, **sslmode=require** |
| `AUTH_SECRET` | `openssl rand -base64 32` (min. 32 karakter) |
| `NEXT_PUBLIC_APP_URL` | `https://winunio.vercel.app` (a te production URL-ed) |

Mind: **Production** + **Preview**.

## 2. Postgres (Neon)

Vercel **Storage** → **Neon** → Create → másold a `DATABASE_URL`-t.

## 3. Migrációk (egyszer, lokálisan)

```bash
export DATABASE_URL="postgres://...@...neon.tech/...?sslmode=require"
bash scripts/run-migrations.sh
```

## 4. Deploy / Redeploy

Git push → auto deploy, vagy Vercel → **Redeploy**.

## 5. Ellenőrzés

```
https://TE-DOMAIN.vercel.app/api/v1/health
```

Válasz: `{"status":"ok","database":"connected"}`

## Gyakori hibák

| Hiba | Megoldás |
|------|----------|
| Application error (server-side) | `DATABASE_URL` hiányzik vagy migráció nem futott |
| `DATABASE_URL is not set` | Env Vercelen + redeploy |
| relation "debates" does not exist | `bash scripts/run-migrations.sh` Neon URL-lel |
| Auth hiba | `AUTH_SECRET` min. 32 karakter |
