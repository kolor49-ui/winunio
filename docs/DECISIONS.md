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
**Státusz:** **Felülírva** — lásd ADR-024  
**Eredeti döntés:** Zárolt beküldés, 72h határidő, egyidejű publikálás — nem real-time stream.  
**Új irány (2026-07-23):** Fokozatos publikálás: A azonnal nyilvános, B utána; egyidejű közzététel csak zárógondolatoknál.

---

## ADR-024 — Fokozatos forduló-publikálás (A → B)

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva  
**Döntés:** A megszólalás beküldésekor azonnal nyilvános; B csak A publikált tartalmára válaszol; a forduló `published` csak mindkét oldal megjelenése után.  
**Indok:** Természetes, egymásra reagáló vita; A megszólalása kíváncsiságot kelt, B válasza visszahozza a nézőket.  
**Elvetett alternatíva:** Forduló-végén rejtett tartalom + egyidejű leplemelés (régi zárolt modell).

---

## ADR-025 — Zárógondolatok: egyidejű publikálás csak a vitavégén

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva  
**Döntés:** `awaiting_closure` állapot; mindkét fél kötelező zárógondolata rejtett beküldés alatt; publikálás párosan, egy tranzakcióban.  
**Indok:** Lezárás tisztességes, nincs utolsó válaszadási lehetőség a zárógondolatok után.

---

## ADR-026 — Jutalom függő → kifizethető csak teljes lezáráskor

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva  
**Döntés:** Küszöb után `DebateReward.status = pending`; `simulated` (MVP megjelenítés) csak ha minden forduló teljesült és mindkét zárógondolat megjelent.  
**Indok:** *„Véleményben ellenfelek, a vita létrehozásában partnerek.”*

---

## ADR-027 — `awaiting_closure` állapot

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva  
**Döntés:** Folytatási időszak lejárta küszöb nélkül (és más érdemi lezárások) → `awaiting_closure`, nem azonnal `completed`.  
**Elvetett alternatíva:** Küszöb nélküli lejárat azonnali `completed` státusszal.

---

## ADR-028 — B-válasz értesítés (nem követőrendszer)

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva  
**Döntés:** Néző kérhet értesítést B válaszára egy adott fordulóhoz (`RoundResponseNotification`); ez **nem** követőrendszer.  
**MVP-n kívül marad:** profilkövetés, általános értesítési feed.

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

## ADR-029 — AI tartalom-ellenőrzés közzététel előtt (fail-closed)

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva (spec); **Implementáció: Tervezett**  
**Döntés:** Minden nyilvánosságra szánt résztvevői szöveg AI review-n megy át publikálás előtt. Provider hiba → nincs közzététel.  
**Indok:** Biztonság és vitakultúra; nem helyettesíti az emberi moderációt.  
**Elvetett alternatíva:** Csak jelentés-alapú utólagos moderáció.

---

## ADR-030 — Az AI nem fogalmaz a résztvevő helyett

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva (spec); **Implementáció: Tervezett**  
**Döntés:** Review kimenet = megjelölés + ok + szabály-hivatkozás. Tilos átfogalmazás, szócsere-javaslat, stílusmódosítás.  
**Indok:** Saját érvelés alapelv; megkülönböztetés álláspont-minősítéstől.

---

## ADR-031 — Beillesztésvédelem a saját érvelés mezőben

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva (spec); **Implementáció: Tervezett**  
**Döntés:** Fő mező: paste/drop tiltás; idézet és forrás külön mező, ott engedélyezett.  
**Indok:** Kész szöveg gyors átemelésének megnehezítése — nem teljes kizárás.  
**Korlát:** Nem szerzőségi bizonyíték; diktálás nem mindig detektálható.

---

## ADR-032 — Helyesírás-ellenőrzés opcionális és jóváhagyás-kötött

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva (spec); **Implementáció: Tervezett**  
**Döntés:** Csak külön gombra; csak formai hibák; javítás csak explicit elfogadással kerül a mezőbe.  
**Elvetett alternatíva:** Automatikus autocorrect publikálás előtt.

---

## ADR-033 — Idézet / forrás külön adattípus

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva (spec); **Implementáció: Tervezett**  
**Döntés:** `reasoning` + opcionális `quote` + `source`; idézethez forrás kötelező; megjelenítés elkülönítve.

---

## ADR-034 — OpenAI (ChatGPT API) tartalom-ellenőrzéshez

**Dátum:** 2026-07-23  
**Státusz:** Elfogadva  
**Döntés:** Tartalom-ellenőrzés szolgáltatója: **OpenAI Chat Completions API** (`OPENAI_API_KEY`, alap modell: `gpt-4o-mini`).  
**Indok:** Megbízható magyar nyelvű moderáció, strukturált JSON kimenet.  
**Implementáció:** `src/server/services/content-review-service.ts`; napló: `content_reviews` tábla.

---

## ADR-035 — Folytatáskérés: Turnstile kivéve MVP UI-ból

**Dátum:** 2026-07-28  
**Státusz:** Elfogadva (részben felülírva: ADR-036)  
**Döntés:** Cloudflare Turnstile **nincs** a folytatáskérés felhasználói folyamatában.  
**Kapcsolat:** ADR-018.

---

## ADR-036 — Folytatáskérés: SMS OTP indulás; Passkey későbbi natív apphoz

**Dátum:** 2026-07-28  
**Státusz:** Elfogadva  
**Döntés:** Folytatáskérés megerősítése **SMS OTP** (6 jegy, a fiókhoz kötött telefonra) minden kérésnél. **Passkey nincs** a webes folytatás UI-ban. Egyszer használható challenge + rate limit marad.  
**Indok:** Webes Passkey Androidon megbízhatatlan; SMS minden telefonon működik, Twilio Verify már él.  
**Később:** piaci fogadtatás / forgalom után natív app bank-szintű ujjlenyomattal (MVP-n kívül).  
**Felülírja:** ADR-018 Passkey kötelező minden webes kérésnél; ADR-035 botvédelem sor Passkey.

---

## Nyitott döntések

| ADR | Kérdés |
|-----|--------|
| — | Vitázó auth: e-mail+jelszó vs. Passkey kötelező vitázóknál is? (MVP: e-mail + jelszó elég vitázóknak) |
| — | Argument max. karakterhossz |
| — | Pontos rate limit számok |
| — | AI szolgáltató ([CONTENT_EDITOR.md](CONTENT_EDITOR.md)) | **Döntve:** OpenAI — ADR-034 |
| — | Piszkozat verziók száma és megőrzés |

---

## Döntés napló

| ADR | Dátum | Státusz |
|-----|-------|---------|
| 001–008 | 2026-07-22 | Elfogadva |
| 009 | 2026-07-22 | Felülírva (024) |
| 010–023 | 2026-07-22 | Elfogadva |
| 024–028 | 2026-07-23 | Elfogadva |
| 029–033 | 2026-07-23 | Elfogadva (spec); implementáció Tervezett |
| 034 | 2026-07-23 | Elfogadva; implementálva |
