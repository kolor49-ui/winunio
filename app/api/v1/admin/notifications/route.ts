import { z } from "zod";
import { handleRouteError } from "@/server/api/errors";
import {
  jsonOk,
  requireActiveUser,
  requireSession,
} from "@/server/api/http";
import {
  listAdminNotifications,
  listRecentRegistrations,
  markAdminNotificationsRead,
} from "@/server/services/admin-notification-service";
import { requireAdminUser } from "@/server/services/moderation-service";
import { listDebates } from "@/server/services/debate-service";

const markReadSchema = z.object({
  notification_ids: z.array(z.string().uuid()).optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireSession();
    const user = await requireActiveUser(session);
    await requireAdminUser(user.id);

    const url = new URL(request.url);
    const countOnly = url.searchParams.get("count_only") === "1";

    if (countOnly) {
      const { unread_count } = await listAdminNotifications(user.id, { limit: 1 });
      return jsonOk({ unread_count });
    }

    const includeActivity = url.searchParams.get("activity") === "1";
    const { notifications, unread_count } = await listAdminNotifications(user.id);

    if (!includeActivity) {
      return jsonOk({ notifications, unread_count });
    }

    const [registrations, debates] = await Promise.all([
      listRecentRegistrations(10),
      listDebates("new"),
    ]);

    return jsonOk({
      notifications,
      unread_count,
      registrations,
      recent_debates: debates.slice(0, 10),
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

    const body = markReadSchema.parse(await request.json().catch(() => ({})));
    await markAdminNotificationsRead(user.id, body.notification_ids);
    const { unread_count } = await listAdminNotifications(user.id, { limit: 1 });
    return jsonOk({ unread_count });
  } catch (error) {
    return handleRouteError(error);
  }
}
