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

const STATUS: Record<
  IssueStatus,
  { label: string; className: string; fill: string }
> = {
  SUBMITTED: {
    label: "Submitted",
    className: "bg-status-submitted-tint text-status-submitted",
    fill: "bg-status-submitted",
  },
  ACKNOWLEDGED: {
    label: "Acknowledged",
    className: "bg-status-acknowledged-tint text-status-acknowledged",
    fill: "bg-status-acknowledged",
  },
  IN_PROGRESS: {
    label: "In progress",
    className: "bg-status-progress-tint text-status-progress",
    fill: "bg-status-progress",
  },
  RESOLVED: {
    label: "Resolved",
    className: "bg-status-resolved-tint text-status-resolved",
    fill: "bg-status-resolved",
  },
  REJECTED: {
    label: "Rejected",
    className: "bg-status-rejected-tint text-status-rejected",
    fill: "bg-status-rejected",
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

/**
 * A tinted tile, an icon on a white disc, the figure, and one line of context.
 *
 * The tint is the card's only edge, matching the bento on the landing page, so
 * the four tiles read as one band rather than four boxes. There is no "+12%
 * this week" here and there will not be: the aggregate query returns a count,
 * not a trend, and a delta with nothing behind it is decoration that lies.
 * `hint` carries a figure the database actually knows.
 */
export function Stat({
  label,
  value,
  hint,
  icon,
  trend,
  spark,
  tint = "mint",
  tone = "ink",
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: React.ReactNode;
  /**
   * Seven days against the seven before them, both measured. Rendered only
   * where the aggregate actually has two windows to compare — a tile that
   * counts a state, not a flow, gets no arrow.
   */
  trend?: { current: number; previous: number };
  /** Daily counts behind the figure, drawn as a sparkline. */
  spark?: number[];
  tint?: "mint" | "sky" | "lilac" | "sand";
  tone?: "ink" | "brand" | "danger";
}) {
  const TINT = {
    mint: "bg-tint-mint",
    sky: "bg-tint-sky",
    lilac: "bg-tint-lilac",
    sand: "bg-tint-sand",
  } as const;

  return (
    <div
      className={cn(
        "rounded-2xl p-5 transition-transform duration-300 motion-safe:hover:-translate-y-0.5",
        TINT[tint],
      )}
    >
      <div className="flex items-center gap-3">
        {icon ? (
          <span className="text-brand flex size-10 shrink-0 items-center justify-center rounded-xl bg-white">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <p
            className={cn(
              "font-mono text-[1.625rem] leading-none font-semibold tabular-nums",
              tone === "brand"
                ? "text-brand"
                : tone === "danger"
                  ? "text-danger"
                  : "text-ink",
            )}
          >
            {value}
          </p>
          <p className="text-body mt-1.5 truncate text-[0.8125rem]">{label}</p>
        </div>
      </div>

      {spark && spark.length > 1 ? (
        <span className="mt-3 block">
          <Spark values={spark} />
        </span>
      ) : null}

      {trend ? <Trend {...trend} /> : null}

      {hint ? (
        <p className="text-body mt-3 text-[0.75rem] leading-[1.5]">{hint}</p>
      ) : null}
    </div>
  );
}

/**
 * The change between two measured windows, stated as a count and a direction.
 *
 * "+3 on the previous 7 days" rather than "+25%": a percentage over small
 * counts overstates, and a change from zero has no percentage at all. The arrow
 * is decoration; the sign is in the text, so direction survives without colour.
 */
function Trend({ current, previous }: { current: number; previous: number }) {
  const delta = current - previous;
  const flat = delta === 0;

  return (
    <p className="text-body mt-3 flex items-center gap-1.5 text-[0.75rem]">
      <span
        aria-hidden="true"
        className={cn(
          "font-mono",
          flat ? "text-body" : delta > 0 ? "text-brand" : "text-status-progress",
        )}
      >
        {flat ? "→" : delta > 0 ? "↑" : "↓"}
      </span>
      <span>
        <span className="text-ink font-medium">
          {flat ? "No change" : `${delta > 0 ? "+" : ""}${delta}`}
        </span>{" "}
        on the previous 7 days
      </span>
    </p>
  );
}

/**
 * A sparkline: shape only, no axis, no labels.
 *
 * It sits beside a figure that already states the total, so its job is the
 * direction of travel at a glance. Drawn as a filled area rather than a line
 * because at 64×28 a 1px stroke reads as noise.
 */
function Spark({ values }: { values: number[] }) {
  const W = 64;
  const H = 28;
  const max = Math.max(1, ...values);
  const step = W / Math.max(1, values.length - 1);

  const points = values.map((v, i) => `${i * step},${H - (v / max) * H}`);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="h-8 w-full"
      aria-hidden="true"
      preserveAspectRatio="none"
    >
      <polygon
        points={`0,${H} ${points.join(" ")} ${W},${H}`}
        className="fill-brand/15"
      />
      <polyline
        points={points.join(" ")}
        fill="none"
        className="stroke-brand"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ── Status band ────────────────────────────────────────────── */

/**
 * Where every report stands, as one stacked bar plus its key.
 *
 * Five separate rows of "label … count" answered "how many are acknowledged"
 * and nothing else. The question an officer actually opens this for is how the
 * register is distributed, which is a part-to-whole, so the parts share a bar.
 * The counts stay in the key: the bar carries the shape, the numbers carry the
 * fact.
 */
export function StatusBand({
  rows,
}: {
  rows: { status: IssueStatus; count: number }[];
}) {
  const total = rows.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return <Empty>No reports have been filed, so there is nothing to divide.</Empty>;
  }

  return (
    <div className="mt-5">
      <div
        className="bg-surface flex h-3 gap-0.5 overflow-hidden rounded-full"
        role="img"
        aria-label={rows
          .map((r) => `${STATUS[r.status].label} ${r.count}`)
          .join(", ")}
      >
        {rows
          .filter((r) => r.count > 0)
          .map((r) => (
            <span
              key={r.status}
              className={STATUS[r.status].fill}
              style={{ width: `${(r.count / total) * 100}%` }}
            >
              <title>{`${STATUS[r.status].label}: ${r.count}`}</title>
            </span>
          ))}
      </div>

      <ul className="divide-line mt-4 divide-y">
        {rows.map((r) => (
          <li
            key={r.status}
            className="flex items-center gap-3 py-2.5 text-[0.875rem]"
          >
            <span
              aria-hidden="true"
              className={cn("size-2.5 shrink-0 rounded-full", STATUS[r.status].fill)}
            />
            <span className="text-body">{STATUS[r.status].label}</span>
            <span className="text-ink ml-auto font-mono tabular-nums">
              {r.count}
            </span>
            <span className="text-body w-10 text-right font-mono text-[0.8125rem] tabular-nums">
              {Math.round((r.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Secondary figures, on one white strip.
 *
 * These answer "how is the system itself doing" rather than "how many reports
 * are there", so they are deliberately quieter than the tinted tiles above:
 * four more coloured cards would flatten the hierarchy and leave the page with
 * no primary row at all.
 */
export function Signals({
  items,
}: {
  items: { label: string; value: string | number; hint?: string }[];
}) {
  return (
    <dl className="border-line divide-line mt-4 grid divide-y rounded-2xl border bg-white sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-4 lg:divide-x">
      {items.map((item) => (
        <div key={item.label} className="px-5 py-4">
          <dt className="text-body text-[0.8125rem]">{item.label}</dt>
          <dd className="text-ink mt-1.5 font-mono text-[1.25rem] leading-none font-semibold tabular-nums">
            {item.value}
          </dd>
          {item.hint ? (
            <p className="text-body mt-2 text-[0.75rem] leading-[1.5]">
              {item.hint}
            </p>
          ) : null}
        </div>
      ))}
    </dl>
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
  // Taller than the 150 it started at: the panel beside it is a five-row list,
  // and a short chart left a band of empty card under the bars.
  const H = 200;
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

/**
 * Who is carrying the load, ranked.
 *
 * One hue per department, assigned by rank rather than by name, so the busiest
 * department is always the same colour as the busiest bar in the chart above
 * it. The count and the share sit on the row: the bar is the comparison, the
 * numbers are the fact.
 */
const DEPARTMENT_HUES = [
  "var(--cat-roads)",
  "var(--cat-water)",
  "var(--cat-electricity)",
  "var(--cat-sanitation)",
  "var(--cat-safety)",
  "var(--cat-other)",
];

export function Departments({
  data,
}: {
  data: { department: string; count: number }[];
}) {
  if (data.length === 0) {
    return <Empty>No departments have been created yet.</Empty>;
  }

  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((sum, d) => sum + d.count, 0);

  return (
    <ul className="mt-5 space-y-3.5">
      {data.map((row, i) => {
        const hue = DEPARTMENT_HUES[i % DEPARTMENT_HUES.length];
        return (
          <li key={row.department} className="grid grid-cols-[7.5rem_1fr_auto] items-center gap-3">
            <span className="text-body truncate text-[0.8125rem]">
              {row.department}
            </span>
            <span className="bg-surface h-2.5 overflow-hidden rounded-full">
              <span
                className="block h-full rounded-full transition-[width] duration-500"
                style={{ width: `${(row.count / max) * 100}%`, background: hue }}
              />
            </span>
            <span className="text-ink w-14 text-right font-mono text-[0.8125rem] tabular-nums">
              {row.count}
              <span className="text-body">
                {total > 0 ? ` ${Math.round((row.count / total) * 100)}%` : ""}
              </span>
            </span>
          </li>
        );
      })}
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
  attachments?: { id: string; url: string; fileType: string | null }[];
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
      {issues.map((issue) => {
        const meta = CATEGORY[issue.category as IssueCategory];
        const photo = issue.attachments?.find((a) =>
          a.fileType?.startsWith("image/"),
        );

        return (
          <li key={issue.id}>
            {/* The whole row is the link. A title-only target inside a row this
                tall is a small target surrounded by dead space. */}
            <Link
              href={`/issues/${issue.id}`}
              className="hover:bg-surface -mx-2 flex items-center gap-3.5 rounded-xl px-2 py-3 transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              {photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photo.url}
                  alt=""
                  loading="lazy"
                  className="border-line size-11 shrink-0 rounded-xl border object-cover"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl"
                  style={{
                    background: `color-mix(in srgb, ${meta?.color ?? "var(--cat-other)"} 14%, white)`,
                    color: meta?.color ?? "var(--cat-other)",
                  }}
                >
                  <span className="font-mono text-[0.6875rem] tabular-nums">
                    {issue.number}
                  </span>
                </span>
              )}

              <span className="min-w-0 flex-1">
                <span className="text-ink block truncate text-[0.9375rem] font-medium">
                  {issue.title}
                </span>
                <span className="text-body mt-0.5 block truncate text-[0.8125rem]">
                  {meta?.label ?? issue.category} · {issue.address}
                </span>
              </span>

              <span className="flex shrink-0 flex-col items-end gap-1">
                <StatusChip status={issue.status} />
                <time
                  dateTime={new Date(issue.createdAt).toISOString()}
                  className="text-body font-mono text-[0.75rem]"
                >
                  {new Date(issue.createdAt).toLocaleDateString()}
                </time>
              </span>
            </Link>
          </li>
        );
      })}
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
