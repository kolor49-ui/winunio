# Winunio — Moderálás

Világosan különválasztja a **moderációt** a **minősítéstől**.

---

## A platform vizsgálhatja

| Kategória | Példa |
|-----------|--------|
| Jogellenes tartalom | Büntetőjogi kockázat |
| Fenyegetés | Erőszakos fenyegetés |
| Személyes adat | Doxxing, telefonszám közzététele |
| Zaklatás | Célzott bántalmazás |
| Spam | Tömeges, irreleváns tartalom |
| Technikai visszaélés | Bot farm, manipulált folytatáskérések |

---

## A platform nem minősíti

- az álláspont intelligenciáját;
- a vitázó képességét;
- az érv „erősségét”;
- a politikai vagy erkölcsi helyességet;
- a partner kiválasztását („rossz partner” ≠ moderációs ok).

---

## MVP moderációs folyamat

**Státusz (emberi moderáció):** Tervezett — séma és domain állapotok megvannak; API és UI **nincs**.

```
Felhasználó → Report (ok kategória)
           → Admin queue
           → ModerationAction (under_review / remove / suspend / complete)
```

### AI tartalom-ellenőrzés (külön réteg)

**Státusz:** Tervezett — lásd [CONTENT_EDITOR.md](CONTENT_EDITOR.md).

| Réteg | Mikor | Ki dönt |
|-------|-------|---------|
| **AI tartalom-ellenőrzés** | Nyilvánosságra szánt résztvevői szöveg **közzététel előtt** | Automatikus; `revision_required` / `blocked` |
| **Emberi moderáció** | Jelentés, súlyos AI-eset, admin | Admin |

Az AI **nem** minősíti az érv erősségét — csak viselkedés / biztonság. Az AI **nem** fogalmaz helyette.

Súlyos AI-eset (`blocked`) továbbítható emberi queue-ba (implementáció: Tervezett).

### `under_review` hatása

- Vita `under_review` állapotba kerül.
- Új forduló beküldés és folytatáskérés **felfüggesztve**.
- Meglévő tartalom látható maradhat vagy elrejthető (admin döntés).

### Lezárás

- Admin `completed`-re állíthatja a vitát.
- Jutalom **nem** számolódik újra lezáráskor.

---

## Jelentés (Report)

- Bejelentkezett felhasználó jelenthet vitát, fordulót vagy konkrét argumentumot.
- Ok: `illegal` \| `threat` \| `pii` \| `harassment` \| `spam` \| `abuse`.
- Nincs közönség-szavazás-alapú moderáció.

---

## Vitaindító viselkedése

A partner kiválasztás **nem** minősítés — de szisztematikus kizárás / soha nem választ technikai visszaélés lehet → `ABUSE_PREVENTION`, nem tartalmi minősítés.

---

## GDPR / fióktörlés

A felhasználó **saját maga** kérheti a fiók végleges törlését (GDPR törlési jog). A moderációs `suspended` státusz **blokkolja** a törlést.

### Kérés feltételei

1. Bejelentkezett, `active` fiók.
2. Jelszó megerősítés kötelező.
3. `suspended` fiók → **403** (moderációs zárolás alatt nem törölhető).
4. Már `deleted` → **409** (idempotens visszajelzés).

### Személyes adatok (azonnal)

| Adat | Kezelés |
|------|---------|
| `email` | Egyedi helyettes: `deleted.{userId}@deleted.winunio.invalid` — az eredeti cím **felszabadul** új regisztrációra |
| `password_hash` | Véletlen, használhatatlan hash |
| `email_verified_at`, `phone_verified_at` | NULL |
| `public_profiles` | `display_name` NULL, `is_anonymous` true, `avatar_url` NULL |
| `email_auth_tokens`, `passkey_credentials`, `phone_verifications` | Törlés |
| `continuation_requests`, `continuation_challenges` | Törlés |
| `users.status` | `deleted` |

### Viták és tartalom

| Helyzet | Kezelés |
|---------|---------|
| Indító, vita még **nem indult** (`draft`, `waiting_for_partner`, `invitation_pending`) | Vita `cancelled`; nyitott jelentkezések `closed` / `withdrawn` |
| Meghívott partner, még nem fogadta el | Jelentkezés `rejected`; vita vissza `waiting_for_partner` |
| **Aktív vita** (`active`, `waiting_for_continuation`, `under_review`, `completed`) | A vita **megmarad**; a résztvevő nyilvános neve **„Törölt fiók”** (anonimizált profil) |
| Publikált argumentumok | Megmaradnak — vitatörténeti integritás; személyes azonosító nem |

### UI

- Beállítások: `/account` — **Fiók végleges törlése** + jelszó + figyelmeztetés.
- Siker után kijelentkezés; ugyanazzal az e-mail címmel **újra regisztrálhat**.

Kapcsolódó: [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md), [BUSINESS_RULES.md](BUSINESS_RULES.md) §13–§14, [DATA_MODEL.md](DATA_MODEL.md), [API.md](API.md), [CONTENT_EDITOR.md](CONTENT_EDITOR.md).
