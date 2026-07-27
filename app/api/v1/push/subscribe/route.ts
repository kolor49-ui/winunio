import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  getVapidPublicKey,
  isWebPushConfigured,
  saveUserPushSubscription,
} from "@/server/services/user-notification-service";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function GET() {
  try {
    await requireActiveUser(await requireSession());
    return jsonOk({
      configured: isWebPushConfigured(),
      public_key: getVapidPublicKey(),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}

export async function POST(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);

    if (!isWebPushConfigured()) {
      return jsonOk({
        subscribed: false,
        message: "A push értesítés nincs beállítva a szerveren.",
      });
    }

    const body = subscribeSchema.parse(await request.json());
    await saveUserPushSubscription({
      userId: user.id,
      endpoint: body.endpoint,
      p256dh: body.keys.p256dh,
      auth: body.keys.auth,
    });

    return jsonOk({
      subscribed: true,
      message: "Push értesítés engedélyezve.",
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
