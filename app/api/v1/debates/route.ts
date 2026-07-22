import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  createDebate,
  listDebates,
  parseCreateDebateBody,
} from "@/server/services/debate-service";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sort = searchParams.get("sort") === "popular" ? "popular" : "new";
    const debates = await listDebates(sort);
    return jsonOk({ debates });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const body = await request.json();
    const input = parseCreateDebateBody(body);
    const debate = await createDebate(user.id, input);
    return jsonOk({ debate }, 201);
  } catch (error) {
    return handleRouteError(error);
  }
}
