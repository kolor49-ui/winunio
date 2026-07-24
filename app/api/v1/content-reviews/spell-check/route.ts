import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import { spellCheckParticipantContent } from "@/server/services/content-review-service";

const bodySchema = z.object({
  text: z.string().min(1).max(2000),
});

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    await requireActiveUser(session);
    const body = bodySchema.parse(await request.json());
    const result = await spellCheckParticipantContent({ text: body.text });
    return jsonOk(result);
  } catch (error) {
    return handleRouteError(error);
  }
}
