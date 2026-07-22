# Winunio — MVP scope

## Cél

Működő páros vita életciklus: vitaindítás → jelentkezés → meghívás → 1. forduló → folytatáskérések küszöb szerint → szimulált jutalom — a specifikált szabályokkal.

## Benne van (MVP)

| Terület | Scope |
|---------|--------|
| Auth | Regisztráció, bejelentkezés, e-mail megerősítés |
| Profil | Nyilvános profil, névvel vagy anonim mód (ellenőrzött fiók) |
| Vitaindítás | Kérdés (max. 160 kar.), kiinduló álláspont, kategória, előnézet, közzététel |
| Jelentkezés | Ingyenes, rövid állásponttal, várólista |
| Partner kiválasztás | Vitaindító választ; meghívás **48h** lejárat |
| 1. forduló | Partner elfogadás után **automatikus** indulás |
| Forduló modell | **Zárolt** forduló, **72h** timeout, 48h emlékeztető, háttérjob |
| Folytatáskérés | Közönség: **1 kérés / lezárt forduló / fiók** |
| Küszöb | `RoundUnlockRule`: **25 → 50 → 100 → 250 → 500**, majd duplázódik |
| Következő forduló | Küszöb teljesülése után, atomi tranzakcióban |
| Jutalom | `DebateReward`: **teljes összeg** küszöbön; **szimulált**, nincs kifizetés |
| Jutalom UI | Csak küszöb **után**; küszöb előtt semmi (nincs „0 Ft”) |
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
| Követőrendszer | MVP-n kívül |
| Privát üzenetek | MVP-n kívül |
| Automatikus partnerkiválasztás / pontszám | Alapelv |
| Személyre szabott ajánlóalgoritmus | Csak egyszerű, magyarázható rendezés |
| Natív mobilalkalmazás | Reszponzív web elég |
| Kriptovaluta, automatikus adományozás | MVP-n kívül |
| Közönségi kommentek | MVP-n kívül |
| AI vitaösszefoglaló | MVP-n kívül |
| Külön „függő” és „megerősített” folytatáskérés-számláló | Egyszerűsített MVP modell |

## Elfogadási kritériumok (magas szint)

1. Meghívás 48h után lejár; elfogadás után 1. forduló automatikusan indul.
2. Zárolt forduló: tartalom rejtett, egyidejű publikálás lezáráskor.
3. Timeout három ága: mindkét fél / egy fél / senki — spec szerint.
4. Folytatáskérés csak `published`, kétoldalú forduló után; Turnstile + challenge + Passkey + telefon (első alkalom).
5. Ugyanaz a fiók nem kérhet kétszer ugyanarra a lezárt fordulóra folytatást.
6. Küszöbök teljesülése után következő forduló + `DebateReward` atomikusan.
7. Küszöb előtt nincs jutalom UI.

## Kapcsolódó

- [PRODUCT.md](PRODUCT.md)
- [BUSINESS_RULES.md](BUSINESS_RULES.md)
- [DECISIONS.md](DECISIONS.md)
