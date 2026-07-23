import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import { formatResendError } from "@/server/email/send-email";
import { sendVerificationEmailForUser } from "@/server/services/email-auth-service";

export async function POST() {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const result = await sendVerificationEmailForUser(user.id, user.email);
    return jsonOk({
      sent: !result.alreadyVerified,
      already_verified: result.alreadyVerified,
    });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("RESEND_FAILED:")) {
      return Response.json(
        {
          error: {
            code: "EMAIL_SEND_FAILED",
            message: formatResendError(error),
          },
        },
        { status: 502 },
      );
    }
    return handleRouteError(error);
  }
}
