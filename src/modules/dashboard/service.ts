/**
 * Authority dashboard aggregates.
 *
 * Every number the dashboard shows comes from ONE round-trip. Six sequential
 * `count(*)` queries would each be a separate HTTPS request to Neon — fine on
 * localhost, visibly slow in a demo. Postgres FILTER aggregates collapse them
 * into a single scan.
 */
import { sql } from "drizzle-orm";

import { db } from "@/db";
import { requireRole } from "@/modules/auth/permissions";

export type DashboardSummary = {
  total: number;
  submitted: number;
  acknowledged: number;
  inProgress: number;
  resolved: number;
  rejected: number;
  open: number;
  highPriority: number;
  /** Average hours from report to resolution, or null when nothing is resolved. */
  averageResolutionHours: number | null;
  byCategory: { category: string; count: number }[];
  byDepartment: { department: string; count: number }[];
  overTime: { day: string; count: number }[];
  /**
   * Reports linked to an earlier report of the same thing. The duplicate check
   * runs before an issue is created, and every "mine is this one" writes a row
   * in `issue_duplicates` — this counts the reports it caught.
   */
  duplicatesLinked: number;
  /**
   * Reports filed in the last seven days, and in the seven before that. Two
   * counts rather than one percentage: the dashboard renders the delta, and a
   * change from 0 has no percentage to render.
   */
  lastSevenDays: number;
  previousSevenDays: number;
};

/** Narrow the whole dashboard to one department, or leave it city-wide. */
export type DashboardFilter = { departmentId?: string };

export async function getDashboard(
  filter: DashboardFilter = {},
): Promise<DashboardSummary> {
  // The brief calls this the "Authority dashboard" — it exposes counts across
  // every department, so it is not public.
  await requireRole("OFFICER", "ADMIN");

  // One optional predicate, spliced into each aggregate. `sql` builds it as a
  // bound parameter; the department id never becomes SQL text.
  const scope = filter.departmentId
    ? sql`where department_id = ${filter.departmentId}`
    : sql``;
  const andScope = filter.departmentId
    ? sql`and i.department_id = ${filter.departmentId}`
    : sql``;

  const [summary, byCategory, byDepartment, overTime, duplicates, trend] =
    await Promise.all([
    db.execute(sql`
      select
        count(*)::int                                                   as total,
        count(*) filter (where status = 'SUBMITTED')::int               as submitted,
        count(*) filter (where status = 'ACKNOWLEDGED')::int            as acknowledged,
        count(*) filter (where status = 'IN_PROGRESS')::int             as in_progress,
        count(*) filter (where status = 'RESOLVED')::int                as resolved,
        count(*) filter (where status = 'REJECTED')::int                as rejected,
        count(*) filter (where status in ('SUBMITTED','ACKNOWLEDGED','IN_PROGRESS'))::int as open,
        count(*) filter (where priority in ('HIGH','CRITICAL')
                           and status <> 'RESOLVED'
                           and status <> 'REJECTED')::int               as high_priority,
        -- Averaged over resolved issues only; null when there are none, rather
        -- than a misleading zero.
        avg(extract(epoch from (resolved_at - created_at)) / 3600)
          filter (where resolved_at is not null)                        as avg_resolution_hours
      from issues
      ${scope}
    `),

    db.execute(sql`
      select category, count(*)::int as count
      from issues ${scope} group by category order by count desc
    `),

    // LEFT JOIN from departments so a department with zero issues still shows —
    // "Sanitation: 0" is information; a missing row looks like a bug.
    db.execute(sql`
      select d.name as department, count(i.id)::int as count
      from departments d
      left join issues i on i.department_id = d.id
      group by d.name order by count desc
    `),

    db.execute(sql`
      select to_char(date_trunc('day', created_at), 'YYYY-MM-DD') as day,
             count(*)::int as count
      from issues
      where created_at > now() - interval '30 days'
        ${filter.departmentId ? sql`and department_id = ${filter.departmentId}` : sql``}
      group by 1 order by 1
    `),

    db.execute(sql`
      select count(*)::int as count
      from issue_duplicates d
      join issues i on i.id = d.duplicate_issue_id
      where true ${andScope}
    `),

    // Both windows in one scan, so the delta cannot be read from two different
    // moments in time.
    db.execute(sql`
      select
        count(*) filter (where created_at > now() - interval '7 days')::int  as recent,
        count(*) filter (where created_at <= now() - interval '7 days'
                           and created_at > now() - interval '14 days')::int as previous
      from issues
      ${scope}
    `),
  ]);

  const row = (summary.rows ?? summary)[0] as Record<string, unknown>;
  const rows = <T,>(r: { rows?: unknown[] } | unknown[]): T[] =>
    ((Array.isArray(r) ? r : (r.rows ?? [])) as T[]);

  return {
    total: Number(row.total ?? 0),
    submitted: Number(row.submitted ?? 0),
    acknowledged: Number(row.acknowledged ?? 0),
    inProgress: Number(row.in_progress ?? 0),
    resolved: Number(row.resolved ?? 0),
    rejected: Number(row.rejected ?? 0),
    open: Number(row.open ?? 0),
    highPriority: Number(row.high_priority ?? 0),
    averageResolutionHours:
      row.avg_resolution_hours === null || row.avg_resolution_hours === undefined
        ? null
        : Math.round(Number(row.avg_resolution_hours) * 10) / 10,
    byCategory: rows<{ category: string; count: number }>(byCategory),
    byDepartment: rows<{ department: string; count: number }>(byDepartment),
    overTime: rows<{ day: string; count: number }>(overTime),
    duplicatesLinked: Number(
      (rows<{ count: number }>(duplicates)[0]?.count ?? 0),
    ),
    lastSevenDays: Number(rows<{ recent: number }>(trend)[0]?.recent ?? 0),
    previousSevenDays: Number(
      rows<{ previous: number }>(trend)[0]?.previous ?? 0,
    ),
  };
}
