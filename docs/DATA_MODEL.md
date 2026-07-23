# Winunio — Adatmodell

Logikai modell — implementáció: Postgres séma + migrációk külön lépés.

---

## Entitások áttekintés

```
User ──────────────┬──< PublicProfile
                   ├──< DebateApplication
                   ├──< DebateParticipant
                   ├──< ContinuationRequest
                   ├──< PasskeyCredential
                   ├──< PhoneVerification
                   └──< SecurityEvent / AuditLog

Debate ──< Round ──< Argument
    │         │
    │         └── ContinuationRequest (completed_round_id)
    ├── DebateReward
    └── Report → ModerationAction
```

---

## User

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `email` | string | Kötelező regisztrációnál |
| `email_verified_at` | timestamp \| null | Folytatáskéréshez kötelező |
| `phone_verified_at` | timestamp \| null | Első folytatáskérés előtt kötelező |
| `created_at` | timestamp | |
| `status` | enum | `active` \| `suspended` \| `deleted` |

**Törlés után:** e-mail helyettesítő domain (`deleted.winunio.invalid`); bejelentkezés és folytatáskérés nem lehetséges. Vitatartalom megmaradhat anonimizált résztvevővel — lásd [MODERATION.md](MODERATION.md).

## PublicProfile

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `user_id` | User ref | |
| `display_name` | string \| null | Névvel induláskor |
| `is_anonymous` | boolean | Ellenőrzött fiók + anonim mód |
| `avatar_url` | string \| null | Opcionális |

---

## Debate

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `initiator_id` | User ref | |
| `question` | string(160) | Vitakérdés |
| `initiator_stance` | text | Rövid kiinduló álláspont |
| `category` | string | |
| `status` | enum | Lásd STATE_MACHINE |
| `created_at` | timestamp | |
| `published_at` | timestamp \| null | |

**Állapotok:** `draft` \| `waiting_for_partner` \| `invitation_pending` \| `active` \| `waiting_for_continuation` \| `completed` \| `cancelled` \| `under_review`

**Szabályok:** Nincs `winner_id`, `loser_id`, `likes_count`.

---

## DebateApplication

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `debate_id` | Debate ref | |
| `user_id` | User ref | |
| `stance` | text | Rövid álláspont |
| `status` | enum | `pending` \| `invited` \| `accepted` \| `rejected` \| `expired` \| `withdrawn` \| `closed` |
| `invited_at` | timestamp \| null | |
| `invitation_expires_at` | timestamp \| null | `invited_at` + 48h |
| `created_at` | timestamp | |

---

## DebateParticipant

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `debate_id` | Debate ref | |
| `user_id` | User ref | |
| `role` | enum | `initiator` \| `partner` |
| `side` | enum | `A` \| `B` — fix pozíció |
| `public_profile_id` | PublicProfile ref | |

**Korlát:** Pontosan 2 résztvevő / vita; `side` nem cserélődik.

---

## Round

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `debate_id` | Debate ref | |
| `round_number` | int | 1, 2, 3, … |
| `status` | enum | `open` \| `published` \| `closed_without_content` |
| `opened_at` | timestamp | |
| `deadline_at` | timestamp | `opened_at` + 72h |
| `reminder_sent_at` | timestamp \| null | 48h emlékeztető |
| `published_at` | timestamp \| null | |

**Állapotok:** `open` — válaszadás; `published` — tartalom nyilvános; `closed_without_content` — senki nem válaszolt.

---

## Argument

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `round_id` | Round ref | |
| `participant_id` | DebateParticipant ref | |
| `content` | text | |
| `submitted_at` | timestamp | |
| `published_at` | timestamp \| null | Forduló lezárásakor |
| `is_system_placeholder` | boolean | Timeout hiányzó oldal |

**Korlát:** Max 1 argument / résztvevő / forduló.

---

## ContinuationRequest

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `debate_id` | Debate ref | |
| `completed_round_id` | Round ref | Melyik lezárt forduló után |
| `user_id` | User ref | Közönségi fiók |
| `challenge_id` | ContinuationChallenge ref | |
| `created_at` | timestamp | |

