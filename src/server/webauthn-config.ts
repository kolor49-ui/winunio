import { readEnv } from "@/server/env";

export function getWebAuthnRpId(): string {
  const appUrl = readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3001";
  try {
    return new URL(appUrl).hostname;
  } catch {
    return "localhost";
  }
}

export function getWebAuthnOrigin(): string {
  return readEnv("NEXT_PUBLIC_APP_URL") ?? "http://localhost:3001";
}

export function getWebAuthnRpName(): string {
  return "Winunio";
}
