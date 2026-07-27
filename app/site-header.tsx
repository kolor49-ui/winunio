import Link from "next/link";
import { LogoMark } from "./logo-mark";
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
      <div className="container site-header-inner">
        <div className="site-header-bar">
          <Link href="/" className="logo">
            <LogoMark />
            <span>Winunio</span>
          </Link>
          {user ? (
            <span className="site-header-email" title="Bejelentkezve">
              {user.email}
            </span>
          ) : null}
        </div>
        <nav className="nav-links">
          <Link href="/hogyan-mukodik">Hogyan működik</Link>
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
