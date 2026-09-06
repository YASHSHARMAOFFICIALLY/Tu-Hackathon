"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { CATEGORY } from "@/components/dashboard/pieces";
import type {
  IssueCategory,
  IssuePriority,
  IssueStatus,
} from "@/db/schema/enums";
import { cn } from "@/lib/utils";
import type { ResolutionPlan } from "@/modules/ai/copilot";

/**
 * The officer's controls: triage, move, assign, annotate.
 *
 * Rendered only for OFFICER/ADMIN, and the server decides that — this component
 * is never mounted for a citizen. That is presentation, not authorization: every
 * endpoint it calls re-checks the role, because a hidden button is not a
 * permission.
 *
 * Two rules the UI must not break, both of which live in the workflow module and
 * are only mirrored here:
 *
 *   1. Only legal transitions are offered. `allowed` comes from the server's
 *      `allowedTransitions(status)`, so the buttons cannot drift from the state
 *      machine — a terminal issue offers nothing at all.
 *   2. Closing requires a note. RESOLVED and REJECTED reveal the note field and
 *      the submit stays disabled until it has content. The service enforces the
 *      same rule; this only saves a round trip.
 *
 * AI suggestions are rendered as *suggestions* with Accept and Override, never
 * as decisions already applied. `reviewedAt` is what separates "an officer
 * looked at this" from "a model guessed", and it only gets stamped by one of
 * these two buttons.
 *
 * Every action calls `router.refresh()` on success: the page is a server
 * component, the refresh re-renders it from the database, and there is no second
 * copy of the issue living in the browser to fall out of step.
 */
