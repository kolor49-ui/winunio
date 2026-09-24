import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";
import QRCode from "qrcode";
import { generateSecret, generateURI, verifySync } from "otplib";
import { z } from "zod";
import { ApiError } from "@/server/api/http";
import { getSql } from "@/server/db";

const SETUP_TTL_MINUTES = 15;
const ISSUER = "Winunio";
const TOTP_EPOCH_TOLERANCE = 1;

const confirmTotpSchema = z.object({
  code: z.string().regex(/^\d{6}$/),
});

export function parseConfirmTotpBody(body: unknown) {
  return confirmTotpSchema.parse(body);
}

function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    throw new ApiError(
      500,
      "INTERNAL_ERROR",
      "AUTH_SECRET hiányzik a TOTP titkosításhoz",
    );
  }
  return createHash("sha256").update(`${secret}:totp-v1`).digest();
}

function encryptSecret(plainSecret: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plainSecret, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(".");
}

function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const [ivB64, tagB64, dataB64] = ciphertext.split(".");
  if (!ivB64 || !tagB64 || !dataB64) {
    throw new ApiError(500, "INTERNAL_ERROR", "Érvénytelen TOTP titkosítás");
  }
  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString(
    "utf8",
  );
}

export async function isTotpEnabled(userId: string): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql<{ user_id: string }[]>`
    SELECT user_id FROM user_totp_credentials WHERE user_id = ${userId} LIMIT 1
  `;
  return Boolean(row);
}

export async function startTotpSetup(userId: string, email: string) {
  const sql = getSql();

  if (await isTotpEnabled(userId)) {
    throw new ApiError(
      409,
      "TOTP_ALREADY_ENABLED",
      "Az authenticator app már be van állítva",
    );
  }

  const secret = generateSecret();
  const otpauthUri = generateURI({
    issuer: ISSUER,
    label: email,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUri, {
    margin: 1,
    width: 220,
  });
  const expiresAt = new Date(Date.now() + SETUP_TTL_MINUTES * 60 * 1000);

  await sql`
    INSERT INTO user_totp_pending (user_id, secret_ciphertext, expires_at)
    VALUES (${userId}, ${encryptSecret(secret)}, ${expiresAt})
    ON CONFLICT (user_id) DO UPDATE
    SET
      secret_ciphertext = EXCLUDED.secret_ciphertext,
      expires_at = EXCLUDED.expires_at,
      created_at = now()
  `;

  return {
    otpauth_uri: otpauthUri,
    qr_code_data_url: qrCodeDataUrl,
    manual_secret: secret,
    expires_at: expiresAt.toISOString(),
  };
}

export async function confirmTotpSetup(userId: string, code: string) {
  const sql = getSql();

  if (await isTotpEnabled(userId)) {
    throw new ApiError(
      409,
      "TOTP_ALREADY_ENABLED",
      "Az authenticator app már be van állítva",
    );
  }

  const [pending] = await sql<
    { secret_ciphertext: string; expires_at: Date }[]
  >`
    SELECT secret_ciphertext, expires_at
    FROM user_totp_pending
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (!pending) {
    throw new ApiError(
      404,
      "TOTP_SETUP_NOT_FOUND",
      "Nincs folyamatban lévő beállítás — indítsd újra",
    );
  }
  if (pending.expires_at.getTime() <= Date.now()) {
    await sql`DELETE FROM user_totp_pending WHERE user_id = ${userId}`;
    throw new ApiError(410, "TOTP_SETUP_EXPIRED", "A beállítás lejárt — indítsd újra");
  }

  const secret = decryptSecret(pending.secret_ciphertext);
  if (!verifyTotpCode(secret, code)) {
    throw new ApiError(401, "TOTP_INVALID", "Hibás vagy lejárt kód");
  }

  await sql.begin(async (tx) => {
    await tx`
      INSERT INTO user_totp_credentials (user_id, secret_ciphertext)
      VALUES (${userId}, ${encryptSecret(secret)})
    `;
    await tx`DELETE FROM user_totp_pending WHERE user_id = ${userId}`;
  });

  return { totp_enabled: true as const };
}

export async function verifyTotpForContinuation(userId: string, code: string) {
  const sql = getSql();

  const [cred] = await sql<{ secret_ciphertext: string }[]>`
    SELECT secret_ciphertext
    FROM user_totp_credentials
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  if (!cred) {
    throw new ApiError(
      403,
      "TOTP_NOT_CONFIGURED",
      "Authenticator app beállítása szükséges a folytatáskéréshez",
    );
  }

  const secret = decryptSecret(cred.secret_ciphertext);
  if (!verifyTotpCode(secret, code)) {
    throw new ApiError(401, "TOTP_INVALID", "Hibás vagy lejárt kód");
  }

  return { verified: true as const };
}

function verifyTotpCode(secret: string, code: string): boolean {
  return verifySync({
    secret,
    token: code,
    epochTolerance: TOTP_EPOCH_TOLERANCE,
  }).valid;
}
