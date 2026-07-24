import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import { decideReport } from "@/server/services/report-service";

type Params = { params: Promise<{ id: string }> };

const actionSchema = z.object({
  action: z.enum(["dismiss", "hide_content", "under_review"]),
  note: z.string().min(1).max(2000),
});

export async function POST(request: Request, { params }: Params) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { id } = await params;
    const body = actionSchema.parse(await request.json());
    const result = await decideReport({
      reportId: id,
      adminId: user.id,
      action: body.action,
      note: body.note,
    });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
