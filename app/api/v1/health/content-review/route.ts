import { getContentReviewReadiness } from "@/server/readiness";

export async function GET() {
  const readiness = await getContentReviewReadiness();
  return Response.json(readiness, { status: readiness.ready ? 200 : 503 });
}
