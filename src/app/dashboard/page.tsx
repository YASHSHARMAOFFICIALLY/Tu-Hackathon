import Link from "next/link";
import { redirect } from "next/navigation";

import {
  Categories,
  Departments,
  IssueList,
  OverTime,
  Panel,
  Stat,
  type IssueRow,
} from "@/components/dashboard/pieces";
import { getCurrentUser } from "@/modules/auth/permissions";
import { getDashboard } from "@/modules/dashboard/service";
import { listIssues } from "@/modules/issues/service";
import { toPublicIssue } from "@/modules/issues/serialize";

export const metadata = { title: "Dashboard" };

/**
 * The screen after sign-in.
 *
 * Two dashboards on one route, because the product has two audiences and they
 * do not want the same page:
 *
 *   CITIZEN         their own reports, and the way back to filing another
 *   OFFICER, ADMIN  the authority aggregates from `getDashboard()`
 *
 * The split is on role, not on a query parameter: a citizen cannot see the
 * aggregates (the service calls `requireRole("OFFICER","ADMIN")` itself), so
 * asking for them would throw rather than render an empty page.
 *
 * Every figure here comes from the database. There is no invented metric, no
 * "+12% this week" delta with nothing behind it, and no map: coordinates are
 * deliberately rounded to about a kilometre in the public shape, and a map with
 * no tiles is a grey box.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?redirectTo=/dashboard");

  const name = user.displayName ?? user.name;
  const isAuthority = user.role === "OFFICER" || user.role === "ADMIN";

  return (
    <div className="flex min-h-[100svh] flex-col">
      <header className="bg-ink">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 md:px-8">
          <Link
            href="/"
            className="text-canvas inline-flex items-center gap-2 rounded-lg text-[0.9375rem] font-semibold tracking-[-0.01em] focus-visible:ring-2 focus-visible:ring-canvas focus-visible:ring-offset-2 focus-visible:ring-offset-ink focus-visible:outline-none"
          >
            CivicTrack
          </Link>
          <span aria-hidden="true" className="text-ink-muted">
            /
          </span>
          <span className="text-ink-muted text-[0.9375rem]">Dashboard</span>

          <div className="ml-auto flex items-center gap-5">
            {user.role === "ADMIN" ? (
              <Link
                href="/admin/backup"
                className="text-ink-muted hover:text-canvas rounded text-[0.8125rem] transition-colors focus-visible:ring-2 focus-visible:ring-canvas focus-visible:outline-none"
              >
                Backup
              </Link>
            ) : null}
            <p className="text-ink-muted hidden text-[0.8125rem] sm:block">
              {name} · <span className="font-mono">{user.role}</span>
            </p>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 md:px-8 md:py-14">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="text-ink text-[clamp(1.625rem,3vw,2.25rem)] leading-[1.1] font-bold tracking-[-0.03em]">
              {isAuthority ? "Authority dashboard" : `Welcome back, ${name}`}
            </h1>
            <p className="text-body mt-2 text-[1rem] leading-[1.55]">
              {isAuthority
                ? "Every report in the register, counted where it stands right now."
                : "The reports you have filed, and where each one has got to."}
            </p>
          </div>
          <Link
            href="/report"
            className="bg-brand hover:bg-brand-hover inline-flex h-12 items-center rounded-xl px-6 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Report an issue
          </Link>
        </div>

        {isAuthority ? <Authority /> : <Citizen />}
      </main>
    </div>
  );
}

/* ── Authority ──────────────────────────────────────────────── */

async function Authority() {
  // Both reads are independent, so they overlap rather than queue.
  const [summary, recent] = await Promise.all([
    getDashboard(),
    listIssues({ limit: 6, offset: 0 }),
  ]);

  const rows: IssueRow[] = recent.issues.map(toPublicIssue);

  const resolutionHint =
    summary.averageResolutionHours === null
      ? "Nothing resolved yet"
      : `Average ${summary.averageResolutionHours} hours from report to resolution`;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Reports in the register" value={summary.total} />
        <Stat
          label="Open"
          value={summary.open}
          hint="Submitted, acknowledged or in progress"
        />
        <Stat
          label="High priority, still open"
          value={summary.highPriority}
          tone={summary.highPriority > 0 ? "danger" : "ink"}
        />
        <Stat
          label="Resolved"
          value={summary.resolved}
          tone="brand"
          hint={resolutionHint}
        />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Reports filed, last 30 days">
          <OverTime data={summary.overTime} />
        </Panel>

        <Panel title="Where reports stand">
          <ul className="divide-line mt-4 divide-y">
            {(
              [
                ["Submitted", summary.submitted],
                ["Acknowledged", summary.acknowledged],
                ["In progress", summary.inProgress],
                ["Resolved", summary.resolved],
                ["Rejected", summary.rejected],
              ] as const
            ).map(([label, count]) => (
              <li
                key={label}
                className="flex items-baseline justify-between py-2.5"
              >
                <span className="text-body text-[0.875rem]">{label}</span>
                <span className="text-ink font-mono text-[0.9375rem] tabular-nums">
                  {count}
                </span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="By category">
          <Categories data={summary.byCategory} />
        </Panel>

        <Panel title="By department">
          <Departments data={summary.byDepartment} />
        </Panel>
      </div>

      <Panel
        title="Latest reports"
        action={{ href: "/issues", label: "See all" }}
        className="mt-6"
      >
        <IssueList
          issues={rows}
          empty="No reports have been filed yet. The first one will appear here as soon as it is."
        />
      </Panel>
    </>
  );
}

/* ── Citizen ────────────────────────────────────────────────── */

async function Citizen() {
  // `mine` resolves against the session inside the service, never a client id.
  const [mine, recent] = await Promise.all([
    listIssues({ mine: true, limit: 20, offset: 0 }),
    listIssues({ limit: 5, offset: 0 }),
  ]);

  const rows: IssueRow[] = mine.issues.map(toPublicIssue);
  const open = rows.filter(
    (issue) =>
      issue.status === "SUBMITTED" ||
      issue.status === "ACKNOWLEDGED" ||
      issue.status === "IN_PROGRESS",
  ).length;
  const resolved = rows.filter((issue) => issue.status === "RESOLVED").length;

  return (
    <>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="Reports you have filed" value={mine.total} />
        <Stat label="Still open" value={open} />
        <Stat label="Resolved" value={resolved} tone="brand" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel title="Your reports" action={{ href: "/track", label: "Track by number" }}>
          <IssueList
            issues={rows}
            empty="You have not filed a report yet. When you do, it appears here with its reference number and its status."
          />
        </Panel>

        <Panel title="Recently filed nearby" action={{ href: "/issues", label: "See all" }}>
          <IssueList
            issues={recent.issues.map(toPublicIssue)}
            empty="Nothing has been reported yet."
          />
        </Panel>
      </div>
    </>
  );
}
