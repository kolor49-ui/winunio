# Winunio — MVP scope

## Cél

Működő páros vita életciklus: vitaindítás → jelentkezés → meghívás → 1. forduló (A→B fokozatos publikálás) → folytatáskérések küszöb szerint → függő jutalom → zárógondolatok → szimulált kifizethető jutalom — a specifikált szabályokkal.

## Benne van (MVP)

| Terület | Scope |
|---------|--------|
| Auth | Regisztráció, bejelentkezés, e-mail megerősítés |
| Profil | Nyilvános profil, névvel vagy anonim mód (ellenőrzött fiók) |
| Vitaindítás | Kérdés (max. 160 kar.), kiinduló álláspont, kategória, előnézet, közzététel |
| Jelentkezés | Ingyenes, rövid állásponttal, várólista |
| Partner kiválasztás | Vitaindító választ; meghívás **48h** lejárat |
| 1. forduló | Partner elfogadás után **automatikus** indulás |
| Forduló modell | **A azonnal publikál → B válasz publikál**; **72h** timeout; 48h emlékeztető; háttérjob |
| Értesítés B válaszára | Egy vitára / fordulóra kötött kérés (**nem** követőrendszer) |
| Folytatáskérés | Közönség: **1 kérés / teljes lezárt forduló / fiók** |
| Küszöb | `RoundUnlockRule`: **25 → 50 → 100 → 250 → 500**, majd duplázódik |
| Következő forduló | Küszöb teljesülése után, atomi tranzakcióban; A válaszol először |
| Jutalom | `DebateReward`: **függő** küszöbön; **simulated** (kifizethető megjelenítés) csak teljes lezáráskor |
| Jutalom UI | Küszöb után függő összeg; küszöb előtt semmi (nincs „0 Ft”) |
| Vita lezárás | `awaiting_closure` → kötelező zárógondolatok (egyidejű publikálás) → `completed` |
| Abuse — folytatás | Turnstile + egyszer használható challenge + **kötelező Passkey minden kérésnél** |
| Abuse — telefon | **Első folytatáskérés előtt** kötelező ellenőrzés |
| Listák | „Új viták” (`created_at DESC`); „Népszerű” (7 napos folytatáskérések, nem személyre szabott) |
| Moderálás | Alap jelentés, admin, `under_review` állapot |
| Dokumentáció | Teljes `docs/` + Cursor rule |

## Kinn van (MVP)

| Terület | Indok |
|---------|--------|
| Valódi kifizetés / Payout | Spec: szimulált jutalom |
| Nevezési díj | Üzleti döntés |
| Lájk, szavazat, poll, reakció | Alapelv: tiltott |
| Győztes/vesztes UI | Alapelv: tiltott |
| Jutalom UI küszöb előtt | Üzleti szabály |
| Növekményes jutalom megjelenítés | `DebateReward` = teljes összeg |
| Több folytatáskérés / forduló / fiók | Abuse szabály |
| **Követőrendszer** | MVP-n kívül — az értesítés **nem** követés |
| Privát üzenetek | MVP-n kívül |
| Automatikus partnerkiválasztás / pontszám | Alapelv |
| Személyre szabott ajánlóalgoritmus | Csak egyszerű, magyarázható rendezés |
| Natív mobilalkalmazás | Reszponzív web elég |
| Kriptovaluta, automatikus adományozás | MVP-n kívül |
| Közönségi kommentek | MVP-n kívül |
| AI vitaösszefoglaló | MVP-n kívül |
| Külön „függő” és „megerősített” folytatáskérés-számláló | Egyszerűsített MVP modell |
| Forduló-végén rejtett tartalom + egyidejű leplemelés | Felülírva: fokozatos publikálás (ADR-024) |

## Elfogadási kritériumok (magas szint)

1. Meghívás 48h után lejár; elfogadás után 1. forduló automatikusan indul.
2. **A megszólalása azonnal nyilvános**; B csak utána válaszolhat; B válasza külön publikálódik.
3. Közönség látja a várakozást B-re; értesítés kérhető (nem követőrendszer).
4. Teljes forduló (`published`, kétoldalú) után folytatáskérés nyílik.
5. Timeout három ága: mindkét fél / egy fél / senki — spec szerint.
6. Folytatáskérés csak teljes `published` forduló után; Turnstile + challenge + Passkey + telefon (első alkalom).
7. Ugyanaz a fiók nem kérhet kétszer ugyanarra a lezárt fordulóra folytatást.
8. Küszöbök teljesülése után következő forduló + `DebateReward` **pending** atomikusan.
9. Küszöb előtt nincs jutalom UI.
10. Folytatási időszak lejárása → `awaiting_closure` → zárógondolatok egyidejű publikálása → `completed`.
11. Jutalom csak teljes lezáráskor válik **simulated** (kifizethető megjelenítés) állapotúvá.

## Kapcsolódó

- [PRODUCT.md](PRODUCT.md)
- [BUSINESS_RULES.md](BUSINESS_RULES.md)
- [DECISIONS.md](DECISIONS.md)
