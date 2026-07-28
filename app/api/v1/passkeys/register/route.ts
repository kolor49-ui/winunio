import { handleRouteError } from "@/server/api/errors";
import { jsonOk, requireActiveUser, requireSession } from "@/server/api/http";
import {
  createPasskeyRegistrationOptions,
  deleteUserPasskeys,
  verifyPasskeyRegistration,
} from "@/server/services/passkey-service";
import { getWebAuthnContextFromRequest } from "@/server/webauthn-config";
import { z } from "zod";
import type { RegistrationResponseJSON } from "@simplewebauthn/server";

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    const url = new URL(request.url);
    const action = url.searchParams.get("action");
    const webAuthnContext = getWebAuthnContextFromRequest(request);

    if (action === "reset") {
      const removed = await deleteUserPasskeys(user.id);
      return jsonOk({ removed });
    }

    if (action === "options") {
      const replace = url.searchParams.get("replace") === "true";
      const options = await createPasskeyRegistrationOptions(
        user.id,
        user.email,
        webAuthnContext,
        replace,
      );
      return jsonOk(options);
    }

    if (action === "verify") {
      const body = await request.json();
      const response = z.custom<RegistrationResponseJSON>().parse(body);
      const result = await verifyPasskeyRegistration(
        user.id,
        response,
        webAuthnContext,
      );
      return jsonOk(result);
    }

    return Response.json(
      { error: { code: "BAD_REQUEST", message: "Ismeretlen művelet" } },
      { status: 400 },
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
