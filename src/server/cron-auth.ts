import { readEnv } from "@/server/env";

export function verifyCronRequest(request: Request): boolean {
  const secret = readEnv("CRON_SECRET");
  if (!secret) return false;

  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}
