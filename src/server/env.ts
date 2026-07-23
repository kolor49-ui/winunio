import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export function readEnv(name: string): string | null {
  if (process.env.NODE_ENV === "development") {
    try {
      const envFile = readFileSync(resolve(process.cwd(), ".env"), "utf8");
      const line = envFile
        .split("\n")
        .find((entry) => entry.startsWith(`${name}=`));
      if (line) {
        const fromFile = line
          .slice(name.length + 1)
          .trim()
          .replace(/^["']|["']$/g, "");
        if (fromFile) return fromFile;
      }
    } catch {
      // fallback process.env alá
    }
  }

  const raw = process.env[name];
  if (!raw) return null;
  return raw.trim().replace(/^["']|["']$/g, "");
}
