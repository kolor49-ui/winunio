import { cache } from "react";
import { z } from "zod";
import { getSql } from "@/server/db";
import { hashPassword } from "@/server/auth/password";
import { ensureBootstrapAdmin } from "@/server/services/bootstrap-admin-service";
import { notifyAdminsUserRegistered } from "@/server/services/admin-notification-service";

const registerSchema = z.object({
  email: z.string().email().max(320),
  password: z.string().min(8).max(128),
  display_name: z.string().min(1).max(80).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;

export function parseRegisterBody(body: unknown): RegisterInput {
  return registerSchema.parse(body);
}

export async function registerUser(input: RegisterInput) {
  const sql = getSql();
  const passwordHash = await hashPassword(input.password);
  const email = input.email.toLowerCase().trim();

  try {
    const user = await sql.begin(async (tx) => {
      const [row] = await tx<{ id: string; email: string; created_at: Date }[]>`
        INSERT INTO users (email, password_hash)
        VALUES (${email}, ${passwordHash})
        RETURNING id, email, created_at
      `;

      await tx`
        INSERT INTO public_profiles (user_id, display_name, is_anonymous)
        VALUES (
          ${row.id},
          ${input.display_name ?? null},
          ${input.display_name ? false : true}
        )
      `;

      return {
        id: row.id,
        email: row.email,
        created_at: row.created_at.toISOString(),
      };
    });

    await ensureBootstrapAdmin(user.id, user.email);
    void notifyAdminsUserRegistered({
      userId: user.id,
      email: user.email,
      displayName: input.display_name ?? null,
    }).catch((error) => {
      console.error("[admin-notification] registration alert failed:", error);
    });
    return user;
  } catch (err: unknown) {
    if (
      err &&
      typeof err === "object" &&
      "code" in err &&
      err.code === "23505"
    ) {
      throw new Error("EMAIL_TAKEN");
    }
    throw err;
  }
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export function parseLoginBody(body: unknown) {
  return loginSchema.parse(body);
}

export async function authenticateUser(email: string, password: string) {
  const sql = getSql();
  const normalized = email.toLowerCase().trim();
  const [user] = await sql<
    { id: string; email: string; password_hash: string; status: string }[]
  >`
    SELECT id, email, password_hash, status::text
    FROM users
    WHERE email = ${normalized}
    LIMIT 1
  `;

  if (!user || user.status !== "active") {
    return null;
  }

  const { verifyPassword } = await import("@/server/auth/password");
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;

  await ensureBootstrapAdmin(user.id, user.email);

  return { id: user.id, email: user.email };
}

export const getUserById = cache(async (userId: string) => {
  const sql = getSql();
  const [user] = await sql<
    {
      id: string;
      email: string;
      email_verified_at: Date | null;
      phone_verified_at: Date | null;
      is_admin: boolean;
      created_at: Date;
      display_name: string | null;
      is_anonymous: boolean | null;
    }[]
  >`
    SELECT
      u.id,
      u.email,
      u.email_verified_at,
      u.phone_verified_at,
      u.is_admin,
      u.created_at,
      p.display_name,
      p.is_anonymous
    FROM users u
    LEFT JOIN public_profiles p ON p.user_id = u.id
    WHERE u.id = ${userId} AND u.status = 'active'
    LIMIT 1
  `;
  if (!user) return null;

  const promoted = await ensureBootstrapAdmin(user.id, user.email);

  return {
    id: user.id,
    email: user.email,
    email_verified: user.email_verified_at !== null,
    phone_verified: user.phone_verified_at !== null,
    is_admin: promoted ? true : user.is_admin,
    display_name: user.display_name ?? null,
    is_anonymous: user.is_anonymous ?? true,
    created_at: user.created_at.toISOString(),
  };
});
