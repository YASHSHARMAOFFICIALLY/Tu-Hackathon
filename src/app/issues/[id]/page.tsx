import Link from "next/link";
import { notFound } from "next/navigation";

import { PinIcon } from "@/components/app/icons";
import { PageShell } from "@/components/app/page-shell";
import { CATEGORY, StatusChip } from "@/components/dashboard/pieces";
import { Timeline } from "@/components/issues/timeline";
import type { IssueCategory } from "@/db/schema/enums";
import { NotFoundError } from "@/lib/http";
import { getCurrentUser } from "@/modules/auth/permissions";
import { getIssue, listIssues } from "@/modules/issues/service";
import { toAuthorityIssue, toPublicIssue } from "@/modules/issues/serialize";

export const metadata = { title: "Report" };

/**
 * One report, in public.
 *
 * The serialiser decides what this page is allowed to know: an officer gets
 * `toAuthorityIssue` (reporter identity, internal notes, exact coordinates), a
 * citizen or an anonymous visitor gets `toPublicIssue`. The page never reaches
 * past that boundary to the row itself, so a field added to `issues` cannot
 * leak here by default.
 *
 * A bad id is a 404 rather than a 500: `getIssue` throws `NotFoundError`, and
 * an unknown UUID in a shared link is an ordinary thing, not a fault.
 */
