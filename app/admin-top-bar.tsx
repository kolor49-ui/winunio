import Link from "next/link";
import { AdminUnreadBadge } from "./admin/admin-unread-badge";
import { getSession } from "@/server/api/http";
import { withDbRetry } from "@/server/db";
import { getUserById } from "@/server/services/auth-service";

export async function AdminTopBar() {
  const session = await getSession();
  if (!session) return null;

  let user: Awaited<ReturnType<typeof getUserById>> = null;
  try {
    user = await withDbRetry(() => getUserById(session.userId));
  } catch (error) {
    console.error("[admin-top-bar] user load failed:", error);
    return null;
  }

  if (!user?.is_admin) return null;

  return (
    <aside className="admin-top-bar" aria-label="Admin navigáció">
      <div className="container admin-top-bar-inner">
        <span className="admin-top-bar-label">Admin</span>
        <nav className="admin-top-bar-nav" aria-label="Admin menü">
          <Link href="/admin" className="admin-top-bar-link">
            Áttekintés
          </Link>
          <AdminUnreadBadge />
          <Link href="/admin/moderation" className="admin-top-bar-link">
            Moderáció
          </Link>
        </nav>
      </div>
    </aside>
  );
}
