# Winunio — Vitaszerkesztő, tartalom-ellenőrzés és hiteles bevitel

**Státusz:** Részben implementálva (2026-07-23) — AI tartalom-ellenőrzés **OpenAI (ChatGPT API)**; piszkozat, beillesztésvédelem, helyesírás még **Tervezett**.

| # | Funkció | Státusz |
|---|---------|---------|
| §1 | AI tartalom-ellenőrzés | **Implementálva** (argument, closing, stance) |
| §2 | AI nem fogalmaz helyette | **Implementálva** (prompt + séma) |
| §3 | Helyesírás-ellenőrzés | Tervezett |
| §4 | Beillesztésvédelem | Tervezett |
| §5 | Piszkozatkezelés | Tervezett |
| §6 | Idézet / forrás mezők | Tervezett |
| §7 | Akadálymentesség (szerkesztő) | Tervezett |

**AI szolgáltató:** OpenAI Chat Completions API — modell: `OPENAI_MODEL` (alapértelmezés: `gpt-4o-mini`). Lásd ADR-034.

> **Fontos:** Az alábbi funkciók csak tényleges megvalósítás **és** az [§8 elfogadási feltételek](#8-elfogadási-feltételek) automatizált tesztjei után minősülnek késznek. Addig minden sor **Tervezett**.

---

## Összefoglaló termékszabály

> „A Winunión a saját érvelést itt kell megírni. Az AI tartalmi szempontból ellenőrizhet és jelezhet, de nem fogalmazhat, nem írhat át, és nem adhat átfogalmazási javaslatot. Konkrét javítást kizárólag helyesírási ellenőrzéskor, a résztvevő külön kérésére és jóváhagyásával ajánlhat. Beilleszteni kizárólag egyértelműen megjelölt idézetet vagy forrást lehet.”

---

## Hatókör — mely szövegek érintettek

| Szöveg | Hol | Nyilvánosság | Szerkesztő modell |
|--------|-----|--------------|-------------------|
| Kiinduló álláspont | Vitaindítás | Nyilvános a vitán | **Tervezett** — teljes csomag |
| Jelentkezői álláspont | Jelentkezés | Vitaindító + később nyilvános | **Tervezett** — teljes csomag |
| Forduló érvelés | Aktív forduló | Nyilvános publikáláskor | **Tervezett** — teljes csomag |
| Zárógondolat | `awaiting_closure` | Nyilvános lezáráskor | **Tervezett** — teljes csomag |

A vitakérdés (`question`, max. 160 kar.) és a kategória **nem** tartozik ide — moderálható külön szabályokkal, de nem a vitaszerkesztő csomag része.

---

## 1. Kötelező AI-alapú tartalom-ellenőrzés

**Státusz:** Implementálva (OpenAI / ChatGPT API)

### Cél

Szerveroldali AI-ellenőrzés **minden** nyilvánosságra szánt résztvevői szöveg **közzététel előtt**.

### Vizsgált kategóriák

| Kategória | Példa |
|-----------|--------|
| Sértő megfogalmazás | Személyiségbe vágó sértés |
| Személyeskedés | A partner jellemének támadása érv helyett |
| Megalázás | Célzott lekezelés |
| Indokolatlan trágárság | Szándékos vulgáris hangnem |
| Fenyegetés / zaklatás / gyűlöletkeltés | Erőszak, csoport elleni gyűlölet |

### Kontextus

- Az AI **különbséget tesz** érv / vélemény **határozott bírálata** és a **másik résztvevő személyének támadása** között.
- Idézett tartalomnál figyelembe veszi, hogy **idézet** — lásd [§6](#6-idézetek-és-források).

### Eredmények

| Eredmény | Viselkedés |
|----------|------------|
| **Megfelelt** (`approved`) | A szöveg közzétehető. |
| **Javítás szükséges** (`revision_required`) | Problémás rész megjelölve; ok típusa; rövid hivatkozás a Winunio-szabályra; szöveg vissza a résztvevőnek. **Nincs közzététel**, amíg ő nem javít és újra beküldi. |
| **Súlyos szabálysértés** (`blocked`) | Közzététel tiltva; eset **emberi felülvizsgálatra** továbbítható ([MODERATION.md](MODERATION.md)). |

### Technikai hiba

Ha az AI-ellenőrzés **nem fut le** (timeout, provider hiba, konfiguráció hiány):

- a szöveg **nem** jelenhet meg ellenőrizetlenül;
- a résztvevő hibaüzenetet kap (pl. „Az ellenőrzés most nem érhető el — próbáld később”);
- esemény naplózása (`SecurityEvent` / audit).

### Amit ez **nem** jelent (MVP-korlátok)

- **Nem** álláspont-minősítés vagy érv-erősség pontozás — lásd [MODERATION.md](MODERATION.md) „A platform nem minősíti”.
- **Nem** vitaösszefoglaló generálás — MVP-n kívül ([MVP_SCOPE.md](MVP_SCOPE.md)).

---

## 2. Az AI nem fogalmazhat a résztvevő helyett

**Státusz:** Implementálva (prompt + JSON séma — nincs javasolt szöveg mező)

Tartalmi ellenőrzéskor az AI **tilos**:

- mondatot átírni vagy átfogalmazni;
- alternatív mondatot / helyettesítő szót javasolni;
- stílust, hangnemet, mondatszerkezetet módosítani;
- rövidíteni, kiegészíteni, érvelést generálni;
- udvariasabb „kész változatot” adni;
- közvetlenül módosítani a szerkesztőmező tartalmát.

**Engedélyezett moderációs kimenet:**

- problémás rész megjelölése (offset / kijelölés);
- kifogás okának megnevezése;
- megsértett szabály hivatkozása;
- kérés: a résztvevő **saját kezűleg** javítson.

> „Az AI megmutathatja, hol a probléma, de nem mondhatja meg helyetted, hogyan fogalmazz.”

---

## 3. Opcionális helyesírás-ellenőrzés

**Státusz:** Tervezett

| Szabály | Részlet |
|---------|---------|
| Indítás | **Csak** a résztvevő kifejezett kérésére („Helyesírás ellenőrzése” gomb) |
| Tartalom | Elütés, helyesírási hiba, ékezet, egyértelmű központozás |
| Tiltott | Stilisztika, szócsere hangnemből, mondatszerkezet, tartalmi pontosítás, érvelés-javítás |
| Bizonytalanság | Többféleképp értelmezhető esetben **nincs** javaslat |

### Javaslat megjelenítése

Minden javaslatnál:

- eredeti forma;
- javasolt javítás;
- a változtatás pontos helye.

### Elfogadás

- egyenként, vagy
- „Helyesírási javítások elfogadása” összesített művelet.

Elfogadás nélkül az eredeti szöveg **változatlan**.

> A helyesírás-ellenőrzés az **egyetlen** funkció, amely konkrét szövegmódosítást **javasolhat** — és csak külön kérés + jóváhagyás után kerülhet a mezőbe.

---

## 4. Saját érvelés — beillesztési tilalom

**Státusz:** Tervezett

A **Saját érvelés** fő mező **nem** fogad beillesztett szöveget:

- Ctrl/Cmd+V, helyi menü, mobil beillesztés, drag-and-drop szöveg.

**Beillesztési kísérlet üzenete:**

> „A saját érvelést a Winunio szerkesztőjében kell megírnod. Beilleszteni csak az Idézet vagy a Forrás mezőbe lehet.”

### Cél (realisztikus elvárás)

- kész AI-szöveg gyors átemelésének megnehezítése;
- cikkrészlet / más szöveg saját érvelésként való beillesztésének nehezítése;
- **nem** teljes technikai kizárás külső segítségről vagy minden visszaélésről.

Implementáció: kliensoldali `paste` / `drop` blokkolás + szerveroldali ellenőrzés, ha a beküldött szöveg jelzői paste-nak utalnak (nem bizonyíték, csak kiegészítő jel).

---

## 5. Megbízható piszkozatkezelés

**Státusz:** Tervezett

| Funkció | Követelmény |
|---------|-------------|
| Automatikus mentés | Debounce-szal, fiókhoz kötve |
| Megszakítás utáni folytatás | Ugyanazon vitán / fordulón / zárógondolatnál visszatöltés |
| Korábbi változatok | Legalább N utolsó verzió (pontos N: nyitott döntés) |
| Adatvesztés védelem | `beforeunload` figyelmeztetés mentetlen változásnál |
| Mentési állapot | „Mentve”, „Mentés…”, „Mentés sikertelen” |

A helyesírási javaslatok elfogadása **előtti** szövegváltozatot is meg kell őrizni (visszaállítás).

---

## 6. Idézetek és források

**Státusz:** Tervezett

Három **külön** adattípus:

### Saját érvelés

- fő szerkesztőmező;
- nincs beillesztés;
- a résztvevő saját megfogalmazása.

### Idézet

- külön „Idézet” mező;
- **beillesztés engedélyezett**;
- vizuálisan elkülönítve (nem olvad össze az érveléssel);
- **kötelező forrás** az idézethez;
- tartalom-ellenőrzés lefut, idézet kontextussal.

### Forrás / Forráslink

- külön mező;
- link beillesztése engedélyezett;
- jól látható a hozzászólás mellett;
- **nem** számít saját megfogalmazásnak.

> „A Winunión idézni lehet. Mások gondolatait sajátként beilleszteni nem.”

---

## 7. Akadálymentesség

**Státusz:** Tervezett

- A beillesztési tilalom **minden** résztvevőre egyformán vonatkozik — nincs kivétel képernyőolvasó / billentyűzet / kapcsoló eszközökre.
- Az operációs rendszer **diktálását** a web nem mindig különbözteti meg megbízhatóan a gépeléstől — a spec **nem ígér** minden felolvasott/külső segített szöveg felismerését.
- A beillesztési korlátozás **nem** szerzőségi bizonyíték — visszaélés megnehezítése, nem lehetetlenné tétele.

Szerkesztő követelmények: címkézett mezők, fókuszkezelés, billentyűzetes navigáció, aria-live mentési állapot.

---

## 8. Elfogadási feltételek

A csomag **késznek** minősül, ha az alábbiak **automatizált teszttel** igazolva:

| # | Eset |
|---|------|
| 1 | Megfelelő szöveg átmegy a tartalom-ellenőrzésen |
| 2 | Személyeskedő / indokolatlanul trágár szöveg nem tehető közzé |
| 3 | Az AI megjelöli a problémát, de **nem** ad helyette új mondatot |
| 4 | Tartalom-ellenőrzés **nem** módosítja az eredeti szöveget |
| 5 | Helyesírás-ellenőrzés csak külön kérésre indul |
| 6 | Helyesírási javítás csak kifejezett elfogadás után kerül a szövegbe |
| 7 | Fő mező blokkolja a beillesztést |
| 8 | Idézet és Forrás mező engedélyezi a szükséges beillesztést |
| 9 | Piszkozat automatikusan mentődik és visszaállítható |
| 10 | AI-szolgáltatás hibája → ellenőrizetlen szöveg **nem** jelenik meg |
| 11 | Szerkesztő alapvető akadálymentes használata megmarad |

---

## Implementációs fázisok (terv)

| Fázis | Tartalom | Státusz |
|-------|----------|---------|
| **0** | Specifikáció (`docs/`) | **Folyamatban** — ez a dokumentum |
| **1** | Adatmodell: idézet/forrás mezők, piszkozat, review napló | Tervezett |
| **2** | Közös `DebateEditor` UI: 3 mező, paste tiltás, piszkozat, a11y | Tervezett |
| **3** | `content-review-service`: AI provider, 3 eredmény, fail-closed | **Kész** |
| **4** | Publish útvonalak bekötése (arguments, closing, stance) | **Kész** |
| **5** | Opcionális helyesírás-ellenőrzés + elfogadási UI | Tervezett |
| **6** | Súlyos eset → emberi queue ([MODERATION.md](MODERATION.md)) | Tervezett |
| **7** | Automatizált tesztek (§8) + manuális QA | Tervezett |

---

## Nyitott termékdöntések

| # | Kérdés |
|---|--------|
| ~~1~~ | ~~AI szolgáltató~~ → **OpenAI (ChatGPT API)** — ADR-034 |
| 2 | Idézet / forrás max. hossz |
| 3 | Piszkozat verziók száma és megőrzési idő |
| 4 | Kiinduló álláspont és jelentkezői stance: azonnali publikálás review után, vagy külön „beküldés ellenőrzésre” lépés? |
| 5 | Súlyos eset automatikus `under_review` vs. csak admin queue |

---

## Kapcsolódó dokumentumok

- [MODERATION.md](MODERATION.md) — emberi moderáció, jelentés, `under_review`
- [DATA_MODEL.md](DATA_MODEL.md) — tervezett entitások
- [API.md](API.md) — tervezett végpontok
- [USER_FLOWS.md](USER_FLOWS.md) — UF-13–UF-15
- [DESIGN_SYSTEM.md](DESIGN_SYSTEM.md) — szerkesztő UI
- [BUSINESS_RULES.md](BUSINESS_RULES.md) — §14
- [DECISIONS.md](DECISIONS.md) — ADR-029–ADR-033
- [MVP_SCOPE.md](MVP_SCOPE.md) — tervezett csomag határa
