import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import { parseStartPhoneBody, startPhoneVerification } from "@/server/services/phone-service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const parsed = parseStartPhoneBody(body);
    const result = await startPhoneVerification(user.id, parsed.phone);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
