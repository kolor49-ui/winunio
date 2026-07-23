import { verifyCronRequest } from "@/server/cron-auth";
import { jsonOk } from "@/server/api/http";
import { runBackgroundJobs } from "@/server/services/background-job-service";

export async function GET(request: Request) {
  if (!verifyCronRequest(request)) {
    return Response.json(
      { error: { code: "UNAUTHORIZED", message: "Érvénytelen cron hitelesítés" } },
      { status: 401 },
    );
  }

  const summary = await runBackgroundJobs();
  return jsonOk({ ok: true, ...summary });
}
