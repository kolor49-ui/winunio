import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  listContentDrafts,
  parseDraftContextType,
} from "@/server/services/content-draft-service";

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { searchParams } = new URL(request.url);
    const contextType = parseDraftContextType(
      searchParams.get("context_type") ?? "",
    );
    const drafts = await listContentDrafts(user.id, contextType);
    return jsonOk({ drafts });
  } catch (error) {
    return handleRouteError(error);
  }
}
