import { createHash, randomInt } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";
import { getSmsReadiness } from "@/server/sms/sms-readiness";
import {
  checkTwilioVerification,
  mapTwilioError,
  sendTwilioVerification,
} from "@/server/sms/twilio-verify";

const OTP_TTL_MINUTES = 10;
const TWILIO_PENDING_MARKER = "twilio-verify";
const CONTINUATION_OTP_PREFIX = "continuation:";

function continuationOtpMarker(challengeId: string): string {
  return `${CONTINUATION_OTP_PREFIX}${challengeId}`;
}

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

async function markPhoneVerificationComplete(userId: string, phoneE164: string) {
  const sql = getSql();
  return sql.begin(async (tx) => {
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

export async function startPhoneVerification(userId: string, phone: string) {
  const sql = getSql();
  const phoneE164 = normalizePhoneE164(phone);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const sms = getSmsReadiness();

  if (sms.provider === "twilio_verify") {
    try {
      await sendTwilioVerification(phoneE164);
    } catch (error) {
      console.error("[phone-otp] Twilio send failed:", error);
      throw new ApiError(502, "SMS_SEND_FAILED", mapTwilioError(error));
    }

    await sql`DELETE FROM phone_otp_pending WHERE user_id = ${userId}`;
    await sql`
      INSERT INTO phone_otp_pending (user_id, phone_e164, code_hash, expires_at)
      VALUES (${userId}, ${phoneE164}, ${TWILIO_PENDING_MARKER}, ${expiresAt})
    `;

    return {
      phone_e164: phoneE164,
      expires_at: expiresAt.toISOString(),
      delivery: "sms" as const,
      message: "Ellenőrző kódot SMS-ben küldtünk.",
    };
  }

  if (sms.provider === "none") {
    throw new ApiError(
      503,
      "SMS_NOT_CONFIGURED",
      "Telefonos megerősítés élesben még nincs beállítva (Twilio Verify).",
    );
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await sql`DELETE FROM phone_otp_pending WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO phone_otp_pending (user_id, phone_e164, code_hash, expires_at)
    VALUES (${userId}, ${phoneE164}, ${hashOtp(code)}, ${expiresAt})
  `;

  console.info(`[phone-otp] ${phoneE164} → ${code} (dev)`);

  return {
    phone_e164: phoneE164,
    expires_at: expiresAt.toISOString(),
    delivery: "dev" as const,
    dev_code: process.env.NODE_ENV === "development" ? code : undefined,
    message: "Fejlesztői mód: a kód a képernyőn jelenik meg.",
  };
}

export async function confirmPhoneVerification(
  userId: string,
  phone: string,
  code: string,
) {
  const sql = getSql();
  const phoneE164 = normalizePhoneE164(phone);
  const sms = getSmsReadiness();

  const [pending] = await sql<
    { id: string; code_hash: string; expires_at: Date }[]
  >`
    SELECT id, code_hash, expires_at
    FROM phone_otp_pending
    WHERE user_id = ${userId} AND phone_e164 = ${phoneE164}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!pending) {
    throw new ApiError(404, "OTP_NOT_FOUND", "Nincs folyamatban lévő kód — kérj újat");
  }
  if (pending.expires_at.getTime() <= Date.now()) {
    throw new ApiError(410, "OTP_EXPIRED", "A kód lejárt — kérj új SMS-t");
  }

  if (sms.provider === "twilio_verify" || pending.code_hash === TWILIO_PENDING_MARKER) {
    try {
      const approved = await checkTwilioVerification(phoneE164, code);
      if (!approved) {
        throw new ApiError(401, "OTP_INVALID", "Hibás vagy lejárt kód");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("[phone-otp] Twilio check failed:", error);
      throw new ApiError(502, "SMS_VERIFY_FAILED", mapTwilioError(error));
    }

    return markPhoneVerificationComplete(userId, phoneE164);
  }

  if (pending.code_hash !== hashOtp(code)) {
    throw new ApiError(401, "OTP_INVALID", "Hibás kód");
  }

  return markPhoneVerificationComplete(userId, phoneE164);
}

export async function isPhoneVerified(userId: string): Promise<boolean> {
  const sql = getSql();
  const [user] = await sql<{ phone_verified_at: Date | null }[]>`
    SELECT phone_verified_at FROM users WHERE id = ${userId} LIMIT 1
  `;
  return user?.phone_verified_at != null;
}

export async function getVerifiedPhoneE164(userId: string): Promise<string> {
  const sql = getSql();
  const [row] = await sql<{ phone_e164: string }[]>`
    SELECT phone_e164
    FROM phone_verifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!row) {
    throw new ApiError(
      403,
      "PHONE_NOT_VERIFIED",
      "Telefonszám megerősítés szükséges",
    );
  }
  return row.phone_e164;
}

export function maskPhoneE164(phoneE164: string): string {
  const digits = phoneE164.replace(/\D/g, "");
  if (digits.length < 4) return phoneE164;
  return `••• ${digits.slice(-4)}`;
}

export async function startContinuationSmsOtp(userId: string, challengeId: string) {
  const sql = getSql();
  const phoneE164 = await getVerifiedPhoneE164(userId);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);
  const sms = getSmsReadiness();
  const marker = continuationOtpMarker(challengeId);

  if (sms.provider === "twilio_verify") {
    try {
      await sendTwilioVerification(phoneE164);
    } catch (error) {
      console.error("[continuation-otp] Twilio send failed:", error);
      throw new ApiError(502, "SMS_SEND_FAILED", mapTwilioError(error));
    }

    await sql`DELETE FROM phone_otp_pending WHERE user_id = ${userId}`;
    await sql`
      INSERT INTO phone_otp_pending (user_id, phone_e164, code_hash, expires_at)
      VALUES (${userId}, ${phoneE164}, ${`${marker}:twilio`}, ${expiresAt})
    `;

    return {
      phone_masked: maskPhoneE164(phoneE164),
      expires_at: expiresAt.toISOString(),
      delivery: "sms" as const,
    };
  }

  if (sms.provider === "none") {
    throw new ApiError(
      503,
      "SMS_NOT_CONFIGURED",
      "SMS megerősítés élesben nincs beállítva (Twilio Verify).",
    );
  }

  const code = String(randomInt(0, 1_000_000)).padStart(6, "0");

  await sql`DELETE FROM phone_otp_pending WHERE user_id = ${userId}`;
  await sql`
    INSERT INTO phone_otp_pending (user_id, phone_e164, code_hash, expires_at)
    VALUES (${userId}, ${phoneE164}, ${`${marker}:${hashOtp(code)}`}, ${expiresAt})
  `;

  console.info(`[continuation-otp] ${phoneE164} challenge=${challengeId} → ${code} (dev)`);

  return {
    phone_masked: maskPhoneE164(phoneE164),
    expires_at: expiresAt.toISOString(),
    delivery: "dev" as const,
    dev_code: process.env.NODE_ENV === "development" ? code : undefined,
  };
}

export async function verifyContinuationSmsOtp(
  userId: string,
  challengeId: string,
  code: string,
) {
  const sql = getSql();
  const marker = continuationOtpMarker(challengeId);
  const phoneE164 = await getVerifiedPhoneE164(userId);

  const [pending] = await sql<
    { id: string; code_hash: string; expires_at: Date; phone_e164: string }[]
  >`
    SELECT id, code_hash, expires_at, phone_e164
    FROM phone_otp_pending
    WHERE user_id = ${userId}
      AND phone_e164 = ${phoneE164}
      AND code_hash LIKE ${`${marker}:%`}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!pending) {
    throw new ApiError(404, "OTP_NOT_FOUND", "Nincs folyamatban lévő kód — kérj újat");
  }
  if (pending.expires_at.getTime() <= Date.now()) {
    throw new ApiError(410, "OTP_EXPIRED", "A kód lejárt — kérj új SMS-t");
  }

  if (pending.code_hash.endsWith(":twilio")) {
    try {
      const approved = await checkTwilioVerification(phoneE164, code);
      if (!approved) {
        throw new ApiError(401, "OTP_INVALID", "Hibás vagy lejárt kód");
      }
    } catch (error) {
      if (error instanceof ApiError) throw error;
      console.error("[continuation-otp] Twilio check failed:", error);
      throw new ApiError(502, "SMS_VERIFY_FAILED", mapTwilioError(error));
    }
  } else {
    const expectedHash = pending.code_hash.slice(marker.length + 1);
    if (expectedHash !== hashOtp(code)) {
      throw new ApiError(401, "OTP_INVALID", "Hibás kód");
    }
  }

  await sql`DELETE FROM phone_otp_pending WHERE id = ${pending.id}`;
  return { verified: true as const };
}
