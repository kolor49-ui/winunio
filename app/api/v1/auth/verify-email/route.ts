import { handleRouteError } from "@/server/api/errors";
import { jsonOk } from "@/server/api/http";
import { verifyEmailWithToken } from "@/server/services/email-auth-service";

export async function GET(request: Request) {
  try {
    const token = new URL(request.url).searchParams.get("token");
    if (!token) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Hiányzó token",
          },
        },
        { status: 422 },
      );
    }
    const result = await verifyEmailWithToken(token);
    return jsonOk({ verified: true, user_id: result.userId });
  } catch (error) {
    return handleRouteError(error);
  }
}
