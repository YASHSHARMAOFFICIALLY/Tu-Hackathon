import Link from "next/link";

import { PinIcon } from "@/components/app/icons";
import { PageShell } from "@/components/app/page-shell";
import { CATEGORY, StatusChip } from "@/components/dashboard/pieces";
import { Timeline } from "@/components/issues/timeline";
import type { IssueCategory } from "@/db/schema/enums";
import { getIssueByNumber } from "@/modules/issues/service";
import { toPublicIssue } from "@/modules/issues/serialize";

export const metadata = { title: "Track a report" };

/**
 * Public tracking by reference number. No account, no session, no cookie.
 *
 * A plain `<form method="get">` again: the number lands in the URL, so a
 * tracked report is a link somebody can bookmark or send on, and the page needs
 * no JavaScript to work. Always the public shape — this is the one screen whose
 * payload has to be safe for anyone, so it never widens for an officer.
 */
export default async function TrackPage(props: PageProps<"/track">) {
  const params = await props.searchParams;
  const raw = Array.isArray(params.number) ? params.number[0] : params.number;
  const number = raw ? Number(raw.replace(/^#/, "").trim()) : null;

  const issue =
    number !== null && Number.isFinite(number)
      ? await getIssueByNumber(number)
      : null;
  const view = issue ? toPublicIssue(issue) : null;
  const missed = raw !== undefined && raw !== "" && !view;

  return (
    <PageShell title="Track a report">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-ink text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] font-bold tracking-[-0.03em]">
          Track a report
        </h1>
        <p className="text-body mt-2 max-w-prose text-[0.9375rem] leading-[1.6]">
          Enter the reference number you were given when you filed. It works
          without signing in.
        </p>

        <form
          method="get"
          action="/track"
          className="border-line mt-6 flex flex-wrap gap-3 rounded-2xl border bg-white p-4"
        >
          <label className="min-w-0 flex-1">
            <span className="sr-only">Reference number</span>
            <input
              name="number"
              inputMode="numeric"
              defaultValue={raw ?? ""}
              placeholder="1024"
              className="border-field text-ink placeholder:text-placeholder h-12 w-full rounded-xl border bg-white px-4 font-mono text-[1rem] tabular-nums focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand focus-visible:outline-none"
            />
          </label>
          <button
            type="submit"
            className="bg-brand hover:bg-brand-hover h-12 shrink-0 rounded-xl px-6 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            Track
          </button>
        </form>

        {missed ? (
          <p
            role="status"
            className="border-line text-body mt-5 rounded-2xl border border-dashed px-5 py-6 text-center text-[0.9375rem] leading-[1.6]"
          >
            No report carries the number{" "}
            <span className="text-ink font-mono">#{raw}</span>. Check the digits
            — or{" "}
            <Link
              href="/issues"
              className="text-brand font-medium underline decoration-current/30 underline-offset-4 hover:decoration-current"
            >
              search the register
            </Link>{" "}
            by what you reported.
          </p>
        ) : null}

        {view ? (
          <article className="border-line mt-5 rounded-2xl border bg-white p-6 md:p-8">
            <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
              <div className="min-w-0">
                <p className="text-body font-mono text-[0.8125rem] tabular-nums">
                  #{view.number}
                </p>
                <h2 className="text-ink mt-1 text-[1.25rem] leading-[1.25] font-bold tracking-[-0.02em]">
                  {view.title}
                </h2>
                <p className="text-body mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[0.875rem]">
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{
                        background:
                          CATEGORY[view.category as IssueCategory]?.color ??
                          "var(--cat-other)",
                      }}
                    />
                    {CATEGORY[view.category as IssueCategory]?.label ??
                      view.category}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <PinIcon className="size-4" />
                    {view.address}
                  </span>
                </p>
              </div>
              <StatusChip status={view.status} />
            </div>

            <Timeline entries={view.history ?? []} createdAt={view.createdAt} />

            {view.resolutionNote ? (
              <div className="bg-status-resolved-tint mt-6 rounded-xl p-4">
                <p className="text-status-resolved text-[0.75rem] font-semibold tracking-[0.02em] uppercase">
                  How it was resolved
                </p>
                <p className="text-ink mt-2 text-[0.9375rem] leading-[1.65]">
                  {view.resolutionNote}
                </p>
              </div>
            ) : null}

            <Link
              href={`/issues/${view.id}`}
              className="text-brand mt-6 inline-flex rounded text-[0.875rem] font-medium underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              See the full report
            </Link>
          </article>
        ) : null}
      </div>
    </PageShell>
  );
}
