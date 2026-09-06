/**
 * Post-commit enrichment: triage + embedding, written back to the issue.
 *
 * Runs AFTER `createIssue` has committed, so the citizen's report exists no
 * matter what happens here. Everything is wrapped: a provider outage, a
 * timeout, a malformed reply — all leave the issue exactly as filed, with null
 * ai_* columns.
 *
 * ponytail: fire-and-forget from the route rather than a job queue. Add a queue
 * when volume justifies retries; for now a failed enrichment is re-runnable
 * with the backfill script.
 *
 * It also re-runs when a photo is attached, because photos arrive after the
 * issue exists and the first run therefore saw none. ponytail: uploading three
 * photos fires three enrichments, each reading whatever was present when it
 * started, and the last to finish wins. Wasteful, not wrong, and the panel only
 * ever claims the photo count that run actually read. Coalesce them the day the
 * model bill matters.
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { departments, issues } from "@/db/schema";
import { aiEnabled } from "@/env";

import { embed } from "./client";
import { triageIssue } from "./triage";

/** The text a complaint is embedded from. Title carries most of the signal. */
export function embeddingText(input: { title: string; description: string }) {
  return `${input.title}\n\n${input.description}`;
}

export async function enrichIssue(issueId: string): Promise<void> {
  if (!aiEnabled) return;

  try {
    const issue = await db.query.issues.findFirst({
      where: { id: issueId },
      columns: {
        id: true,
        title: true,
        description: true,
        address: true,
        aiReviewedAt: true,
      },
      // Photos are part of the complaint, so triage reads them. They arrive
      // after the issue exists, which is why the attachment route re-runs this.
      with: { attachments: { columns: { url: true, fileType: true } } },
    });
    if (!issue) return;

    // An officer has already accepted or overridden these suggestions. Rewriting
    // them because a photo arrived late would silently undo a human decision.
    if (issue.aiReviewedAt) return;

    const photoUrls = (issue.attachments ?? [])
      .filter((a) => a.fileType?.startsWith("image/"))
      .map((a) => a.url);

    // Both calls in parallel: they are independent, and triage is the slow one.
    const [triage, embedding] = await Promise.all([
      triageIssue({ ...issue, photoUrls }),
      embed(embeddingText(issue)),
    ]);

    const updates: Record<string, unknown> = {};

    if (triage) {
      let aiDepartmentId: string | null = null;
      if (triage.departmentName) {
        const [match] = await db
          .select({ id: departments.id })
          .from(departments)
          .where(eq(departments.name, triage.departmentName))
          .limit(1);
        aiDepartmentId = match?.id ?? null;
      }

      Object.assign(updates, {
        aiCategory: triage.category,
        aiPriority: triage.priority,
        aiPriorityScore: triage.priorityScore,
        aiDepartmentId,
        aiSummary: triage.summary,
        aiReasoning: triage.reasoning,
        aiConfidence: triage.confidence,
        aiPhotoCount: triage.photoCount,
      });
    }

    if (embedding) updates.embedding = embedding;

    // Note what is NOT written: category, priority, departmentId, status.
    // Those stay as the citizen filed them until an officer accepts the
    // suggestion. AI assists; it does not decide.
    if (Object.keys(updates).length > 0) {
      await db.update(issues).set(updates).where(eq(issues.id, issueId));
    }
  } catch (error) {
    // Enrichment is best-effort by design. Log and move on.
    console.warn(`AI enrichment failed for issue ${issueId}:`, error);
  }
}
