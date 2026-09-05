/**
 * GET /api/admin/backup/export — download the full backup as JSON. ADMIN ONLY.
 *
 * The file contains user names and emails, so it is personal data: served as an
 * attachment, never cached, never a public URL. `?redactEmails=true` swaps them
 * for stable hashed placeholders when the file has to leave trusted hands.
 */
import { handle } from "@/lib/http";
import { requireAdmin } from "@/modules/auth/permissions";
import { backupFilename, exportBackup } from "@/modules/backup/export";

export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin();

    const redactEmails =
      new URL(request.url).searchParams.get("redactEmails") === "true";

    const backup = await exportBackup({ redactEmails });

    return new Response(JSON.stringify(backup, null, 2), {
      headers: {
        "content-type": "application/json",
        "content-disposition": `attachment; filename="${backupFilename()}"`,
        // Personal data must not sit in a shared cache.
        "cache-control": "no-store, private",
      },
    });
  });
}
