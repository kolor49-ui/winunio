import { SiteHeaderInner } from "./site-header-inner";
import { getSession } from "@/server/api/http";
import { withDbRetry } from "@/server/db";
import { getUserById } from "@/server/services/auth-service";

export async function SiteHeader() {
  let user: Awaited<ReturnType<typeof getUserById>> = null;

  try {
    const session = await getSession();
    user = session
      ? await withDbRetry(() => getUserById(session.userId))
      : null;
  } catch (error) {
    console.error("[site-header] user load failed:", error);
  }

  return (
    <header className="site-header">
      <div className="container">
        <SiteHeaderInner
          user={
            user
              ? {
                  email: user.email,
                  email_verified: user.email_verified,
                }
              : null
          }
        />
      </div>
    </header>
  );
}
