import { checkDatabaseConnection } from "@/server/health";
import { getContentReviewReadiness } from "@/server/readiness";
import { getSmsReadiness } from "@/server/sms/sms-readiness";

export async function GET() {
  const dbOk = await checkDatabaseConnection();
  const contentReview = await getContentReviewReadiness();
  const sms = getSmsReadiness();
  return Response.json(
    {
      status: dbOk ? "ok" : "degraded",
      database: dbOk ? "connected" : "disconnected",
      content_review: contentReview,
      sms,
    },
    { status: dbOk ? 200 : 503 },
  );
}
