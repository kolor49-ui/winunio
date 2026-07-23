import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import { subscribeToBResponse } from "@/server/services/notification-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { id: roundId } = await params;
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const result = await subscribeToBResponse(roundId, user.id);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
