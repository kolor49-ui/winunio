import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  parseSelectPartnerBody,
  selectPartner,
} from "@/server/services/application-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const body = await request.json();
    const { application_id } = parseSelectPartnerBody(body);
    const result = await selectPartner(id, user.id, application_id);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
