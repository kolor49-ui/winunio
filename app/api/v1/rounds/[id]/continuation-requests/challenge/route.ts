import { handleRouteError } from "@/server/api/errors";
import { isWinunioAndroidClient } from "@/server/api/client-context";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import { issueContinuationChallenge } from "@/server/services/continuation-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: completedRoundId } = await params;
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const result = await issueContinuationChallenge(completedRoundId, user.id, {
      mobileClient: isWinunioAndroidClient(request),
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
