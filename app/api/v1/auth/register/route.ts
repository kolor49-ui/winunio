import { cookies } from "next/headers";
import {
  createSessionToken,
  sessionCookieOptions,
} from "@/server/auth/session";
import { handleRouteError } from "@/server/api/errors";
import { jsonOk } from "@/server/api/http";
import {
  parseRegisterBody,
  registerUser,
} from "@/server/services/auth-service";
import { sendVerificationEmailForUser } from "@/server/services/email-auth-service";
import { formatResendError } from "@/server/email/send-email";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const input = parseRegisterBody(body);
    const user = await registerUser(input);
    const token = await createSessionToken({
      userId: user.id,
      email: user.email,
    });
    const cookieStore = await cookies();
    cookieStore.set(sessionCookieOptions(token));

    let verificationEmailSent = false;
    try {
      const sent = await sendVerificationEmailForUser(user.id, user.email);
      verificationEmailSent = !sent.alreadyVerified;
    } catch (emailError) {
      console.error("[register] verification email failed:", emailError);
      return jsonOk(
        {
          user,
          verification_email_sent: false,
          email_error: formatResendError(emailError),
        },
        201,
      );
    }

    return jsonOk({ user, verification_email_sent: verificationEmailSent }, 201);
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
