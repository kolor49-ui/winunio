import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __winunioSql: ReturnType<typeof postgres> | undefined;
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

function getSslOption(url: string): "require" | undefined {
  if (
    url.includes("sslmode=require") ||
    url.includes("neon.tech") ||
    url.includes("supabase.co")
  ) {
    return "require";
  }
  return undefined;
}

export function getSql() {
  if (!globalThis.__winunioSql) {
    const url = getDatabaseUrl();
    const ssl = getSslOption(url);
    globalThis.__winunioSql = postgres(url, {
      max: 10,
      prepare: false,
      ...(ssl ? { ssl } : {}),
    });
  }
  return globalThis.__winunioSql;
}

export type Sql = ReturnType<typeof getSql>;