**Üzleti kapcsolat:** `target_round_number = completed_round.number + 1`

**Korlát:**

```sql
UNIQUE(user_id, completed_round_id)
```

Idempotens: ismételt kérés nem hoz létre új rekordot.

---

## ContinuationChallenge

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `user_id` | User ref | |
| `completed_round_id` | Round ref | |
| `challenge_token` | string | Kriptográfiailag biztonságos, szerveroldali |
| `status` | enum | `issued` \| `consumed` \| `invalidated` \| `expired` |
| `expires_at` | timestamp | Rövid TTL |
| `consumed_at` | timestamp \| null | |

---

## RoundUnlockRule

Egyetlen konfigurációs entitás a küszöbhöz és jutalomhoz (ADR-013).

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `completed_round_number` | int | 1 → 25 kérés → 2. forduló |
| `required_continuation_requests` | int | |
| `reward_amount_per_participant` | decimal | Teljes összeg |
| `active_from` | timestamp | Csak új vitákra |
| `active_to` | timestamp \| null | |
| `created_at` | timestamp | |

**MVP induló értékek:** 1→25/1000, 2→50/2000, 3→100/4000, 4→250/8000, 5→500/12000; 6+ duplázódó küszöb.

---

## DebateReward

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `debate_id` | Debate ref | |
| `unlocked_by_completed_round_id` | Round ref | |
| `round_unlock_rule_id` | RoundUnlockRule ref | |
| `amount_per_participant` | decimal | Teljes összeg, nem növekmény |
| `status` | enum | MVP: `simulated` |
| `calculated_at` | timestamp | Küszöb elérésekor |

**Korlátok:**

```sql
UNIQUE(debate_id, unlocked_by_completed_round_id)
UNIQUE(debate_id, round_unlock_rule_id)
```

A vita aktuális jutalma = legutóbbi `DebateReward` rekord. Küszöb előtt nincs rekord → nincs UI.

---

## PasskeyCredential

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `user_id` | User ref | |
| `credential_id` | string | WebAuthn |
| `public_key` | bytes | |
| `counter` | bigint | Signature counter |
| `created_at` | timestamp | |

---

## PhoneVerification

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `user_id` | User ref | |
| `phone_e164` | string | |
| `verified_at` | timestamp | |

---

## Report

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `reporter_id` | User ref | |
| `debate_id` | Debate ref \| null | |
| `round_id` | Round ref \| null | |
| `reason` | enum | `illegal` \| `threat` \| `pii` \| `harassment` \| `spam` \| `abuse` |
| `status` | enum | `open` \| `reviewed` \| `dismissed` |
| `created_at` | timestamp | |

---

## ModerationAction

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `admin_id` | User ref | |
| `target_type` | enum | `debate` \| `user` \| `argument` |
| `target_id` | UUID | |
| `action` | enum | `under_review` \| `remove_content` \| `suspend_user` \| `complete_debate` |
| `note` | text | |
| `created_at` | timestamp | |

---

## SecurityEvent / AuditLog

| Mező | Típus | Megjegyzés |
|------|-------|------------|
| `id` | UUID | |
| `user_id` | User ref \| null | |
| `event_type` | string | pl. `continuation_request`, `passkey_fail`, `rate_limit` |
| `metadata` | jsonb | |
| `ip_hash` | string \| null | |
| `created_at` | timestamp | |

---

## Indexek / constraint-ek

| Constraint | Szabály |
|------------|---------|
| `UNIQUE(user_id, completed_round_id)` on ContinuationRequest | 1 kérés / forduló / fiók |
| `UNIQUE(debate_id, side)` on DebateParticipant | A/B fix |
| Invitation / Application `invitation_expires_at` | 48h |
| Round `deadline_at` | 72h |

Kapcsolódó: [BUSINESS_RULES.md](BUSINESS_RULES.md), [API.md](API.md), [STATE_MACHINE.md](STATE_MACHINE.md).
