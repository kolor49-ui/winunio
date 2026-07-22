import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import { getUserById } from "@/server/services/auth-service";

export async function GET() {
  try {
    const session = await requireSession();
    await requireActiveUser(session);
    const user = await getUserById(session.userId);
    if (!user) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Bejelentkezés szükséges" } },
        { status: 401 },
      );
    }
    return jsonOk({ user });
  } catch (error) {
    return handleRouteError(error);
  }
}
