/**
 * DELETE /api/issues/:id/attachments/:attachmentId — remove a photograph.
 *
 * The issue id in the path is not used for the lookup: an attachment id is
 * already unique, and resolving the attachment tells us its issue. It stays in
 * the route so the URL reads as the hierarchy it actually is, and so a client
 * cannot construct a delete without knowing which report it belongs to.
 */
import { handle } from "@/lib/http";
import { deleteAttachment } from "@/modules/issues/attachments";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  return handle(async () => {
    const { attachmentId } = await params;
    const removed = await deleteAttachment(attachmentId);
    return Response.json(removed);
  });
}
