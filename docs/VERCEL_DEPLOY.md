# Vercel deploy

## 1. Environment Variables (Vercel → Project → Settings)

| Variable | Példa / megjegyzés |
|----------|-------------------|
| `DATABASE_URL` | Neon connection string, **sslmode=require** |
| `AUTH_SECRET` | `openssl rand -base64 32` (min. 32 karakter) |
| `NEXT_PUBLIC_APP_URL` | `https://winunio.vercel.app` (a te production URL-ed) |
| `CRON_SECRET` | `openssl rand -base64 32` — Vercel Cron hitelesítéshez |
| `OPENAI_API_KEY` | OpenAI → [API Keys](https://platform.openai.com/api-keys) — `sk-…` |
| `OPENAI_MODEL` | Alapértelmezés: `gpt-4o-mini` (tartalom-ellenőrzés) |

Mind: **Production** + **Preview**.

## 2. Postgres (Neon)

Vercel **Storage** → **Neon** → Create → másold a `DATABASE_URL`-t.

## 3. Migrációk (egyszer, lokálisan)

```bash
export DATABASE_URL="postgres://...@...neon.tech/...?sslmode=require"
bash scripts/run-migrations.sh
```

## 4. Deploy / Redeploy

**Ajánlott:** `git push origin main` → Vercel automatikus production deploy (ha a projekt GitHubhoz van kötve).

Ha a push **HTTP 400** hibával elhasal (nagy commit history):

```bash
git -c http.postBuffer=524288000 push origin main
```

Alternatíva: SSH remote (`git@github.com:kolor49-ui/winunio.git`).

Manuális deploy (GitHub nélkül): `npx vercel deploy --prod --yes`

Vagy Vercel → **Redeploy**.

## 5. Ellenőrzés

```
https://TE-DOMAIN.vercel.app/api/v1/health
```

Válasz: `{"status":"ok","database":"connected", "content_review": { "ready": true, ... }}`

OpenAI külön:

```
https://TE-DOMAIN.vercel.app/api/v1/health/content-review
```

Lokálisan a kulcs tesztelése:

```bash
# .env: OPENAI_API_KEY=sk-...
node scripts/test-openai.mjs
node scripts/sync-vercel-env.mjs   # Vercel env + redeploy
```

## Gyakori hibák

| Hiba | Megoldás |
|------|----------|
| Application error (server-side) | `DATABASE_URL` hiányzik vagy migráció nem futott |
| `DATABASE_URL is not set` | Env Vercelen + redeploy |
| relation "debates" does not exist | `bash scripts/run-migrations.sh` Neon URL-lel |
| Auth hiba | `AUTH_SECRET` min. 32 karakter |
| Cron 401 | `CRON_SECRET` beállítva + redeploy; Vercel automatikusan küldi `Authorization: Bearer …` |
| „Az ellenőrzés most nem érhető el” | `OPENAI_API_KEY` hiányzik Vercelen → add hozzá + redeploy |
| OpenAI 401 | Érvénytelen vagy visszavont kulcs |
