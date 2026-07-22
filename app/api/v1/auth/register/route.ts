import { cookies } from "next/headers";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/server/auth/session";
import { handleRouteError } from "@/server/api/errors";
import { jsonOk } from "@/server/api/http";
import {
  parseRegisterBody,
  registerUser,
} from "@/server/services/auth-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parseRegisterBody(body);
    const user = await registerUser(input);
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
    });
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieOptions(token));
    return jsonOk({ user }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
