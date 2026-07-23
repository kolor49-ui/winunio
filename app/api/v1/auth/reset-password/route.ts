import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import { jsonOk } from "@/server/api/http";
import { resetPasswordWithToken } from "@/server/services/email-auth-service";

const schema = z.object({
  token: z.string().min(16).max(256),
  password: z.string().min(8).max(128),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { token, password } = schema.parse(body);
    await resetPasswordWithToken(token, password);
    return jsonOk({ message: "A jelszó frissítve. Most bejelentkezhetsz." });
  } catch (error) {
    return handleRouteError(error);
  }
}
