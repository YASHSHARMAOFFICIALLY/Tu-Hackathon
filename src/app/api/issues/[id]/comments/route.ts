/**
 * POST /api/issues/:id/comments — add a comment.
 *
 * Internal notes are silently downgraded to public for citizens rather than
 * rejected; the service decides, not the client.
 */
import { handle, jsonBody } from "@/lib/http";
import { addComment } from "@/modules/issues/service";
import { createCommentSchema } from "@/modules/issues/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const input = createCommentSchema.parse(await jsonBody(request));
    const comment = await addComment(id, input);
    return Response.json(
      { id: comment.id, createdAt: comment.createdAt },
      { status: 201 },
    );
  });
}
