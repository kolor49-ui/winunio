import { checkDatabaseConnection } from "@/server/health";

export async function GET() {
  const dbOk = await checkDatabaseConnection();
  return Response.json(
    {
      status: dbOk ? "ok" : "degraded",
      database: dbOk ? "connected" : "disconnected",
    },
    { status: dbOk ? 200 : 503 },
  );
}
