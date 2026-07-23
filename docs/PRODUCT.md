# Winunio — Termék

## Mi ez?

A Winunio **páros vitaplatform**: két ember vitázik egymással egy kérdés körül. A közönség nem ítélkezik felettük, nem szavaz rájuk — csak bizonyos feltételek mellett **újabb fordulót kérhet**.

A vita **aszinkron**: fordulónként **A megszólal → B válaszol**, fokozatos publikálással. Nem élő stream, nem chat-szerű ping-pong. Az egyidejű közzététel **kizárólag** a vita végén, a két zárógondolatnál történik.

## Alapelvek

| Elv | Leírás |
|-----|--------|
| Két fél | Egy vitában pontosan két vitázó van. Nincs győztes és nincs vesztes. |
| Nincs közönség-szavazás | Nincs lájk, reakció vagy résztvevőre szavazat. |
| Folytatáskérés | A közönség **csak folytatást kérhet**: egy lezárt fordulóra / fiókra / egyszer. |
| Partner választás | A **vitaindító** választja ki a vitapartnert a jelentkezők közül. |
| Egyenlő jutalom | Mindkét vitázó **azonos** jutalmat kap. MVP: szimulált, nincs kifizetés. |
| Első forduló | Az 1. forduló a partner elfogadása után **automatikusan** indul; folytatáskérés nem kell hozzá. |
| Küszöbök | Folytatáskérések száma fordulónként: **25 → 50 → 100 → 250 → 500**, majd **duplázódik** (`RoundUnlockRule`). |
| Jutalom modell | `DebateReward`: a **teljes összeg** a küszöb elérésekor **függőben** jelenik meg; **kifizethető** (MVP: szimulált) csak a vita szabályos lezárásakor. |
| Közös teljesítés | *„Véleményben ellenfelek, a vita létrehozásában partnerek.”* — mindkét fél a teljes vitáért felel. |
| Jutalom UI | Küszöb elérése **előtt** nincs jutalom UI — **nincs „0 Ft”** sem. |
| Minősítés tilos | A platform nem minősíti az álláspontokat, a vitázó képességét vagy a partner kiválasztását. |

## Szereplők

### Vitaindító (Initiator)

- Megfogalmazza a vitakérdést (max. 160 karakter).
- Megadja a saját rövid kiinduló álláspontját.
- Közzéteszi a vitát; a vita `waiting_for_partner` állapotba kerül.
- Kiválasztja a partnert a jelentkezők közül.
- Nem kell indokolnia a választást.

### Vitapartner (Partner)

- Jelentkezhet a vitára rövid állásponttal.
- Elfogadhatja vagy elutasíthatja a meghívást.
- Elfogadás után a vita indul; az 1. forduló automatikusan megnyílik.

### Közönség (Audience)

- Olvashatja a vitát — akár **részleges fordulót** is (A megszólalása B válasza előtt).
- **Értesítést kérhet** B válaszának megérkezéséről (egy vitára / fordulóra kötött — nem követőrendszer).
- **Egy** folytatáskérést adhat le: **egy adott lezárt fordulóra**, **egy fiókból**, **egyszer**.
- A folytatáskérés nem A vagy B támogatása.

### Rendszer

- Fordulók **aszinkron, fokozatos publikálással** futnak: A azonnal nyilvános, B utána; **72 órás** határidő.
- 48 óránál emlékeztető a soron következő beküldésre kötelezett vitázónak; timeout háttérjobban.
- Meghívások **48 óra** után lejárnak.
- Vita lezárása: **`awaiting_closure`** → kötelező zárógondolatok (egyidejű publikálás) → **`completed`**.

## Anonimitás

Ellenőrzött fiókkal a vitázó **névvel vagy anonim nyilvános profillal** vehet részt. Az anonimitás nem vonja el a moderációt vagy a fiókellenőrzést.

## Amit nem csinál a Winunio

- Nem rangsorol vitázókat közönség-szavazással.
- Nem jelöl ki győztest vagy vesztest.
- Nem ajánl „legjobb” partnert vagy álláspontot.
- MVP-ben nem fizet ki valódi pénzt.
- Nem futtat személyre szabott ajánlóalgoritmust.

## Kapcsolódó dokumentumok

- [MVP_SCOPE.md](MVP_SCOPE.md) — határok
- [BUSINESS_RULES.md](BUSINESS_RULES.md) — szabályok részletesen
- [STATE_MACHINE.md](STATE_MACHINE.md) — állapotok
- [USER_FLOWS.md](USER_FLOWS.md) — folyamatok
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — vizuális nyelv
