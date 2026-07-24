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
- A fordulón belüli sorrend **mindig**: **A megszólal → B válaszol**.
- Az **1. fordulóban** A a vitaindító kiinduló megszólalását adja; B közvetlenül arra reagál.
- A **2. és további fordulókban** A B **előző fordulóbeli** válaszára reagál; B ezután A **aktuális** megszólalására válaszol.
- A következő forduló a szükséges folytatáskérés elérésekor nyílik meg (2. fordulótól).
- A küszöb **nem** A vagy B támogatását méri.
- Egy fiók csak **egyszer** számíthat bele ugyanabba a forduló-küszöbbe (egy lezárt fordulóra egy kérés).

**Alapelv:** *„Véleményben ellenfelek, a vita létrehozásában partnerek.”*

---

## 5. Forduló sorrendje és fokozatos publikálás

A vita **aszinkron**, de **nem** rejtett, forduló-végén egyidejű „leplemelés”. A cél természetes, egymásra reagáló vita: A megszólalása nyitott kíváncsiságot teremt; B válasza visszahozza a nézőket.

### 5.1. Publikálás lépései

1. **A** megírja a megszólalását → a tartalom **azonnal nyilvánosan** megjelenik.
2. **B** elolvassa A megszólalását, majd **közvetlenül arra reagál**.
3. Amíg B válasza **nem érkezett meg**, a közönség **látja A megszólalását**, és azt jelzi, hogy **B válaszára várunk**.
4. A néző **kérhet értesítést** B válaszának megérkezéséről (egy vitára / fordulóra kötött kérés — **nem** követőrendszer).
5. **B** válasza beküldése után **nyilvánosan megjelenik**; az értesítést kérő nézők **értesítést kaphatnak**.
6. A forduló **csak** A megszólalásának **és** B válaszának megjelenése után számít **lezártnak** és **`published`** állapotúnak.
7. **Folytatást** kizárólag **lezárt, teljes** (kétoldalú, nem placeholder) forduló után lehet kérni.
8. Küszöb teljesülése után az **(N+1). forduló** nyílik: A reagál B előző válaszára, majd B válaszol A új megszólalására.

### 5.2. Mit lát a vitázó `open` forduló alatt

| Szereplő | Látja |
|----------|--------|
| **A** | Saját beküldött (és már publikált) megszólalását; B válaszát **csak** annak megjelenése után |
| **B** | A **már publikált** A megszólalást (reagálnia kell rá); saját válaszát beküldés után azonnal nyilvánosan |
| **Közönség** | A publikált A tartalmat; B hiányában „B válaszára várunk” állapotot |

**Fontos:** A két hozzászólás **nem** egyszerre készül és **nem** egyszerre jelenik meg. Az egyidejű közzététel **kizárólag** a vita végén, a két kötelező zárógondolatnál marad meg (lásd §11).

### 5.3. Módosíthatóság

- Beküldés után a tartalom **nem** szerkeszthető (MVP).
- A **már nyilvánosságra hozott** A megszólalás **nem módosítható** B válaszának ismeretében (azaz B beküldése / válaszának megjelenése után).
- B válasza szintén **nem** módosítható publikálás után.

### 5.4. Határidő és emlékeztető

- Válaszadási határidő: **72 óra** a forduló megnyitásától.
- **48 óra** elteltével emlékeztető a soron következő beküldésre kötelezett vitázónak.
- **72 óra** után a beküldési lehetőség lejár (háttérjob).

---

## 6. Forduló lezárása — három eset

### A) Mindkét résztvevő válaszolt (teljes forduló)

- A megszólalások **fokozatosan** jelentek meg (§5); a forduló **`published`** csak B válasza után;
- megnyílik a **folytatáskérési időszak** (a vita **`waiting_for_continuation`** állapotba kerül).

### B) Csak az egyik résztvevő válaszolt (timeout)

- A **már publikált** tartalom megmarad;
- a hiányzó oldalon a határidő lejártakor semleges rendszerüzenet jelenik meg:

  > Ehhez a fordulóhoz nem érkezett válasz a határidőn belül.

- a forduló **`published`**, de **nem** minősül teljes, kétoldalú fordulónak folytatáskérés szempontjából;
- a vita **`awaiting_closure`** állapotba kerül (lásd §11), ha van érdemi, korábbi teljes forduló vagy függő jutalom; ellenkező esetben **`completed`**.

### C) Egyik résztvevő sem válaszolt

- a forduló tartalom nélkül lezárul (`closed_without_content`);
- a fordulóhoz **nem** jelenik meg üres A/B tartalomkártya;
- a vita **`completed`** állapotba kerül;
- nyilvános szöveg:

  > A vita érdemi tartalom nélkül lezárult.

