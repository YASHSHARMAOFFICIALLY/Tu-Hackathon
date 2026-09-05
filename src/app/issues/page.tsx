import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { FilterBar } from "@/components/issues/filter-bar";
import { IssueCards } from "@/components/issues/issue-cards";
import { IssueMap } from "@/components/issues/issue-map";
import { issueCategory, issueStatus } from "@/db/schema/enums";
import { getCurrentUser } from "@/modules/auth/permissions";
import { listDepartments } from "@/modules/departments/service";
import { listIssues } from "@/modules/issues/service";
import { toPublicIssue } from "@/modules/issues/serialize";
import { listIssuesSchema } from "@/modules/issues/validation";

export const metadata = { title: "All issues" };

const PAGE_SIZE = 12;

/**
 * The public register: every report in the city, filterable.
 *
 * The filters live in the URL, not in component state. That is what makes a
 * filtered view something a citizen can send to a councillor, a browser back
 * button behave, and the whole screen a server component with no data in the
 * client bundle.
 *
 * Unparseable parameters are dropped rather than rejected: a hand-edited or
 * stale URL should show the register, not an error page. `listIssuesSchema` is
 * still the only thing that reaches the service, so a crafted parameter cannot
 * widen the query.
 */
export default async function IssuesPage(props: PageProps<"/issues">) {
  const params = await props.searchParams;

  const parsed = listIssuesSchema.safeParse({
    ...flatten(params),
    limit: PAGE_SIZE,
    offset: offsetOf(params, PAGE_SIZE),
  });

  const input = parsed.success
    ? parsed.data
    : { limit: PAGE_SIZE, offset: 0 };

  const [{ issues, total }, departments, user] = await Promise.all([
    listIssues(input),
    listDepartments(),
    getCurrentUser(),
  ]);

  const rows = issues.map(toPublicIssue);
  const page = Math.floor(input.offset / PAGE_SIZE) + 1;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <PageShell title="All issues">
      <div className="mx-auto w-full max-w-6xl">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
          <div>
            <h1 className="text-ink text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] font-bold tracking-[-0.03em]">
              The register
            </h1>
            <p className="text-body mt-2 text-[0.9375rem] leading-[1.55]">
              Every report filed in the city, with the status each one has
              reached. Personal details of reporters are never shown here.
            </p>
          </div>
          <p className="text-body text-[0.875rem]">
            <span className="text-ink font-mono tabular-nums">{total}</span>{" "}
            {total === 1 ? "report" : "reports"} match
          </p>
        </div>

        <FilterBar
          departments={departments}
          statuses={issueStatus.enumValues}
          categories={issueCategory.enumValues}
          values={{
            q: input.q,
            status: input.status,
            category: input.category,
            departmentId: input.departmentId,
          }}
          className="mt-6"
        />

        {/* The map shows exactly what the filters selected — the same page of
            results as the cards below it, not a different query. */}
        {rows.some((issue) => issue.latitude !== null) ? (
          <section className="border-line mt-5 rounded-2xl border bg-white p-5">
            <h2 className="text-ink text-[1rem] font-bold tracking-[-0.01em]">
              These reports on a map
            </h2>
            <IssueMap
              points={rows.map((issue) => ({
                id: issue.id,
                number: issue.number,
                title: issue.title,
                category: issue.category,
                latitude: issue.latitude,
                longitude: issue.longitude,
              }))}
              height={320}
            />
          </section>
        ) : null}

        <IssueCards
          issues={rows}
          className="mt-5"
          empty={
            hasFilters(params)
              ? "No report matches these filters. Clear one and try again."
              : "Nothing has been reported yet. The first report will appear here the moment it is filed."
          }
        />

        {pages > 1 ? (
          <nav
            aria-label="Pages"
            className="mt-8 flex items-center justify-between gap-4"
          >
            <PageLink
              params={params}
              page={page - 1}
              disabled={page <= 1}
              label="Previous"
            />
            <p className="text-body font-mono text-[0.8125rem] tabular-nums">
              {page} / {pages}
            </p>
            <PageLink
              params={params}
              page={page + 1}
              disabled={page >= pages}
              label="Next"
            />
          </nav>
        ) : null}

        {!user ? (
          <p className="border-line text-body mt-8 rounded-2xl border border-dashed px-5 py-4 text-[0.875rem] leading-[1.6]">
            You are browsing anonymously.{" "}
            <Link
              href="/sign-in?redirectTo=/issues"
              className="text-brand font-medium underline decoration-current/30 underline-offset-4 hover:decoration-current"
            >
              Sign in
            </Link>{" "}
            to file a report and follow it through to resolution.
          </p>
        ) : null}
      </div>
    </PageShell>
  );
}

/* ── Search parameters ──────────────────────────────────────── */

type Params = Record<string, string | string[] | undefined>;

/** Next gives repeated parameters as arrays. The schema wants one value. */
function flatten(params: Params) {
  return Object.fromEntries(
    Object.entries(params)
      .map(([key, value]) => [key, Array.isArray(value) ? value[0] : value])
      .filter(([, value]) => value !== undefined && value !== ""),
  );
}

function offsetOf(params: Params, size: number) {
  const raw = Number(Array.isArray(params.page) ? params.page[0] : params.page);
  const page = Number.isFinite(raw) && raw > 1 ? Math.floor(raw) : 1;
  return (page - 1) * size;
}

function hasFilters(params: Params) {
  return ["q", "status", "category", "departmentId"].some((key) => params[key]);
}

function PageLink({
  params,
  page,
  disabled,
  label,
}: {
  params: Params;
  page: number;
  disabled: boolean;
  label: string;
}) {
  if (disabled) {
    return (
      <span className="text-placeholder text-[0.875rem]" aria-hidden="true">
        {label}
      </span>
    );
  }

  const next = new URLSearchParams(flatten(params) as Record<string, string>);
  next.set("page", String(page));

  return (
    <Link
      href={`/issues?${next.toString()}`}
      className="border-field text-ink hover:bg-canvas inline-flex h-10 items-center rounded-lg border bg-white px-4 text-[0.875rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
    >
      {label}
    </Link>
  );
}
