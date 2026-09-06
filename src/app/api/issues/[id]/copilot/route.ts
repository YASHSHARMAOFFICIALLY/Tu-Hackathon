/**
 * POST /api/issues/:id/copilot — suggested next actions and a citizen draft.
 *
 * POST rather than GET because it costs a model call: a GET invites a browser,
 * a prefetch or a crawler to spend one. Nothing is stored, so nothing is
 * returned twice; the officer asks when they want an answer.
 */
import { handle, NotFoundError } from "@/lib/http";
import { suggestResolution } from "@/modules/ai/copilot";
import { requireOfficer } from "@/modules/auth/permissions";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  return handle(async () => {
    await requireOfficer();
    const { id } = await params;

    const plan = await suggestResolution(id);
    if (!plan) {
      throw new NotFoundError(
        "No suggestion is available for this report right now.",
      );
    }

    return Response.json(plan);
  });
}
