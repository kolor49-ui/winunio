import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  parseClosingStatementBody,
  submitClosingStatement,
} from "@/server/services/closing-statement-service";

type RouteParams = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: debateId } = await params;
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const parsed = parseClosingStatementBody(body);
    const result = await submitClosingStatement(
      debateId,
      user.id,
      parsed.content,
      parsed.content_review_id,
    );
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
