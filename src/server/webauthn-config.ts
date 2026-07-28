import { readEnv } from "@/server/env";

export type WebAuthnContext = {
  origin: string;
  rpId: string;
};

export function getWebAuthnRpName(): string {
  return "Winunio";
}

function configuredAppOrigin(): string {
  if (process.env.VERCEL_ENV === "production") {
    return "https://winunio.com";
  }
  return readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3001";
}

/** @deprecated Prefer request-scoped context in API handlers. */
export function getWebAuthnRpId(): string {
  try {
    return deriveWebAuthnRpId(new URL(configuredAppOrigin()).hostname);
  } catch {
    return "localhost";
  }
}

/** @deprecated Prefer request-scoped context in API handlers. */
export function getWebAuthnOrigin(): string {
  return configuredAppOrigin();
}

export function deriveWebAuthnRpId(hostname: string): string {
  if (hostname === "localhost") return "localhost";
  if (hostname.endsWith(".vercel.app")) return hostname;
  if (hostname.startsWith("www.")) return hostname.slice(4);
  return hostname;
}

function normalizeOrigin(origin: string): string {
  return origin.replace(/\/$/, "");
}

function hostsMatch(a: string, b: string): boolean {
  const normalize = (host: string) => host.replace(/^www\./, "").toLowerCase();
  return normalize(a) === normalize(b);
}

/** www és apex (winunio.com ↔ www.winunio.com) elfogadása WebAuthn ellenőrzésnél. */
export function expandWebAuthnOrigins(origin: string): string[] {
  const normalized = normalizeOrigin(origin);
  const origins = new Set<string>([normalized]);
  try {
    const url = new URL(normalized);
    if (url.hostname === "localhost") return [normalized];
    if (url.hostname.endsWith(".vercel.app")) return [normalized];
    if (url.hostname.startsWith("www.")) {
      origins.add(`${url.protocol}//${url.hostname.slice(4)}`);
    } else {
      origins.add(`${url.protocol}//www.${url.hostname}`);
    }
  } catch {
    // Keep single origin when malformed.
  }
  return [...origins];
}

export function getWebAuthnContextFromRequest(request: Request): WebAuthnContext {
  const configured = normalizeOrigin(configuredAppOrigin());
  const originHeader = request.headers.get("origin")?.trim();

  let origin = configured;
  if (originHeader) {
    try {
      const headerOrigin = normalizeOrigin(originHeader);
      const configuredHost = new URL(configured).hostname;
      const headerHost = new URL(headerOrigin).hostname;
      if (hostsMatch(configuredHost, headerHost)) {
        origin = headerOrigin;
      }
    } catch {
      // Keep configured origin when the header is malformed.
    }
  }

  try {
    return {
      origin,
      rpId: deriveWebAuthnRpId(new URL(origin).hostname),
    };
  } catch {
    return {
      origin: getWebAuthnOrigin(),
      rpId: getWebAuthnRpId(),
    };
  }
}
