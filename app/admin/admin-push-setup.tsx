"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function AdminPushSetup() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    setSupported(
      typeof window !== "undefined" &&
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window,
    );
  }, []);

  async function enablePush() {
    setLoading(true);
    setStatus(null);
    try {
      const configRes = await fetch("/api/v1/admin/push/subscribe");
      const config = await configRes.json();
      if (!configRes.ok) {
        throw new Error(config.error?.message ?? "Push beállítás sikertelen");
      }
      if (!config.configured || !config.public_key) {
        setStatus(
          "A push értesítés még nincs beállítva a szerveren (VAPID kulcsok).",
        );
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setStatus("Az értesítés engedélyezése megtagadva.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(
          config.public_key,
        ) as BufferSource,
      });

      const json = subscription.toJSON();
      if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) {
        throw new Error("Push feliratkozás sikertelen");
      }

      const saveRes = await fetch("/api/v1/admin/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: json.endpoint,
          keys: {
            p256dh: json.keys.p256dh,
            auth: json.keys.auth,
          },
        }),
      });
      const saveData = await saveRes.json();
      if (!saveRes.ok) {
        throw new Error(saveData.error?.message ?? "Push mentés sikertelen");
      }

      setStatus(saveData.message ?? "Push értesítés engedélyezve.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Push beállítás sikertelen");
    } finally {
      setLoading(false);
    }
  }

  if (!supported) {
    return (
      <p className="hint">
        A böngésződ nem támogatja a push értesítést. Az admin panelen és e-mailben
        továbbra is láthatod az új eseményeket.
      </p>
    );
  }

  return (
    <div className="form-actions">
      <button
        type="button"
        className="btn btn-secondary"
        disabled={loading}
        onClick={() => void enablePush()}
      >
        {loading ? "Beállítás…" : "Push értesítés engedélyezése"}
      </button>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
