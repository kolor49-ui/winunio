import { getSql, withDbRetry } from "@/server/db";

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const [row] = await withDbRetry(async () => {
      const sql = getSql();
      return sql<{ ok: number }[]>`SELECT 1 AS ok`;
    });
    return row?.ok === 1;
  } catch {
    return false;
  }
}
