import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  createReport,
  parseCreateReportBody,
} from "@/server/services/report-service";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const input = parseCreateReportBody(body);
    const result = await createReport(user.id, input);
    return jsonOk(result, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
