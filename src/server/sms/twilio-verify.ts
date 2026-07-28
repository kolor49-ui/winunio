import { readEnv } from "@/server/env";

export type TwilioVerifyConfig = {
  accountSid: string;
  authToken: string;
  serviceSid: string;
};

export function getTwilioVerifyConfig(): TwilioVerifyConfig | null {
  const accountSid = readEnv("TWILIO_ACCOUNT_SID");
  const authToken = readEnv("TWILIO_AUTH_TOKEN");
  const serviceSid = readEnv("TWILIO_VERIFY_SERVICE_SID");
  if (!accountSid || !authToken || !serviceSid) {
    return null;
  }
  return { accountSid, authToken, serviceSid };
}

export function isTwilioVerifyConfigured(): boolean {
  return getTwilioVerifyConfig() !== null;
}

function twilioAuthHeader(config: TwilioVerifyConfig): string {
  const token = Buffer.from(`${config.accountSid}:${config.authToken}`).toString(
    "base64",
  );
  return `Basic ${token}`;
}

type TwilioErrorBody = {
  code?: number;
  message?: string;
  status?: number;
};

async function parseTwilioResponse<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & TwilioErrorBody;
  if (!res.ok) {
    const message = data.message ?? `Twilio hiba (${res.status})`;
    const error = new Error(message) as Error & { twilioCode?: number };
    error.twilioCode = data.code;
    throw error;
  }
  return data;
}

export async function sendTwilioVerification(phoneE164: string): Promise<void> {
  const config = getTwilioVerifyConfig();
  if (!config) {
    throw new Error("TWILIO_NOT_CONFIGURED");
  }

  const body = new URLSearchParams({
    To: phoneE164,
    Channel: "sms",
  });

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${config.serviceSid}/Verifications`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(config),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  await parseTwilioResponse<{ status: string }>(res);
}

export async function checkTwilioVerification(
  phoneE164: string,
  code: string,
): Promise<boolean> {
  const config = getTwilioVerifyConfig();
  if (!config) {
    throw new Error("TWILIO_NOT_CONFIGURED");
  }

  const body = new URLSearchParams({
    To: phoneE164,
    Code: code,
  });

  const res = await fetch(
    `https://verify.twilio.com/v2/Services/${config.serviceSid}/VerificationCheck`,
    {
      method: "POST",
      headers: {
        Authorization: twilioAuthHeader(config),
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    },
  );

  const data = await parseTwilioResponse<{ status: string }>(res);
  return data.status === "approved";
}

export function mapTwilioError(error: unknown): string {
  const twilioCode =
    typeof error === "object" &&
    error !== null &&
    "twilioCode" in error &&
    typeof (error as { twilioCode: unknown }).twilioCode === "number"
      ? (error as { twilioCode: number }).twilioCode
      : undefined;

  if (twilioCode === 60200) {
    return "Érvénytelen telefonszám formátum.";
  }
  if (twilioCode === 60203) {
    return "Túl sok SMS-kérés ehhez a számhoz — próbáld később.";
  }
  if (twilioCode === 60202) {
    return "Túl sok hibás kód — kérj új SMS-t.";
  }
  if (error instanceof Error && error.message === "TWILIO_NOT_CONFIGURED") {
    return "SMS-küldés nincs beállítva a szerveren.";
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "SMS szolgáltatás hiba";
}
