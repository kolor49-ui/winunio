"use client";

import { useEffect } from "react";

const PRODUCTION_CANONICAL = "https://www.winunio.com";

function apexHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

function resolveCanonicalOrigin(): string | null {
  if (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith("winunio.com")
  ) {
    return PRODUCTION_CANONICAL;
  }

  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** PWA esetén apex → www (Vercel fő domain). */
export function CanonicalHostRedirect() {
  useEffect(() => {
    const canonicalOrigin = resolveCanonicalOrigin();
    if (!canonicalOrigin) return;

    let canonical: URL;
    try {
      canonical = new URL(canonicalOrigin);
    } catch {
      return;
    }

    const currentHost = window.location.hostname;
    if (currentHost === canonical.hostname) return;
    if (apexHost(currentHost) !== apexHost(canonical.hostname)) return;

    const target = `${canonical.origin}${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);

  return null;
}
