/**
 * Backfills AI triage and embeddings for issues that have none.
 *
 * Usage: bun run ai:backfill [limit]
 *
 * Needed in three situations: seeded demo data (inserted directly, so
 * enrichment never ran), issues created while the API key was missing, and
 * restored backups (embeddings are derived data and deliberately not exported).
 *
 * Sequential and rate-limit friendly rather than parallel — the free tier has a
 * per-minute cap, and this is background work with no one waiting on it.
 */
import { isNull, sql } from "drizzle-orm";

import { db } from "@/db";
import { issues } from "@/db/schema";
import { aiEnabled } from "@/env";

import { enrichIssue } from "./enrich";

if (!aiEnabled) {
  console.error("GEMINI_API_KEY is not set — nothing to do.");
  process.exit(1);
}

const limit = Number(process.argv[2] ?? 100);

const pending = await db
  .select({ id: issues.id, number: issues.number, title: issues.title })
  .from(issues)
  .where(sql`${issues.embedding} is null or ${issues.aiCategory} is null`)
  .orderBy(issues.createdAt)
  .limit(limit);

console.log(`${pending.length} issues need enrichment.`);

let done = 0;
for (const issue of pending) {
  await enrichIssue(issue.id);
  done++;
  // Gentle pacing: the free tier limits requests per minute, and a backfill
  // that trips the limit takes longer than one that waits.
  if (done % 10 === 0) {
    console.log(`  ${done}/${pending.length}`);
    await new Promise((r) => setTimeout(r, 1000));
  }
}

const remaining = await db
  .select({ n: sql<number>`count(*)::int` })
  .from(issues)
  .where(isNull(issues.embedding));

console.log(`Enriched ${done}. Still missing embeddings: ${remaining[0].n}`);