- **nem** nyílik folytatáskérési időszak;
- **nem** számolódik jutalom.

**Megjegyzés:** Timeout miatt lezárt, megnyitott de be nem fejezett forduló **nem** minősül teljes `published` fordulónak folytatáskérés szempontjából.

---

## 7. Folytatáskérési időszak

Folytatáskérés **csak** olyan lezárt forduló után adható le, amelyben **mindkét résztvevő szabályos, nem placeholder tartalma megjelent** (§6 A eset).

Az **N. forduló** után leadott folytatáskérések az **(N+1). forduló** megnyitására vonatkoznak.

A felületi gomb felirata:

> **KÉREM A FOLYTATÁST**

A felhasználónak **nem** kell fordulószámot választania.

### Számlálás (MVP)

- Nincs külön „függő” és „megerősített” számláló.
- A nyilvános számláló = a küszöbhöz számító érték.
- Rögzítési feltételek: [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md).
- Egy kérés csak akkor számít, ha: bejelentkezett, ellenőrzött (e-mail, telefon első alkalommal), még nem kért ugyanennél a lezárt fordulónál, nem sért sebességkorlátot, a vita megfelelő állapotban van, a forduló **teljes, kétoldalú `published`**.

UI minta:

> 38 ember kéri a folytatást. Még 12 kérés szükséges.

---

## 8. Következő forduló megnyitása

A szükséges számú **érvényes** folytatáskérés elérésekor **egyetlen atomi eseményben**:

1. a folytatáskérési időszak lezárul;
2. az **(N+1). forduló** létrejön;
3. az **(N+1). forduló** automatikusan megnyílik;
4. **A** válaszadása indul (B **nem** küldhet, amíg A megszólalása nincs publikálva);
5. a `DebateReward` **függő** állapotba kerül / frissül (§9);
6. a vita **`active`** állapotba kerül.

A kérések számlálása **minden teljes published forduló után újraindul**. A korábbi fordulók kérései **nem** számítanak bele a következő forduló küszöbébe.

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

## 9. Jutalom számítása és kifizethetőség (MVP)

- A jutalmi szint és a következő forduló küszöbe **ugyanahhoz** a `RoundUnlockRule` rekordhoz tartozik.
- Küszöb elérésekor `reward_amount_per_participant` = **aktuális teljes** jutalom, **nem** növekmény.
- Mindkét résztvevőnél **azonos** összeg.
- **1. forduló előtt** jutalmi sáv **nem** jelenik meg.

### Függő vs. kifizethető (szimulált MVP)

A két résztvevő a vita teljes időtartama alatt **egymástól függ**. A jutalom **nem** az egyes hozzászólásokért, hanem a **közösen, szabályosan befejezett vitáért** jár.

| Állapot | Jelentés | UI (MVP) |
|---------|----------|----------|
| **Nincs rekord** | Küszöb még nem teljesült | Semmi jutalom blokk |
| **`pending`** | Küszöb teljesült; összeg **függőben**, még nem kifizethető | Teljes összeg + „függőben” jelzés |
| **`simulated`** | Minden teljesítési feltétel megvan; **kifizethető** (MVP: szimulált, nincs valódi kifizetés) | Teljes összeg + tesztüzem felirat |

**Kifizethetővé** (`simulated`) kizárólag akkor válik a jutalom, ha **egyidejűleg**:

1. minden **megkezdett** forduló szabályosan befejeződött;
2. mindkét résztvevő benyújtotta a **kötelező zárógondolatát**;
3. a két zárógondolat **egyidejűleg** megjelent;
4. a vita **`completed`** állapotba került.

Ha **bármelyik** résztvevő nem teljesíti a kötelező válaszát vagy zárógondolatát, a vita **befejezetlen** marad, és **egyik** résztvevőnek **sem** jár kifizetés — a függő összeg **nem** válik kifizethetővé.

Felirat minden jutalmi megjelenítésnél:

> **Tesztüzem – a megjelenített összeg szimuláció, nem kerül kifizetésre.**

### Timeout és jutalom

Ha egy **már megnyitott** következő forduló timeout miatt nem fejeződik be kétoldalúan:

- a korábban elért **függő** jutalmi szint **megmarad**;
- **új** jutalmi szint **nem** érhető el, mert befejezett új forduló nélkül nem indulhat új folytatáskérési szakasz;
- a jutalom továbbra is **nem** kifizethető, amíg a vita nincs szabályosan lezárva (§11).

---

## 10. Küszöb elérése — atomi végrehajtás

A küszöböt elérő kérés feldolgozásakor **egyetlen adatbázis-tranzakcióban** kell:

