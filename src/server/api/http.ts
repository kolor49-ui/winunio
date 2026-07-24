import { cookies } from "next/headers";
import {
  COOKIE_NAME,
  verifySessionToken,
  type SessionPayload,
} from "@/server/auth/session";
import { getSql } from "@/server/db";
import { ensureBootstrapAdmin } from "@/server/services/bootstrap-admin-service";

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

export async function requireSession(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new ApiError(401, "UNAUTHORIZED", "Bejelentkezés szükséges");
  }
  return session;
}

export async function requireActiveUser(session: SessionPayload) {
  const sql = getSql();
  const [user] = await sql<
    { id: string; email: string; status: string }[]
  >`
    SELECT id, email, status::text
    FROM users
    WHERE id = ${session.userId}
    LIMIT 1
  `;
  if (!user || user.status !== "active") {
    throw new ApiError(401, "UNAUTHORIZED", "Érvénytelen munkamenet");
  }

  await ensureBootstrapAdmin(user.id, user.email);

  return user;
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function jsonError(error: unknown): Response {
  if (error instanceof ApiError) {
    return Response.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status },
    );
  }
  console.error(error);
  return Response.json(
    { error: { code: "INTERNAL_ERROR", message: "Váratlan hiba" } },
    { status: 500 },
  );
}

export function jsonOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}
