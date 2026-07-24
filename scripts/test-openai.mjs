#!/usr/bin/env node
/**
 * Ellenőrzi a .env OpenAI beállításokat és egy minimális API hívást.
 * A kulcsot nem írja ki.
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

const key = env.OPENAI_API_KEY?.trim() ?? "";
const model = env.OPENAI_MODEL?.trim() || "gpt-4o-mini";

if (!key) {
  console.error("❌ OPENAI_API_KEY hiányzik a .env-ből.");
  console.error("   OpenAI → API Keys → https://platform.openai.com/api-keys");
  console.error("   Add hozzá: OPENAI_API_KEY=sk-...");
  process.exit(1);
}

if (!key.startsWith("sk-")) {
  console.error("❌ Az OPENAI_API_KEY nem sk_-vel kezdődik.");
  process.exit(1);
}

console.log("✓ API kulcs formátum OK");
console.log("  Hossz:", key.length, "karakter");
console.log("✓ OPENAI_MODEL:", model);

const modelsRes = await fetch("https://api.openai.com/v1/models", {
  headers: { Authorization: `Bearer ${key}` },
});

if (modelsRes.status === 401) {
  console.error("❌ OpenAI elutasítja a kulcsot (401).");
  process.exit(1);
}

if (!modelsRes.ok) {
  console.error("❌ OpenAI models hiba:", modelsRes.status, await modelsRes.text());
  process.exit(1);
}

console.log("✓ OpenAI API elérhető (models)");

const reviewRes = await fetch("https://api.openai.com/v1/chat/completions", {
  method: "POST",
  headers: {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    model,
    temperature: 0,
    max_tokens: 120,
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "winunio_smoke",
        strict: true,
        schema: {
          type: "object",
          properties: {
            status: { type: "string", enum: ["approved"] },
            issues: {
              type: "array",
              items: {
                type: "object",
                properties: {},
                additionalProperties: false,
              },
            },
          },
          required: ["status", "issues"],
          additionalProperties: false,
        },
      },
    },
    messages: [
      {
        role: "user",
        content:
          'Teszt: "Sok érv szól amellett, hogy a döntés helytelen volt." — approved?',
      },
    ],
  }),
});

if (!reviewRes.ok) {
  console.error(
    "❌ Chat Completions hiba:",
    reviewRes.status,
    await reviewRes.text(),
  );
  process.exit(1);
}

const reviewData = await reviewRes.json();
const content = reviewData.choices?.[0]?.message?.content;
console.log("✓ Tartalom-ellenőrzés smoke teszt OK");
console.log("  Válasz:", content);
