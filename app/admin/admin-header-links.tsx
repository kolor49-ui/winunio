"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export function AdminHeaderLinks() {
  const [unreadCount, setUnreadCount] = useState(0);

  async function refreshUnreadCount() {
    try {
      const res = await fetch("/api/v1/admin/notifications?count_only=1");
      if (res.status === 403) return;
      if (!res.ok) return;
      const data = await res.json();
      setUnreadCount(data.unread_count ?? 0);
    } catch {
      // ignore polling errors
    }
  }

  useEffect(() => {
    void refreshUnreadCount();
    const intervalId = window.setInterval(() => {
      void refreshUnreadCount();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  return (
    <>
      <Link href="/admin" className="nav-admin-link">
        Admin
        {unreadCount > 0 && (
          <span className="nav-badge" aria-label={`${unreadCount} olvasatlan értesítés`}>
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </Link>
      <Link href="/admin/moderation">Moderáció</Link>
    </>
  );
}
