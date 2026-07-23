import { checkDatabaseConnection } from "@/server/health";
import {
  checkAppUrlReadiness,
  checkEmailEnvReadiness,
  checkResendApiReadiness,
} from "@/server/env-readiness";
import { readEnv } from "@/server/env";

export async function getRegistrationReadiness() {
  const dbOk = await checkDatabaseConnection();
  const appUrl = checkAppUrlReadiness();
  const emailEnv = checkEmailEnvReadiness();
  const resend = await checkResendApiReadiness();

  const issues = [
    ...(dbOk ? [] : ["Adatbázis nem elérhető"]),
    ...appUrl.issues,
    ...emailEnv.issues,
    ...resend.issues,
  ];

  const apiKey = readEnv("RESEND_API_KEY");

  return {
    ready: issues.length === 0,
    database: dbOk ? "connected" : "disconnected",
    app_url: readEnv("NEXT_PUBLIC_APP_URL"),
    email_from: readEnv("EMAIL_FROM") ?? "onboarding@resend.dev",
    resend_api_key_set: Boolean(apiKey),
    resend_api_key_length: apiKey?.length ?? 0,
    issues,
    sandbox:
      "Teszt küldő (onboarding@resend.dev): levél csak a Resend-fiók e-mail címére megy.",
  };
}
