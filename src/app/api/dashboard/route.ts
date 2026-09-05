/** GET /api/dashboard — authority dashboard aggregates. OFFICER or ADMIN. */
import { handle } from "@/lib/http";
import { getDashboard } from "@/modules/dashboard/service";

export async function GET() {
  return handle(async () => Response.json(await getDashboard()));
}
