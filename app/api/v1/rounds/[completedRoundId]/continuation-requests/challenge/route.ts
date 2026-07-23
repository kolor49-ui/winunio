import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  issueContinuationChallenge,
  parseContinuationChallengeBody,
} from "@/server/services/continuation-service";

type RouteParams = { params: Promise<{ completedRoundId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { completedRoundId } = await params;
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const parsed = parseContinuationChallengeBody(body);
    const result = await issueContinuationChallenge(
      completedRoundId,
      user.id,
      parsed.turnstile_token,
    );
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
