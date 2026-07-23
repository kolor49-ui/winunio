import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import { jsonOk } from "@/server/api/http";
import { requestPasswordReset } from "@/server/services/email-auth-service";

const schema = z.object({
  email: z.string().email().max(320),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email } = schema.parse(body);
    await requestPasswordReset(email);
    return jsonOk({
      message:
        "Ha ez az e-mail cím regisztrálva van, küldtünk visszaállító linket.",
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RESEND_FAILED:")) {
      return Response.json(
        {
          error: {
            code: "EMAIL_SEND_FAILED",
            message:
              "Nem sikerült elküldeni a levelet. Ellenőrizd a Resend beállításokat.",
          },
        },
        { status: 502 },
      );
    }
    return handleRouteError(error);
  }
}
