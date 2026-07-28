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
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Auth Token |
| `TWILIO_VERIFY_SERVICE_SID` | Verify → Services → `VA…` (SMS OTP) |

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

Válasz: `{"status":"ok","database":"connected", "content_review": { "ready": true, ... }, "sms": { "ready": true, "provider": "twilio_verify" }}`

## 6. Twilio Verify (telefonos SMS)

1. Regisztráció: [twilio.com/try-twilio](https://www.twilio.com/try-twilio)
2. Console → **Account Info** → másold: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`
3. **Verify** → **Services** → **Create** → Service neve: `Winunio` → másold a **Service SID** (`VA…`) → `TWILIO_VERIFY_SERVICE_SID`
4. Trial fióknál: **Phone Numbers** → **Verified Caller IDs** → add hozzá a **saját** mobilszámod (csak erre megy SMS trialban)
5. Vercel → **Settings → Environment Variables** → mindhárom Twilio env → **Production** + **Preview**
6. **Redeploy**
7. Ellenőrzés: `GET /api/v1/health` → `"sms": { "ready": true, "provider": "twilio_verify" }`
8. Vitánál: telefonszám → SMS a telefonodra → 6 jegyű kód beírása

Trial korlát: SMS csak **Twilio-ban regisztrált** számokra megy, amíg nincs fizetős upgrade.

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
