/**
 * POST /api/issues/:id/attachments — attach one photograph to an existing issue.
 *
 * Multipart, one file per request. Not a batch: a single failed image in a set
 * of four should not cost the other three, and the form uploads them
 * concurrently anyway.
 *
 * The issue must already exist — that is the whole reason this hangs off an
 * issue id rather than living on the create path. See `modules/issues/
 * attachments.ts` for why an upload during the duplicate check would leave
 * orphan blobs.
 */
import { handle, ValidationError } from "@/lib/http";
import { addAttachment } from "@/modules/issues/attachments";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    const { id } = await params;

    const form = await request.formData().catch(() => null);
    if (!form) {
      throw new ValidationError("Send the photo as multipart/form-data");
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new ValidationError("No file was sent under the field 'file'");
    }

    // Every check that matters — who, what type, how big, how many — lives in
    // the service, so a future caller cannot skip them by not being this route.
    const attachment = await addAttachment(id, file);

    return Response.json(attachment, { status: 201 });
  });
}
