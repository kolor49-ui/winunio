import { cookies } from "next/headers";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/server/auth/session";
import { handleRouteError } from "@/server/api/errors";
import { jsonOk } from "@/server/api/http";
import {
  authenticateUser,
  parseLoginBody,
} from "@/server/services/auth-service";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, password } = parseLoginBody(body);
    const user = await authenticateUser(email, password);
    if (!user) {
      return Response.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Hibás e-mail vagy jelszó" } },
        { status: 401 },
      );
    }
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
    });
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieOptions(token));
    return jsonOk({ user: { id: user.id, email: user.email } });
  } catch (error) {
    return handleRouteError(error);
  }
}
