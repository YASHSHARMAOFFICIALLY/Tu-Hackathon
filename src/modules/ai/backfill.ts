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
import { sql } from "drizzle-orm";

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

/**
 * Milliseconds between issues.
 *
 * Measured, not guessed: pausing one second every ten issues tripped the free
 * tier's per-minute cap on the first run and 39 of 50 issues came back with an
 * embedding but no triage, because `enrichIssue` swallows the 429 and keeps the
 * row. Each issue costs two calls (triage and embedding), so six seconds holds
 * it near ten issues a minute. The 429 body carries a `retryDelay` of 26s, which
 * is the number to respect if this ever needs tightening.
 *
 * ponytail: a flat delay, not adaptive backoff. Re-running the script is free
 * and picks up exactly what is still missing.
 */
const DELAY_MS = Number(process.env.BACKFILL_DELAY_MS ?? 6000);

let done = 0;
for (const issue of pending) {
  await enrichIssue(issue.id);
  done++;
  if (done % 10 === 0) console.log(`  ${done}/${pending.length}`);
  if (done < pending.length) {
    await new Promise((r) => setTimeout(r, DELAY_MS));
  }
}

// Reports what is STILL missing, per signal. A run that hits the rate limit
// leaves embeddings intact and triage null, and a summary counting only
// embeddings reported success on exactly that failure.
const [remaining] = await db
  .select({
    noEmbedding: sql<number>`count(*) filter (where ${issues.embedding} is null)::int`,
    noTriage: sql<number>`count(*) filter (where ${issues.aiCategory} is null)::int`,
  })
  .from(issues);

console.log(
  `Enriched ${done}. Still missing: ${remaining.noEmbedding} embeddings, ${remaining.noTriage} triage.`,
);
if (remaining.noTriage > 0) {
  console.log("Re-run to pick those up; it only selects what is missing.");
}
