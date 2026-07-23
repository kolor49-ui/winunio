import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";

const OTP_TTL_MINUTES = 10;

const startPhoneSchema = z.object({
  phone: z.string().min(8).max(20),
});

const confirmPhoneSchema = z.object({
  phone: z.string().min(8).max(20),
  code: z.string().regex(/^\d{6}$/),
});

export function parseStartPhoneBody(body: unknown) {
  return startPhoneSchema.parse(body);
}

export function parseConfirmPhoneBody(body: unknown) {
  return confirmPhoneSchema.parse(body);
}

function normalizePhoneE164(phone: string): string {
  const trimmed = phone.trim().replace(/\s+/g, "");
  if (trimmed.startsWith("+")) return trimmed;
  if (trimmed.startsWith("00")) return `+${trimmed.slice(2)}`;
  if (trimmed.startsWith("06")) return `+36${trimmed.slice(1)}`;
  if (/^\d{9}$/.test(trimmed)) return `+36${trimmed}`;
  throw new ApiError(422, "INVALID_PHONE", "Érvényes telefonszám kell (+36…)");
}

function hashOtp(code: string): string {
  return createHash("sha256").update(code).digest("hex");
}

export async function startPhoneVerification(userId: string, phone: string) {
  const sql = getSql();
  const phoneE164 = normalizePhoneE164(phone);
  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await sql`DELETE FROM phone_otp_pending WHERE user_id = ${userId}`;

  await sql`
    INSERT INTO phone_otp_pending (user_id, phone_e164, code_hash, expires_at)
    VALUES (${userId}, ${phoneE164}, ${hashOtp(code)}, ${expiresAt})
  `;

  console.info(`[phone-otp] ${phoneE164} → ${code} (dev)`);

  return {
    phone_e164: phoneE164,
    expires_at: expiresAt.toISOString(),
    dev_code: process.env.NODE_ENV === "development" ? code : undefined,
  };
}

export async function confirmPhoneVerification(
  userId: string,
  phone: string,
  code: string,
) {
  const sql = getSql();
  const phoneE164 = normalizePhoneE164(phone);

  return sql.begin(async (tx) => {
    const [pending] = await tx<
      { id: string; code_hash: string; expires_at: Date }[]
    >`
      SELECT id, code_hash, expires_at
      FROM phone_otp_pending
      WHERE user_id = ${userId} AND phone_e164 = ${phoneE164}
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
    `;

    if (!pending) {
      throw new ApiError(404, "OTP_NOT_FOUND", "Nincs folyamatban lévő kód");
    }
    if (pending.expires_at.getTime() <= Date.now()) {
      throw new ApiError(410, "OTP_EXPIRED", "A kód lejárt — kérj újat");
    }
    if (pending.code_hash !== hashOtp(code)) {
      throw new ApiError(401, "OTP_INVALID", "Hibás kód");
    }

    await tx`DELETE FROM phone_otp_pending WHERE user_id = ${userId}`;

    await tx`
      UPDATE users
      SET phone_verified_at = now()
      WHERE id = ${userId}
    `;

    await tx`
      INSERT INTO phone_verifications (user_id, phone_e164)
      VALUES (${userId}, ${phoneE164})
    `;

    return { phone_verified: true as const, phone_e164: phoneE164 };
  });
}

export async function isPhoneVerified(userId: string): Promise<boolean> {
  const sql = getSql();
  const [user] = await sql<{ phone_verified_at: Date | null }[]>`
    SELECT phone_verified_at FROM users WHERE id = ${userId} LIMIT 1
  `;
  return user?.phone_verified_at != null;
}
