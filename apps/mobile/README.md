# Winunio Android app

React Native + Expo — [docs/MOBILE_APP.md](../../docs/MOBILE_APP.md)

## Fejlesztés

```bash
cd apps/mobile
npm install
npm start
```

Android emulátor vagy Expo Go: scan QR.

API alapértelmezés: `https://www.winunio.com`. Felülírás:

```bash
EXPO_PUBLIC_API_URL=http://YOUR_LAN_IP:3001 npm start
```

## Teszt Play Console nélkül (ajánlott indulás)

### 1. Telefon

- Telepítsd a **Expo Go** appot a Play Store-ból (ez csak teszt eszköz, nem a Winunió app).

### 2. Mac

```bash
cd apps/mobile
npm install
npm start
```

### 3. Csatlakozás

- Telefon és Mac **ugyanazon a Wi‑Fin**.
- Expo Go → **Scan QR code** a terminálban / böngészőben megjelenő kódot.

Ha nem csatlakozik: terminálban `s` → **Tunnel** mód, újra scan.

### 4. Bejelentkezés

- Az app az éles API-t hívja: `https://www.winunio.com`
- Ugyanazzal a fiókkal jelentkezz be, mint a weben.
- **Deploy kell** a Bearer auth-hoz (`git push` után ~2 perc).

### Alternatíva: USB / natív build (Inauone-szerű)

Telefonon: **Developer options → USB debugging** be.

```bash
cd apps/mobile
npx expo run:android
```

Ez telepít egy önálló Winunió ikont (Expo Go nélkül). Android Studio / SDK kell a Macen.

---

## Build (Play internal test — később)

```bash
npx eas build --platform android --profile preview
```

`eas.json` és Play listing együtt állítjuk be.

## Csomagnév

`com.winunio.app` — új listing a meglévő Play Console fiókban.
