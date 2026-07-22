import { getSql } from "@/server/db";

export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    const sql = getSql();
    const [row] = await sql<{ ok: number }[]>`SELECT 1 AS ok`;
    return row?.ok === 1;
  } catch {
    return false;
  }
}
