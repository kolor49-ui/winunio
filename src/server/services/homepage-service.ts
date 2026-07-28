import type { SessionPayload } from "@/server/auth/session";
import { getUserById } from "@/server/services/auth-service";
import {
  listHomepageDebateBuckets,
  listUserDebates,
  type DebateListItem,
  type UserDebateListItem,
} from "@/server/services/debate-service";

export type HomepageData = {
  user: Awaited<ReturnType<typeof getUserById>>;
  myDebates: UserDebateListItem[];
  liveDebates: DebateListItem[];
  openDebates: DebateListItem[];
};

/** Egy kérésen belül szekvenciális DB-hívások — serverless pool deadlock elkerülésére. */
export async function loadHomepageData(
  session: SessionPayload | null,
): Promise<HomepageData> {
  let user: HomepageData["user"] = null;
  let myDebates: UserDebateListItem[] = [];

  if (session?.userId) {
    user = await getUserById(session.userId);
    if (user) {
      myDebates = await listUserDebates(session.userId);
    }
  }

  const { live, open } = await listHomepageDebateBuckets();

  return {
    user,
    myDebates,
    liveDebates: live,
    openDebates: open,
  };
}