export default async function IssuePage(props: PageProps<"/issues/[id]">) {
  const { id } = await props.params;

  const [user, issue] = await Promise.all([
    getCurrentUser(),
    getIssue(id).catch((error) => {
      if (error instanceof NotFoundError) return null;
      throw error;
    }),
  ]);

  if (!issue) notFound();

  const isAuthority = user?.role === "OFFICER" || user?.role === "ADMIN";
  const view = isAuthority ? toAuthorityIssue(issue) : toPublicIssue(issue);
  const meta = CATEGORY[view.category as IssueCategory];

  // Other open reports in the same category, which is what "similar" can mean
  // honestly without re-running the embedding search on every page view.
  const { issues: related } = await listIssues({
    category: view.category,
    limit: 4,
    offset: 0,
  });
  const nearby = related.filter((r) => r.id !== issue.id).slice(0, 3);

  const photos =
    view.attachments?.filter((a) => a.fileType?.startsWith("image/")) ?? [];

  return (
    <PageShell title={`Report #${view.number}`}>
      <div className="mx-auto w-full max-w-5xl">
        <Link
          href="/issues"
          className="text-body hover:text-ink inline-flex items-center gap-1.5 rounded text-[0.875rem] transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          ← Back to the register
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-ink text-[clamp(1.375rem,2.2vw,1.875rem)] leading-[1.15] font-bold tracking-[-0.03em]">
                {view.title}
              </h1>
              <StatusChip status={view.status} />
            </div>
            <p className="text-body mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem]">
              <span className="font-mono tabular-nums">#{view.number}</span>
              <span className="inline-flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full"
                  style={{ background: meta?.color ?? "var(--cat-other)" }}
                />
                {meta?.label ?? view.category}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <PinIcon className="size-4" />
                {view.address}
              </span>
            </p>
          </div>

          <Link
            href={`/track?number=${view.number}`}
            className="border-field text-ink hover:bg-canvas inline-flex h-11 items-center rounded-xl border bg-white px-5 text-[0.875rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Track this report
          </Link>
        </div>

        <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex flex-col gap-5">
            {photos.length > 0 ? (
              <ul className="grid gap-3 sm:grid-cols-2">
                {photos.map((photo) => (
                  <li key={photo.id}>
                    {/* Reporter-supplied URL: served as-is rather than through
                        the image optimiser, which would fetch arbitrary hosts
                        on the server's behalf. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={photo.url}
                      alt={`Evidence attached to report #${view.number}`}
                      loading="lazy"
                      className="border-line h-52 w-full rounded-2xl border object-cover"
                    />
                  </li>
                ))}
              </ul>
            ) : null}

            <section className="border-line rounded-2xl border bg-white p-6">
              <h2 className="text-ink text-[1rem] font-bold tracking-[-0.01em]">
                What was reported
              </h2>
              <p className="text-body mt-3 text-[0.9375rem] leading-[1.7] whitespace-pre-wrap">
                {view.description}
              </p>

              {view.resolutionNote ? (
                <div className="bg-status-resolved-tint mt-5 rounded-xl p-4">
                  <p className="text-status-resolved text-[0.75rem] font-semibold tracking-[0.02em] uppercase">
                    How it was resolved
                  </p>
                  <p className="text-ink mt-2 text-[0.9375rem] leading-[1.65]">
                    {view.resolutionNote}
                  </p>
                </div>
              ) : null}
            </section>

            <section className="border-line rounded-2xl border bg-white p-6">
              <h2 className="text-ink text-[1rem] font-bold tracking-[-0.01em]">
                Progress
              </h2>
              <Timeline
                entries={view.history ?? []}
                createdAt={view.createdAt}
              />
            </section>

            {view.comments && view.comments.length > 0 ? (
              <section className="border-line rounded-2xl border bg-white p-6">
                <h2 className="text-ink text-[1rem] font-bold tracking-[-0.01em]">
                  Updates
                </h2>
                <ul className="divide-line mt-3 divide-y">
                  {view.comments.map((comment) => (
                    <li key={comment.id} className="py-3.5">
                      <p className="text-body text-[0.8125rem]">
                        <span className="text-ink font-medium">
                          {comment.author?.name ?? "Municipal office"}
                        </span>{" "}
                        ·{" "}
                        <time
                          dateTime={new Date(comment.createdAt).toISOString()}
                        >
                          {new Date(comment.createdAt).toLocaleDateString()}
                        </time>
                      </p>
                      <p className="text-ink mt-1.5 text-[0.9375rem] leading-[1.6]">
                        {comment.body}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>

          <div className="flex flex-col gap-5">
            <section className="border-line rounded-2xl border bg-white p-6">
              <h2 className="text-ink text-[1rem] font-bold tracking-[-0.01em]">
                Details
              </h2>
              <dl className="divide-line mt-3 divide-y text-[0.875rem]">
                <Row label="Department" value={view.department?.name ?? "Unassigned"} />
                <Row label="Priority" value={title(view.priority)} />
                <Row
                  label="Reported"
                  value={new Date(view.createdAt).toLocaleDateString()}
                />
                <Row
                  label="Resolved"
                  value={
                    view.resolvedAt
                      ? new Date(view.resolvedAt).toLocaleDateString()
                      : "Not yet"
                  }
                />
                {isAuthority ? (
                  <Row
                    label="Reported by"
                    value={
                      "reportedBy" in view && view.reportedBy
                        ? (view.reportedBy as { name: string }).name
                        : "Account removed"
                    }
                  />
                ) : null}
              </dl>
            </section>

            {nearby.length > 0 ? (
              <section className="border-line rounded-2xl border bg-white p-6">
                <h2 className="text-ink text-[1rem] font-bold tracking-[-0.01em]">
                  Also in {meta?.label ?? "this category"}
                </h2>
                <ul className="divide-line mt-2 divide-y">
                  {nearby.map((other) => (
                    <li key={other.id}>
                      <Link
                        href={`/issues/${other.id}`}
                        className="hover:bg-surface -mx-2 flex items-start gap-3 rounded-lg px-2 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="text-ink block truncate text-[0.875rem] font-medium">
                            {other.title}
                          </span>
                          <span className="text-body mt-0.5 block truncate text-[0.75rem]">
                            {other.address}
                          </span>
                        </span>
                        <StatusChip status={other.status} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </PageShell>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="text-body">{label}</dt>
      <dd className="text-ink text-right font-medium">{value}</dd>
    </div>
  );
}

/** `IN_PROGRESS` → `In progress`. */
function title(value: string) {
  const words = value.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
