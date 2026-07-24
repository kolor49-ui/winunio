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
  saveAdminPushSubscription,
} from "@/server/services/admin-notification-service";
import { requireAdminUser } from "@/server/services/moderation-service";

const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

export async function GET() {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    await requireAdminUser(user.id);

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
    await requireAdminUser(user.id);

    if (!isWebPushConfigured()) {
      return jsonOk({
        subscribed: false,
        message: "A push értesítés nincs beállítva a szerveren.",
      });
    }

    const body = subscribeSchema.parse(await request.json());
    await saveAdminPushSubscription({
      adminId: user.id,
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
