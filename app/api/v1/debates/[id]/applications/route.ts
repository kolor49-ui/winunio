import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  applyToDebate,
  listApplicationsForDebate,
  parseApplyBody,
} from "@/server/services/application-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const applications = await listApplicationsForDebate(id, user.id);
    return jsonOk({ applications });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const body = await request.json();
    const { stance, content_review_id } = parseApplyBody(body);
    const application = await applyToDebate(id, user.id, stance, content_review_id);
    return jsonOk({ application }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
