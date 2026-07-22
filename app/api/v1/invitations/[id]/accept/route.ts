import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import { acceptInvitation } from "@/server/services/application-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const result = await acceptInvitation(id, user.id);
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
