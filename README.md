# Winunio

Páros vitaplatform — két fél, közös jutalom, közönség csak folytatást kérhet.

## Dokumentáció

| Dokumentum | Tartalom |
|------------|----------|
| [docs/PRODUCT.md](docs/PRODUCT.md) | Termékvízió, alapelvek, szereplők |
| [docs/MVP_SCOPE.md](docs/MVP_SCOPE.md) | MVP határok: benne / kinn |
| [docs/BUSINESS_RULES.md](docs/BUSINESS_RULES.md) | Üzleti szabályok — a rendszer „alkotmánya” |
| [docs/STATE_MACHINE.md](docs/STATE_MACHINE.md) | Állapotgépek (vita, forduló, jelentkezés) |
| [docs/ABUSE_PREVENTION.md](docs/ABUSE_PREVENTION.md) | Visszaélés-megelőzés, folytatáskérés |
| [docs/DATA_MODEL.md](docs/DATA_MODEL.md) | Entitások és kapcsolatok |
| [docs/DECISIONS.md](docs/DECISIONS.md) | Architektúra-döntések (ADR-001–023) |
| [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) | UI elvek, színek, komponensek |
| [docs/MODERATION.md](docs/MODERATION.md) | Moderálás vs. minősítés |
| [docs/USER_FLOWS.md](docs/USER_FLOWS.md) | Felhasználói folyamatok |
| [docs/API.md](docs/API.md) | API váz |

## Fejlesztés előtt

1. Olvasd el sorrendben: **PRODUCT → MVP_SCOPE → BUSINESS_RULES → STATE_MACHINE**.
2. Tartsd be a [.cursor/rules/winunio-project.mdc](.cursor/rules/winunio-project.mdc) szabályait.
3. Ha a spec nem tartalmaz valamit, **ne találj ki szabályt** — kérdezz.

## MVP korlátok (rövid)

- Szimulált jutalom, **nincs kifizetés**.
- Nincs győztes/vesztes, lájk, résztvevő-szavazat.
- Küszöb előtt **nincs jutalom UI** (nincs „0 Ft” sem).
- Folytatáskérés: Turnstile + challenge + **Passkey minden kérésnél** + telefon (első alkalom).

## Repo struktúra

```
Winunio/
├── README.md
├── package.json
├── src/domain/          # tiszta állapotgép logika
├── tests/state-machine/
├── db/
│   ├── README.md
│   └── migrations/
├── docs/
│   ├── PRODUCT.md
│   ├── MVP_SCOPE.md
│   ├── BUSINESS_RULES.md
│   ├── STATE_MACHINE.md
│   ├── ABUSE_PREVENTION.md
│   ├── DATA_MODEL.md
│   ├── DECISIONS.md
│   ├── DESIGN_SYSTEM.md
│   ├── MODERATION.md
│   ├── USER_FLOWS.md
│   └── API.md
└── .cursor/
    └── rules/
        └── winunio-project.mdc
```

## Következő lépések (implementáció)

1. ~~Git init + első commit (docs only).~~
2. ~~Postgres séma / migrációk a `DATA_MODEL.md` alapján.~~ → [db/README.md](db/README.md)
3. ~~Állapotgép tesztek a `STATE_MACHINE.md` alapján.~~ → `npm test`
4. ~~Next.js scaffold + auth + első API végpontok.~~ → `npm run dev`

## App futtatás

```bash
cp .env.example .env   # DATABASE_URL + AUTH_SECRET
npm run db:migrate     # ha még nem futott a 000003
npm install
npm run dev
```

Nyisd meg: http://localhost:3000

API: `/api/v1/health`, `/api/v1/auth/*`, `/api/v1/debates`
