import Link from "next/link";

import { PinIcon } from "@/components/app/icons";
import { CATEGORY, StatusChip } from "@/components/dashboard/pieces";
import type { IssueCategory, IssueStatus } from "@/db/schema/enums";
import { cn } from "@/lib/utils";

/**
 * The register as cards.
 *
 * A card rather than a table row because the register is browsed, not audited:
 * the photograph, the place and the state are what a citizen scans for, and a
 * table would spend its width on columns nobody reads twice.
 *
 * The photograph is the reporter's own evidence when there is one. When there
 * is not, the card falls back to the category hue rather than a grey box or a
 * stock image — an empty frame is honest, a borrowed photograph is not.
 */
export type CardIssue = {
  id: string;
  number: number;
  title: string;
  status: IssueStatus;
  category: string;
  address: string;
  createdAt: string | Date;
  attachments?: { id: string; url: string; fileType: string | null }[];
};

export function IssueCards({
  issues,
  empty,
  className,
}: {
  issues: CardIssue[];
  empty: React.ReactNode;
  className?: string;
}) {
  if (issues.length === 0) {
    return (
      <p
        className={cn(
          "border-line text-body rounded-2xl border border-dashed bg-white px-5 py-14 text-center text-[0.9375rem] leading-[1.6]",
          className,
        )}
      >
        {empty}
      </p>
    );
  }

  return (
    <ul className={cn("grid gap-4 sm:grid-cols-2 lg:grid-cols-3", className)}>
      {issues.map((issue) => {
        const meta = CATEGORY[issue.category as IssueCategory];
        const photo = issue.attachments?.find((a) =>
          a.fileType?.startsWith("image/"),
        );

        return (
          <li key={issue.id}>
            <Link
              href={`/issues/${issue.id}`}
              className="border-line group focus-visible:ring-brand block h-full overflow-hidden rounded-2xl border bg-white transition-shadow duration-300 hover:shadow-[0_12px_28px_-18px_rgb(22_36_29/0.45)] focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {/* No photo means no frame. A 144px placeholder on every card
                  was empty space pretending to be content; the category rule
                  along the top carries the same colour in 3px. */}
              {photo ? (
                <div className="relative flex h-36 items-end overflow-hidden">
                  {/* Reporter-supplied URLs point anywhere, so this stays a
                      plain <img>: routing arbitrary hosts through the Next
                      image optimiser would make the app fetch on their
                      behalf. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo.url}
                    alt=""
                    loading="lazy"
                    className="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                  <span className="relative m-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-[0.6875rem] font-medium backdrop-blur">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: meta?.color ?? "var(--cat-other)" }}
                    />
                    {meta?.label ?? issue.category}
                  </span>
                </div>
              ) : (
                <span
                  aria-hidden="true"
                  className="block h-[3px] w-full"
                  style={{ background: meta?.color ?? "var(--cat-other)" }}
                />
              )}

              <div className="p-4">
                {photo ? null : (
                  <p className="text-body mb-2.5 inline-flex items-center gap-1.5 text-[0.6875rem] font-medium tracking-[0.02em] uppercase">
                    <span
                      aria-hidden="true"
                      className="size-2 rounded-full"
                      style={{ background: meta?.color ?? "var(--cat-other)" }}
                    />
                    {meta?.label ?? issue.category}
                  </p>
                )}
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-ink line-clamp-2 text-[0.9375rem] leading-[1.35] font-semibold">
                    {issue.title}
                  </h3>
                  <StatusChip status={issue.status} />
                </div>

                <p className="text-body mt-2 flex items-center gap-1.5 truncate text-[0.8125rem]">
                  <PinIcon className="size-3.5 shrink-0" />
                  {issue.address}
                </p>

                <p className="text-body mt-3 flex items-center justify-between font-mono text-[0.75rem] tabular-nums">
                  <span>#{issue.number}</span>
                  <time dateTime={new Date(issue.createdAt).toISOString()}>
                    {new Date(issue.createdAt).toLocaleDateString()}
                  </time>
                </p>
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
