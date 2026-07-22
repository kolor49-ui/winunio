# Winunio — Moderálás

Világosan különválasztja a **moderációt** a **minősítéstől**.

---

## A platform vizsgálhatja

| Kategória | Példa |
|-----------|--------|
| Jogellenes tartalom | Büntetőjogi kockázat |
| Fenyegetés | Erőszakos fenyegetés |
| Személyes adat | Doxxing, telefonszám közzététele |
| Zaklatás | Célzott bántalmazás |
| Spam | Tömeges, irreleváns tartalom |
| Technikai visszaélés | Bot farm, manipulált folytatáskérések |

---

## A platform nem minősíti

- az álláspont intelligenciáját;
- a vitázó képességét;
- az érv „erősségét”;
- a politikai vagy erkölcsi helyességet;
- a partner kiválasztását („rossz partner” ≠ moderációs ok).

---

## MVP moderációs folyamat

```
Felhasználó → Report (ok kategória)
           → Admin queue
           → ModerationAction (under_review / remove / suspend / complete)
```

### `under_review` hatása

- Vita `under_review` állapotba kerül.
- Új forduló beküldés és folytatáskérés **felfüggesztve**.
- Meglévő tartalom látható maradhat vagy elrejthető (admin döntés).

### Lezárás

- Admin `completed`-re állíthatja a vitát.
- Jutalom **nem** számolódik újra lezáráskor.

---

## Jelentés (Report)

- Bejelentkezett felhasználó jelenthet vitát, fordulót vagy konkrét argumentumot.
- Ok: `illegal` \| `threat` \| `pii` \| `harassment` \| `spam` \| `abuse`.
- Nincs közönség-szavazás-alapú moderáció.

---

## Vitaindító viselkedése

A partner kiválasztás **nem** minősítés — de szisztematikus kizárás / soha nem választ technikai visszaélés lehet → `ABUSE_PREVENTION`, nem tartalmi minősítés.

---

## GDPR / törlés

[TBD implementáció] — fióktörlés, adatmegőrzési idők külön policy.

Kapcsolódó: [ABUSE_PREVENTION.md](ABUSE_PREVENTION.md), [BUSINESS_RULES.md](BUSINESS_RULES.md) §12, [DATA_MODEL.md](DATA_MODEL.md).
