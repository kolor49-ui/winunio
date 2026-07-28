"use client";

import { useEffect } from "react";

function apexHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

/** PWA / könyvjelző esetén is a kanonikus hostra irányít (pl. winunio.com → www.winunio.com). */
export function CanonicalHostRedirect() {
  useEffect(() => {
    const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (!raw) return;

    let canonical: URL;
    try {
      canonical = new URL(raw);
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
