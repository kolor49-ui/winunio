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

## Build (Play internal test — később)

```bash
npx eas build --platform android --profile preview
```

`eas.json` és Play listing együtt állítjuk be.

## Csomagnév

`com.winunio.app` — új listing a meglévő Play Console fiókban.
