"use client";

import { useId, useMemo, useState } from "react";

import type { UserRole } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * The people console: who holds which role, and the control that changes it.
 *
 * Built as one register rather than a card per person. The first version gave
 * every account a tall card with the edit form permanently open, so sixteen
 * accounts were eight screens of scrolling and the page was mostly controls
 * nobody was using. The work here is scanning ("who are my officers, and for
 * which department") and the occasional single change, so the list is dense and
 * the form appears on the one row being changed.
 *
 * Grouped by role, because that grouping IS the answer to the scanning
 * question, and the group heading carries what the role may do, which is what
 * an administrator needs to know before promoting anyone.
 */

export type Person = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  departmentName: string | null;
};

type Department = { id: string; name: string };

const GROUPS: { role: UserRole; title: string; blurb: string }[] = [
  {
    role: "ADMIN",
    title: "Administrators",
    blurb: "Every issue, plus backup and restore. Keep this list short.",
  },
  {
    role: "OFFICER",
    title: "Officers",
    blurb:
      "Act on their own department's issues, and on anything nobody has triaged.",
  },
  {
    role: "CITIZEN",
    title: "Residents",
    blurb: "Report issues and follow their own reports.",
  },
];

const ROLE_LABEL: Record<UserRole, string> = {
  CITIZEN: "Resident",
  OFFICER: "Officer",
  ADMIN: "Administrator",
};

async function errorFrom(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string };
    return body.error ?? `Request failed (${response.status})`;
  } catch {
    return `Request failed (${response.status})`;
  }
}

