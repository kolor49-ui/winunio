#!/usr/bin/env node
/**
 * Ellenőrzi a .env Resend beállításokat (kulcsot nem írja ki).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const envPath = resolve(process.cwd(), ".env");
const raw = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  raw
    .split("\n")
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const i = line.indexOf("=");
      return [line.slice(0, i), line.slice(i + 1).replace(/^"|"$/g, "")];
    }),
);

const key = env.RESEND_API_KEY?.trim() ?? "";
const from = env.EMAIL_FROM?.trim() ?? "";

if (!key || key.includes("xxxxxxxx")) {
  console.error("❌ A RESEND_API_KEY még placeholder (re_xxxxxxxx...).");
  console.error("   Resend → API Keys → másold be a VALÓDI kulcsot a .env-be, mentsd.");
  process.exit(1);
}

if (!key.startsWith("re_")) {
  console.error("❌ A RESEND_API_KEY nem re_-vel kezdődik.");
  process.exit(1);
}

console.log("✓ API kulcs formátum OK");
console.log("  Hossz:", key.length, "karakter (ha rövidnek tűnik, lehet, hogy nem teljes másolás)");
console.log("✓ EMAIL_FROM:", from || "(alapértelmezett onboarding@resend.dev)");

const headers = {
  Authorization: `Bearer ${key}`,
  "Content-Type": "application/json",
  "User-Agent": "winunio-test/1.0",
};

// Üres body → auth ellenőrzés, levél nem megy ki érvényes adatok nélkül
const res = await fetch("https://api.resend.com/emails", {
  method: "POST",
  headers,
  body: JSON.stringify({}),
});

const body = await res.text();
let parsed;
try {
  parsed = JSON.parse(body);
} catch {
  parsed = { message: body.slice(0, 200) };
}

if (res.status === 401) {
  console.error("❌ Resend: érvénytelen API kulcs (401).");
  console.error("   Üzenet:", parsed.message ?? body);
  console.error("");
  console.error("Gyakori okok:");
  console.error("  • Nem a teljes kulcsot másoltad (Resend csak egyszer mutatja)");
  console.error("  • Rossz Resend fiók (Inauone vs Winunio)");
  console.error("  • A kulcsot törölted / újrageneráltad a dashboardon");
  console.error("");
  console.error("Megoldás: resend.com/api-keys → Create API Key → Sending access");
  console.error("         → másold ki az EGÉSZ re_... sort → .env → mentsd → npm run dev");
  process.exit(1);
}

if (res.status === 403 && parsed.message?.includes("testing emails")) {
  console.log("✓ API kulcs érvényes (auth OK)");
  console.log("");
  console.log("Sandbox szabály: onboarding@resend.dev csak a Resend-fiókod");
  console.log("e-mail címére küld. Winunión UGYANAZZAL regisztrálj.");
  process.exit(0);
}

if (res.status === 422 || res.status === 400) {
  console.log("✓ API kulcs érvényes — a levélküldés működnie kell.");
  console.log("");
  console.log("Következő: npm run dev újraindítás, regisztráció a Resend-fiók e-mail címével.");
  process.exit(0);
}

console.error("❌ Váratlan Resend válasz:", res.status, parsed.message ?? body.slice(0, 200));
process.exit(1);