const PRIORITIES: IssuePriority[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
const CATEGORIES = Object.keys(CATEGORY) as IssueCategory[];

const STATUS_LABEL: Record<IssueStatus, string> = {
  SUBMITTED: "Submitted",
  ACKNOWLEDGED: "Acknowledge",
  IN_PROGRESS: "Start work",
  RESOLVED: "Resolve",
  REJECTED: "Reject",
};

const FIELD =
  "border-field text-ink placeholder:text-placeholder w-full rounded-xl border bg-white px-3.5 py-2.5 text-[0.875rem] focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand focus-visible:outline-none";

type Ai = {
  category: string | null;
  priority: string | null;
  priorityScore: number | null;
  departmentId: string | null;
  summary: string | null;
  reasoning: string | null;
  confidence: number | null;
  reviewedAt: string | Date | null;
  /** Photos the model actually read. Zero means it worked from text alone. */
  photoCount: number;
};

export function OfficerPanel({
  issueId,
  status,
  category,
  priority,
  departmentId,
  assignedToId,
  allowed,
  departments,
  officers,
  ai,
}: {
  issueId: string;
  status: IssueStatus;
  category: IssueCategory;
  priority: IssuePriority;
  departmentId: string | null;
  assignedToId: string | null;
  /** From the server's state machine, never assembled in the browser. */
  allowed: readonly IssueStatus[];
  departments: { id: string; name: string }[];
  officers: { id: string; name: string; departmentId: string | null }[];
  ai: Ai;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [moveTo, setMoveTo] = useState<IssueStatus | null>(null);
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState("");
  // The copilot's answer is never stored, so it lives here and nowhere else.
  // Closing the page throws it away, which is the right lifetime for a draft
  // nobody has agreed to.
  const [plan, setPlan] = useState<ResolutionPlan | null>(null);
  const [draft, setDraft] = useState("");
  const [planError, setPlanError] = useState<string | null>(null);

  /** One place that talks to the API, so every action reports failure alike. */
  async function call(
    key: string,
    url: string,
    init: RequestInit,
  ): Promise<boolean> {
    setBusy(key);
    setError(null);
    try {
      const response = await fetch(url, init);
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        // The API explains a refused transition and lists the legal ones —
        // showing that verbatim is more useful than "something went wrong".
        setError(body.error ?? "That did not work. Try again.");
        return false;
      }
      router.refresh();
      return true;
    } catch {
      setError("No connection to the server.");
      return false;
    } finally {
      setBusy(null);
    }
  }

  const json = (body: unknown): RequestInit => ({
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });

  const needsNote = moveTo === "RESOLVED" || moveTo === "REJECTED";
  const noteTooShort = note.trim().length > 0 && note.trim().length < 3;
  const aiDepartment = departments.find((d) => d.id === ai.departmentId);
  const hasSuggestion =
    ai.category !== null || ai.priority !== null || ai.summary !== null;

  return (
    <section className="border-brand-line rounded-2xl border bg-white p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="text-ink text-[1rem] font-bold tracking-[-0.01em]">
          Officer controls
        </h2>
        <p className="text-body text-[0.75rem]">
          Visible to officers and administrators only
        </p>
      </div>

      {error ? (
        <p
          role="alert"
          className="bg-danger-tint text-danger mt-4 rounded-xl px-4 py-3 text-[0.875rem] leading-[1.55]"
        >
          {error}
        </p>
      ) : null}

      {/* ── AI triage ────────────────────────────────────────── */}
      {hasSuggestion ? (
        <div className="bg-tint-lilac mt-5 rounded-xl p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="text-ink text-[0.875rem] font-semibold">
              Suggested by triage
            </p>
            {ai.reviewedAt ? (
              <p className="text-brand text-[0.75rem] font-medium">
                Reviewed by an officer
              </p>
            ) : ai.confidence !== null ? (
              <p className="text-body font-mono text-[0.75rem] tabular-nums">
                {ai.confidence}% confidence
              </p>
            ) : null}
          </div>

          {ai.summary ? (
            <p className="text-body mt-2 text-[0.875rem] leading-[1.6]">
              {ai.summary}
            </p>
          ) : null}

          {/* Only ever shown when the model really read them. `aiPhotoCount` is
              what that run fetched, not what the issue happens to carry now. */}
          {ai.photoCount > 0 ? (
            <p className="text-body mt-2 text-[0.8125rem]">
              Read the report and{" "}
              <span className="text-ink font-medium">
                {ai.photoCount} {ai.photoCount === 1 ? "photo" : "photos"}
              </span>
              .
            </p>
          ) : null}

          <ul className="mt-3 flex flex-wrap gap-2 text-[0.75rem]">
            {ai.category ? (
              <Chip label="Category">
                {CATEGORY[ai.category as IssueCategory]?.label ?? ai.category}
              </Chip>
            ) : null}
            {ai.priority ? (
              <Chip label="Priority">
                {ai.priority}
                {ai.priorityScore !== null ? ` · ${ai.priorityScore}/100` : ""}
              </Chip>
            ) : null}
            {aiDepartment ? (
              <Chip label="Department">{aiDepartment.name}</Chip>
            ) : null}
          </ul>

          {ai.reasoning ? (
            <p className="text-body mt-3 text-[0.8125rem] leading-[1.55] italic">
              {ai.reasoning}
            </p>
          ) : null}

          {ai.reviewedAt ? null : (
            <div className="mt-4">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() =>
                  call("triage", `/api/issues/${issueId}/triage`, {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: "{}",
                  })
                }
                className="bg-brand hover:bg-brand-hover h-10 rounded-lg px-4 text-[0.8125rem] font-medium text-white transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                {busy === "triage" ? "Applying…" : "Accept all"}
              </button>
              <details className="mt-3">
                <summary className="text-brand w-fit cursor-pointer rounded text-[0.8125rem] font-medium focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none">
                  Modify suggestion
                </summary>
                <form
                  className="mt-3 grid gap-3 sm:grid-cols-3"
                  onSubmit={async (event) => {
                    event.preventDefault();
                    const data = new FormData(event.currentTarget);
                    await call("triage", `/api/issues/${issueId}/triage`, {
                      method: "POST",
                      headers: { "content-type": "application/json" },
                      body: JSON.stringify({
                        category: data.get("category"),
                        priority: data.get("priority"),
                        departmentId: data.get("departmentId") || null,
                      }),
                    });
                  }}
                >
                  <label className="block">
                    <span className="text-ink mb-1.5 block text-[0.75rem] font-medium">
                      Category
                    </span>
                    <select
                      name="category"
                      defaultValue={ai.category ?? category}
                      disabled={busy !== null}
                      className={FIELD}
                    >
                      {CATEGORIES.map((value) => (
                        <option key={value} value={value}>
                          {CATEGORY[value].label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-ink mb-1.5 block text-[0.75rem] font-medium">
                      Priority
                    </span>
                    <select
                      name="priority"
                      defaultValue={ai.priority ?? priority}
                      disabled={busy !== null}
                      className={FIELD}
                    >
                      {PRIORITIES.map((value) => (
                        <option key={value} value={value}>
                          {value.charAt(0) + value.slice(1).toLowerCase()}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="block">
                    <span className="text-ink mb-1.5 block text-[0.75rem] font-medium">
                      Department
                    </span>
                    <select
                      name="departmentId"
                      defaultValue={ai.departmentId ?? departmentId ?? ""}
                      disabled={busy !== null}
                      className={FIELD}
                    >
                      <option value="">Unassigned</option>
                      {departments.map((department) => (
                        <option key={department.id} value={department.id}>
                          {department.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="submit"
                    disabled={busy !== null}
                    className="border-field text-ink hover:bg-surface h-10 rounded-lg border px-4 text-[0.8125rem] font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none sm:col-span-3 sm:w-fit"
                  >
                    {busy === "triage" ? "Saving…" : "Apply changes"}
                  </button>
                </form>
              </details>
            </div>
          )}
        </div>
      ) : null}

      {/* ── Status ───────────────────────────────────────────── */}
      <div className="mt-6">
        <p className="text-ink text-[0.875rem] font-medium">Move this report</p>
        {allowed.length === 0 ? (
          <p className="text-body mt-2 text-[0.8125rem] leading-[1.55]">
            {STATUS_LABEL[status]} is final. A problem that recurs is filed as a
            new report, which keeps this one&apos;s timeline honest.
          </p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap gap-2">
              {allowed.map((next) => (
                <button
                  key={next}
                  type="button"
                  onClick={() => {
                    setMoveTo(next === moveTo ? null : next);
                    setError(null);
                  }}
                  aria-pressed={moveTo === next}
                  className={cn(
                    "h-10 rounded-lg border px-4 text-[0.8125rem] font-medium transition-colors focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none",
                    moveTo === next
                      ? "border-brand bg-brand-tint text-brand"
                      : "border-field text-body hover:bg-surface",
                  )}
                >
                  {STATUS_LABEL[next]}
                </button>
              ))}
            </div>

            {moveTo ? (
              <div className="mt-3">
                <label className="block">
                  <span className="text-body block text-[0.8125rem]">
                    {needsNote
                      ? "What happened? This is published on the citizen's timeline."
                      : "Note (optional)"}
                  </span>
                  <textarea
                    rows={3}
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder={
                      needsNote
                        ? "Crew replaced the light on 12 September."
                        : "Anything the citizen should know."
                    }
                    className={cn(FIELD, "mt-1.5 resize-y")}
                  />
                </label>
                <button
                  type="button"
                  disabled={
                    busy !== null || noteTooShort || (needsNote && !note.trim())
                  }
                  onClick={async () => {
                    const ok = await call(
                      "status",
                      `/api/issues/${issueId}/status`,
                      json({
                        status: moveTo,
                        ...(note.trim() ? { note: note.trim() } : {}),
                      }),
                    );
                    if (ok) {
                      setMoveTo(null);
                      setNote("");
                    }
                  }}
                  className="bg-brand hover:bg-brand-hover mt-3 h-11 rounded-xl px-5 text-[0.875rem] font-medium text-white transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {busy === "status"
                    ? "Saving…"
                    : `Confirm — ${STATUS_LABEL[moveTo]}`}
                </button>
                {(needsNote && !note.trim()) || noteTooShort ? (
                  <p className="text-body mt-2 text-[0.75rem]">
                    Closing a report requires a note. The brief asks for it, and
                    so does the service.
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        )}
      </div>

      {/* ── Priority, department, assignee ───────────────────── */}
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="text-ink mb-1.5 block text-[0.8125rem] font-medium">
            Priority
          </span>
          <select
            defaultValue={priority}
            disabled={busy !== null}
            onChange={async (e) => {
              const select = e.currentTarget;
              const ok = await call(
                "priority",
                `/api/issues/${issueId}/priority`,
                json({ priority: select.value }),
              );
              if (!ok) select.value = priority;
            }}
            className={FIELD}
          >
            {PRIORITIES.map((value) => (
              <option key={value} value={value}>
                {value.charAt(0) + value.slice(1).toLowerCase()}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-ink mb-1.5 block text-[0.8125rem] font-medium">
            Department
          </span>
          <select
            defaultValue={departmentId ?? ""}
            disabled={busy !== null}
            onChange={async (e) => {
              const select = e.currentTarget;
              const ok = await call(
                "assign",
                `/api/issues/${issueId}/assign`,
                json({ departmentId: select.value || null }),
              );
              if (!ok) select.value = departmentId ?? "";
            }}
            className={FIELD}
          >
            <option value="">Unassigned</option>
            {departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="text-ink mb-1.5 block text-[0.8125rem] font-medium">
            Officer
          </span>
          <select
            defaultValue={assignedToId ?? ""}
            disabled={busy !== null}
            onChange={async (e) => {
              const select = e.currentTarget;
              const ok = await call(
                "assign",
                `/api/issues/${issueId}/assign`,
                json({ assignedTo: select.value || null }),
              );
              if (!ok) select.value = assignedToId ?? "";
            }}
            className={FIELD}
          >
            <option value="">Nobody</option>
            {officers.map((officer) => (
              <option key={officer.id} value={officer.id}>
                {officer.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* ── Resolution copilot ───────────────────────────────── */}
      <div className="border-line mt-6 border-t pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <p className="text-ink text-[0.875rem] font-semibold">
            Suggested next steps
          </p>
          <button
            type="button"
            disabled={busy !== null}
            onClick={async () => {
              setBusy("copilot");
              setPlanError(null);
              try {
                const response = await fetch(`/api/issues/${issueId}/copilot`, {
                  method: "POST",
                });
                if (!response.ok) {
                  const body = (await response
                    .json()
                    .catch(() => null)) as { error?: string } | null;
                  setPlanError(
                    body?.error ??
                      `No suggestion could be produced (${response.status}).`,
                  );
                  return;
                }
                const next = (await response.json()) as ResolutionPlan;
                setPlan(next);
                setDraft(next.citizenUpdate);
              } catch {
                setPlanError(
                  "The request did not reach the server. Check your connection.",
                );
              } finally {
                setBusy(null);
              }
            }}
            className="text-brand rounded text-[0.8125rem] font-medium underline decoration-current/30 underline-offset-4 transition-colors hover:decoration-current disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none"
          >
            {busy === "copilot"
              ? "Thinking…"
              : plan
                ? "Suggest again"
                : "Suggest what to do"}
          </button>
        </div>

        {planError ? (
          <p role="alert" className="text-danger mt-2 text-[0.8125rem] leading-[1.55]">
            {planError}
          </p>
        ) : plan ? (
          <>
            <ol className="text-body mt-3 list-decimal space-y-1.5 pl-5 text-[0.875rem] leading-[1.6]">
              {plan.steps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>

            <label className="mt-4 block">
              <span className="text-ink block text-[0.875rem] font-medium">
                Draft update for the citizen
              </span>
              <span className="text-body mt-1 mb-2 block text-[0.8125rem] leading-[1.5]">
                Read it, change what is wrong, then post it. It appears on the
                public report under your name, like anything else you write.
              </span>
              <textarea
                rows={4}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className={cn(FIELD, "resize-y")}
              />
            </label>
            <button
              type="button"
              disabled={busy !== null || draft.trim().length === 0}
              onClick={async () => {
                const ok = await call(
                  "draft",
                  `/api/issues/${issueId}/comments`,
                  {
                    method: "POST",
                    headers: { "content-type": "application/json" },
                    body: JSON.stringify({ body: draft.trim() }),
                  },
                );
                if (ok) {
                  setPlan(null);
                  setDraft("");
                }
              }}
              className="bg-brand hover:bg-brand-hover mt-3 h-11 rounded-xl px-5 text-[0.875rem] font-medium text-white transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
            >
              {busy === "draft" ? "Posting…" : "Post as an update"}
            </button>
          </>
        ) : (
          <p className="text-body mt-2 text-[0.8125rem] leading-[1.55]">
            Asks the model what a municipal officer does next on a report like
            this, and drafts the update the citizen is waiting for. Nothing is
            sent until you press post.
          </p>
        )}
      </div>

      {/* ── Internal note ────────────────────────────────────── */}
      <div className="mt-6">
        <label className="block">
          <span className="text-ink block text-[0.875rem] font-medium">
            Internal note
          </span>
          <span className="text-body mt-1 mb-2 block text-[0.8125rem] leading-[1.5]">
            Never shown to the citizen. The serialiser filters internal notes out
            of every public response.
          </span>
          <textarea
            rows={3}
            value={internal}
            onChange={(e) => setInternal(e.target.value)}
            placeholder="Contractor booked for Thursday. Second complaint from the same street."
            className={cn(FIELD, "resize-y")}
          />
        </label>
        <button
          type="button"
          disabled={busy !== null || internal.trim().length === 0}
          onClick={async () => {
            const ok = await call(
              "comment",
              `/api/issues/${issueId}/comments`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({
                  body: internal.trim(),
                  isInternal: true,
                }),
              },
            );
            if (ok) setInternal("");
          }}
          className="border-field text-ink hover:bg-surface mt-3 h-11 rounded-xl border px-5 text-[0.875rem] font-medium transition-colors disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          {busy === "comment" ? "Saving…" : "Add internal note"}
        </button>
      </div>
    </section>
  );
}

function Chip({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <li className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1">
      <span className="text-body">{label}</span>
      <span className="text-ink font-medium">{children}</span>
    </li>
  );
}
