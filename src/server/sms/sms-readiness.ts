import { isProductionAppUrl } from "@/server/email/email-sending-readiness";
import { readEnv } from "@/server/env";
import { isTwilioVerifyConfigured } from "@/server/sms/twilio-verify";

export function getSmsReadiness(): {
  ready: boolean;
  provider: "twilio_verify" | "dev" | "none";
  issues: string[];
} {
  if (isTwilioVerifyConfigured()) {
    return {
      ready: true,
      provider: "twilio_verify",
      issues: [],
    };
  }

  const issues: string[] = [];
  const missing = [
    "TWILIO_ACCOUNT_SID",
    "TWILIO_AUTH_TOKEN",
    "TWILIO_VERIFY_SERVICE_SID",
  ].filter((name) => !readEnv(name));

  if (missing.length > 0) {
    issues.push(`Hiányzó env: ${missing.join(", ")}`);
  }

  if (isProductionAppUrl()) {
    issues.push(
      "Éles környezetben Twilio Verify kötelező a telefonos megerősítéshez.",
    );
    return { ready: false, provider: "none", issues };
  }

  return {
    ready: true,
    provider: "dev",
    issues: [
      "Twilio nincs beállítva — lokálisan a kód a képernyőn / szerver logban jelenik meg.",
    ],
  };
}
