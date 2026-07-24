"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PwaSetup() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // SW optional for basic browsing
    });
  }, []);

  return null;
}

export function InstallAppButton() {
  const [installEvent, setInstallEvent] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(display-mode: standalone)").matches) {
      setInstalled(true);
    }

    function onBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    }

    function onInstalled() {
      setInstalled(true);
      setInstallEvent(null);
      setStatus("Az alkalmazás telepítve.");
    }

    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function installApp() {
    if (!installEvent) {
      setStatus(
        "Telepítés: böngésző menü → „Telepítés” / „Hozzáadás a kezdőképernyőhöz”, vagy megosztás → „Hozzáadás a főképernyőhöz” (iPhone).",
      );
      return;
    }

    await installEvent.prompt();
    const choice = await installEvent.userChoice;
    if (choice.outcome === "accepted") {
      setStatus("Telepítés elindult.");
      setInstallEvent(null);
    } else {
      setStatus("A telepítés megszakítva.");
    }
  }

  if (installed) {
    return <p className="hint">A Winunio ikon már a kezdőképernyőn / asztalon van.</p>;
  }

  return (
    <div className="form-actions">
      <button type="button" className="btn btn-secondary" onClick={() => void installApp()}>
        Telepítés az asztalra / kezdőképernyőre
      </button>
      {status && <p className="hint">{status}</p>}
    </div>
  );
}
