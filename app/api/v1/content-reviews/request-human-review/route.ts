import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import { requestHumanReviewForContentReviews } from "@/server/services/moderation-service";

const bodySchema = z.object({
  content_review_ids: z.array(z.string().uuid()).min(1).max(10),
  note: z.string().max(1000).optional(),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = bodySchema.parse(await request.json());
    const result = await requestHumanReviewForContentReviews({
      userId: user.id,
      contentReviewIds: body.content_review_ids,
      note: body.note,
    });
    return jsonOk(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