export function PeopleConsole({
  initialPeople,
  departments,
  currentUserId,
}: {
  initialPeople: Person[];
  departments: Department[];
  currentUserId: string;
}) {
  const [people, setPeople] = useState(initialPeople);
  const [query, setQuery] = useState("");
  /** Only one row is ever in edit mode: this is a register, not a bulk editor. */
  const [editing, setEditing] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [saved, setSaved] = useState<string | null>(null);
  const searchId = useId();

  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return people;
    return people.filter(
      (p) =>
        p.name.toLowerCase().includes(needle) ||
        p.email.toLowerCase().includes(needle) ||
        (p.departmentName?.toLowerCase().includes(needle) ?? false),
    );
  }, [people, query]);

  const counts = useMemo(
    () => ({
      ADMIN: people.filter((p) => p.role === "ADMIN").length,
      OFFICER: people.filter((p) => p.role === "OFFICER").length,
      CITIZEN: people.filter((p) => p.role === "CITIZEN").length,
      covered: new Set(
        people
          .filter((p) => p.role === "OFFICER" && p.departmentId)
          .map((p) => p.departmentId),
      ).size,
    }),
    [people],
  );

  async function save(
    person: Person,
    role: UserRole,
    departmentId: string | null,
  ) {
    setSavingId(person.id);
    setError(null);
    setSaved(null);
    try {
      const response = await fetch(`/api/admin/people/${person.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ role, departmentId }),
      });
      if (!response.ok) {
        setError({ id: person.id, message: await errorFrom(response) });
        return;
      }
      const body = (await response.json()) as { people: Person[] };
      setPeople(body.people);
      setSaved(person.id);
      setEditing(null);
    } catch {
      setError({
        id: person.id,
        message: "The request did not reach the server. Check your connection.",
      });
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="mt-8">
      {/* Counts, from the list itself. Nothing here is a number the page went
          looking for, so nothing here can be a number the page invented. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <Stat value={counts.ADMIN} label="administrators" />
        <Stat value={counts.OFFICER} label="officers" />
        <Stat value={counts.CITIZEN} label="residents" />
        <Stat
          value={`${counts.covered}/${departments.length}`}
          label="departments staffed"
        />

        <div className="ml-auto min-w-[14rem] flex-1 sm:max-w-xs">
          <label htmlFor={searchId} className="sr-only">
            Filter people by name, email or department
          </label>
          <input
            id={searchId}
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter by name, email or department"
            className="border-field bg-canvas text-ink placeholder:text-placeholder h-10 w-full rounded-lg border px-3.5 text-[0.875rem] focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          />
        </div>
      </div>

      <div className="border-line mt-6 overflow-hidden rounded-2xl border bg-white">
        {GROUPS.map((group) => {
          const members = matches.filter((p) => p.role === group.role);
          return (
            <section key={group.role}>
              <div className="border-line bg-surface flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b px-4 py-3 md:px-5">
                <h2 className="text-ink text-[0.9375rem] font-bold tracking-[-0.01em]">
                  {group.title}
                </h2>
                <span className="text-body font-mono text-[0.75rem] tabular-nums">
                  {members.length}
                </span>
                <p className="text-body basis-full text-[0.8125rem] leading-[1.5] sm:basis-auto">
                  {group.blurb}
                </p>
              </div>

              {members.length === 0 ? (
                <p className="text-body border-line border-b px-4 py-5 text-[0.875rem] md:px-5">
                  {query.trim()
                    ? "Nobody here matches that filter."
                    : group.role === "OFFICER"
                      ? "Nobody works the queue yet. Change a resident below to Officer and give them a department."
                      : `No ${group.title.toLowerCase()} yet.`}
                </p>
              ) : (
                <ul className="divide-line divide-y">
                  {members.map((person) => (
                    <PersonRow
                      key={person.id}
                      person={person}
                      departments={departments}
                      isSelf={person.id === currentUserId}
                      editing={editing === person.id}
                      onEdit={() => {
                        setEditing(editing === person.id ? null : person.id);
                        setError(null);
                        setSaved(null);
                      }}
                      saving={savingId === person.id}
                      error={error?.id === person.id ? error.message : null}
                      saved={saved === person.id}
                      onSave={save}
                    />
                  ))}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: number | string; label: string }) {
  return (
    <p className="text-body text-[0.8125rem]">
      <span className="text-ink font-mono text-[1.125rem] font-medium tabular-nums">
        {value}
      </span>{" "}
      {label}
    </p>
  );
}

/* ── One person ─────────────────────────────────────────────── */

function PersonRow({
  person,
  departments,
  isSelf,
  editing,
  onEdit,
  saving,
  error,
  saved,
  onSave,
}: {
  person: Person;
  departments: Department[];
  isSelf: boolean;
  editing: boolean;
  onEdit: () => void;
  saving: boolean;
  error: string | null;
  saved: boolean;
  onSave: (
    person: Person,
    role: UserRole,
    departmentId: string | null,
  ) => Promise<void>;
}) {
  const [role, setRole] = useState<UserRole>(person.role);
  const [departmentId, setDepartmentId] = useState(person.departmentId ?? "");
  const roleId = useId();
  const deptId = useId();

  const wanted = role === "OFFICER" ? departmentId || null : null;
  const dirty = role !== person.role || wanted !== person.departmentId;
  const incomplete = role === "OFFICER" && wanted === null;

  return (
    <li className={cn("px-4 md:px-5", editing && "bg-surface")}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
        <span
          aria-hidden="true"
          className="bg-brand-tint text-brand flex size-9 shrink-0 items-center justify-center rounded-full text-[0.75rem] font-semibold"
        >
          {initials(person.name)}
        </span>

        <div className="min-w-[10rem] flex-1">
          <p className="text-ink text-[0.875rem] leading-tight font-medium">
            {person.name}
            {isSelf ? (
              <span className="text-body ml-1.5 text-[0.75rem] font-normal">
                (you)
              </span>
            ) : null}
          </p>
          <p className="text-body truncate text-[0.75rem]">{person.email}</p>
        </div>

        <p className="text-body text-[0.8125rem]">
          {ROLE_LABEL[person.role]}
          {person.departmentName ? (
            <>
              {", "}
              <span className="text-ink">{person.departmentName}</span>
            </>
          ) : null}
        </p>

        {isSelf ? (
          <span className="text-body w-[5.5rem] text-right text-[0.75rem]">
            locked
          </span>
        ) : (
          <button
            type="button"
            onClick={onEdit}
            aria-expanded={editing}
            className="border-field text-ink hover:bg-surface h-10 w-[5.5rem] shrink-0 rounded-lg border text-[0.8125rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
          >
            {editing ? "Cancel" : "Change"}
          </button>
        )}
      </div>

      {editing ? (
        <form
          className="border-line flex flex-wrap items-end gap-3 border-t py-4"
          onSubmit={(event) => {
            event.preventDefault();
            void onSave(person, role, wanted);
          }}
        >
          <div className="min-w-[9rem]">
            <label
              htmlFor={roleId}
              className="text-body block text-[0.75rem] font-medium"
            >
              Role
            </label>
            <select
              id={roleId}
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className="border-field bg-canvas text-ink mt-1.5 h-10 w-full rounded-lg border px-3 text-[0.875rem] focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
            >
              <option value="CITIZEN">Resident</option>
              <option value="OFFICER">Officer</option>
              <option value="ADMIN">Administrator</option>
            </select>
          </div>

          {/* Only an officer has a department, so the control appears with the
              role rather than sitting greyed out beside it. */}
          {role === "OFFICER" ? (
            <div className="min-w-[12rem] flex-1">
              <label
                htmlFor={deptId}
                className="text-body block text-[0.75rem] font-medium"
              >
                Department
              </label>
              <select
                id={deptId}
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                className="border-field bg-canvas text-ink mt-1.5 h-10 w-full rounded-lg border px-3 text-[0.875rem] focus-visible:border-brand focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
              >
                <option value="">Choose a department</option>
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <button
            type="submit"
            disabled={!dirty || incomplete || saving}
            className={cn(
              "h-10 shrink-0 rounded-lg px-4 text-[0.875rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
              !dirty || incomplete || saving
                ? "border-field text-body cursor-not-allowed border"
                : "bg-brand hover:bg-brand-hover text-white",
            )}
          >
            {saving ? "Saving…" : "Save role"}
          </button>

          <p
            aria-live="polite"
            className={cn(
              "w-full text-[0.8125rem] leading-[1.5]",
              error ? "text-danger" : "text-body",
            )}
          >
            {error
              ? error
              : incomplete
                ? "Choose the department this officer works for."
                : dirty
                  ? ""
                  : "Change the role or the department to enable saving."}
          </p>
        </form>
      ) : null}

      {saved && !editing ? (
        <p
          aria-live="polite"
          className="text-brand border-line border-t py-3 text-[0.8125rem]"
        >
          Saved. {person.name} is now{" "}
          {ROLE_LABEL[person.role].toLowerCase()}
          {person.departmentName ? ` for ${person.departmentName}` : ""}.
        </p>
      ) : null}

      {isSelf ? (
        <p className="text-body border-line border-t py-3 text-[0.75rem] leading-[1.5]">
          You cannot change your own role. That rule is what stops the last
          administrator locking everyone out.
        </p>
      ) : null}
    </li>
  );
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}
