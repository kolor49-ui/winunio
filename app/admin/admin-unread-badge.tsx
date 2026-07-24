"use client";

import { useEffect, useState } from "react";

export function AdminUnreadBadge() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function refreshUnreadCount() {
      try {
        const res = await fetch("/api/v1/admin/notifications?count_only=1");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { unread_count?: number };
        if (!cancelled) {
          setUnreadCount(Number(data.unread_count) || 0);
        }
      } catch {
        // ignore polling errors
      }
    }

    void refreshUnreadCount();
    const intervalId = window.setInterval(refreshUnreadCount, 30000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  if (unreadCount <= 0) return null;

  return (
    <span className="nav-badge" aria-label={`${unreadCount} olvasatlan értesítés`}>
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}
