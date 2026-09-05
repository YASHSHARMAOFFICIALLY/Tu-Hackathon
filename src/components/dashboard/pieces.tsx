import Link from "next/link";

import type { IssueCategory, IssueStatus } from "@/db/schema/enums";
import { cn } from "@/lib/utils";

/**
 * Dashboard pieces: status chip, stat tile, the two charts, and an issue row.
 *
 * All server components. Every number rendered here comes from the aggregate
 * query in `modules/dashboard/service.ts` or from `listIssues`; nothing on this
 * screen is a placeholder figure.
 *
 * The charts are inline SVG with `<title>` for the hover text, which is the
 * whole interaction layer. That is a deliberate floor rather than an oversight:
 * a JS tooltip would make this a client component and drag the dashboard's data
 * into the browser bundle for a label that the axis and the direct labels
 * already carry.
 */

/* ── Status ─────────────────────────────────────────────────── */

const STATUS: Record<IssueStatus, { label: string; className: string }> = {
  SUBMITTED: {
    label: "Submitted",
    className: "bg-status-submitted-tint text-status-submitted",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    className: "bg-status-acknowledged-tint text-status-acknowledged",
  },
  IN_PROGRESS: {
    label: "In progress",
    className: "bg-status-progress-tint text-status-progress",
  },
  RESOLVED: {
    label: "Resolved",
    className: "bg-status-resolved-tint text-status-resolved",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-status-rejected-tint text-status-rejected",
  },
};

export function StatusChip({ status }: { status: IssueStatus }) {
  const tone = STATUS[status];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[0.75rem] font-medium",
        tone.className,
      )}
    >
      {tone.label}
    </span>
  );
}

/* ── Categories ─────────────────────────────────────────────── */

/** Fixed order, fixed hue per category. A category filter that removes one must
 *  never repaint the others, which is why this is a map and not an index. */
export const CATEGORY: Record<IssueCategory, { label: string; color: string }> = {
  ROADS: { label: "Roads", color: "var(--cat-roads)" },
  WATER_SUPPLY: { label: "Water supply", color: "var(--cat-water)" },
  ELECTRICITY: { label: "Electricity", color: "var(--cat-electricity)" },
  SANITATION: { label: "Sanitation", color: "var(--cat-sanitation)" },
  PUBLIC_SAFETY: { label: "Public safety", color: "var(--cat-safety)" },
  OTHER: { label: "Other", color: "var(--cat-other)" },
};

/* ── Stat tile ──────────────────────────────────────────────── */

export function Stat({
  label,
  value,
  hint,
  tone = "ink",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "ink" | "brand" | "danger";
}) {
  return (
    <div className="border-line rounded-2xl border bg-white px-5 py-5">
      <p className="text-body text-[0.8125rem]">{label}</p>
      <p
        className={cn(
          "mt-2 font-mono text-[1.75rem] leading-none font-semibold tabular-nums",
          tone === "brand"
            ? "text-brand"
            : tone === "danger"
              ? "text-danger"
              : "text-ink",
        )}
      >
        {value}
      </p>
      {hint ? <p className="text-body mt-2 text-[0.75rem]">{hint}</p> : null}
    </div>
  );
}

/* ── Issues over time ───────────────────────────────────────── */

/**
 * Thirty days of counts as bars. The service returns only the days that have
 * rows, so the gaps are filled here: a missing day is a zero, and drawing it as
 * a gap would compress the axis and misstate the shape.
 */
export function OverTime({
  data,
}: {
  data: { day: string; count: number }[];
}) {
  const byDay = new Map(data.map((d) => [d.day, d.count]));
  const days: { day: string; count: number }[] = [];
  const today = new Date();

  for (let i = 29; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    days.push({ day: key, count: byDay.get(key) ?? 0 });
  }

  const max = Math.max(1, ...days.map((d) => d.count));
  const total = days.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return (
      <Empty>
        No reports in the last thirty days. New reports appear here the day they
        are filed.
      </Empty>
    );
  }

  const W = 640;
  const H = 150;
  const slot = W / days.length;
  const barW = Math.max(4, slot - 4);

  return (
    <figure className="mt-5">
      <svg
        viewBox={`0 0 ${W} ${H + 22}`}
        className="w-full"
        role="img"
        aria-label={`Reports filed per day over the last thirty days. ${total} in total, busiest day ${max}.`}
      >
        {/* Two recessive gridlines, at the maximum and at half of it. */}
        {[0, 0.5].map((f) => (
          <line
            key={f}
            x1="0"
            x2={W}
            y1={H * f}
            y2={H * f}
            stroke="var(--color-line)"
            strokeWidth="1"
          />
        ))}

        {days.map((d, i) => {
          const h = (d.count / max) * H;
          return (
            <rect
              key={d.day}
              x={i * slot + 2}
              y={H - h}
              width={barW}
              height={h}
              rx="2"
              fill="var(--color-brand)"
              opacity={d.count === 0 ? 0.12 : 0.85}
            >
              <title>{`${d.day}: ${d.count}`}</title>
            </rect>
          );
        })}

        <text
          x="0"
          y={H + 16}
          className="fill-body text-[11px]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {days[0].day.slice(5)}
        </text>
        <text
          x={W}
          y={H + 16}
          textAnchor="end"
          className="fill-body text-[11px]"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {days[days.length - 1].day.slice(5)}
        </text>
      </svg>
      <figcaption className="text-body mt-2 text-[0.8125rem]">
        <span className="text-ink font-mono tabular-nums">{total}</span> reports
        filed in the last thirty days, busiest day{" "}
        <span className="text-ink font-mono tabular-nums">{max}</span>.
      </figcaption>
    </figure>
  );
}

/* ── Categories ─────────────────────────────────────────────── */

