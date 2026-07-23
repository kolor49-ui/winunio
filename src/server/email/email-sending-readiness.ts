import { readEnv } from "@/server/env";

export function parseEmailFromAddress(from: string): string {
  const match = from.match(/<([^>]+)>/);
  return (match?.[1] ?? from).trim().toLowerCase();
}

export function getConfiguredEmailFrom(): string {
  return readEnv("EMAIL_FROM") ?? "onboarding@resend.dev";
}

export function isSandboxEmailFrom(from: string): boolean {
  return parseEmailFromAddress(from).endsWith("@resend.dev");
}

export function isProductionAppUrl(): boolean {
  const url = readEnv("NEXT_PUBLIC_APP_URL") ?? "";
  return !url.includes("localhost") && url.startsWith("https://");
}

export function sandboxRegistrationMessage(): string {
  return "Az e-mail küldés még sandbox módban van (onboarding@resend.dev). Éles regisztrációhoz verified winunio.com domain kell a Resenden, és EMAIL_FROM=Winunio <noreply@winunio.com> a Vercelen.";
}

export async function checkResendDomainReadiness(): Promise<{
  ok: boolean;
  issues: string[];
  verified_domains: string[];
  sandbox: boolean;
  sender_domain: string;
}> {
  const emailFrom = getConfiguredEmailFrom();
  const senderAddress = parseEmailFromAddress(emailFrom);
  const senderDomain = senderAddress.split("@")[1] ?? "";
  const sandbox = isSandboxEmailFrom(emailFrom);

  if (sandbox) {
    if (isProductionAppUrl()) {
      return {
        ok: false,
        issues: [sandboxRegistrationMessage()],
        verified_domains: [],
        sandbox: true,
        sender_domain: senderDomain,
      };
    }
    return {
      ok: true,
      issues: [],
      verified_domains: [],
      sandbox: true,
      sender_domain: senderDomain,
    };
  }

  const apiKey = readEnv("RESEND_API_KEY");
  if (!apiKey) {
    return {
      ok: false,
      issues: ["RESEND_API_KEY nincs beállítva"],
      verified_domains: [],
      sandbox: false,
      sender_domain: senderDomain,
    };
  }

  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "User-Agent": "winunio-readiness/1.0",
      },
    });

    if (res.status === 401) {
      const sendProbe = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "User-Agent": "winunio-readiness/1.0",
        },
        body: JSON.stringify({}),
      });

      if (sendProbe.status === 422 || sendProbe.status === 400) {
        return {
          ok: true,
          issues: [],
          verified_domains: [senderDomain],
          sandbox: false,
          sender_domain: senderDomain,
        };
      }

      return {
        ok: false,
        issues: ["Resend elutasítja az API kulcsot (401 invalid)"],
        verified_domains: [],
        sandbox: false,
        sender_domain: senderDomain,
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        issues: [`Resend domains API hiba: ${res.status}`],
        verified_domains: [],
        sandbox: false,
        sender_domain: senderDomain,
      };
    }

    const body = (await res.json()) as {
      data?: Array<{ name: string; status: string }>;
    };
    const domains = body.data ?? [];
    const verifiedDomains = domains
      .filter((domain) => domain.status === "verified")
      .map((domain) => domain.name);

    const matchingDomain = domains.find(
      (domain) =>
        senderDomain === domain.name || senderDomain.endsWith(`.${domain.name}`),
    );

    if (!matchingDomain) {
      return {
        ok: false,
        issues: [
          `A küldő cím domainje (${senderDomain}) nincs hozzáadva a Resend fiókhoz.`,
        ],
        verified_domains: verifiedDomains,
        sandbox: false,
        sender_domain: senderDomain,
      };
    }

    if (matchingDomain.status !== "verified") {
      return {
        ok: false,
        issues: [
          `A ${matchingDomain.name} domain státusza: ${matchingDomain.status}. DNS rekordok ellenőrzése szükséges a Resenden.`,
        ],
        verified_domains: verifiedDomains,
        sandbox: false,
        sender_domain: senderDomain,
      };
    }

    return {
      ok: true,
      issues: [],
      verified_domains: verifiedDomains,
      sandbox: false,
      sender_domain: senderDomain,
    };
  } catch {
    return {
      ok: false,
      issues: ["Resend domains API nem elérhető"],
      verified_domains: [],
      sandbox: false,
      sender_domain: senderDomain,
    };
  }
}

export function assertPublicEmailSendingAllowed(): void {
  if (isProductionAppUrl() && isSandboxEmailFrom(getConfiguredEmailFrom())) {
    throw new Error("EMAIL_SANDBOX");
  }
}
