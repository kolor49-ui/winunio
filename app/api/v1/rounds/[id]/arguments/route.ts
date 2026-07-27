import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  parseSubmitArgumentBody,
  submitArgument,
} from "@/server/services/round-service";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const body = await request.json();
    const parsed = parseSubmitArgumentBody(body);
    const result = await submitArgument(id, user.id, parsed);
    return jsonOk(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
