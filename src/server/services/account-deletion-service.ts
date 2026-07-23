import { randomBytes } from "node:crypto";
import { z } from "zod";
import { ApiError } from "@/server/api/http";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { getSql } from "@/server/db";

export const DELETED_ACCOUNT_LABEL = "Törölt fiók";
const DELETED_EMAIL_DOMAIN = "deleted.winunio.invalid";

export function deletedAccountEmail(userId: string): string {
  return `deleted.${userId}@${DELETED_EMAIL_DOMAIN}`;
}

export function resolvePublicDisplayName(
  userStatus: string,
  isAnonymous: boolean,
  displayName: string | null,
): string {
  if (userStatus === "deleted") return DELETED_ACCOUNT_LABEL;
  if (isAnonymous) return "Anonim jelentkező";
  return displayName ?? "Névtelen";
}

const deleteAccountSchema = z.object({
  password: z.string().min(1).max(128),
});

export function parseDeleteAccountBody(body: unknown) {
  return deleteAccountSchema.parse(body);
}

export async function deleteUserAccount(userId: string, password: string) {
  const sql = getSql();

  return sql.begin(async (tx) => {
    const [user] = await tx<
      { id: string; password_hash: string; status: string }[]
    >`
      SELECT id, password_hash, status::text AS status
      FROM users
      WHERE id = ${userId}
      FOR UPDATE
    `;

    if (!user) {
      throw new ApiError(404, "NOT_FOUND", "Felhasználó nem található");
    }
    if (user.status === "deleted") {
      throw new ApiError(
        409,
        "ACCOUNT_ALREADY_DELETED",
        "A fiók már törölve lett",
      );
    }
    if (user.status === "suspended") {
      throw new ApiError(
        403,
        "ACCOUNT_SUSPENDED",
        "Felfüggesztett fiók nem törölhető — írj a moderációnak",
      );
    }

    const passwordOk = await verifyPassword(password, user.password_hash);
    if (!passwordOk) {
      throw new ApiError(401, "INVALID_PASSWORD", "Hibás jelszó");
    }

    const invitedRows = await tx<{ debate_id: string }[]>`
      SELECT debate_id
      FROM debate_applications
      WHERE user_id = ${userId} AND status = 'invited'::debate_application_status
    `;

    await tx`
      UPDATE debates
      SET status = 'cancelled'::debate_status
      WHERE initiator_id = ${userId}
        AND status IN (
          'draft'::debate_status,
          'waiting_for_partner'::debate_status,
          'invitation_pending'::debate_status
        )
    `;

    await tx`
      UPDATE debate_applications
      SET status = 'closed'::debate_application_status
      WHERE debate_id IN (
        SELECT id FROM debates
        WHERE initiator_id = ${userId} AND status = 'cancelled'::debate_status
      )
        AND status IN (
          'pending'::debate_application_status,
          'invited'::debate_application_status
        )
    `;

    await tx`
      UPDATE debate_applications
      SET status = 'withdrawn'::debate_application_status
      WHERE user_id = ${userId}
        AND status = 'pending'::debate_application_status
    `;

    await tx`
      UPDATE debate_applications
      SET status = 'rejected'::debate_application_status
      WHERE user_id = ${userId}
        AND status = 'invited'::debate_application_status
    `;

    for (const row of invitedRows) {
      await tx`
        UPDATE debates
        SET status = 'waiting_for_partner'::debate_status
        WHERE id = ${row.debate_id}
          AND status = 'invitation_pending'::debate_status
      `;
    }

    await tx`DELETE FROM continuation_requests WHERE user_id = ${userId}`;
    await tx`DELETE FROM continuation_challenges WHERE user_id = ${userId}`;
    await tx`DELETE FROM email_auth_tokens WHERE user_id = ${userId}`;
    await tx`DELETE FROM passkey_credentials WHERE user_id = ${userId}`;
    await tx`DELETE FROM phone_verifications WHERE user_id = ${userId}`;

    await tx`
      UPDATE public_profiles
      SET display_name = NULL, is_anonymous = true, avatar_url = NULL
      WHERE user_id = ${userId}
    `;

    const deadPassword = await hashPassword(randomBytes(32).toString("hex"));

    await tx`
      UPDATE users
      SET
        email = ${deletedAccountEmail(userId)},
        password_hash = ${deadPassword},
        email_verified_at = NULL,
        phone_verified_at = NULL,
        status = 'deleted'::user_status
      WHERE id = ${userId}
    `;

    return { deleted: true as const };
  });
}
