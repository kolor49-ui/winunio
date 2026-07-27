import { z } from "zod";

/** Vitaindításkor választható kategóriák — forrás: docs/BUSINESS_RULES.md §1 */
export const DEBATE_CATEGORIES = [
  "Közélet és politika",
  "Társadalom és emberi kapcsolatok",
  "Gazdaság, pénz és munka",
  "Tudomány és technológia",
  "Egészség és életmód",
  "Oktatás és fejlődés",
  "Környezet és jövő",
  "Kultúra, média és szórakozás",
  "Sport és szabadidő",
  "Filozófia, etika és vallás",
  "Közlekedés",
] as const;

export type DebateCategory = (typeof DEBATE_CATEGORIES)[number];

export const debateCategorySchema = z.enum(DEBATE_CATEGORIES);

export function isDebateCategory(value: string): value is DebateCategory {
  return debateCategorySchema.safeParse(value).success;
}
