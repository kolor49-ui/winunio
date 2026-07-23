#!/usr/bin/env node
/**
 * Teljes levélküldés teszt — ugyanaz a kódút, mint az app (Resend SDK + .env).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Resend } from "resend";

const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8");
const key = envFile
  .match(/^RESEND_API_KEY=(.+)$/m)?.[1]
  ?.trim()
  .replace(/^["']|["']$/g, "");
const to =
  process.argv[2]?.trim() ||
  envFile.match(/^TEST_EMAIL=(.+)$/m)?.[1]?.trim() ||
  "reziszallas@gmail.com";

if (!key || key.includes("xxxxxxxx")) {
  console.error("❌ Nincs érvényes RESEND_API_KEY a .env-ben");
  process.exit(1);
}

console.log("Kulcs hossz:", key.length, "karakter");
console.log("Címzett:", to);

const resend = new Resend(key);
const { data, error } = await resend.emails.send({
  from: "onboarding@resend.dev",
  to,
  subject: "Winunio teszt levél",
  text: "Ha ezt látod, a Resend működik.",
});

if (error) {
  console.error("❌ Küldés sikertelen:", error);
  process.exit(1);
}

console.log("✓ Levél kiment, id:", data?.id);
