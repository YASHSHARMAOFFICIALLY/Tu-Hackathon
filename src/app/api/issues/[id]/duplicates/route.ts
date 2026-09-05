/**
 * POST   /api/issues/:id/duplicates — group another report under this one
 * DELETE /api/issues/:id/duplicates — remove the link
 *
 * DELETE removes the LINK, never an issue. The brief requires duplicates to be
 * grouped or linked, not silently deleted.
 */
import { handle, jsonBody } from "@/lib/http";
import {
  linkDuplicate,
  unlinkDuplicate,
} from "@/modules/issues/workflow.service";
import { linkDuplicateSchema } from "@/modules/issues/validation";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const { duplicateIssueId } = linkDuplicateSchema.parse(
      await jsonBody(request),
    );
    const result = await linkDuplicate(id, duplicateIssueId);
    return Response.json(result, { status: 201 });
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;
    const { duplicateIssueId } = linkDuplicateSchema.parse(
      await jsonBody(request),
    );
    return Response.json(await unlinkDuplicate(id, duplicateIssueId));
  });
}
