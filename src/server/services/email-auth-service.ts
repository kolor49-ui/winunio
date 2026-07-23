import { getSql } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import {
  buildResetPasswordUrl,
  buildVerifyEmailUrl,
  generateEmailToken,
  hashEmailToken,
  type EmailTokenPurpose,
} from "@/server/email/tokens";
import {
  formatResendError,
  passwordResetEmailContent,
  sendEmail,
  verificationEmailContent,
} from "@/server/email/send-email";
import { ApiError } from "@/server/api/http";

const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

async function invalidateActiveTokens(
  userId: string,
  purpose: EmailTokenPurpose,
) {
  const sql = getSql();
  await sql`
    UPDATE email_auth_tokens
    SET consumed_at = now()
    WHERE user_id = ${userId}
      AND purpose = ${purpose}::email_token_purpose
      AND consumed_at IS NULL
  `;
}

async function issueToken(userId: string, purpose: EmailTokenPurpose) {
  const sql = getSql();
  const { token, tokenHash } = generateEmailToken();
  const ttlHours =
    purpose === "verify_email" ? VERIFY_TTL_HOURS : RESET_TTL_HOURS;

  await invalidateActiveTokens(userId, purpose);

  await sql`
    INSERT INTO email_auth_tokens (user_id, token_hash, purpose, expires_at)
    VALUES (
      ${userId},
      ${tokenHash},
      ${purpose}::email_token_purpose,
      now() + (${ttlHours} * interval '1 hour')
    )
  `;

  return token;
}

export async function sendVerificationEmailForUser(
  userId: string,
  email: string,
) {
  const sql = getSql();
  const [user] = await sql<{ email_verified_at: Date | null }[]>`
    SELECT email_verified_at FROM users WHERE id = ${userId} LIMIT 1
  `;
  if (!user) throw new ApiError(404, "NOT_FOUND", "Felhasználó nem található");
  if (user.email_verified_at) return { alreadyVerified: true as const };

  const token = await issueToken(userId, "verify_email");
  const verifyUrl = buildVerifyEmailUrl(token);
  const content = verificationEmailContent(verifyUrl);

  await sendEmail({
    to: email,
    ...content,
  });

  return { alreadyVerified: false as const };
}

export async function verifyEmailWithToken(token: string) {
  const sql = getSql();
  const tokenHash = hashEmailToken(token);

  const [row] = await sql<
    {
      id: string;
      user_id: string;
      expires_at: Date;
      consumed_at: Date | null;
    }[]
  >`
    SELECT id, user_id, expires_at, consumed_at
    FROM email_auth_tokens
    WHERE token_hash = ${tokenHash}
      AND purpose = 'verify_email'::email_token_purpose
    LIMIT 1
  `;

  if (!row) {
    throw new ApiError(
      422,
      "INVALID_TOKEN",
      "Érvénytelen vagy lejárt megerősítő link",
    );
  }
  if (row.consumed_at) {
    throw new ApiError(
      422,
      "TOKEN_USED",
      "Ez a megerősítő link már felhasználásra került",
    );
  }
  if (row.expires_at.getTime() < Date.now()) {
    throw new ApiError(
      422,
      "TOKEN_EXPIRED",
      "A megerősítő link lejárt — kérj újat",
    );
  }

  await sql.begin(async (tx) => {
    await tx`
      UPDATE users
      SET email_verified_at = now()
      WHERE id = ${row.user_id} AND email_verified_at IS NULL
    `;
    await tx`
      UPDATE email_auth_tokens
      SET consumed_at = now()
      WHERE id = ${row.id}
    `;
  });

  return { userId: row.user_id };
}

export async function requestPasswordReset(email: string) {
  const sql = getSql();
  const normalized = email.toLowerCase().trim();
  const [user] = await sql<{ id: string; email: string; status: string }[]>`
    SELECT id, email, status::text
    FROM users
    WHERE email = ${normalized}
    LIMIT 1
  `;

  if (!user || user.status !== "active") {
    return { sent: false as const };
  }

  const token = await issueToken(user.id, "reset_password");
  const resetUrl = buildResetPasswordUrl(token);
  const content = passwordResetEmailContent(resetUrl);

  await sendEmail({
    to: user.email,
    ...content,
  });

  return { sent: true as const };
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
) {
  const sql = getSql();
  const tokenHash = hashEmailToken(token);

  const [row] = await sql<
    {
      id: string;
      user_id: string;
      expires_at: Date;
      consumed_at: Date | null;
    }[]
  >`
    SELECT id, user_id, expires_at, consumed_at
    FROM email_auth_tokens
    WHERE token_hash = ${tokenHash}
      AND purpose = 'reset_password'::email_token_purpose
    LIMIT 1
  `;

  if (!row) {
    throw new ApiError(
      422,
      "INVALID_TOKEN",
      "Érvénytelen vagy lejárt visszaállító link",
    );
  }
  if (row.consumed_at) {
    throw new ApiError(
      422,
      "TOKEN_USED",
      "Ez a visszaállító link már felhasználásra került",
    );
  }
  if (row.expires_at.getTime() < Date.now()) {
    throw new ApiError(
      422,
      "TOKEN_EXPIRED",
      "A visszaállító link lejárt — kérj újat",
    );
  }

  const passwordHash = await hashPassword(newPassword);

  await sql.begin(async (tx) => {
    await tx`
      UPDATE users
      SET password_hash = ${passwordHash}
      WHERE id = ${row.user_id}
    `;
    await tx`
      UPDATE email_auth_tokens
      SET consumed_at = now()
      WHERE id = ${row.id}
    `;
  });

  return { userId: row.user_id };
}
