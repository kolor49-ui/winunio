import Link from "next/link";
import { LogoutButton } from "./logout-button";
import { AdminUnreadBadge } from "./admin/admin-unread-badge";
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
        <Link href="/" className="logo">
          <img
            src="/logo.svg"
            alt=""
            width={48}
            height={48}
            className="logo-mark"
          />
          <span>Winunio</span>
        </Link>
        <nav className="nav-links">
          <Link href="/debates/new">Vitát indítok</Link>
          {user ? (
            <>
              <Link href="/vitaim">Vitáim</Link>
              <Link href="/account">Fiók</Link>
              {user.is_admin && (
                <>
                  <Link href="/admin">Admin</Link>
                  <AdminUnreadBadge />
                  <Link href="/admin/moderation">Moderáció</Link>
                </>
              )}
              {!user.email_verified && (
                <Link href="/verify-email" className="nav-verify">
                  E-mail megerősítés
                </Link>
              )}
              <span className="nav-user" title="Bejelentkezve">
                {user.email}
              </span>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login">Bejelentkezés</Link>
              <Link href="/register">Regisztráció</Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
