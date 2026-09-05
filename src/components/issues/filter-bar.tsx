import Link from "next/link";

import { CATEGORY } from "@/components/dashboard/pieces";
import type { IssueCategory, IssueStatus } from "@/db/schema/enums";
import { cn } from "@/lib/utils";

/**
 * The register's filter bar.
 *
 * A plain `<form method="get">`. No client component, no state, no JavaScript:
 * the browser turns the fields into the query string the page already reads,
 * which means the filters work with scripting off and every filtered view is a
 * URL somebody can send to someone else.
 *
 * The cost is one press of "Apply" rather than filtering on change. That is the
 * right trade here — an auto-submitting select would need a client boundary
 * around the whole bar to save a click.
 */
const STATUS_LABEL: Record<IssueStatus, string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledged",
  IN_PROGRESS: "In progress",
  RESOLVED: "Resolved",
  REJECTED: "Rejected",
};

const FIELD =
  "border-field text-ink placeholder:text-placeholder h-11 w-full rounded-xl border bg-white px-3.5 text-[0.875rem] focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand focus-visible:outline-none";

export function FilterBar({
  departments,
  statuses,
  categories,
  /** The filters currently in the URL, so the controls show what is applied. */
  values,
  className,
}: {
  departments: { id: string; name: string }[];
  statuses: readonly IssueStatus[];
  categories: readonly IssueCategory[];
  values: {
    q?: string;
    status?: string;
    category?: string;
    departmentId?: string;
  };
  className?: string;
}) {
  return (
    <form
      method="get"
      action="/issues"
      className={cn(
        "border-line grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto]",
        className,
      )}
    >
      <label className="block">
        <span className="text-body mb-1.5 block text-[0.75rem] font-medium">
          Search
        </span>
        <input
          type="search"
          name="q"
          placeholder="Pothole, street light, an address…"
          defaultValue={values.q ?? ""}
          className={FIELD}
        />
      </label>

      <label className="block">
        <span className="text-body mb-1.5 block text-[0.75rem] font-medium">
          Status
        </span>
        <select name="status" className={FIELD} defaultValue={values.status ?? ""}>
          <option value="">All statuses</option>
          {statuses.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABEL[status]}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-body mb-1.5 block text-[0.75rem] font-medium">
          Category
        </span>
        <select name="category" className={FIELD} defaultValue={values.category ?? ""}>
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>
              {CATEGORY[category].label}
            </option>
          ))}
        </select>
      </label>

      <label className="block">
        <span className="text-body mb-1.5 block text-[0.75rem] font-medium">
          Department
        </span>
        <select
          name="departmentId"
          className={FIELD}
          defaultValue={values.departmentId ?? ""}
        >
          <option value="">All departments</option>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.name}
            </option>
          ))}
        </select>
      </label>

      <div className="flex items-end gap-2">
        <button
          type="submit"
          className="bg-brand hover:bg-brand-hover h-11 rounded-xl px-5 text-[0.875rem] font-medium text-white transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          Apply
        </button>
        <Link
          href="/issues"
          className="text-body hover:text-ink inline-flex h-11 items-center rounded-xl px-3 text-[0.875rem] transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
        >
          Reset
        </Link>
      </div>
    </form>
  );
}
