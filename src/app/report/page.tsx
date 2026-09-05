import Link from "next/link";

import { PageShell } from "@/components/app/page-shell";
import { ReportForm } from "@/components/issues/report-form";
import { getCurrentUser } from "@/modules/auth/permissions";

export const metadata = { title: "Report an issue" };

/**
 * Filing a report.
 *
 * Signed-in only, because `createIssue` attributes the report to a person: an
 * anonymous report cannot be tracked back to its reporter, and the tracker is
 * half the product. Rather than bouncing to the sign-in page, this explains
 * why first — a redirect from a form the citizen has not seen yet reads as a
 * wall, and the register underneath is public either way.
 */
export default async function ReportPage() {
  const user = await getCurrentUser();

  return (
    <PageShell title="Report an issue">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-ink text-[clamp(1.5rem,2.4vw,2rem)] leading-[1.1] font-bold tracking-[-0.03em]">
          Report an issue
        </h1>
        <p className="text-body mt-2 max-w-prose text-[0.9375rem] leading-[1.6]">
          Four fields and it is on the register with a reference number. It goes
          to the department that owns the category, and every status change after
          that is public.
        </p>

        {user ? (
          <div className="mt-6">
            <ReportForm />
          </div>
        ) : (
          <div className="border-line mt-6 rounded-2xl border bg-white p-6 md:p-8">
            <h2 className="text-ink text-[1.0625rem] font-bold tracking-[-0.01em]">
              Sign in to file a report
            </h2>
            <p className="text-body mt-2 max-w-prose text-[0.9375rem] leading-[1.65]">
              A report is tied to the person who filed it, so you can follow it
              and be told when it moves. Your name is never shown on the public
              register — only the status is.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                href="/sign-in?redirectTo=/report"
                className="bg-brand hover:bg-brand-hover inline-flex h-12 items-center rounded-xl px-6 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Sign in
              </Link>
              <Link
                href="/issues"
                className="border-field text-ink hover:bg-canvas inline-flex h-12 items-center rounded-xl border bg-white px-5 text-[0.9375rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                Browse the register
              </Link>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
