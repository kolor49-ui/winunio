"use client";

import { useEffect, useState } from "react";
import { LogoMark } from "./logo-mark";

const SPLASH_MS = 2000;
const FADE_MS = 350;

export function SplashScreen() {
  const [phase, setPhase] = useState<"visible" | "fading" | "hidden">("visible");

  useEffect(() => {
    const reducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const displayMs = reducedMotion ? 0 : SPLASH_MS;

    const fadeTimer = window.setTimeout(() => {
      setPhase("fading");
    }, displayMs);

    const hideTimer = window.setTimeout(() => {
      setPhase("hidden");
    }, displayMs + FADE_MS);

    return () => {
      window.clearTimeout(fadeTimer);
      window.clearTimeout(hideTimer);
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
