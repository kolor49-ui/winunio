import type { SessionPayload } from "@/server/auth/session";
import { getUserById } from "@/server/services/auth-service";
import {
  listHomepageDebateBuckets,
  type DebateListItem,
} from "@/server/services/debate-service";

export type HomepageData = {
  user: Awaited<ReturnType<typeof getUserById>>;
  liveDebates: DebateListItem[];
  openDebates: DebateListItem[];
};

/** Egy kérésen belül szekvenciális DB-hívások — serverless pool deadlock elkerülésére. */
export async function loadHomepageData(
  session: SessionPayload | null,
): Promise<HomepageData> {
  let user: HomepageData["user"] = null;

  if (session?.userId) {
    user = await getUserById(session.userId);
  }

  const { live, open } = await listHomepageDebateBuckets();

  return {
    user,
    liveDebates: live,
    openDebates: open,
  };
}