/**
 * Share of reports by category. A donut answers "which categories dominate",
 * which is the question here, and the legend carries the count and the share so
 * identity is never colour alone.
 */
export function Categories({
  data,
}: {
  data: { category: string; count: number }[];
}) {
  const total = data.reduce((sum, d) => sum + d.count, 0);

  if (total === 0) {
    return <Empty>No reports yet, so there is nothing to break down.</Empty>;
  }

  const R = 60;
  const STROKE = 22;
  const C = 2 * Math.PI * R;

  // Each arc's offset is the sum of everything before it, computed without a
  // running variable: the React compiler rejects a mutation inside a render
  // closure, and a prefix sum over at most six categories costs nothing.
  const arcs = data.map((slice, i) => ({
    ...slice,
    length: (slice.count / total) * C,
    offset:
      (data.slice(0, i).reduce((sum, s) => sum + s.count, 0) / total) * C,
  }));

  return (
    <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-6">
      <svg
        viewBox="0 0 150 150"
        className="size-[150px] shrink-0"
        role="img"
        aria-label={`Reports by category, ${total} in total.`}
      >
        <g transform="rotate(-90 75 75)">
          {arcs.map((slice) => {
            const meta = CATEGORY[slice.category as IssueCategory];
            // 2 units trimmed off each arc: the gap between segments is what
            // keeps two adjacent hues from reading as one band.
            const drawn = Math.max(0, slice.length - 2);
            return (
              <circle
                key={slice.category}
                cx="75"
                cy="75"
                r={R}
                fill="none"
                stroke={meta?.color ?? "var(--cat-other)"}
                strokeWidth={STROKE}
                strokeDasharray={`${drawn} ${C - drawn}`}
                strokeDashoffset={-slice.offset}
              >
                <title>{`${meta?.label ?? slice.category}: ${slice.count}`}</title>
              </circle>
            );
          })}
        </g>
        <text
          x="75"
          y="72"
          textAnchor="middle"
          className="fill-ink text-[20px] font-bold tabular-nums"
          style={{ fontFamily: "var(--font-mono)" }}
        >
          {total}
        </text>
        <text x="75" y="88" textAnchor="middle" className="fill-body text-[10px]">
          reports
        </text>
      </svg>

      <ul className="min-w-[12rem] flex-1 space-y-2">
        {data.map((slice) => {
          const meta = CATEGORY[slice.category as IssueCategory];
          return (
            <li
              key={slice.category}
              className="flex items-center gap-2.5 text-[0.8125rem]"
            >
              <span
                aria-hidden="true"
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: meta?.color ?? "var(--cat-other)" }}
              />
              <span className="text-body">{meta?.label ?? slice.category}</span>
              <span className="text-ink ml-auto font-mono tabular-nums">
                {slice.count}
              </span>
              <span className="text-body w-10 text-right font-mono tabular-nums">
                {Math.round((slice.count / total) * 100)}%
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ── Departments ────────────────────────────────────────────── */

/** Ranked bars: the question is "who is carrying the load", which is a
 *  comparison of magnitudes, so one hue and a shared baseline. */
export function Departments({
  data,
}: {
  data: { department: string; count: number }[];
}) {
  if (data.length === 0) {
    return <Empty>No departments have been created yet.</Empty>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));

  return (
    <ul className="mt-5 space-y-3">
      {data.map((row) => (
        <li key={row.department}>
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-body text-[0.8125rem]">{row.department}</span>
            <span className="text-ink font-mono text-[0.8125rem] tabular-nums">
              {row.count}
            </span>
          </div>
          <div className="bg-canvas border-line mt-1.5 h-2 overflow-hidden rounded-full border">
            <div
              className="bg-brand h-full rounded-full"
              style={{ width: `${(row.count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Issue rows ─────────────────────────────────────────────── */

export type IssueRow = {
  id: string;
  number: number;
  title: string;
  status: IssueStatus;
  category: string;
  address: string;
  createdAt: string | Date;
};

export function IssueList({
  issues,
  empty,
}: {
  issues: IssueRow[];
  empty: React.ReactNode;
}) {
  if (issues.length === 0) return <Empty>{empty}</Empty>;

  return (
    <ul className="divide-line mt-2 divide-y">
      {issues.map((issue) => (
        <li key={issue.id} className="flex items-start gap-4 py-3.5">
          <span className="text-body mt-0.5 w-14 shrink-0 font-mono text-[0.8125rem] tabular-nums">
            #{issue.number}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-ink truncate text-[0.9375rem] font-medium">
              {issue.title}
            </p>
            <p className="text-body mt-0.5 truncate text-[0.8125rem]">
              {CATEGORY[issue.category as IssueCategory]?.label ?? issue.category}{" "}
              · {issue.address}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <StatusChip status={issue.status} />
            <time
              dateTime={new Date(issue.createdAt).toISOString()}
              className="text-body font-mono text-[0.75rem]"
            >
              {new Date(issue.createdAt).toLocaleDateString()}
            </time>
          </div>
        </li>
      ))}
    </ul>
  );
}

/* ── Shared ─────────────────────────────────────────────────── */

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title: string;
  action?: { href: "/issues" | "/report" | "/track"; label: string };
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border-line rounded-2xl border bg-white p-6", className)}>
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-ink text-[1rem] font-bold tracking-[-0.01em]">
          {title}
        </h2>
        {action ? (
          <Link
            href={action.href}
            className="text-brand rounded text-[0.8125rem] font-medium underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            {action.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

/** An empty state says why it is empty and what fills it. "No data" does not. */
function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-line text-body mt-4 rounded-xl border border-dashed px-4 py-6 text-center text-[0.875rem] leading-[1.6]">
      {children}
    </p>
  );
}
