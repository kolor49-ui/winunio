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

export function getSql() {
  if (!globalThis.__winunioSql) {
    globalThis.__winunioSql = postgres(getDatabaseUrl(), {
      max: 10,
      prepare: false,
    });
  }
  return globalThis.__winunioSql;
}

export type Sql = ReturnType<typeof getSql>;
