import type { IssueEvent, IssueStatus } from "@/db/schema/enums";

/**
 * The progress timeline: the four stages the brief names, plus whatever else
 * actually happened to this report.
 *
 * Two things are shown at once and they are different in kind. The stages are
 * the promise — Submitted, Acknowledged, In progress, Resolved — and a stage
 * with no history entry is drawn unreached rather than hidden, because "we have
 * not got there yet" is the answer the citizen came for. The entries are the
 * record: assignments, priority changes, a duplicate link.
 *
 * Rejected is not a fifth stage. It ends the run, so it replaces the tail
 * instead of pretending resolution is still coming.
 */
const STAGES: { status: IssueStatus; label: string; blurb: string }[] = [
  { status: "SUBMITTED", label: "Submitted", blurb: "Report filed by a citizen." },
  {
    status: "ACKNOWLEDGED",
    label: "Acknowledged",
    blurb: "Seen by the municipal office.",
  },
  {
    status: "IN_PROGRESS",
    label: "In progress",
    blurb: "Work assigned to a department.",
  },
  { status: "RESOLVED", label: "Resolved", blurb: "Reported as fixed." },
];

const EVENT_LABEL: Record<IssueEvent, string> = {
  CREATED: "Report created",
  STATUS_CHANGED: "Status changed",
  ASSIGNED: "Assigned",
  PRIORITY_CHANGED: "Priority changed",
  DEPARTMENT_CHANGED: "Department changed",
  DUPLICATE_LINKED: "Linked to an existing report",
  COMMENTED: "Update posted",
};

export type TimelineEntry = {
  event: IssueEvent;
  oldStatus: IssueStatus | null;
  newStatus: IssueStatus | null;
  note: string | null;
  createdAt: string | Date;
};

export function Timeline({
  entries,
  createdAt,
}: {
  entries: TimelineEntry[];
  createdAt: string | Date;
}) {
  // Oldest first: a timeline read top to bottom is a chronology.
  const ordered = [...entries].sort(
    (a, b) => +new Date(a.createdAt) - +new Date(b.createdAt),
  );

  const reachedAt = new Map<IssueStatus, Date>();
  reachedAt.set("SUBMITTED", new Date(createdAt));
  for (const entry of ordered) {
    if (entry.newStatus && !reachedAt.has(entry.newStatus)) {
      reachedAt.set(entry.newStatus, new Date(entry.createdAt));
    }
  }

  const rejected = reachedAt.has("REJECTED");
  const stages = rejected
    ? [
        ...STAGES.filter((s) => reachedAt.has(s.status)),
        {
          status: "REJECTED" as const,
          label: "Rejected",
          blurb: "Closed without work. The report is kept on the register.",
        },
      ]
    : STAGES;

  const extras = ordered.filter(
    (entry) => entry.event !== "CREATED" && entry.event !== "STATUS_CHANGED",
  );

  return (
    <div className="mt-4">
      <ol className="relative">
        {stages.map((stage, i) => {
          const at = reachedAt.get(stage.status);
          const last = i === stages.length - 1;

          return (
            <li key={stage.status} className="relative flex gap-4 pb-6 last:pb-0">
              {/* The connector stops at the last node rather than trailing off
                  into the padding. */}
              {last ? null : (
                <span
                  aria-hidden="true"
                  className={
                    at
                      ? "bg-brand/30 absolute top-4 left-[7px] h-full w-px"
                      : "bg-line absolute top-4 left-[7px] h-full w-px"
                  }
                />
              )}

              <span
                aria-hidden="true"
                className={
                  at
                    ? "bg-brand relative mt-1 size-[15px] shrink-0 rounded-full ring-4 ring-white"
                    : "border-field relative mt-1 size-[15px] shrink-0 rounded-full border-2 bg-white"
                }
              />

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-baseline gap-x-3">
                  <span
                    className={
                      at
                        ? "text-ink text-[0.9375rem] font-semibold"
                        : "text-body text-[0.9375rem] font-medium"
                    }
                  >
                    {stage.label}
                  </span>
                  {at ? (
                    <time
                      dateTime={at.toISOString()}
                      className="text-body font-mono text-[0.75rem] tabular-nums"
                    >
                      {at.toLocaleDateString()}{" "}
                      {at.toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </time>
                  ) : (
                    <span className="text-placeholder text-[0.75rem]">
                      Pending
                    </span>
                  )}
                </p>
                <p className="text-body mt-1 text-[0.8125rem] leading-[1.55]">
                  {stage.blurb}
                </p>
              </div>
            </li>
          );
        })}
      </ol>

      {extras.length > 0 ? (
        <ul className="divide-line border-line mt-5 divide-y border-t pt-2">
          {extras.map((entry, i) => (
            <li key={`${entry.event}-${i}`} className="py-2.5">
              <p className="text-body flex items-baseline justify-between gap-4 text-[0.8125rem]">
                <span className="text-ink font-medium">
                  {EVENT_LABEL[entry.event]}
                </span>
                <time
                  dateTime={new Date(entry.createdAt).toISOString()}
                  className="font-mono text-[0.75rem] tabular-nums"
                >
                  {new Date(entry.createdAt).toLocaleDateString()}
                </time>
              </p>
              {entry.note ? (
                <p className="text-body mt-1 text-[0.8125rem] leading-[1.55]">
                  {entry.note}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
