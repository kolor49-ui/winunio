import { handleRouteError } from "@/server/api/errors";
import { isWinunioAndroidClient } from "@/server/api/client-context";
import { ApiError, jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  parseMobileContinuationCodeBody,
  unlockMobileContinuationCode,
} from "@/server/services/continuation-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    if (!isWinunioAndroidClient(request)) {
      throw new ApiError(403, "FORBIDDEN", "Csak a Winunió Android app használhatja");
    }

    const { id: completedRoundId } = await params;
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const parsed = parseMobileContinuationCodeBody(body);
    const result = await unlockMobileContinuationCode(
      completedRoundId,
      user.id,
      parsed.challenge_id,
    );
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
