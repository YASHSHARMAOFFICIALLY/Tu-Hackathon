/** PATCH /api/issues/:id/priority — triage priority. */
import { handle, jsonBody } from "@/lib/http";
import { setPriority } from "@/modules/issues/workflow.service";
import { setPrioritySchema } from "@/modules/issues/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const input = setPrioritySchema.parse(await jsonBody(request));
    const issue = await setPriority(id, input);
    return Response.json({ id: issue.id, priority: issue.priority });
  });
}
