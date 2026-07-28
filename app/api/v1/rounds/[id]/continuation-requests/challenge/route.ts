import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import { issueContinuationChallenge } from "@/server/services/continuation-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id: completedRoundId } = await params;
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const result = await issueContinuationChallenge(completedRoundId, user.id);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
