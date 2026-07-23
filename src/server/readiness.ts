import { checkDatabaseConnection } from "@/server/health";
import {
  checkAppUrlReadiness,
  checkEmailEnvReadiness,
  checkResendApiReadiness,
} from "@/server/env-readiness";
import {
  checkResendDomainReadiness,
  getConfiguredEmailFrom,
  isProductionAppUrl,
  sandboxRegistrationMessage,
} from "@/server/email/email-sending-readiness";
import { readEnv } from "@/server/env";

export async function getRegistrationReadiness() {
  const dbOk = await checkDatabaseConnection();
  const appUrl = checkAppUrlReadiness();
  const emailEnv = checkEmailEnvReadiness();
  const resend = await checkResendApiReadiness();
  const domain = await checkResendDomainReadiness();
  const emailFrom = getConfiguredEmailFrom();

  const issues = [
    ...(dbOk ? [] : ["Adatbázis nem elérhető"]),
    ...appUrl.issues,
    ...emailEnv.issues,
    ...resend.issues,
    ...domain.issues,
  ];

  const apiKey = readEnv("RESEND_API_KEY");
  const sandbox = domain.sandbox;

  return {
    ready: issues.length === 0,
    database: dbOk ? "connected" : "disconnected",
    app_url: readEnv("NEXT_PUBLIC_APP_URL"),
    email_from: emailFrom,
    email_sandbox: sandbox,
    email_public: !sandbox && domain.ok,
    sender_domain: domain.sender_domain,
    verified_domains: domain.verified_domains,
    resend_api_key_set: Boolean(apiKey),
    resend_api_key_length: apiKey?.length ?? 0,
    issues,
    sandbox: sandbox
      ? isProductionAppUrl()
        ? sandboxRegistrationMessage()
        : "Teszt küldő (onboarding@resend.dev): levél csak a Resend-fiók e-mail címére megy."
      : null,
  };
}
