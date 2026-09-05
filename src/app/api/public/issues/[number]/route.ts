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
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { issues } from "@/db/schema";
import { handle, NotFoundError, ValidationError } from "@/lib/http";
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

    const [match] = await db
      .select({ id: issues.id })
      .from(issues)
      .where(eq(issues.number, parsed))
      .limit(1);

    if (!match) throw new NotFoundError("No issue with that number");

    const issue = await db.query.issues.findFirst({
      where: { id: match.id },
      with: {
        department: true,
        reporter: { columns: { id: true, name: true, image: true } },
        history: true,
        comments: {
          with: { author: { columns: { id: true, name: true, image: true } } },
        },
        attachments: true,
      },
    });

    if (!issue) throw new NotFoundError("No issue with that number");
    return Response.json(toPublicIssue(issue));
  });
}
