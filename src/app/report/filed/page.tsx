import Link from "next/link";
import { notFound } from "next/navigation";

import { CheckIcon } from "@/components/app/icons";
import { PageShell } from "@/components/app/page-shell";

export const metadata = { title: "Report filed" };

/**
 * The receipt.
 *
 * The reference number is the thing the citizen has to leave with, so it is the
 * largest element on the page and it is selectable text rather than an image or
 * a toast that disappears. The tracker accepts it without an account, which is
 * the whole point of printing it this size.
 */
export default async function FiledPage(props: PageProps<"/report/filed">) {
  const params = await props.searchParams;
  const number = Array.isArray(params.number) ? params.number[0] : params.number;
  const id = Array.isArray(params.id) ? params.id[0] : params.id;

  // Reached without a number means someone typed the URL. There is no receipt
  // to show, and inventing one would be worse than a 404.
  if (!number) notFound();

  return (
    <PageShell title="Report filed">
      <div className="mx-auto w-full max-w-2xl">
        <div className="border-line rounded-2xl border bg-white p-8 text-center md:p-10">
          <span className="bg-brand-tint text-brand mx-auto flex size-14 items-center justify-center rounded-full">
            <CheckIcon className="size-7" />
          </span>

          <h1 className="text-ink mt-6 text-[clamp(1.5rem,2.6vw,2rem)] leading-[1.1] font-bold tracking-[-0.03em]">
            Filed. It is on the register.
          </h1>
          <p className="text-body mx-auto mt-3 max-w-prose text-[0.9375rem] leading-[1.65]">
            Keep this reference number. It is all the tracker needs — no account,
            no email, no link to click.
          </p>

          <p className="bg-surface text-ink mt-7 rounded-2xl py-6 font-mono text-[2.5rem] leading-none font-semibold tabular-nums select-all">
            #{number}
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link
              href={`/track?number=${number}`}
              className="bg-brand hover:bg-brand-hover inline-flex h-12 items-center rounded-xl px-6 text-[0.9375rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              Track this report
            </Link>
            {id ? (
              <Link
                href={`/issues/${id}`}
                className="border-field text-ink hover:bg-canvas inline-flex h-12 items-center rounded-xl border bg-white px-5 text-[0.9375rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                See it on the register
              </Link>
            ) : null}
          </div>
        </div>

        <p className="text-body mt-6 text-center text-[0.875rem] leading-[1.6]">
          Filed something else?{" "}
          <Link
            href="/report"
            className="text-brand font-medium underline decoration-current/30 underline-offset-4 hover:decoration-current"
          >
            Report another issue
          </Link>
          .
        </p>
      </div>
    </PageShell>
  );
}
