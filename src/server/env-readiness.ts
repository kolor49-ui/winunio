import { readEnv } from "@/server/env";

export type ReadinessCheck = {
  ok: boolean;
  issues: string[];
};

export function checkAppUrlReadiness(): ReadinessCheck {
  const issues: string[] = [];
  const appUrl = readEnv("NEXT_PUBLIC_APP_URL");

  if (!appUrl) {
    issues.push("NEXT_PUBLIC_APP_URL nincs beállítva");
  } else if (appUrl.includes("localhost")) {
    issues.push(
      "NEXT_PUBLIC_APP_URL localhost — a megerősítő link nem fog működni élesen",
    );
  } else if (!appUrl.startsWith("https://")) {
    issues.push("NEXT_PUBLIC_APP_URL legyen https://…");
  }

  return { ok: issues.length === 0, issues };
}

export function checkEmailEnvReadiness(): ReadinessCheck {
  const issues: string[] = [];
  const apiKey = readEnv("RESEND_API_KEY");
  const emailFrom = readEnv("EMAIL_FROM");

  if (!apiKey) {
    issues.push("RESEND_API_KEY nincs beállítva");
  } else if (apiKey.includes("xxxxxxxx")) {
    issues.push("RESEND_API_KEY placeholder — valódi re_… kulcs kell");
  } else if (!apiKey.startsWith("re_")) {
    issues.push("RESEND_API_KEY formátum hibás (re_…)");
  }

  if (!emailFrom) {
    issues.push("EMAIL_FROM nincs beállítva (pl. onboarding@resend.dev)");
  }

  return { ok: issues.length === 0, issues };
}

export async function checkResendApiReadiness(): Promise<ReadinessCheck> {
  const envCheck = checkEmailEnvReadiness();
  if (!envCheck.ok) return envCheck;

  const apiKey = readEnv("RESEND_API_KEY")!;

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "User-Agent": "winunio-readiness/1.0",
      },
      body: JSON.stringify({}),
    });

    if (res.status === 401) {
      return {
        ok: false,
        issues: ["Resend elutasítja az API kulcsot (401 invalid)"],
      };
    }

    if (res.status === 422 || res.status === 400 || res.status === 403) {
      return { ok: true, issues: [] };
    }

    const body = await res.text();
    return {
      ok: false,
      issues: [`Váratlan Resend válasz: ${res.status} ${body.slice(0, 120)}`],
    };
  } catch {
    return { ok: false, issues: ["Resend API nem elérhető"] };
  }
}
