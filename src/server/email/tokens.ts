import { createHash, randomBytes } from "node:crypto";

export type EmailTokenPurpose = "verify_email" | "reset_password";

export function generateEmailToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashEmailToken(token);
  return { token, tokenHash };
}

export function hashEmailToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function getAppBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (!url) {
    throw new Error("NEXT_PUBLIC_APP_URL is not set");
  }
  return url.replace(/\/$/, "");
}

export function buildVerifyEmailUrl(token: string): string {
  return `${getAppBaseUrl()}/verify-email?token=${encodeURIComponent(token)}`;
}

export function buildResetPasswordUrl(token: string): string {
  return `${getAppBaseUrl()}/reset-password?token=${encodeURIComponent(token)}`;
}
