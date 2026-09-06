/** PATCH /api/admin/people/:userId — set a role and its department. ADMIN. */
import { z } from "zod";

import { handle, jsonBody } from "@/lib/http";
import { setPersonRole } from "@/modules/auth/roles";

const schema = z.object({
  role: z.enum(["CITIZEN", "OFFICER", "ADMIN"]),
  // Absent and null mean the same thing here: no department.
  departmentId: z.uuid().nullish(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  return handle(async () => {
    const { userId } = await params;
    const input = schema.parse(await jsonBody(request));
    const people = await setPersonRole({
      userId,
      role: input.role,
      departmentId: input.departmentId ?? null,
    });
    return Response.json({ people });
  });
}
