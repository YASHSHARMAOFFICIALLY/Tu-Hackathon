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
 * TRIGRAM IS NOT ENOUGH ON ITS OWN. It compares character trigrams, so it
 * matches "Big pothole near the university entrance" to "Huge pothole near
 * university gate" (0.47 measured) but MISSES "Big crater on road outside
 * university gate" — the words share almost no trigrams even though it is
 * plainly the same pothole.
 *
 * So when AI is configured, a semantic search over embeddings runs alongside
 * and the two result sets are merged. Trigram remains the floor: with no API
 * key the feature still works exactly as before, just with lower recall.
 */
import { and, eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { aiEnabled } from "@/env";
import { embed } from "@/modules/ai/client";
import { embeddingText } from "@/modules/ai/enrich";
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
  /** How this candidate was found. Shown to the citizen, and useful in a demo. */
  matchedBy: "text" | "meaning" | "both";
  createdAt: Date;
};

export async function findPossibleDuplicates(input: {
  title: string;
  /** Optional: improves the semantic match, unused by the trigram half. */
  description?: string;
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

  const textMatches = await db
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

  const semanticMatches = await findSemanticDuplicates({
    title, description: input.description ?? "", category, limit,
  });

  return mergeCandidates(textMatches, semanticMatches, limit);
}

/**
 * Cosine-distance search over embeddings. Returns [] when AI is not configured,
 * which is what keeps this an enhancement rather than a dependency.
 *
 * 0.25 cosine distance ≈ 0.75 similarity: tight enough that unrelated
 * complaints in the same category do not surface, loose enough to catch a
 * genuine reword.
 */
const MAX_COSINE_DISTANCE = 0.25;

async function findSemanticDuplicates(input: {
  title: string;
  description: string;
  category: IssueCategory;
  limit: number;
}): Promise<Omit<DuplicateCandidate, "matchedBy">[]> {
  if (!aiEnabled) return [];

  const vector = await embed(embeddingText(input));
  if (!vector) return [];

  const literal = `[${vector.join(",")}]`;
  const distance = sql<number>`${issues.embedding} <=> ${literal}::vector`;

  return db
    .select({
      id: issues.id,
      number: issues.number,
      title: issues.title,
      status: issues.status,
      address: issues.address,
      // Reported on the same 0-1 scale as the trigram score so the two can be
      // compared and merged.
      similarity: sql<number>`1 - (${distance})`,
      createdAt: issues.createdAt,
    })
    .from(issues)
    .where(
      and(
        eq(issues.category, input.category),
        sql`${issues.embedding} is not null`,
        sql`${distance} < ${MAX_COSINE_DISTANCE}`,
        sql`${issues.status} <> 'RESOLVED'`,
        sql`${issues.status} <> 'REJECTED'`,
      ),
    )
    .orderBy(distance)
    .limit(input.limit);
}

/**
 * Merges the two result sets, keeping the higher score per issue and flagging
 * anything both methods found — agreement between an exact-ish and a semantic
 * match is the strongest duplicate signal there is, so those sort first.
 */
function mergeCandidates(
  textMatches: Omit<DuplicateCandidate, "matchedBy">[],
  semanticMatches: Omit<DuplicateCandidate, "matchedBy">[],
  limit: number,
): DuplicateCandidate[] {
  const merged = new Map<string, DuplicateCandidate>();

  for (const row of textMatches) merged.set(row.id, { ...row, matchedBy: "text" });

  for (const row of semanticMatches) {
    const existing = merged.get(row.id);
    if (existing) {
      merged.set(row.id, {
        ...existing,
        similarity: Math.max(existing.similarity, row.similarity),
        matchedBy: "both",
      });
    } else {
      merged.set(row.id, { ...row, matchedBy: "meaning" });
    }
  }

  return [...merged.values()]
    .sort((a, b) => {
      if ((a.matchedBy === "both") !== (b.matchedBy === "both")) {
        return a.matchedBy === "both" ? -1 : 1;
      }
      return b.similarity - a.similarity;
    })
    .slice(0, limit);
}
