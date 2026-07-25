"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./logo-mark";

const SPLASH_MIN_MS = 3000;
const FADE_MS = 350;

function waitForPageLoad(): Promise<void> {
  if (document.readyState === "complete") {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    window.addEventListener("load", () => resolve(), { once: true });
  });
}

function waitMs(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">("visible");

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    if (reducedMotion) {
      setPhase("hidden");
      return;
    }

    let hideTimer: number | undefined;
    let cancelled = false;

    void (async () => {
      await Promise.all([waitMs(SPLASH_MIN_MS), waitForPageLoad()]);
      if (cancelled) return;

      setPhase("fading");

      hideTimer = window.setTimeout(() => {
        setPhase("hidden");
      }, FADE_MS);
    })();

    return () => {
      cancelled = true;
      if (hideTimer) window.clearTimeout(hideTimer);
    };
  }, []);

  useEffect(() => {
    if (phase === "hidden") {
      document.body.classList.remove("splash-active");
      return;
    }

    document.body.classList.add("splash-active");
    return () => {
      document.body.classList.remove("splash-active");
    };
  }, [phase]);

  if (phase === "hidden") {
    return null;
  }

  return (
    <div
      className={`splash-screen${phase === "fading" ? " splash-screen-fading" : ""}`}
      aria-hidden="true"
    >
      <LogoMark className="splash-logo" size={112} />
    </div>
  );
}
