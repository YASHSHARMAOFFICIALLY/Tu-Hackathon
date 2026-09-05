import Link from "next/link";
import { redirect } from "next/navigation";

import {
  AlertIcon,
  CheckIcon,
  ClockIcon,
  ListIcon,
  ReportIcon,
} from "@/components/app/icons";
import { AppShell, type NavItem } from "@/components/app/shell";
import {
  Categories,
  Departments,
  IssueList,
  OverTime,
  Panel,
  Stat,
  StatusBand,
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
 * Both sit inside `AppShell`, which is the rail every signed-in screen shares.
 * The nav is built here rather than inside the shell because it is role-shaped:
 * the backup console is an admin tool and a citizen must not see a link to a
 * page that will refuse them.
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

  const nav: NavItem[] = [
    { href: "/", label: "Home", icon: "home" },
    { href: "/dashboard", label: "Dashboard", icon: "chart" },
    { href: "/report", label: "Report an issue", icon: "report" },
    { href: "/issues", label: "All issues", icon: "list" },
    { href: "/track", label: "Track a report", icon: "pin" },
    ...(user.role === "ADMIN"
      ? [{ href: "/admin/backup", label: "Backup", icon: "archive" } as const]
      : []),
  ];

  return (
    <AppShell nav={nav} user={{ name, role: user.role }} title="Dashboard">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="text-ink text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] font-bold tracking-[-0.03em]">
              {greeting()}, {name.split(" ")[0]}
            </h1>
            <p className="text-body mt-2 text-[0.9375rem] leading-[1.55]">
              {isAuthority
                ? "Every report in the register, counted where it stands right now."
                : "The reports you have filed, and where each one has got to."}
            </p>
          </div>
          {/* The rail already carries "report an issue" in brand green, so this
              is not a second copy of it: an officer's next move is the
              register, a citizen's is the form. */}
          {isAuthority ? (
            <Link
              href="/issues"
              className="border-field text-ink hover:bg-canvas inline-flex h-11 items-center gap-2 rounded-xl border bg-white px-5 text-[0.9375rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <ListIcon className="size-[18px]" />
              Open the register
            </Link>
          ) : (
            <Link
              href="/report"
              className="bg-brand hover:bg-brand-hover inline-flex h-11 items-center gap-2 rounded-xl px-5 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              <ReportIcon className="size-[18px]" />
              Report an issue
            </Link>
          )}
        </div>

        {isAuthority ? <Authority /> : <Citizen />}
      </div>
    </AppShell>
  );
}

/** Server-rendered, so this is the server's hour. Close enough for a greeting,
 *  and a client component for it would cost a hydration boundary. */
function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
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

  const share = (n: number) =>
    summary.total === 0
      ? undefined
      : `${Math.round((n / summary.total) * 100)}% of the register`;

  return (
    <>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat
          label="Reports in the register"
          value={summary.total}
          icon={<ReportIcon className="size-5" />}
          tint="mint"
          hint="Every report ever filed, in any state"
        />
        <Stat
          label="Open"
          value={summary.open}
          icon={<ClockIcon className="size-5" />}
          tint="sand"
          hint={share(summary.open) ?? "Submitted, acknowledged or in progress"}
        />
        <Stat
          label="High priority, still open"
          value={summary.highPriority}
          icon={<AlertIcon className="size-5" />}
          tint="lilac"
          tone={summary.highPriority > 0 ? "danger" : "ink"}
          hint={
            summary.highPriority > 0
              ? "Waiting on a department right now"
              : "Nothing urgent is outstanding"
          }
        />
        <Stat
          label="Resolved"
          value={summary.resolved}
          icon={<CheckIcon className="size-5" />}
          tint="sky"
          tone="brand"
          hint={resolutionHint}
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Panel title="Reports filed, last 30 days">
          <OverTime data={summary.overTime} />
        </Panel>

        <Panel title="Where reports stand">
          <StatusBand
            rows={[
              { status: "SUBMITTED", count: summary.submitted },
              { status: "ACKNOWLEDGED", count: summary.acknowledged },
              { status: "IN_PROGRESS", count: summary.inProgress },
              { status: "RESOLVED", count: summary.resolved },
              { status: "REJECTED", count: summary.rejected },
            ]}
          />
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
        className="mt-5"
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
      <div className="mt-7 grid gap-4 sm:grid-cols-3">
        <Stat
          label="Reports you have filed"
          value={mine.total}
          icon={<ReportIcon className="size-5" />}
          tint="mint"
        />
        <Stat
          label="Still open"
          value={open}
          icon={<ClockIcon className="size-5" />}
          tint="sand"
        />
        <Stat
          label="Resolved"
          value={resolved}
          icon={<CheckIcon className="size-5" />}
          tint="sky"
          tone="brand"
        />
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Panel
          title="Your reports"
          action={{ href: "/track", label: "Track by number" }}
        >
          <IssueList
            issues={rows}
            empty="You have not filed a report yet. When you do, it appears here with its reference number and its status."
          />
        </Panel>

        <Panel
          title="Recently filed nearby"
          action={{ href: "/issues", label: "See all" }}
        >
          <IssueList
            issues={recent.issues.map(toPublicIssue)}
            empty="Nothing has been reported yet."
          />
        </Panel>
      </div>
    </>
  );
}
