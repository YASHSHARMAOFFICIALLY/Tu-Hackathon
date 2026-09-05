/**
 * GET /api/me — who is signed in.
 *
 * Returns 401 for anonymous callers rather than a null body, so clients can
 * branch on the status code instead of parsing to find out.
 *
 * Deliberately returns a narrow shape, not the whole session: the brief
 * requires that personal information stays private, and the smallest payload
 * that does the job is the one that cannot leak something later.
 */
import { getSession } from "@/modules/auth/session";

export async function GET() {
  const session = await getSession();

  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  return Response.json({
    id: session.user.id,
    name: session.user.name,
    email: session.user.email,
    image: session.user.image,
  });
}
