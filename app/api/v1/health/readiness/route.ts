import { getRegistrationReadiness } from "@/server/readiness";

export async function GET() {
  const readiness = await getRegistrationReadiness();
  return Response.json(readiness, { status: readiness.ready ? 200 : 503 });
}
