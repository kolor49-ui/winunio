#!/usr/bin/env node
/**
 * DB migrációk — psql nélkül, Node + postgres (Vercel build + helyi dev).
 */
import { readFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import postgres from "postgres";

function loadDotEnv() {
  const envPath = resolve(process.cwd(), ".env");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      value = value.replace(/^["']|["']$/g, "");
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch {
    // Vercel build: env vars already injected
  }
}

loadDotEnv();

const url = process.env.DATABASE_URL?.trim();
if (!url) {
  console.log("⊘ Migráció kihagyva — nincs DATABASE_URL");
  process.exit(0);
}

const ssl =
  url.includes("sslmode=require") ||
  url.includes("neon.tech") ||
  url.includes("supabase.co")
    ? "require"
    : undefined;

const sql = postgres(url, { max: 1, prepare: false, ...(ssl ? { ssl } : {}) });

const migrationsDir = resolve(process.cwd(), "db/migrations");

try {
  await sql`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `;

  const hasUsers = await sql`
    SELECT to_regclass('public.users') IS NOT NULL AS ok
  `;
  if (hasUsers[0]?.ok) {
    for (const legacy of [
      "000001_initial_schema.up.sql",
      "000002_seed_round_unlock_rules.up.sql",
    ]) {
      const [row] = await sql`
        SELECT 1 AS n FROM schema_migrations WHERE filename = ${legacy}
      `;
      if (!row) {
        console.log(`↺ backfill ${legacy}`);
        await sql`INSERT INTO schema_migrations (filename) VALUES (${legacy})`;
      }
    }
  }

  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".up.sql"))
    .sort();

  for (const base of files) {
    const [applied] = await sql`
      SELECT 1 AS n FROM schema_migrations WHERE filename = ${base}
    `;
    if (applied) {
      console.log(`⊘ skip ${base}`);
      continue;
    }
    console.log(`→ ${base}`);
    const filePath = join(migrationsDir, base);
    await sql.file(filePath);
    await sql`INSERT INTO schema_migrations (filename) VALUES (${base})`;
  }

  console.log("Migrációk kész.");
} finally {
  await sql.end({ timeout: 5 });
}
