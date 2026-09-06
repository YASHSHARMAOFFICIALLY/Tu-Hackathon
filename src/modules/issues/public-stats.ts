/**
 * The register snapshot the landing page renders.
 *
 * Deliberately not `getDashboard()`. That one opens with `requireRole`, which
 * reads the session cookie, and a cookie read anywhere in a route opts the
 * whole page out of static rendering. Nothing here is per-request, so `/` stays
 * prerendered and refreshes on a timer instead.
 *
 * Counts come back in one round-trip. Four scalar sub-selects in a single
 * statement is one HTTPS request to Neon; four `db.$count` calls would be four.
 */
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { toPublicIssue } from "./serialize";

export type RegisterSnapshot = {
  total: number;
  open: number;
  resolved: number;
  departments: number;
  recent: ReturnType<typeof toPublicIssue>[];
};

/**
 * Returns null when the database cannot be reached, rather than throwing.
 *
 * This runs at build time as well as on revalidation, and a landing page that
 * fails to build because Neon was asleep is a worse outcome than a landing page
 * that renders without the strip. The caller renders the fallback.
 */
export async function getRegisterSnapshot(): Promise<RegisterSnapshot | null> {
  try {
    const [totals, recent] = await Promise.all([
      db.execute(sql`
        select
          (select count(*) from issues)::int as total,
          (select count(*) from issues
            where status in ('SUBMITTED','ACKNOWLEDGED','IN_PROGRESS'))::int as open,
          (select count(*) from issues where status = 'RESOLVED')::int as resolved,
          (select count(*) from departments)::int as departments
      `),
      db.query.issues.findMany({
        // The card shows the reporter's first photo as its thumbnail, same as
        // the register does.
        with: { attachments: true },
        orderBy: { createdAt: "desc" },
        limit: 3,
      }),
    ]);

    const row = ((totals.rows ?? totals) as Record<string, unknown>[])[0] ?? {};

    return {
      total: Number(row.total ?? 0),
      open: Number(row.open ?? 0),
      resolved: Number(row.resolved ?? 0),
      departments: Number(row.departments ?? 0),
      // Through the privacy boundary like every other issue response, even
      // though these fields are already public ones. The rule is that nothing
      // reaches a view without passing through here.
      recent: recent.map((issue) => toPublicIssue(issue)),
    };
  } catch {
    return null;
  }
}
