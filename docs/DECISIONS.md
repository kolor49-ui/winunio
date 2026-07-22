# Winunio — Architecture Decision Records (ADR)

Döntési napló. **Státusz:** `Elfogadva` = rögzített spec; `Nyitott` = még nem döntött.

---

## ADR-001 — Nincs résztvevőre adott szavazat

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Nincs lájk, reakció vagy A/B résztvevőre szavazat.  
**Indok:** A közönség nem ítélkezik a vitázók felett.  
**Elvetett alternatíva:** „Támogatom A-t” gomb.  
**Újravizsgálat:** Ha új közönség-interakció kell — csak folytatáskérés maradhat.

---

## ADR-002 — A vitaindító választ partnert

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Kizárólag a vitaindító választ a jelentkezők közül.  
**Indok:** Személyes párosítás, nincs algoritmus.  
**Elvetett alternatíva:** Automatikus partnermatching, pontszám.

---

## ADR-003 — Nincs vitázói rangsor

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Nincs leaderboard, győzelmi arány, teljesítménypont.  
**Elvetett alternatíva:** „Top vitázók” lista.

---

## ADR-004 — A és B színei nem cserélődnek

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** A = `#6F8F72`, B = `#8A78A8`; A bal, B jobb.  
**Indok:** Konzisztens vizuális nyelv, nem verseny-színkód.

---

## ADR-005 — Induláskor nincs nevezési díj

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Jelentkezés és részvétel ingyenes az MVP-ben.

---

## ADR-006 — A jutalom mindig azonos mindkét vitázónak

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** `DebateReward.amount_per_participant` mindkét félre azonos.

---

## ADR-007 — MVP: szimulált jutalom, nincs kifizetés

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Nincs payout, pénztárca, payment provider az MVP-ben.

---

## ADR-008 — 1. forduló automatikus partner elfogadás után

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Meghívás elfogadása → 1. forduló automatikusan `open`; folytatáskérés nem kell.

---

## ADR-009 — Async fordulómodell (nem élő vita)

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Zárolt beküldés, 72h határidő, egyidejű publikálás — nem real-time stream.  
**Újravizsgálat:** Ha lesz élő vita funkció.

---

## ADR-010 — RoundUnlockRule: 25 → 50 → 100 → 250 → 500, majd duplázódik

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Abszolút küszöbök fordulónként; korábbi kérések nem halmozódnak.

---

## ADR-011 — DebateReward: teljes összeg, nem növekmény

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Küszöb elérésekor a teljes összeg jelenik meg, nem running total.

---

## ADR-012 — Nincs jutalom UI küszöb előtt

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Nincs jutalmi sáv, nincs „0 Ft” placeholder.

---

## ADR-013 — Fordulóküszöb = jutalmi küszöb (RoundUnlockRule)

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Egy `RoundUnlockRule` rekord definiálja a következő forduló küszöbét és a jutalom összegét.

---

## ADR-014 — DebateReward a küszöb elérésekor, atomi tranzakcióban

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Küszöb + új forduló + reward frissítés egy tranzakcióban.

---

## ADR-015 — Folytatáskérés csak közzétett, kétoldalú forduló után

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Részleges timeout vagy üres forduló után nincs folytatáskérés.

---

## ADR-016 — 72 órás forduló timeout, 48h emlékeztető

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Háttérjob zárja le; három ág (mindkét fél / egy fél / senki).

---

## ADR-017 — Nincs jutalom UI az első küszöb előtt

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Első `DebateReward` a 2. forduló megnyitásakor jelenik meg (25 kérés után).

---

## ADR-018 — Folytatáskérés: Turnstile + challenge + Passkey minden kérésnél

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Erősebb védelem: Passkey nem csak gyanús esetben.  
**Elvetett alternatíva:** Passkey csak gyanúsnál.

---

## ADR-019 — Egyszer használható challenge

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Challenge consumed / invalidated / expired után nem újrahasználható.

---

## ADR-020 — Telefon kötelező első folytatáskérés előtt

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** `User.phone_verified_at` ellenőrzés első kérésnél.

---

## ADR-021 — Timeout és meghívás háttérjobban

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** 72h forduló és 48h meghívás lejárat nem szinkron HTTP-ben; scheduler/queue.

---

## ADR-022 — „Népszerű” lista: 7 napos folytatáskérés-szám, nem algoritmus

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Rendezés: érvényes folytatáskérések (7 nap) DESC; tie-break: legfrissebb kérés. Nem személyre szabott.

---

## ADR-023 — Spec-first dokumentáció

**Dátum:** 2026-07-22  
**Státusz:** Elfogadva  
**Döntés:** Üzleti szabályok előbb `docs/`-ban; hiányzó spec → kérdezz, ne találj ki.

---

## Nyitott döntések

| ADR | Kérdés |
|-----|--------|
| — | Vitázó auth: e-mail+jelszó vs. Passkey kötelező vitázóknál is? (MVP: e-mail + jelszó elég vitázóknak) |
| — | Argument max. karakterhossz |
| — | Pontos rate limit számok |

---

## Döntés napló

| ADR | Dátum | Státusz |
|-----|-------|---------|
| 001–023 | 2026-07-22 | Elfogadva |
