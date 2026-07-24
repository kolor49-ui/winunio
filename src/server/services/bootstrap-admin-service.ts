import { getSql } from "@/server/db";
import { readEnv } from "@/server/env";

export function getBootstrapAdminEmails(): string[] {
  const raw = readEnv("WINUNIO_BOOTSTRAP_ADMIN_EMAIL");
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.toLowerCase().trim())
    .filter(Boolean);
}

/** @deprecated use getBootstrapAdminEmails */
export function getBootstrapAdminEmail(): string | null {
  return getBootstrapAdminEmails()[0] ?? null;
}

export function isBootstrapAdminEmail(email: string): boolean {
  const emails = getBootstrapAdminEmails();
  if (emails.length === 0) return false;
  return emails.includes(email.toLowerCase().trim());
}

/** Promotes env-configured bootstrap admin on login/register/me. Idempotent. */
export async function ensureBootstrapAdmin(
  userId: string,
  email: string,
): Promise<boolean> {
  if (!isBootstrapAdminEmail(email)) return false;

  const sql = getSql();
  const result = await sql`
    UPDATE users
    SET is_admin = true
    WHERE id = ${userId}
      AND status = 'active'
      AND is_admin = false
  `;
  return result.count > 0;
}
