# Winunio — Android natív app (v1)

> **Státusz:** Tervezett — [ADR-037](DECISIONS.md#adr-037--android-natív-app-v1-teljes-mvp-paritás)  
> **Platform:** Android (Play Store). iOS nincs v1-ben.  
> **Backend:** Meglévő `/api/v1` — külön mobil backend nem készül.

## Cél

A felhasználó **ne kelljen ki-be lépkedni** a böngésző és az app között: vitaindító, jelentkező, vitázó és közönség **ugyanazt a MVP-t** használja Androidon.

A web **marad** (asztali, linkek, SEO). Az app **elsődleges mobilélmény**.

---

## Technológia

| Réteg | Választás |
|-------|-----------|
| Framework | **React Native + Expo** (managed workflow) |
| Nyelv | TypeScript |
| API | HTTPS → `https://www.winunio.com/api/v1` |
| Auth | JWT Bearer (lásd Előfeltétel) |
| Folytatáskérés megerősítés | **TOTP** (ugyanaz mint weben, ADR-038) |
| Store | Google Play (meglévő fejlesztői fiók, új app listing) |
| Csomagnév | `com.winunio.app` (javasolt) |

---

## Előfeltétel (backend, app előtt)

~~A web session **httpOnly cookie**~~ **Kész (2026-08-11):**

1. Login/register válasz: `access_token` (JWT).
2. `Authorization: Bearer` elfogadása védett API-n.
3. Android folytatás: challenge + `totp_code` (authenticator app).

---

## v1 funkciók — teljes MVP paritás

Minden sor = **benne van v1-ben**. Forrás: [USER_FLOWS.md](USER_FLOWS.md), [API.md](API.md).

### Auth és fiók

| Funkció | UF | API |
|---------|-----|-----|
| Regisztráció | — | `POST /auth/register` |
| Bejelentkezés | — | `POST /auth/login` |
| E-mail megerősítés (deep link / kód) | — | `POST /auth/verify-email` |
| Elfelejtett jelszó | — | `POST /auth/forgot-password` |
| Jelszó visszaállítás | — | `POST /auth/reset-password` |
| Kijelentkezés | — | `POST /auth/logout` |
| Saját profil / fiók | — | `GET /auth/me`, account |
| Fiók törlése | — | `DELETE /auth/account` |
| Vitáim | — | vitaim lista API |

### Felfedezés és olvasás

| Funkció | UF | Megjegyzés |
|---------|-----|------------|
| Főoldal: új viták | — | `GET /debates` |
| Népszerű viták | — | ugyanaz |
| Vita részletek | UF-06 | `GET /debates/:id`, fordulók |
| Jutalom megjelenítés | UF-09 | `GET /debates/:id/reward` — küszöb szabályok szerint |
| Jelentés | — | `POST /reports` |

### Vitaindító

| Funkció | UF | API |
|---------|-----|-----|
| Vita indítása (kérdés, álláspont, kategória) | UF-01 | `POST /debates` |
| Jelentkezők listája | UF-03 | `GET …/applications` |
| Partner kiválasztása / meghívás | UF-03 | `POST …/select-partner` |
| Vita visszavonása | UF-01 | `POST …/cancel` |
| Piszkozat / tartalom-ellenőrzés | — | `POST /content-reviews` (ha weben is elérhető) |

### Jelentkező / partner

| Funkció | UF | API |
|---------|-----|-----|
| Jelentkezés állásponttal | UF-02 | `POST …/applications` |
| Meghívás elfogadása | UF-04 | `POST /invitations/:id/accept` |
| Meghívás elutasítása | UF-04 | `POST /invitations/:id/reject` |

### Vitázó (A és B)

| Funkció | UF | API |
|---------|-----|-----|
| Forduló megtekintése | UF-05, UF-06 | `GET …/rounds` |
| Megszólalás / válasz beküldése | UF-06 | `POST /rounds/:id/arguments` |
| Zárógondolat | UF-10 | `POST …/closing-statements` |
| A/B fix oldal, színek | — | [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) |

### Közönség

| Funkció | UF | App specifikus |
|---------|-----|----------------|
| Folytatáskérés | UF-07 | **TOTP** + challenge API |
| Authenticator beállítás | UF-07 | `POST /auth/totp/setup`, `confirm` — egyszer |
| Értesítés B válaszára | UF-06a | `POST …/response-notifications` |
| Folytatásszámláló | UF-08 | státusz API-ból |

### Folytatáskérés appban (ADR-037)

```
KÉREM A FOLYTATÁST
  → [első alkalom: TOTP beállítás a fiókban]
  → challenge kiadás (POST …/challenge)
  → 6 jegy az authenticator appból
  → POST …/continuation-requests (challenge_id + totp_code)
  → kérés rögzítve
```

Web és app **ugyanaz** a TOTP csatorna (ADR-038).

---

## v1-ben NINCS

| Kizárva | Indok |
|---------|--------|
| iOS / App Store | Döntés: csak Android |
| Admin moderáció | Web elég |
| Push értesítés | v1.1 — FCM külön infra; v1-ben in-app + e-mail |
| Offline mód | Nincs |
| Kripto, token, ranglista | MVP-n kívül |
| Webes Passkey UI | App biometria helyettesíti |

---

## Implementációs sorrend (javasolt)

1. **Backend:** Bearer auth + mobil folytatás assertion endpoint
2. **Expo projekt** (`apps/mobile`), navigáció, design tokenek
3. **Auth flow** (login, register, session tárolás SecureStore)
4. **Vita lista + részlet** (olvasás)
5. **Vitaindítás + jelentkezés + meghívás**
6. **Forduló írás + zárógondolat**
7. **Folytatáskérés TOTP-pal**
8. **Vitáim, account, report**
9. **Play internal testing** → production

Becsült **kód** (egy fejlesztő / AI páros): ~2–3 hét funkció szerint haladva.

---

## Play Store

- **Új app** ugyanabban a fejlesztői fiókban (Inauone minta).
- **Internal testing** → saját telefon.
- Ikon, rövid leírás, adatvédelmi link: `winunio.com`.
- `google-services.json` csak ha később FCM (v1.1).

---

## Kapcsolódó dokumentumok

- [MVP_SCOPE.md](MVP_SCOPE.md) — web MVP; mobil külön fázis
- [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md) — folytatás szabályok
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — A/B színek, gombok
- [DECISIONS.md](DECISIONS.md) ADR-036, ADR-037
