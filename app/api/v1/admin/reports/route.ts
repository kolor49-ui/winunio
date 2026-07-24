import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import { listOpenReports } from "@/server/services/report-service";

export async function GET() {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const reports = await listOpenReports(user.id);
    return jsonOk({
      reports: reports.map((r) => ({
        ...r,
        created_at: r.created_at.toISOString(),
      })),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
