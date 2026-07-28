import { readEnv } from "@/server/env";

const TEST_SITE_KEY_PREFIX = "1x00000000000000000000AA";

export function getTurnstileReadiness() {
  const siteKey = readEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY")?.trim() ?? "";
  const secret = readEnv("TURNSTILE_SECRET_KEY")?.trim() ?? "";
  const issues: string[] = [];

  if (!siteKey) {
    issues.push("NEXT_PUBLIC_TURNSTILE_SITE_KEY nincs beállítva");
  } else if (siteKey === TEST_SITE_KEY_PREFIX || siteKey.startsWith("1x00000000000000000000")) {
    issues.push("Turnstile tesztkulcs van élesben — cseréld Cloudflare éles Site Key-re");
  } else if (!siteKey.startsWith("0x4")) {
    issues.push("Turnstile Site Key formátum gyanús (0x4… várható)");
  }

  if (!secret) {
    issues.push("TURNSTILE_SECRET_KEY nincs beállítva");
  } else if (secret.startsWith("sk_live") || secret.startsWith("sk_test")) {
    issues.push("TURNSTILE_SECRET_KEY nem Cloudflare kulcs (Stripe? 0x4… kell)");
  } else if (!secret.startsWith("0x4")) {
    issues.push("Turnstile Secret Key formátum gyanús (0x4… várható)");
  }

  return {
    ready: issues.length === 0,
    site_key_set: Boolean(siteKey),
    secret_key_set: Boolean(secret),
    using_test_site_key:
      Boolean(siteKey) &&
      (siteKey === TEST_SITE_KEY_PREFIX || siteKey.startsWith("1x00000000000000000000")),
    issues,
  };
}
