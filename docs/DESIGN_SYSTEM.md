# Winunio — Design System

Vizuális nyelv: nyugodt, szerkesztett, egyszerű, **nem versengő**, komoly alapokon finoman játékos.

---

## Színek

| Szerep | Token | Hex |
|--------|-------|-----|
| A oldal | `color-side-a` | `#6F8F72` (zsályazöld) |
| A halvány háttér | `color-side-a-muted` | `#F1F5F0` |
| B oldal | `color-side-b` | `#8A78A8` (levendula) |
| B halvány háttér | `color-side-b-muted` | `#F4F1F7` |
| Közös művelet (folytatás) | `color-action-neutral` | grafitszürke |
| Oldalháttér | `color-background` | meleg törtfehér |

### Szabályok

- **A mindig zsályazöld. B mindig levendula.** A színek **nem cserélődnek**.
- A közös folytatás gomb **egyik fél színét sem** használja.
- A szín önmagában **nem** hordozhat jelentést; mindig legyen **A/B jelölés**.
- Nincs piros–kék szembenállás.
- Nincs **„VS”**, trófea vagy győztesjelzés.

---

## Elrendezés

- **A mindig bal, B mindig jobb** — soha nem cserélődnek pozícióban.
- Két vitázó **vizuálisan egyenrangú** — nincs „főszereplő” badge.

---

## Forduló megjelenítés

| Fázis | UI |
|-------|-----|
| A publikálva, B hiányzik | A kártya + „B válaszára várunk” |
| B publikálva | Teljes forduló (A + B) |
| Értesítés | „Értesítést kérek B válaszáról” — grafitszürke másodlagos gomb |

**Fontos:** A és B hozzászólása **nem** jelenik meg egyszerre a fordulóban. Az egyidejű megjelenés **csak** a zárógondolatoknál.

---

## Zárógondolat UI

| Fázis | UI |
|-------|-----|
| `awaiting_closure` | Mindkét vitázónak beküldőmező (a partner szövege rejtett) |
| Mindkét beküldve | Két zárógondolat **egyidejű** megjelenése |
| Hiányzó partner | „Várakozás a partner zárógondolatára” |

---

## Jutalom megjelenítés

| Fázis | UI |
|-------|-----|
| Küszöb előtt | **Semmi** jutalom blokk — nincs „0 Ft”, nincs progress összeggel |
| Küszöb után, vita folyamatban | `DebateReward` **teljes összege** + **„Függőben”** jelzés |
| Vita `completed` + feltételek teljesültek | Teljes összeg + tesztüzem felirat (kifizethető / szimulált) |

**Tiltott:** növekményes számláló, „eddig X Ft” felirat, `RewardProgressBar`, `ZeroRewardPlaceholder`.

Minden jutalmi megjelenítésnél:

> **Tesztüzem – a megjelenített összeg szimuláció, nem kerül kifizetésre.**

---

## Folytatáskérés UI

- Gomb felirat: **KÉREM A FOLYTATÁST**
- Gomb szín: **grafitszürke** (`color-action-neutral`)
- Számláló szöveg: „38 ember kéri a folytatást. Még 12 kérés szükséges.”
- **Tiltott szavak:** szavazat, szavazz, like, VS
- Egy kérés / forduló — a UI jelezze az egyszeri limitet

Passkey lépés copy:

> Az eszközödön beállított biztonságos azonosítás

(Ne: „Biometria kötelező”.)

---

## Időzítés

- Meghívás: **48h** hátralévő idő látható.
- Aktív forduló: **72h** válaszadási határidő jelzés.
- 48h: emlékeztető (értesítés / banner).

---

## Komponensek (logikai)

| Komponens | Viselkedés |
|-----------|------------|
| `DebatePair` | Két vitázó, A bal / B jobb, egyenrangú |
| `ApplicationWaitlist` | Jelentkezők listája, nincs rangsor/pontszám |
| `InvitationBanner` | 48h countdown, accept/reject |
| `RoundStatus` | Aktív forduló fázisok (`awaiting_a` / `awaiting_b`), timeout — jutalom nélkül küszöb előtt |
| `RoundAwaitingB` | A publikálva; várakozás + értesítés kérés gomb |
| `ClosingStatementForm` | Zárásra vár — rejtett partner szöveg |
| `ContinuationRequestFlow` | Turnstile + challenge + Passkey + telefon gate |
| `DebateRewardReveal` | Függő összeg küszöb után; kifizethető megjelenítés lezáráskor |

**Szándékosan nincs:** `LikeButton`, `VotePoll`, `WinnerBadge`, `VsBadge`, `Leaderboard`, `FollowButton`.

---

## Tipográfia és akadálymentesség

- Elsődleges nyelv: **magyar** (MVP).
- WCAG 2.1 AA cél — kontraszt A/B színeknél ellenőrizendő.
- Hibauzenetek: közérthető, nem technikai.

Kapcsolódó: [PRODUCT.md](PRODUCT.md), [BUSINESS_RULES.md](BUSINESS_RULES.md), [DECISIONS.md](DECISIONS.md) ADR-004.
