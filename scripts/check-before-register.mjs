#!/usr/bin/env node
/**
 * Regisztráció előtti ellenőrzés — local és éles.
 * Használat: node scripts/check-before-register.mjs [url]
 */
const base =
  process.argv[2]?.replace(/\/$/, "") || "https://www.winunio.com";

const res = await fetch(`${base}/api/v1/health/readiness`);
const data = await res.json();

console.log(`\nWinunio regisztráció-előtti ellenőrzés: ${base}\n`);

if (data.ready) {
  console.log("✅ KÉSZEN ÁLL — nyugodtan regisztrálhatsz.\n");
} else {
  console.log("❌ MÉG NEM KÉSZ — ne regisztrálj, amíg ez nincs javítva:\n");
}

console.log("Adatbázis:", data.database);
console.log("App URL:", data.app_url ?? "(nincs)");
console.log("Email FROM:", data.email_from);
console.log(
  "E-mail mód:",
  data.email_public
    ? "éles (bármely címre mehet)"
    : data.email_sandbox
      ? "sandbox (csak Resend-fiók címére)"
      : "ismeretlen",
);
console.log(
  "Resend kulcs:",
  data.resend_api_key_set
    ? `beállítva (${data.resend_api_key_length} karakter)`
    : "HIÁNYZIK",
);

if (data.issues?.length) {
  console.log("\nProblémák:");
  for (const issue of data.issues) {
    console.log("  •", issue);
  }
}

if (data.sandbox) {
  console.log("\nMegjegyzés:", data.sandbox);
}

console.log("");
process.exit(data.ready ? 0 : 1);
