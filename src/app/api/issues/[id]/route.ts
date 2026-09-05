/**
 * GET   /api/issues/:id — one issue with its full timeline (public)
 * PATCH /api/issues/:id — edit your own report
 */
import { handle, jsonBody } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/permissions";
import { getIssue, updateIssue } from "@/modules/issues/service";
import { toAuthorityIssue, toPublicIssue } from "@/modules/issues/serialize";
import { updateIssueSchema } from "@/modules/issues/validation";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const issue = await getIssue(id);

    const user = await getCurrentUser();
    const isAuthority = user?.role === "OFFICER" || user?.role === "ADMIN";

    return Response.json(
      isAuthority ? toAuthorityIssue(issue) : toPublicIssue(issue),
    );
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const input = updateIssueSchema.parse(await jsonBody(request));
    const issue = await updateIssue(id, input);
    return Response.json(toPublicIssue(issue));
  });
}
