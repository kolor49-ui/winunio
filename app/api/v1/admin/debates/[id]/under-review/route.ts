import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import { escalateDebateToUnderReview } from "@/server/services/moderation-service";

type Params = { params: Promise<{ id: string }> };

const bodySchema = z.object({
  note: z.string().min(1).max(2000),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    await escalateDebateToUnderReview({
      debateId: id,
      adminId: user.id,
      note: body.note,
    });
    return jsonOk({ status: "under_review" });
  } catch (error) {
    return handleRouteError(error);
  }
}
