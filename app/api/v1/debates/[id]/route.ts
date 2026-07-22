import { handleRouteError } from "@/server/api/errors";
import { jsonOk } from "@/server/api/http";
import { getDebateById } from "@/server/services/debate-service";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const debate = await getDebateById(id);
    if (!debate) {
      return Response.json(
        { error: { code: "NOT_FOUND", message: "Vita nem található" } },
        { status: 404 },
      );
    }
    return jsonOk({ debate });
  } catch (error) {
    return handleRouteError(error);
  }
}
