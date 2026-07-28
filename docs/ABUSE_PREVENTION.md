# Winunio — Visszaélés-megelőzés

> Nem azt ígérjük, hogy robot számára **lehetetlen** folytatáskérést leadni. Emberfarm, feltört fiók vagy távoli eszközvezérlés ellen nincs tökéletes védelem.

**Pontos ígéret:**

> Minden folytatáskéréshez ellenőrzött fiók, egyszeri szerveroldali engedély és emberi jelenlétet igénylő megerősítés szükséges. A tömeges visszaélés **költségét** a megszerezhető jutalom **fölé** emeljük.

---

## 1. Folytatáskérés — emberi megerősítés (MVP)

A folytatáskérés **nem** rögzíthető kizárólag kliensoldali gombnyomás vagy közvetlen API-hívás alapján.

### Rögzítés feltételei

1. bejelentkezett felhasználó;
2. **megerősített e-mail-cím**;
3. **megerősített telefonszám** (első folytatáskérés előtt kötelező; utána a fiókhoz kötött);
4. szerver által kiadott, **egyszer használható** challenge;
5. **SMS OTP** (6 jegy, a fiókhoz kötött telefonra) — emberi jelenlét, eszközön;
6. challenge **szerveroldali** ellenőrzése;
7. felhasználó + lezárt forduló **egyediségének** ellenőrzése (`UNIQUE(user_id, completed_round_id)`);
8. **sebességkorlát** teljesítése.

> **MVP (2026-07):** Webes folytatáskérés megerősítése **SMS OTP** (ADR-036). Passkey a web UI-ból kikerült; natív app későbbi fázis. Turnstile nincs. Botvédelem: e-mail + telefon (első alkalom) + SMS minden kérésnél + challenge + rate limit.

### Challenge szabályok

- egyszer használható;
- felhasználóhoz kötött;
- lezárt fordulóhoz kötött;
- rövid ideig érvényes (TTL);
- sikeres, sikertelen vagy lejárt feldolgozás után **nem** használható újra.

A kliens **nem** küldhet érvényes folytatáskérést előzetesen kiadott challenge nélkül.

---

## 2. SMS OTP megerősítés minden folytatáskérésnél (MVP web)

**Döntés:** Minden folytatáskérés véglegesítéséhez **SMS OTP** szükséges a fiókhoz kötött telefonra (ADR-036).

### UI folyamat

```
KÉREM A FOLYTATÁST
  → SMS kód a regisztrált telefonra
  → 6 jegy beírása
  → kérés rögzítve
```

**Passkey (WebAuthn):** későbbi **natív app** — nem része a webes MVP folytatás UI-nak.

---

## 3. Egy kérés / lezárt forduló / fiók

- Ugyanaz a fiók **nem** adhat le második folytatáskérést **ugyanarra a lezárt fordulóra**.
- Implementáció: `UNIQUE(user_id, completed_round_id)`.
- API **idempotens**: ismételt sikeres hívás → 200 + meglévő rekord, számláló nem nő.

---

## 4. Számlálás és gazdasági modell (MVP)

Az MVP-ben **nincs** külön nyilvános „függő” és „megerősített” számláló.

- A nyilvános számláló = a küszöbhöz számító érvényes kérések száma.
- Minden szabályosan rögzített kérés érvényesnek minősül és beleszámít a küszöbbe.
- Utólagos csalásvizsgálat, függő státusz és külön „megerősített aktivitás” számláló **nem** része az MVP-nek.

A jutalom **szimulált**; a visszaélés költségét a fenti súrlódások (e-mail, telefon, SMS OTP, rate limit) emelik.

---

## 5. Sebességkorlátok

| Terület | MVP irány |
|---------|-----------|
| Folytatáskérés / fiók / nap | Redis/Upstash rate limit |
| Challenge kiadás | Rate limit / fiók |
| OTP / telefon | Szolgáltatói limit + saját cooldown |
| Új fiók | Első folytatáskéréshez telefon kötelező |

Pontos számok: admin konfiguráció; ne égesd be a forráskódba.

---

## 6. Nincs közönség-szavazás

Lájk és résztvevő-szavazat **nem** implementálandó — nincs alternatív „gyors reakció” abuse felület.

---

## 7. Meghívás és forduló időzítés

- Meghívás **48h** után lejár — csökkenti a stale meghívás abuse-ot.
- Forduló **72h** limit — háttérjob zárja le; végtelenül nyitott fordulók elkerülése.

---

## 8. Naplózás

Minden folytatáskérés-kísérlet (siker és sikertelen) → `SecurityEvent` / `AuditLog`:

- user_id, completed_round_id, challenge_id;
- SMS OTP eredmény;
- rate limit elutasítás;
- időbélyeg, IP hash (GDPR-kompatibilis tárolás).

---

## 9. Technológiai stack (cserélhető szolgáltatók)

| Réteg | MVP javaslat |
|-------|----------------|
| SMS OTP | Twilio Verify |
| Botvédelem | SMS OTP + rate limit |
| Telefon OTP | Twilio Verify, Sinch vagy más |
| Rate limit | Redis / Upstash |
| Adatbázis | Postgres + egyedi kulcsok |

A pontos szolgáltató később cserélhető; a **biztonsági követelmény** nem függ egyetlen vendortól.

---

## 10. Ellenőrzési sorrend (implementációs javaslat)

```
1. Fiók létezik, nem suspended
2. E-mail verified
3. Telefon verified (első folytatáskérésnél kötelező)
4. Vita `waiting_for_continuation`; forduló teljes, kétoldalú `published`
5. Még nincs kérés ebből a fiókból erre a completed_round_id-re
6. Rate limit OK
7. Challenge issued, nem expired, nem consumed
8. SMS OTP OK
9. INSERT ContinuationRequest (tranzakció: számlálás + esetleges küszöb)
```

Kapcsolódó: [BUSINESS_RULES.md](BUSINESS_RULES.md), [MODERATION.md](MODERATION.md), [DECISIONS.md](DECISIONS.md) ADR-011–012, ADR-018–021.
