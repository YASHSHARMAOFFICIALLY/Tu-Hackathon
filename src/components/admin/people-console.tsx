"use client";

import { useId, useState } from "react";

import type { UserRole } from "@/db/schema";
import { cn } from "@/lib/utils";

/**
 * The people console: who holds which role, and the control that changes it.
 *
 * Grouped by role rather than listed flat, because the question this screen
 * answers is "who are my officers, and for which department" — a grouping
 * answers it at a glance and saves shipping a filter control that would only
 * re-derive the same three buckets.
 *
 * The list arrives from the server component, so there is no initial loading
 * state to invent. The states that exist here are the ones a save really has:
 * pending, refused, and saved.
 *
 * Role and department are one form and one request. An officer with no
 * department cannot assign, route or act on anything (`explainAssignment`
 * refuses them), so a two-step control would leave a broken officer between the
 * steps.
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
    blurb:
      "Full access to every issue, plus backup and restore. Keep this list short.",
  },
  {
    role: "OFFICER",
    title: "Officers",
    blurb:
      "Act on issues in their own department, and on issues nobody has triaged yet.",
  },
  {
    role: "CITIZEN",
    title: "Residents",
    blurb: "Can report issues and follow their own reports.",
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
  const [savingId, setSavingId] = useState<string | null>(null);
  const [error, setError] = useState<{ id: string; message: string } | null>(
    null,
  );
  const [saved, setSaved] = useState<string | null>(null);

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
    <div className="mt-12 space-y-12">
      {GROUPS.map((group) => {
        const members = people.filter((p) => p.role === group.role);
        return (
          <section key={group.role}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className="text-ink text-[1.25rem] leading-tight font-bold tracking-[-0.02em]">
                {group.title}
              </h2>
              <span className="text-body font-mono text-[0.8125rem]">
                {members.length}
              </span>
            </div>
            <p className="text-body mt-1.5 max-w-[62ch] text-[0.9375rem] leading-[1.55]">
              {group.blurb}
            </p>

            {members.length === 0 ? (
              <p className="border-field text-body mt-5 rounded-xl border border-dashed px-4 py-6 text-[0.9375rem]">
                {group.role === "OFFICER"
                  ? "Nobody works the queue yet. Promote a resident below and give them a department."
                  : `No ${group.title.toLowerCase()} yet.`}
              </p>
            ) : (
              <ul className="mt-5 space-y-3">
                {members.map((person) => (
                  <PersonRow
                    key={person.id}
                    person={person}
                    departments={departments}
                    isSelf={person.id === currentUserId}
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
  );
}

/* ── One person ─────────────────────────────────────────────── */

function PersonRow({
  person,
  departments,
  isSelf,
  saving,
  error,
  saved,
  onSave,
}: {
  person: Person;
  departments: Department[];
  isSelf: boolean;
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
    <li className="border-line bg-canvas rounded-xl border p-4 md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <p className="text-ink text-[0.9375rem] leading-tight font-semibold">
            {person.name}
            {isSelf ? (
              <span className="text-body ml-2 text-[0.8125rem] font-normal">
                (you)
              </span>
            ) : null}
          </p>
          <p className="text-body mt-1 truncate text-[0.8125rem]">
            {person.email}
          </p>
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
      </div>

      {isSelf ? (
        <p className="border-line text-body mt-4 border-t pt-4 text-[0.8125rem] leading-[1.5]">
          You cannot change your own role. That rule is what stops the last
          administrator locking everyone out. Ask another administrator.
        </p>
      ) : (
        <form
          className="border-line mt-4 flex flex-wrap items-end gap-3 border-t pt-4"
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
                : saved
                  ? `Saved. ${person.name} is now ${ROLE_LABEL[person.role].toLowerCase()}${person.departmentName ? ` for ${person.departmentName}` : ""}.`
                  : ""}
          </p>
        </form>
      )}
    </li>
  );
}
