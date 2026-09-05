/**
 * PATCH /api/issues/:id/status — move an issue through the lifecycle.
 *
 * Refusals come back as 400 with the reason and the legal alternatives, so an
 * officer is told what they may do instead of just being blocked.
 */
import { handle, jsonBody } from "@/lib/http";
import { transitionStatus } from "@/modules/issues/workflow.service";
import { transitionStatusSchema } from "@/modules/issues/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const input = transitionStatusSchema.parse(await jsonBody(request));
    const issue = await transitionStatus(id, input);
    return Response.json({ id: issue.id, status: issue.status });
  });
}
