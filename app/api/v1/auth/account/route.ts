import { cookies } from "next/headers";
import { COOKIE_NAME, clearSessionCookieOptions } from "@/server/auth/session";
import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  deleteUserAccount,
  parseDeleteAccountBody,
} from "@/server/services/account-deletion-service";

export async function DELETE(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const { password } = parseDeleteAccountBody(body);

    const result = await deleteUserAccount(user.id, password);

    const cookieStore = await cookies();
    cookieStore.set(clearSessionCookieOptions());
    cookieStore.delete(COOKIE_NAME);

    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
