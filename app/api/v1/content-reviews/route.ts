import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  parseContentReviewBody,
  reviewParticipantContent,
} from "@/server/services/content-review-service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const input = parseContentReviewBody(body);
    const result = await reviewParticipantContent({
      userId: user.id,
      contextType: input.context_type,
      contextId: input.context_id ?? null,
      text: input.text,
      quote: input.quote,
      source: input.source,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
