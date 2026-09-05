/**
 * The issue state machine — pure, no database, no session.
 *
 * Kept separate from the service so every legal and illegal transition can be
 * asserted in a unit test. A workflow bug that only shows up with a seeded
 * database is a workflow bug that does not get tested.
 */
import type { IssueStatus, UserRole } from "@/db/schema/enums";

type AssignmentPerson = {
  role: UserRole;
  departmentId: string | null;
};

export function explainAssignment(
  actor: AssignmentPerson,
  departmentId: string | null,
  assignee: AssignmentPerson | null | undefined,
): string | null {
  if (
    actor.role === "OFFICER" &&
    (actor.departmentId === null || departmentId !== actor.departmentId)
  ) {
    return "Officers may only route issues to their own department.";
  }
  if (assignee === null || assignee?.role === "CITIZEN") {
    return "The assignee must be an officer or administrator.";
  }
  if (assignee?.role === "OFFICER" && assignee.departmentId !== departmentId) {
    return "The assigned officer must belong to the same department as the issue.";
  }
  return null;
}

/**
 * Legal moves. The brief names the happy path — "Submitted, Acknowledged, In
 * Progress and Resolved" — and REJECTED is our terminal state for reports that
 * are invalid, since the brief forbids deleting them.
 *
 *   SUBMITTED ──► ACKNOWLEDGED ──► IN_PROGRESS ──► RESOLVED
 *       │              │                │
 *       └──────────────┴────────────────┴──────► REJECTED
 *
 * RESOLVED and REJECTED are terminal. A problem that recurs is a NEW report,
 * not a reopened one — that keeps the resolution time honest and preserves the
 * original timeline.
 */
const ALLOWED: Record<IssueStatus, readonly IssueStatus[]> = {
  SUBMITTED: ["ACKNOWLEDGED", "REJECTED"],
  ACKNOWLEDGED: ["IN_PROGRESS", "RESOLVED", "REJECTED"],
  IN_PROGRESS: ["RESOLVED", "REJECTED"],
  RESOLVED: [],
  REJECTED: [],
};

export function canTransition(from: IssueStatus, to: IssueStatus): boolean {
  return ALLOWED[from].includes(to);
}

export function allowedTransitions(from: IssueStatus): readonly IssueStatus[] {
  return ALLOWED[from];
}

export function isTerminal(status: IssueStatus): boolean {
  return ALLOWED[status].length === 0;
}

/**
 * Statuses that require a resolution note or evidence.
 *
 * Brief rule: "Resolution should include a note or evidence." Enforced here and
 * in the service, never only in the UI.
 */
export function requiresNote(to: IssueStatus): boolean {
  return to === "RESOLVED" || to === "REJECTED";
}

/**
 * Explains why a transition is refused, or null if it is allowed.
 * Returning the reason (not just false) is what lets the API tell an officer
 * what they may do instead.
 */
export function explainTransition(
  from: IssueStatus,
  to: IssueStatus,
  note: string | undefined,
): string | null {
  if (from === to) return `Issue is already ${to}.`;
  if (isTerminal(from)) {
    return `${from} is final. Recurring problems should be reported as a new issue.`;
  }
  if (!canTransition(from, to)) {
    return `Cannot move from ${from} to ${to}. Allowed: ${allowedTransitions(from).join(", ")}.`;
  }
  if (requiresNote(to) && !note?.trim()) {
    return `Moving to ${to} requires a note explaining the outcome.`;
  }
  return null;
}
