/**
 * Pre-submit duplicate detection.
 *
 * The brief: "The system should show possible existing reports BEFORE creating
 * a duplicate." So this runs on the create path, before any row exists, using
 * only what the form has at that moment — category, location, and title text.
 *
 * Rule-based on purpose. Three signals, combined:
 *   1. same category            — a pothole is not a water leak
 *   2. within ~1km              — same real-world thing, not the same words
 *   3. title similarity         — pg_trgm trigram distance
 *
 * ponytail: no embeddings, no LLM. Trigram + a bounding box satisfies the brief
 * and runs in one indexed query. Upgrade to semantic search only if the rules
 * demonstrably miss real duplicates.
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { issues } from "./schema/issues";
import type { IssueCategory } from "@/db/schema/enums";

/** Trigram similarity floor. 0.3 is pg_trgm's own default threshold. */
const SIMILARITY_THRESHOLD = 0.3;

/** ~1km in degrees of latitude. Good enough for "the same pothole". */
const RADIUS_DEGREES = 0.01;

export type DuplicateCandidate = {
  id: string;
  number: number;
  title: string;
  status: string;
  address: string;
  similarity: number;
  createdAt: Date;
};

export async function findPossibleDuplicates(input: {
  title: string;
  category: IssueCategory;
  latitude?: number;
  longitude?: number;
  limit?: number;
}): Promise<DuplicateCandidate[]> {
  const { title, category, latitude, longitude, limit = 5 } = input;

  const similarity = sql<number>`similarity(${issues.title}, ${title})`;

  const conditions = [
    eq(issues.category, category),
    sql`${similarity} > ${SIMILARITY_THRESHOLD}`,
    // A resolved issue from last year is not a duplicate of today's report —
    // the problem came back, and that is a new issue.
    sql`${issues.status} <> 'RESOLVED'`,
    sql`${issues.status} <> 'REJECTED'`,
  ];

  // Location narrows the search when available. A bounding box, not a great
  // circle: at this radius the error is metres, and it stays index-friendly.
  if (latitude !== undefined && longitude !== undefined) {
    conditions.push(
      sql`${issues.latitude} between ${latitude - RADIUS_DEGREES} and ${latitude + RADIUS_DEGREES}`,
      sql`${issues.longitude} between ${longitude - RADIUS_DEGREES} and ${longitude + RADIUS_DEGREES}`,
    );
  }

  const rows = await db
    .select({
      id: issues.id,
      number: issues.number,
      title: issues.title,
      status: issues.status,
      address: issues.address,
      similarity,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(and(...conditions))
    .orderBy(sql`${similarity} desc`)
    .limit(limit);

  return rows;
}
