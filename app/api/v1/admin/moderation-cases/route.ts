import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import { listModerationCases } from "@/server/services/moderation-service";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const cases = await listModerationCases(user.id);
    return jsonOk({
      cases: cases.map((c) => ({
        ...c,
        created_at: c.created_at.toISOString(),
        resolved_at: c.resolved_at?.toISOString() ?? null,
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
