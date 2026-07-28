import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  issueContinuationChallenge,
  parseContinuationChallengeBody,
} from "@/server/services/continuation-service";
import { getWebAuthnContextFromRequest } from "@/server/webauthn-config";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: completedRoundId } = await params;
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const parsed = parseContinuationChallengeBody(body);
    const webAuthnContext = getWebAuthnContextFromRequest(request);
    const result = await issueContinuationChallenge(
      completedRoundId,
      user.id,
      parsed.turnstile_token,
      webAuthnContext,
    );
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
