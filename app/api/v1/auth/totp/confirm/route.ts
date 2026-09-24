import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  confirmTotpSetup,
  parseConfirmTotpBody,
} from "@/server/services/totp-service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const parsed = parseConfirmTotpBody(body);
    const result = await confirmTotpSetup(user.id, parsed.code);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
