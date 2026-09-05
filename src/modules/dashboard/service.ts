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
};

export async function getDashboard(): Promise<DashboardSummary> {
  // The brief calls this the "Authority dashboard" — it exposes counts across
  // every department, so it is not public.
  await requireRole("OFFICER", "ADMIN");

  const [summary, byCategory, byDepartment, overTime] = await Promise.all([
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
    `),

    db.execute(sql`
      select category, count(*)::int as count
      from issues group by category order by count desc
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
      group by 1 order by 1
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
  };
}
