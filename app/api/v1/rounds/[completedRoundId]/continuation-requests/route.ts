import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  parseContinuationSubmitBody,
  submitContinuationRequest,
} from "@/server/services/continuation-service";

type RouteParams = { params: Promise<{ completedRoundId: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { completedRoundId } = await params;
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const parsed = parseContinuationSubmitBody(body);
    const result = await submitContinuationRequest(
      completedRoundId,
      user.id,
      parsed,
    );
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
