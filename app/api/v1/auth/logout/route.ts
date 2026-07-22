import { cookies } from "next/headers";
import { clearSessionCookieOptions } from "@/server/auth/session";
import { jsonOk } from "@/server/api/http";

export async function POST() {
  const cookieStore = await cookies();
  cookieStore.set(clearSessionCookieOptions());
  return jsonOk({ ok: true });
}
