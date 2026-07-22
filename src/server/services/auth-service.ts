import { z } from "zod";
import { getSql } from "@/server/db";
import { hashPassword } from "@/server/auth/password";

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
    return await sql.begin(async (tx) => {
      const [user] = await tx<{ id: string; email: string; created_at: Date }[]>`
        INSERT INTO users (email, password_hash)
        VALUES (${email}, ${passwordHash})
        RETURNING id, email, created_at
      `;

      await tx`
        INSERT INTO public_profiles (user_id, display_name, is_anonymous)
        VALUES (
          ${user.id},
          ${input.display_name ?? null},
          ${input.display_name ? false : true}
        )
      `;

      return {
        id: user.id,
        email: user.email,
        created_at: user.created_at.toISOString(),
      };
    });
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

  return { id: user.id, email: user.email };
}

export async function getUserById(userId: string) {
  const sql = getSql();
  const [user] = await sql<
    {
      id: string;
      email: string;
      email_verified_at: Date | null;
      phone_verified_at: Date | null;
      created_at: Date;
    }[]
  >`
    SELECT id, email, email_verified_at, phone_verified_at, created_at
    FROM users
    WHERE id = ${userId} AND status = 'active'
    LIMIT 1
  `;
  if (!user) return null;

  const [profile] = await sql<
    { display_name: string | null; is_anonymous: boolean }[]
  >`
    SELECT display_name, is_anonymous
    FROM public_profiles
    WHERE user_id = ${userId}
    LIMIT 1
  `;

  return {
    id: user.id,
    email: user.email,
    email_verified: user.email_verified_at !== null,
    phone_verified: user.phone_verified_at !== null,
    display_name: profile?.display_name ?? null,
    is_anonymous: profile?.is_anonymous ?? true,
    created_at: user.created_at.toISOString(),
  };
}
