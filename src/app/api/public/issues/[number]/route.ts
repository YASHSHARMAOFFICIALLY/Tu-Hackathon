/**
 * GET /api/public/issues/:number — public progress tracking.
 *
 * Covers the brief's "Public tracking" MVP item. Looked up by the human-facing
 * issue NUMBER, because that is what a citizen has: they were shown "Issue
 * #1024" when they reported it, not a UUID.
 *
 * Always the public shape, even for a signed-in officer: this is the endpoint
 * whose payload must be safe to show anyone, and making it role-dependent is
 * how a leak eventually happens.
 */
import { handle, NotFoundError, ValidationError } from "@/lib/http";
import { getIssueByNumber } from "@/modules/issues/service";
import { toPublicIssue } from "@/modules/issues/serialize";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ number: string }> },
) {
  return handle(async () => {
    const { number } = await params;

    const parsed = Number(number);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new ValidationError("Issue number must be a positive integer");
    }

    const issue = await getIssueByNumber(parsed);
    if (!issue) throw new NotFoundError("No issue with that number");
    return Response.json(toPublicIssue(issue));
  });
}
