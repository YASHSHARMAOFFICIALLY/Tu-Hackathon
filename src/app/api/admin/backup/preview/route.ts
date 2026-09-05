/**
 * POST /api/admin/backup/preview — validate a backup and report what it holds.
 * ADMIN ONLY. Writes nothing.
 *
 * This is the screen shown before RESTORE is confirmed: row counts, format
 * version, and — if the file is bad — the exact reason, with no database
 * changes either way.
 */
import { handle } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/permissions";
import { summarise, validateBackup } from "@/modules/backup/validate";

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const payload = await readBackupPayload(request);
    const backup = validateBackup(payload);

    return Response.json({ valid: true, ...summarise(backup) });
  });
}

/** Accepts either a raw JSON body or a multipart upload with a `file` field. */
export async function readBackupPayload(request: Request): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      throw new (await import("@/lib/http")).ValidationError(
        "Expected a file field named 'file'",
      );
    }
    return JSON.parse(await file.text());
  }

  return request.json();
}
