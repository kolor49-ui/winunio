import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import { draftFieldsSchema } from "@/server/content-editor";
import {
  deleteContentDraft,
  getContentDraft,
  parseDraftContextType,
  saveContentDraft,
} from "@/server/services/content-draft-service";

type RouteParams = {
  params: Promise<{ contextType: string; contextId: string }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { contextType, contextId } = await params;
    const draft = await getContentDraft(
      user.id,
      parseDraftContextType(contextType),
      contextId,
    );
    return jsonOk({ draft });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function PUT(request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { contextType, contextId } = await params;
    const body = await request.json();
    const fields = draftFieldsSchema.parse(body);
    const draft = await saveContentDraft(
      user.id,
      parseDraftContextType(contextType),
      contextId,
      fields,
    );
    return jsonOk({ draft });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const { contextType, contextId } = await params;
    await deleteContentDraft(
      user.id,
      parseDraftContextType(contextType),
      contextId,
    );
    return jsonOk({ deleted: true });
  } catch (error) {
    return handleRouteError(error);
  }
}
