"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminPushSetup } from "./admin-push-setup";

type NotificationRow = {
  id: string;
  type: "user_registered" | "debate_created";
  title: string;
  body: string;
  link_path: string;
  created_at: string;
  read: boolean;
};

type RegistrationRow = {
  id: string;
  email: string;
  display_name: string | null;
  created_at: string;
};

type DebateRow = {
  id: string;
  question: string;
  category: string;
  status: string;
  created_at: string;
};

const TYPE_LABELS: Record<NotificationRow["type"], string> = {
  user_registered: "Regisztráció",
  debate_created: "Új vita",
};

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString("hu-HU", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AdminDashboardPage() {
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [registrations, setRegistrations] = useState<RegistrationRow[]>([]);
  const [debates, setDebates] = useState<DebateRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadDashboard() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/v1/admin/notifications?activity=1");
      if (res.status === 403) {
        setError("Admin jogosultság szükséges.");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error?.message ?? "Betöltés sikertelen");
        return;
      }
      setNotifications(data.notifications ?? []);
      setUnreadCount(data.unread_count ?? 0);
      setRegistrations(data.registrations ?? []);
      setDebates(data.recent_debates ?? []);
    } catch {
      setError("Hálózati hiba");
    } finally {
      setLoading(false);
    }
  }

  async function markAllRead() {
    const res = await fetch("/api/v1/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (!res.ok) return;
    await loadDashboard();
  }

  async function markRead(notificationId: string) {
    const res = await fetch("/api/v1/admin/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notification_ids: [notificationId] }),
    });
    if (!res.ok) return;
    await loadDashboard();
  }

  useEffect(() => {
    void loadDashboard();
    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, 30000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (loading) return <p>Betöltés…</p>;

  return (
    <>
      <h1>Admin áttekintés</h1>
      {error && <p className="error">{error}</p>}

      <section className="card">
        <div className="admin-section-head">
          <h2>Értesítések {unreadCount > 0 ? `(${unreadCount} olvasatlan)` : ""}</h2>
          {unreadCount > 0 && (
            <button type="button" className="btn btn-secondary btn-sm" onClick={markAllRead}>
              Mind olvasott
            </button>
          )}
        </div>
        <AdminPushSetup />
        <ul className="admin-list">
          {notifications.length === 0 && (
            <li className="meta">Még nincs értesítés.</li>
          )}
          {notifications.map((notification) => (
            <li key={notification.id} className={notification.read ? "meta" : ""}>
              <p>
                <strong>{notification.title}</strong> ·{" "}
                {TYPE_LABELS[notification.type]} · {formatWhen(notification.created_at)}
                {!notification.read && " · Új"}
              </p>
              <p>{notification.body}</p>
              <div className="form-actions">
                <Link href={notification.link_path} className="btn btn-secondary btn-sm">
                  Megnyitás
                </Link>
                {!notification.read && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => void markRead(notification.id)}
                  >
                    Olvasott
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div className="admin-grid">
        <section className="card">
          <h2>Új regisztrációk</h2>
          <ul className="admin-list">
            {registrations.map((user) => (
              <li key={user.id}>
                <p>
                  {user.display_name ? `${user.display_name} · ` : ""}
                  {user.email}
                </p>
                <p className="meta">{formatWhen(user.created_at)}</p>
              </li>
            ))}
          </ul>
        </section>

        <section className="card">
          <h2>Új viták</h2>
          <ul className="admin-list">
            {debates.map((debate) => (
              <li key={debate.id}>
                <p>
                  <Link href={`/debates/${debate.id}`}>{debate.question}</Link>
                </p>
                <p className="meta">
                  {debate.category} · {formatWhen(debate.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="hint">
        <Link href="/admin/moderation">Moderációs ügyek</Link>
      </p>
    </>
  );
}
