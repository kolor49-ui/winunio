# Winunio — API

REST API váz, `/api/v1` prefix. OpenAPI séma külön lépés.

Minden végpontnál dokumentálandó: cél, bemenet, válasz, jogosultság, üzleti szabály, hibaállapot, idempotencia, sebességkorlát.

---

## Auth

| Mód | Használat |
|-----|-----------|
| Session / JWT | Általános bejelentkezett műveletek |
| WebAuthn assertion | Folytatáskérés véglegesítése (kötelező) |

Vitázók: e-mail + jelszó (MVP). Passkey regisztráció folytatáskéréshez.

---

## Debates

### `POST /api/v1/debates`

Vitaindítás.

| | |
|---|---|
| **Jogosultság** | Bejelentkezett |
| **Bemenet** | `question`, `initiator_stance`, `category`, `display_mode` |
| **Üzleti szabály** | Max 160 kar. kérdés; `waiting_for_partner` |
| **Válasz** | `201` + Debate |

### `GET /api/v1/debates`

Lista.

| | |
|---|---|
| **Query** | `sort=new` (default) \| `sort=popular` |
| **Üzleti szabály** | `new` = `created_at DESC`; `popular` = 7 napos folytatáskérések DESC |

### `GET /api/v1/debates/:id`

Vita részletek + aktuális forduló + számlálók.

---

## Applications

### `POST /api/v1/debates/:id/applications`

Jelentkezés.

| | |
|---|---|
| **Bemenet** | `stance` |
| **Üzleti szabály** | Ingyenes; vita `waiting_for_partner` |

### `GET /api/v1/debates/:id/applications`

Jelentkezők listája (vitaindító).

| | |
|---|---|
| **Jogosultság** | Vitaindító |
| **Üzleti szabály** | Nincs rangsor, nincs pontszám |

### `DELETE /api/v1/applications/:id`

Jelentkezés visszavonása → `withdrawn`.

---

## Partner kiválasztás / meghívás

### `POST /api/v1/debates/:id/select-partner`

| | |
|---|---|
| **Bemenet** | `application_id` |
| **Üzleti szabály** | Csak vitaindító; meghívás 48h; `invitation_pending` |

---

## Meghívás

### `POST /api/v1/invitations/:id/accept`

| | |
|---|---|
| **Jogosultság** | Meghívott jelentkező |
| **Mellékhatás** | Debate `active`; Round #1 `open` |
| **Hiba** | `410` lejárt meghívás |

### `POST /api/v1/invitations/:id/reject`

→ `waiting_for_partner`.

---

## Rounds / Arguments

### `GET /api/v1/debates/:id/rounds`

Fordulók listája (published tartalom nyilvános).

### `POST /api/v1/rounds/:id/arguments`

| | |
|---|---|
| **Jogosultság** | Vitázó, saját forduló `open` |
| **Üzleti szabály** | Zárolt modell; max 1 / résztvevő / forduló |
| **Idempotencia** | Frissítés tiltott beküldés után (MVP) |

---

## Folytatáskérés

### `POST /api/v1/rounds/:completedRoundId/continuation-requests/challenge`

Challenge kiadása (Turnstile token szükséges).

### `POST /api/v1/rounds/:completedRoundId/continuation-requests`

| | |
|---|---|
| **Bemenet** | `challenge_id`, `turnstile_token`, `passkey_assertion` |
| **Üzleti szabály** | ABUSE_PREVENTION teljes pipeline |
| **Idempotencia** | **Kötelező** — `UNIQUE(user_id, completed_round_id)`; retry → `200` meglévő |
| **Mellékhatás** | Számláló +1; esetleg atomi küszöb-esemény |

**Hibakódok:** `401` auth; `403` telefon/e-mail; `409` duplicate; `422` Turnstile/Passkey/challenge; `429` rate limit.

---

## Rewards

### `GET /api/v1/debates/:id/reward`

| | |
|---|---|
| **Válasz** | `404` ha nincs még `DebateReward`; `200` + `amount_per_participant` ha van |
| **Üzleti szabály** | Ne adj vissza `amount: 0` preview-t |

---

## Phone / Passkey

### `POST /api/v1/phone/start` / `confirm`

OTP indítás és megerősítés.

### `POST /api/v1/passkeys/register` / `authenticate`

WebAuthn regisztráció és assertion.

---

## Reports

### `POST /api/v1/reports`

| | |
|---|---|
| **Bemenet** | `target_type`, `target_id`, `reason` |

---

## Admin (MVP)

### `POST /api/v1/admin/debates/:id/under-review`

### `POST /api/v1/admin/moderation-actions`

---

## Háttérjob (nem publikus API)

| Job | Trigger | Hatás |
|-----|---------|--------|
| `round-deadline-reminder` | `opened_at` + 48h | Emlékeztető vitázóknak |
| `round-timeout` | `deadline_at` | Round lezárás 3 ággal |
| `invitation-expiry` | `invitation_expires_at` | `expired` |

---

## Rate limiting

Redis/Upstash — végpontonként konfigurálható. Folytatáskérés: szigorúbb limit.

Kapcsolódó: [DATA_MODEL.md](DATA_MODEL.md), [USER_FLOWS.md](USER_FLOWS.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md).
