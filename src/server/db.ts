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

function isServerlessRuntime(): boolean {
  return Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
}

function warnIfSuboptimalSupabasePooler(url: string): void {
  if (
    isServerlessRuntime() &&
    url.includes("supabase.co") &&
    url.includes(":5432") &&
    !url.includes(":6543")
  ) {
    console.warn(
      "[db] Supabase session pooler (:5432) gyakran EMAXCONNSESSION hibát okoz serverlessben. Használj transaction poolert (:6543).",
    );
  }
}

function getPoolMaxConnections(): number {
  const parsed = Number(process.env.DB_POOL_MAX);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.floor(parsed);
  }
  return isServerlessRuntime() ? 1 : 10;
}

export function isDatabaseConfigError(error: unknown): boolean {
  return (
    error instanceof Error && error.message.includes("DATABASE_URL is not set")
  );
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }
  return "";
}

function getErrorCode(error: unknown): string | undefined {
  if (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code: unknown }).code === "string"
  ) {
    return (error as { code: string }).code;
  }
  return undefined;
}

export function isTransientDbError(error: unknown): boolean {
  const message = getErrorMessage(error).toLowerCase();
  if (
    message.includes("max clients") ||
    message.includes("emaxconnsession") ||
    message.includes("too many connections") ||
    message.includes("connection terminated") ||
    message.includes("connection timeout") ||
    message.includes("econnreset") ||
    message.includes("etimedout")
  ) {
    return true;
  }

  const code = getErrorCode(error);
  return Boolean(
    code &&
      ["53300", "57P01", "08006", "08001", "08003", "XX000"].includes(code),
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function withDbRetry<T>(
  run: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (isDatabaseConfigError(error) || !isTransientDbError(error)) {
        throw error;
      }
      if (attempt === attempts - 1) {
        throw error;
      }
      await sleep(150 * (attempt + 1));
    }
  }

  throw lastError;
}

export function getSql() {
  if (!globalThis.__winunioSql) {
    const url = getDatabaseUrl();
    warnIfSuboptimalSupabasePooler(url);
    const ssl = getSslOption(url);
    globalThis.__winunioSql = postgres(url, {
      max: getPoolMaxConnections(),
      idle_timeout: 20,
      connect_timeout: 10,
      max_lifetime: 60 * 30,
      prepare: false,
      ...(ssl ? { ssl } : {}),
    });
  }
  return globalThis.__winunioSql;
}

export type Sql = ReturnType<typeof getSql>;
