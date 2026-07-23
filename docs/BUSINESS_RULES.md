# Winunio — Üzleti szabályok

A rendszer logikai „alkotmánya”. Forrásigazság implementáció előtt.

---

## 1. Vitaindítás

- A vitakérdés legfeljebb **160 karakter**.
- Az indító megadja a saját rövid kiinduló álláspontját.
- A vita partner nélkül **`waiting_for_partner`** állapotba kerül.
- A jelentkezés **ingyenes**.
- A jelentkezők rövid állásponttal kerülnek a várólistára.
- A platform **nem minősíti** a jelentkezések minőségét.
- Csak szabály- vagy biztonsági okból avatkozhat be.

---

## 2. Partner kiválasztása

- **Kizárólag** a vitaindító választhat.
- A platform **nem ajánl** „legjobb” partnert.
- A kiválasztást **nem kell indokolni**.
- A kiválasztott jelentkező **elfogadhatja vagy elutasíthatja** a meghívást.
- A vita csak **kölcsönös elfogadás** után indul el.
- Meghívás érvényessége: **48 óra** a létrehozástól.
- Elutasítás vagy lejárat után a vita visszakerül **`waiting_for_partner`** állapotba; az indító új partnert választhat.
- Az elutasított jelentkező **nem** kerül automatikusan vissza a várólistára, de **később újra jelentkezhet**.

---

## 3. Vita indulása és az első forduló

A vitaindító kiválaszt egy jelentkezőt.

A kiválasztott jelentkező **elfogadása** után:

1. a vita **`active`** állapotba kerül;
2. az **1. forduló** automatikusan létrejön;
3. az **1. forduló** automatikusan megnyílik;
4. mindkét résztvevő **válaszadási határideje** elindul (alapértelmezés: **72 óra**).

Az 1. fordulóhoz **nem** szükséges folytatáskérés és **nem** tartozik folytatáskérési küszöb.

---

## 4. Fordulók — általános

- Egy fordulóban mindkét fél **egy** hozzászólást tehet közzé.
- A következő forduló **zárolt állapotból** indul.
- A forduló a szükséges folytatáskérés elérésekor nyílik meg (2. fordulótól).
- A küszöb **nem** A vagy B támogatását méri.
- Egy fiók csak **egyszer** számíthat bele ugyanabba a forduló-küszöbbe (egy lezárt fordulóra egy kérés).

---

## 5. Fordulótartalom beküldése és publikálása

Az MVP **zárolt fordulómodellt** használ.

- A résztvevők beküldött tartalma a forduló lezárásáig **nem nyilvános**.
- A résztvevők a lezárás előtt **nem láthatják** egymás aktuális fordulóhoz beküldött tartalmát.

A forduló akkor zárul le, amikor:

- **mindkét** résztvevő beküldte a tartalmát; vagy
- **lejárt** a dokumentált válaszadási határidő (**72 óra**).

A forduló lezárásakor a rendszer **egyidejűleg** publikálja az összes szabályosan beküldött tartalmat.

**Emlékeztető:** **48 óra** elteltével emlékeztető érkezik; **72 óra** után a beküldési lehetőség lejár (háttérjob).

---

## 6. Forduló lezárása — három eset

### A) Mindkét résztvevő válaszolt

- mindkét tartalom **egyszerre** megjelenik;
- a forduló **`published`** állapotba kerül;
- megnyílik a **folytatáskérési időszak** (a vita **`waiting_for_continuation`** állapotba kerül).

### B) Csak az egyik résztvevő válaszolt

- a beküldött tartalom a határidő lejártakor megjelenik;
- a hiányzó oldalon semleges rendszerüzenet jelenik meg:

  > Ehhez a fordulóhoz nem érkezett válasz a határidőn belül.

- a vita **`completed`** állapotba kerül;
- **nem** nyílik folytatáskérési időszak;
- nincs győztes, vesztes vagy nyilvános minősítés;
- a korábban elért jutalmi szint **megmarad** (ha volt).

### C) Egyik résztvevő sem válaszolt

- a forduló tartalom nélkül lezárul;
- a fordulóhoz **nem** jelenik meg üres A/B tartalomkártya;
- a vita **`completed`** állapotba kerül;
- nyilvános szöveg:

  > A vita érdemi tartalom nélkül lezárult.

- **nem** nyílik folytatáskérési időszak;
- **nem** számolódik jutalom.

**Megjegyzés:** Timeout miatt lezárt, megnyitott de be nem fejezett forduló **nem** minősül `published` fordulónak folytatáskérés szempontjából.

---

## 7. Folytatáskérési időszak

Folytatáskérés **csak** olyan lezárt forduló után adható le, amelyben **mindkét résztvevő szabályos tartalma megjelent** (A eset).

Az **N. forduló** után leadott folytatáskérések az **(N+1). forduló** megnyitására vonatkoznak.

A felületi gomb felirata:

> **KÉREM A FOLYTATÁST**

A felhasználónak **nem** kell fordulószámot választania.

### Számlálás (MVP)

- Nincs külön „függő” és „megerősített” számláló.
- A nyilvános számláló = a küszöbhöz számító érték.
- Rögzítési feltételek: [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md).
- Egy kérés csak akkor számít, ha: bejelentkezett, ellenőrzött (e-mail, telefon első alkalommal), még nem kért ugyanennél a lezárt fordulónál, nem sért sebességkorlátot, a vita megfelelő állapotban van, a forduló **`published`**.

