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

### `DELETE /api/v1/auth/account`

Fiók végleges törlése (GDPR).

| | |
|---|---|
| **Jogosultság** | Bejelentkezett, `active` |
| **Bemenet** | `password` |
| **Üzleti szabály** | Anonimizálás + viták kezelése — [MODERATION.md](MODERATION.md) |
| **Válasz** | `200` `{ deleted: true }`; session törlődik |
| **Hibák** | `401` jelszó; `403` suspended; `409` már törölve |

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

### `POST /api/v1/debates/:id/cancel`

Vitaindító visszavonja a vitát → `cancelled`.

| | |
|---|---|
| **Jogosultság** | Vitaindító |
| **Üzleti szabály** | Csak `waiting_for_partner` vagy `invitation_pending`; nyitott jelentkezések `closed` |
| **Válasz** | `200` `{ debate_id, debate_status: "cancelled" }` |
| **Hibák** | `403` nem indító; `409` nem visszavonható állapot |
| **Idempotencia** | Már `cancelled` → `200` |

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

Fordulók listája. **Fokozatos publikálás:** A már publikált argumentumok látszanak; B hiányában „awaiting_b” meta.

### `POST /api/v1/rounds/:id/arguments`

| | |
|---|---|
| **Jogosultság** | Vitázó, saját forduló `open` |
| **Bemenet** | `reasoning`, opcionális `quote`, `source` (**Tervezett**); jelenleg: `content` |
| **Üzleti szabály** | Sorrend: **A először**, majd B (A már publikálva); max 1 / résztvevő / forduló; A publikálódik beküldéskor |
| **Tartalom-ellenőrzés** | **Tervezett** — közzététel előtt AI review; fail-closed — [CONTENT_EDITOR.md](CONTENT_EDITOR.md) |
| **Idempotencia** | Frissítés tiltott beküldés után (MVP); A nem módosítható B válasza után |

### `POST /api/v1/rounds/:id/response-notifications`

| | |
|---|---|
| **Jogosultság** | Bejelentkezett (vagy e-mail — implementáció) |
| **Üzleti szabály** | Csak `awaiting_b` fázisban; egy kérés / forduló / felhasználó; **nem** követőrendszer |
| **Mellékhatás** | Értesítés B válasz publikálásakor |

---

## Zárógondolatok

### `POST /api/v1/debates/:id/closing-statements`

| | |
|---|---|
| **Jogosultság** | Vitázó; vita `awaiting_closure` |
| **Bemenet** | `reasoning`, opcionális `quote`, `source` (**Tervezett**); jelenleg: `content` |
| **Üzleti szabály** | Rejtett a partner elől; mindkét beküldés után **egyidejű** publikálás; vita → `completed` |
| **Tartalom-ellenőrzés** | **Tervezett** — [CONTENT_EDITOR.md](CONTENT_EDITOR.md) |

---

## Tervezett — Vitaszerkesztő és tartalom-ellenőrzés

**Státusz:** Részben implementálva — lásd [CONTENT_EDITOR.md](CONTENT_EDITOR.md).

### `POST /api/v1/content-reviews` — **Implementálva**

| | |
|---|---|
| **Cél** | Szöveg ellenőrzése közzététel előtt |
| **Bemenet** | `context_type`, `context_id`, `reasoning`, `quote`, `source` |
| **Válasz** | `approved` \| `revision_required` (issues[]) \| `blocked` |
| **Szabály** | AI **nem** ad átfogalmazást; provider hiba → **503**, nincs közzététel |

### `POST /api/v1/content-reviews/:id/spell-check`

| | |
|---|---|
| **Cél** | Opcionális helyesírás — **csak** külön kérésre |
| **Válasz** | Javaslatok (eredeti + javítás + offset); elfogadás külön végponton |

### `PUT /api/v1/content-drafts/:contextType/:contextId`

| | |
|---|---|
| **Cél** | Automatikus piszkozat mentés / visszaállítás |
| **Üzleti szabály** | Fiókhoz kötött; verzió history |

### Publish útvonalak

A `POST …/arguments`, `POST …/closing-statements`, `POST …/debates`, `POST …/applications` **Implementálva**: közzététel előtt OpenAI tartalom-ellenőrzés; fail-closed.

---

## Folytatáskérés

### `POST /api/v1/rounds/:completedRoundId/continuation-requests/challenge`

Challenge kiadása (bejelentkezett, telefon + Passkey előfeltételekkel).

### `POST /api/v1/rounds/:completedRoundId/continuation-requests`

| | |
|---|---|
| **Bemenet** | `challenge_id`, `passkey_assertion` |
| **Üzleti szabály** | ABUSE_PREVENTION teljes pipeline |
| **Idempotencia** | **Kötelező** — `UNIQUE(user_id, completed_round_id)`; retry → `200` meglévő |
| **Mellékhatás** | Számláló +1; esetleg atomi küszöb-esemény |

**Hibakódok:** `401` auth; `403` telefon/e-mail; `409` duplicate; `422` Passkey/challenge; `429` rate limit.

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

Kapcsolódó: [DATA_MODEL.md](DATA_MODEL.md), [USER_FLOWS.md](USER_FLOWS.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md), [CONTENT_EDITOR.md](CONTENT_EDITOR.md).
