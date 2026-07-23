import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  confirmPhoneVerification,
  parseConfirmPhoneBody,
} from "@/server/services/phone-service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const parsed = parseConfirmPhoneBody(body);
    const result = await confirmPhoneVerification(
      user.id,
      parsed.phone,
      parsed.code,
    );
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
