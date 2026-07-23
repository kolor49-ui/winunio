#!/usr/bin/env node
/**
 * Szinkronizálja a Vercel Production + Preview env-et a .env alapján.
 * Használat: node scripts/sync-vercel-env.mjs
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

function parseEnvFile(path) {
  const text = readFileSync(path, "utf8");
  const values = {};
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    values[key] = value;
  }
  return values;
}

const local = parseEnvFile(resolve(process.cwd(), ".env"));

if (!local.CRON_SECRET) {
  console.error(
    "❌ CRON_SECRET hiányzik a .env-ből. Add hozzá: openssl rand -base64 32",
  );
  process.exit(1);
}

const productionValues = {
  DATABASE_URL: local.DATABASE_URL,
  AUTH_SECRET: local.AUTH_SECRET,
  NEXT_PUBLIC_APP_URL: "https://www.winunio.com",
  RESEND_API_KEY: local.RESEND_API_KEY,
  EMAIL_FROM: "Winunio <noreply@winunio.com>",
  CRON_SECRET: local.CRON_SECRET,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY:
    local.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "1x00000000000000000000AA",
  TURNSTILE_SECRET_KEY:
    local.TURNSTILE_SECRET_KEY ?? "1x0000000000000000000000000000000AA",
};

if (local.OPENAI_API_KEY) {
  productionValues.OPENAI_API_KEY = local.OPENAI_API_KEY;
  productionValues.OPENAI_MODEL = local.OPENAI_MODEL ?? "gpt-4o-mini";
} else {
  console.warn(
    "⚠ OPENAI_API_KEY hiányzik a .env-ből — a tartalom-ellenőrzés productionben nem fog működni.",
  );
}

const required = Object.keys(productionValues);
const missing = required.filter((key) => !productionValues[key]);
if (missing.length) {
  console.error("❌ Hiányzó értékek a .env-ben:", missing.join(", "));
  process.exit(1);
}

const targets = ["production", "preview"];

for (const target of targets) {
  for (const [name, value] of Object.entries(productionValues)) {
    const result = spawnSync(
      "npx",
      [
        "vercel@latest",
        "env",
        "add",
        name,
        target,
        "--value",
        value,
        "--force",
        "--yes",
        "--sensitive",
      ],
      {
        cwd: process.cwd(),
        stdio: "pipe",
        encoding: "utf8",
      },
    );

    if (result.status !== 0) {
      console.error(`❌ ${name} (${target}) sikertelen:`);
      console.error(result.stderr || result.stdout);
      process.exit(1);
    }

    console.log(`✓ ${name} → ${target}`);
  }
}

console.log("\n✅ Vercel env frissítve. Redeploy indítása…");

const deploy = spawnSync(
  "npx",
  ["vercel@latest", "deploy", "--prod", "--yes"],
  { cwd: process.cwd(), stdio: "inherit" },
);

process.exit(deploy.status ?? 1);
