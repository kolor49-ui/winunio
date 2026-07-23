import { getSql } from "@/server/db";

export async function logSecurityEvent(input: {
  userId: string | null;
  eventType: string;
  metadata?: Record<string, unknown>;
  ipHash?: string | null;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO security_events (user_id, event_type, metadata, ip_hash)
    VALUES (
      ${input.userId},
      ${input.eventType},
      ${JSON.stringify(input.metadata ?? {})},
      ${input.ipHash ?? null}
    )
  `;
}
