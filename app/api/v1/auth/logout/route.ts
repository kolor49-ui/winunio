import { cookies } from "next/headers";
import { COOKIE_NAME, clearSessionCookieOptions } from "@/server/auth/session";
import { jsonOk } from "@/server/api/http";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(clearSessionCookieOptions());
  cookieStore.delete(COOKIE_NAME);
  return jsonOk({ ok: true });
}
