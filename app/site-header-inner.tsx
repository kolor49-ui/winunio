"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { LogoMark } from "./logo-mark";
import { LogoutButton } from "./logout-button";
import { AdminUnreadBadge } from "./admin/admin-unread-badge";

export type SiteHeaderUser = {
  email: string;
  is_admin: boolean;
  email_verified: boolean;
};

type Props = {
  user: SiteHeaderUser | null;
};

function NavLinks({
  user,
  onNavigate,
  className,
  showHomeLink = false,
}: {
  user: SiteHeaderUser | null;
  onNavigate?: () => void;
  className?: string;
  showHomeLink?: boolean;
}) {
  const closeOnClick = onNavigate ? { onClick: onNavigate } : undefined;

  return (
    <nav className={className} aria-label="Fő navigáció">
      {showHomeLink ? (
        <Link href="/" {...closeOnClick}>
          Főoldal
        </Link>
      ) : null}
      <Link href="/hogyan-mukodik" {...closeOnClick}>
        Hogyan működik
      </Link>
      <Link href="/debates/new" {...closeOnClick}>
        Vitát indítok
      </Link>
      {user ? (
        <>
          <Link href="/vitaim" {...closeOnClick}>
            Vitáim
          </Link>
          <Link href="/account" {...closeOnClick}>
            Fiók
          </Link>
          {user.is_admin && (
            <>
              <Link href="/admin" className="nav-admin-link" {...closeOnClick}>
                Admin
              </Link>
              <AdminUnreadBadge />
              <Link href="/admin/moderation" {...closeOnClick}>
                Moderáció
              </Link>
            </>
          )}
          {!user.email_verified && (
            <Link href="/verify-email" className="nav-verify" {...closeOnClick}>
              E-mail megerősítés
            </Link>
          )}
          <LogoutButton />
        </>
      ) : (
        <>
          <Link href="/login" {...closeOnClick}>
            Bejelentkezés
          </Link>
          <Link href="/register" {...closeOnClick}>
            Regisztráció
          </Link>
        </>
      )}
    </nav>
  );
}

export function SiteHeaderInner({ user }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const panelId = useId();

  useEffect(() => {
    if (!menuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };

    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  return (
    <div className="site-header-inner">
      <div className="site-header-bar">
        <Link href="/" className="logo">
          <LogoMark />
          <span>Winunio</span>
        </Link>
        {user ? (
          <span className="site-header-email site-header-email--desktop" title="Bejelentkezve">
            {user.email}
          </span>
        ) : null}
        <div className="site-header-bar-end">
          <Link href="/" className="site-header-home-link">
            Főoldal
          </Link>
          {user ? (
            <span className="site-header-email site-header-email--mobile" title="Bejelentkezve">
              {user.email}
            </span>
          ) : null}
          <button
            type="button"
            className={`mobile-nav-toggle${menuOpen ? " mobile-nav-toggle-open" : ""}`}
            aria-expanded={menuOpen}
            aria-controls={panelId}
            aria-label={menuOpen ? "Menü bezárása" : "Menü megnyitása"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="mobile-nav-toggle-bar" aria-hidden="true" />
            <span className="mobile-nav-toggle-bar" aria-hidden="true" />
            <span className="mobile-nav-toggle-bar" aria-hidden="true" />
          </button>
        </div>
      </div>

      <NavLinks user={user} className="nav-links nav-links--desktop" showHomeLink />

      {menuOpen ? (
        <>
          <button
            type="button"
            className="mobile-nav-backdrop"
            aria-label="Menü bezárása"
            onClick={() => setMenuOpen(false)}
          />
          <div
            id={panelId}
            className="mobile-nav-panel"
            role="dialog"
            aria-modal="true"
            aria-label="Mobil menü"
          >
            <NavLinks
              user={user}
              className="mobile-nav-links"
              onNavigate={() => setMenuOpen(false)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
