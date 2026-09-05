/**
 * POST /api/issues/check-duplicates
 *
 * Brief requirement: "The system should show possible existing reports before
 * creating a duplicate." Called from the report form as the citizen types,
 * before any issue exists.
 *
 * POST rather than GET because the title is free text and may be long; it also
 * keeps report text out of URLs, server logs, and browser history — the brief
 * requires personal information to stay private.
 */
import { handle, jsonBody } from "@/lib/http";
import { findPossibleDuplicates } from "@/modules/issues/duplicates";
import { checkDuplicatesSchema } from "@/modules/issues/validation";

export async function POST(request: Request) {
  return handle(async () => {
    const input = checkDuplicatesSchema.parse(await jsonBody(request));
    const candidates = await findPossibleDuplicates(input);
    return Response.json({ candidates });
  });
}
