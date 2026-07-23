import { readEnv } from "@/server/env";

type TurnstileVerifyResponse = {
  success: boolean;
  "error-codes"?: string[];
};

export async function verifyTurnstileToken(token: string): Promise<boolean> {
  const secret = readEnv("TURNSTILE_SECRET_KEY");
  if (!secret) {
    console.warn("[turnstile] TURNSTILE_SECRET_KEY nincs beállítva — kihagyva (dev)");
    return true;
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) return false;

  const data = (await res.json()) as TurnstileVerifyResponse;
  return data.success === true;
}

export function getTurnstileSiteKey(): string | null {
  return readEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY");
}
