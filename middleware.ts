import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

function canonicalAppUrl(): URL | null {
  const raw = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

function apexHost(hostname: string): string {
  return hostname.replace(/^www\./, "").toLowerCase();
}

export function middleware(request: NextRequest) {
  const canonical = canonicalAppUrl();
  if (!canonical) return NextResponse.next();

  const requestHost =
    request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().split(":")[0] ??
    request.headers.get("host")?.split(":")[0] ??
    request.nextUrl.hostname;

  if (apexHost(requestHost) !== apexHost(canonical.hostname)) {
    return NextResponse.next();
  }

  if (requestHost === canonical.hostname) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.protocol = canonical.protocol;
  redirectUrl.hostname = canonical.hostname;
  redirectUrl.port = canonical.port;

  return NextResponse.redirect(redirectUrl, 308);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest).*)"],
};