1. rögzíteni a folytatáskérést;
2. újraszámolni az érvényes kérések számát;
3. ellenőrizni a küszöböt;
4. létrehozni a következő fordulót;
5. frissíteni / létrehozni a `DebateReward` rekordot **`pending`** állapotban;
6. a vitát megfelelő állapotba állítani (`active`, új fordulóval).

Így két egyszerre érkező kérés **nem** nyithat két fordulót, és **nem** hozhat létre kétszeres jutalmat.

---

## 11. Vita lezárása — zárásra vár és zárógondolatok

### Mikor kerül a vita „zárásra vár” állapotba

Ha a folytatáskérési időszak **lejár** anélkül, hogy teljesülne a szükséges küszöb, vagy a vita **más szabály szerint** érdemi folyamatban véget ér (pl. timeout egy megnyitott fordulóban, moderáció), a vita **nem** lesz azonnal **`completed`**.

Ilyenkor **`awaiting_closure`** („zárásra vár”) állapotba kerül — **kivéve** az §6 C) üres, érdemi tartalom nélküli lezárást.

### Zárógondolatok

Mindkét résztvevőnek **kötelező zárógondolatot** írnia a vita végleges lezárásához.

| Szabály | Leírás |
|---------|--------|
| Elkészítés | Egymástól **függetlenül** készülnek |
| Láthatóság beküldés alatt | A másik fél **nem látja** a partner zárógondolatát |
| Publikálás | **Csak** akkor jelennek meg, amikor **mindketten** benyújtották |
| Egyidejűség | **Kizárólag** itt van egyidejű közzététel — utána nincs válaszadási lehetőség |

Mindkét zárógondolat megjelenése után a vita **`completed`** állapotba kerül; a jutalom kifizethetősége §9 szerint értékelődik újra.

---

## 12. Főoldali listák

### Új viták

`created_at DESC` — legutóbb létrehozott viták elöl.

### Népszerű

Az **elmúlt 7 napban** kapott **érvényes folytatáskérések** száma szerint csökkenő sorrendben jeleníti meg a vitákat. Azonos értéknél a **frissebben kapott kérés** dönt.

Ez **nem**:

- személyre szabott ajánlóalgoritmus;
- résztvevők rangsorolása;
- A/B támogatottság szerinti rendezés.

---

## 13. Moderáció (üzleti határ)

A platform **vizsgálhat**: jogellenes tartalom, fenyegetés, személyes adat, zaklatás, spam, technikai visszaélés.

A platform **nem minősíti**: álláspont intelligenciáját, vitázó képességét, érv erősségét, politikai/erkölcsi helyességet, partner kiválasztását.

Részletek: [MODERATION.md](MODERATION.md).

---

## 14. Vitaszerkesztő és tartalom-ellenőrzés

**Státusz:** Tervezett — [CONTENT_EDITOR.md](CONTENT_EDITOR.md)

- Minden nyilvánosságra szánt résztvevői szöveg **közzététel előtt** AI tartalom-ellenőrzésen megy át.
- Az AI **nem** fogalmaz, **nem** ír át, **nem** ad alternatív mondatot — csak jelzi a problémát és a megsértett szabályt.
- A saját érvelés **csak** a Winunio szerkesztőjében írható — a fő mező **nem** fogad beillesztést.
- Idézet és forrás **külön** mező; idézethez forrás kötelező; idézet vizuálisan elkülönítve.
- Helyesírás-ellenőrzés **opcionális**, külön kérésre; javítás csak résztvevői jóváhagyással.
- AI vagy ellenőrzési hiba esetén a szöveg **nem** jelenhet meg ellenőrizetlenül.
- A beillesztésvédelem **nem** bizonyítja a szerzőséget; célja a visszaélés megnehezítése.
- **Helyesírás** nem blokkolja a közzétételt: a résztvevő dönti el, javít-e vagy javítás nélkül küldi be — ez az ő felelőssége. Helyesírási segítség csak külön, opcionális funkció (§3, Tervezett).

---

## 15. Fióktörlés (GDPR)

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
| `ClosingStatement` | §11 |
| `RoundResponseNotification` | §5 |
| Meghívás / `DebateApplication` | §2 |
| `ContinuationRequest` | §7, §8 |
| `Round` / `Argument` | §4–6, §14 |
| `Debate` | §1–3, §6, §11, §14 |
| `ContentReview` / `ContentDraft` | §14 (**Tervezett**) |

Kapcsolódó: [DATA_MODEL.md](DATA_MODEL.md), [STATE_MACHINE.md](STATE_MACHINE.md), [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md), [CONTENT_EDITOR.md](CONTENT_EDITOR.md).
