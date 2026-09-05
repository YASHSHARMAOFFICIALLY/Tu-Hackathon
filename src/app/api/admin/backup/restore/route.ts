/**
 * POST /api/admin/backup/restore — validate then restore. ADMIN ONLY.
 *
 * Runs in one transaction: on any failure nothing is written and the response
 * says so explicitly. Defaults to "empty-only" so an accidental restore cannot
 * flatten a live database; `?mode=replace` wipes and restores atomically.
 */
import { handle, ValidationError } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/permissions";
import { restoreBackup, type RestoreMode } from "@/modules/backup/restore";
import { validateBackup } from "@/modules/backup/validate";

import { readBackupPayload } from "../preview/route";

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const modeParam = new URL(request.url).searchParams.get("mode") ?? "empty-only";
    if (modeParam !== "empty-only" && modeParam !== "replace") {
      throw new ValidationError(`Unknown mode: ${modeParam}`);
    }

    const payload = await readBackupPayload(request);
    // Validated in full before the transaction opens: a bad file costs no
    // database work at all.
    const backup = validateBackup(payload);

    const result = await restoreBackup(backup, modeParam as RestoreMode);
    return Response.json({ ok: true, ...result });
  });
}
