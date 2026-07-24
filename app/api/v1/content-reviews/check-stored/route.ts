import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  checkStoredContentReviews,
  checkStoredReviewsBodySchema,
} from "@/server/services/content-review-service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = checkStoredReviewsBodySchema.parse(await request.json());
    const result = await checkStoredContentReviews({
      userId: user.id,
      reviews: body.reviews,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
