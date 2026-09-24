import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import { getUserById } from "@/server/services/auth-service";
import { startTotpSetup } from "@/server/services/totp-service";

export async function POST() {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const profile = await getUserById(user.id);
    if (!profile) {
      return Response.json(
        { error: { code: "UNAUTHORIZED", message: "Bejelentkezés szükséges" } },
        { status: 401 },
      );
    }
    const result = await startTotpSetup(user.id, profile.email);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
