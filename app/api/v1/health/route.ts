import { checkDatabaseConnection } from "@/server/health";
import { getContentReviewReadiness } from "@/server/readiness";

export async function GET() {
  const dbOk = await checkDatabaseConnection();
  const contentReview = await getContentReviewReadiness();
  return Response.json(
    {
      status: dbOk ? "ok" : "degraded",
      database: dbOk ? "connected" : "disconnected",
      content_review: contentReview,
    },
    { status: dbOk ? 200 : 503 },
  );
}
