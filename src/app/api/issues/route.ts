/**
 * GET  /api/issues — public, filtered, paginated list
 * POST /api/issues — create an issue (any signed-in user)
 */
import { handle, jsonBody } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/permissions";
import { createIssue, listIssues } from "@/modules/issues/service";
import { toAuthorityIssue, toPublicIssue } from "@/modules/issues/serialize";
import {
  createIssueSchema,
  listIssuesSchema,
} from "@/modules/issues/validation";

export async function GET(request: Request) {
  return handle(async () => {
    const params = Object.fromEntries(new URL(request.url).searchParams);
    const input = listIssuesSchema.parse(params);

    const { issues, total } = await listIssues(input);

    // Authorities see identities; everyone else sees the privacy-safe shape.
    const user = await getCurrentUser();
    const isAuthority = user?.role === "OFFICER" || user?.role === "ADMIN";
    const serialize = isAuthority ? toAuthorityIssue : toPublicIssue;

    return Response.json({
      issues: issues.map(serialize),
      total,
      limit: input.limit,
      offset: input.offset,
    });
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    const input = createIssueSchema.parse(await jsonBody(request));
    const issue = await createIssue(input);
    return Response.json({ id: issue.id, number: issue.number }, { status: 201 });
  });
}
