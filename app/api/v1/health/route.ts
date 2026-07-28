import { checkDatabaseConnection } from "@/server/health";
import { getContentReviewReadiness } from "@/server/readiness";
import { getSmsReadiness } from "@/server/sms/sms-readiness";
import { getTurnstileReadiness } from "@/server/turnstile-readiness";

export async function GET() {
  const dbOk = await checkDatabaseConnection();
  const contentReview = await getContentReviewReadiness();
  const sms = getSmsReadiness();
  const turnstile = getTurnstileReadiness();
  return Response.json(
    {
      status: dbOk ? "ok" : "degraded",
      database: dbOk ? "connected" : "disconnected",
      content_review: contentReview,
      sms,
      turnstile,
    },
    { status: dbOk ? 200 : 503 },
  );
}
