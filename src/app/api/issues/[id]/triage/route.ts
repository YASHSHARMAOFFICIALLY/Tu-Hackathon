/**
 * POST /api/issues/:id/triage — apply the AI suggestions. OFFICER or ADMIN.
 *
 * An empty body accepts the suggestions as-is; any field in the body overrides
 * that part. Either way the issue is stamped as reviewed, so the dashboard can
 * separate "a human has looked at this" from "a model guessed".
 */
import { handle, jsonBody } from "@/lib/http";
import { applyTriage } from "@/modules/issues/workflow.service";
import { applyTriageSchema } from "@/modules/issues/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;

    // Accepting outright is the common case, so an empty body is valid.
    const raw = request.headers.get("content-length") === "0" ? {} : await jsonBody(request).catch(() => ({}));
    const overrides = applyTriageSchema.parse(raw);

    const issue = await applyTriage(id, overrides);
    return Response.json({
      id: issue.id,
      category: issue.category,
      priority: issue.priority,
      departmentId: issue.departmentId,
      aiReviewedAt: issue.aiReviewedAt,
    });
  });
}
