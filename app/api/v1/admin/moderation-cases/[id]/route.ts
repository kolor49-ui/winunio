import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  decideModerationCase,
  getModerationCaseDetail,
} from "@/server/services/moderation-service";

type Params = { params: Promise<{ id: string }> };

const decideSchema = z.object({
  decision: z.enum(["approve", "return_for_revision", "reject"]),
  note: z.string().min(1).max(2000),
});

export async function GET(_request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const detail = await getModerationCaseDetail(id, user.id);
    return jsonOk({
      case: {
        ...detail.case,
        created_at: detail.case.created_at.toISOString(),
      },
      content_review: detail.contentReview,
      actions: detail.actions.map((a) => ({
        ...a,
        created_at: a.created_at.toISOString(),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const body = decideSchema.parse(await request.json());
    const result = await decideModerationCase({
      caseId: id,
      adminId: user.id,
      decision: body.decision,
      note: body.note,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
