import { createHash } from "node:crypto";

/** Normalized fingerprint — any edit invalidates prior approval. */
export function computeContentHash(text: string): string {
  const normalized = text.trim().replace(/\s+/g, " ");
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}
