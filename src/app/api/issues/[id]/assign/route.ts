/** PATCH /api/issues/:id/assign — set officer and/or department. */
import { handle, jsonBody } from "@/lib/http";
import { assignIssue } from "@/modules/issues/workflow.service";
import { assignIssueSchema } from "@/modules/issues/validation";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const input = assignIssueSchema.parse(await jsonBody(request));
    const issue = await assignIssue(id, input);
    return Response.json({
      id: issue.id,
      assignedTo: issue.assignedTo,
      departmentId: issue.departmentId,
    });
  });
}