UI minta:

> 38 ember kéri a folytatást. Még 12 kérés szükséges.

---

## 8. Következő forduló megnyitása

A szükséges számú **érvényes** folytatáskérés elérésekor **egyetlen atomi eseményben**:

1. a folytatáskérési időszak lezárul;
2. az **(N+1). forduló** létrejön;
3. az **(N+1). forduló** automatikusan megnyílik;
4. mindkét résztvevő **új válaszadási határideje** elindul;
5. a `DebateReward` az elért szintre frissül;
6. a vita **`active`** állapotba kerül.

A kérések számlálása **minden published forduló után újraindul**. A korábbi fordulók kérései **nem** számítanak bele a következő forduló küszöbébe.

### Küszöb és jutalom (`RoundUnlockRule`)

| Lezárt forduló | Következő forduló | Szükséges új kérés | Teljes jutalom / résztvevő |
|---:|---:|---:|---:|
| 1. | 2. | 25 | 1 000 Ft |
| 2. | 3. | 50 | 2 000 Ft |
| 3. | 4. | 100 | 4 000 Ft |
| 4. | 5. | 250 | 8 000 Ft |
| 5. | 6. | 500 | 12 000 Ft |

6. forduló és tovább: a szükséges kérések száma **az előző kétszerese** (konfigurálható admin felületen; MVP induló táblázat fenti 5 sorig fix).

A konkrét számok **konfigurálhatók**, nem kerülnek forráskódba beégetésre. Módosításuk **csak új vitákra** érvényes; futó vita küszöbe és jutalmi szintje **utólag nem** változtatható.

---

## 9. Jutalom számítása (MVP)

- A jutalmi szint és a következő forduló küszöbe **ugyanahhoz** a `RoundUnlockRule` rekordhoz tartozik.
- A `DebateReward` akkor frissül, amikor a lezárt forduló utáni érvényes kérések száma eléri a `required_continuation_requests` értéket.
- `reward_amount_per_participant` = **aktuális teljes** jutalom, **nem** növekmény.
- Mindkét résztvevőnél **azonos** összeg.
- `status` az MVP-ben kizárólag: **`simulated`**.
- A vita `completed` állapotában a jutalom **nem** számolódik újra.
- **1. forduló előtt** jutalmi sáv **nem** jelenik meg.

Felirat minden jutalmi megjelenítésnél:

> **Tesztüzem – a megjelenített összeg szimuláció, nem kerül kifizetésre.**

### Timeout és jutalom

Ha egy **már megnyitott** következő forduló timeout miatt nem fejeződik be kétoldalúan:

- a korábban elért jutalmi szint **megmarad**;
- **új** jutalmi szint **nem** érhető el, mert befejezett új forduló nélkül nem indulhat új folytatáskérési szakasz.

---

## 10. Küszöb elérése — atomi végrehajtás

A küszöböt elérő kérés feldolgozásakor **egyetlen adatbázis-tranzakcióban** kell:

1. rögzíteni a folytatáskérést;
2. újraszámolni az érvényes kérések számát;
3. ellenőrizni a küszöböt;
4. létrehozni a következő fordulót;
5. frissíteni a `DebateReward` rekordot;
6. a vitát megfelelő állapotba állítani (`active`, új fordulóval).

Így két egyszerre érkező kérés **nem** nyithat két fordulót, és **nem** hozhat létre kétszeres jutalmat.

---

## 11. Főoldali listák

### Új viták

`created_at DESC` — legutóbb létrehozott viták elöl.

### Népszerű

Az **elmúlt 7 napban** kapott **érvényes folytatáskérések** száma szerint csökkenő sorrendben jeleníti meg a vitákat. Azonos értéknél a **frissebben kapott kérés** dönt.

Ez **nem**:

- személyre szabott ajánlóalgoritmus;
- résztvevők rangsorolása;
- A/B támogatottság szerinti rendezés.

---

## 12. Moderáció (üzleti határ)

A platform **vizsgálhat**: jogellenes tartalom, fenyegetés, személyes adat, zaklatás, spam, technikai visszaélés.

A platform **nem minősíti**: álláspont intelligenciáját, vitázó képességét, érv erősségét, politikai/erkölcsi helyességet, partner kiválasztását.

Részletek: [MODERATION.md](MODERATION.md).

---

## 13. Fióktörlés (GDPR)

- A felhasználó **jelszóval megerősítve** kérheti a fiók végleges törlését.
- `suspended` fiók **nem** törölhető saját kezdeményezésre.
- Személyes adatok anonimizálása: lásd [MODERATION.md](MODERATION.md) GDPR szakasz.
- **Nem publikált** viták (indító): `cancelled`.
- **Publikált / aktív** viták: megmaradnak; a törölt fél megjelenített neve: **„Törölt fiók”**.
- Az eredeti e-mail cím **újra regisztrálható** a törlés után.

---

## Entitás — szabály hivatkozások

| Entitás | Szabályok |
|---------|-----------|
| `RoundUnlockRule` | §8 |
| `DebateReward` | §9 |
| Meghívás / `DebateApplication` | §2 |
| `ContinuationRequest` | §7, §8 |
| `Round` | §5–6 |
| `Debate` | §1–3, §6 |

Kapcsolódó: [DATA_MODEL.md](DATA_MODEL.md), [STATE_MACHINE.md](STATE_MACHINE.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md).
