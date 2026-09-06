/** GET /api/admin/people — everyone with an account, with their role. ADMIN. */
import { handle } from "@/lib/http";
import { listPeople } from "@/modules/auth/roles";

export async function GET() {
  return handle(async () => {
    return Response.json({ people: await listPeople() });
  });
}
