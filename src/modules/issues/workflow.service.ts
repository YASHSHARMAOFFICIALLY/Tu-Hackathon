/**
 * Workflow operations: status, assignment, priority, duplicate links.
 *
 * Every one of these writes the change AND its history row inside a single
 * `dbPool` transaction. A status change without its timeline entry is corrupt
 * data — the public tracking view would show a state nobody can explain — and
 * the HTTP client cannot guarantee both land.
 */
import { and, eq } from "drizzle-orm";

import { db } from "@/db";
import { dbPool } from "@/db/pool";
import { issueDuplicates, issueHistory, issues } from "@/db/schema";
import type {
  IssueCategory,
  IssuePriority,
  IssueStatus,
} from "@/db/schema/enums";
import { NotFoundError, ValidationError } from "@/lib/http";
import { requireRole, type CurrentUser } from "@/modules/auth/permissions";

import { explainTransition } from "./workflow";

/**
 * Officers act within their own department; admins act anywhere.
 *
 * An untriaged issue (no department yet) is fair game for any officer — someone
 * has to be able to pick it up and route it, or reports with no obvious owner
 * would sit forever.
 */
function assertCanAct(user: CurrentUser, issueDepartmentId: string | null) {
  if (user.role === "ADMIN") return;
  if (issueDepartmentId === null) return;
  if (user.departmentId !== issueDepartmentId) {
    throw new ValidationError(
      "This issue belongs to another department. Ask an admin to reassign it.",
    );
  }
}

async function loadIssue(id: string) {
  const issue = await db.query.issues.findFirst({
    where: { id },
    columns: {
      id: true,
      status: true,
      priority: true,
      departmentId: true,
      assignedTo: true,
    },
  });
  if (!issue) throw new NotFoundError("Issue not found");
  return issue;
}

/** Moves an issue through the lifecycle. OFFICER or ADMIN. */
export async function transitionStatus(
  issueId: string,
  input: { status: IssueStatus; note?: string },
) {
  const user = await requireRole("OFFICER", "ADMIN");
  const issue = await loadIssue(issueId);
  assertCanAct(user, issue.departmentId);

  const refusal = explainTransition(issue.status, input.status, input.note);
  if (refusal) throw new ValidationError(refusal);

  const resolving = input.status === "RESOLVED";

  return dbPool.transaction(async (tx) => {
    const [updated] = await tx
      .update(issues)
      .set({
        status: input.status,
        // The resolution note lives on the issue as well as in history, so the
        // public view reads the current outcome without walking the timeline.
        ...(input.note ? { resolutionNote: input.note } : {}),
        ...(resolving ? { resolvedAt: new Date() } : {}),
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId))
      .returning();

    await tx.insert(issueHistory).values({
      issueId,
      actorId: user.id,
      event: "STATUS_CHANGED",
      oldStatus: issue.status,
      newStatus: input.status,
      note: input.note,
    });

    return updated;
  });
}

/** Assigns an officer and/or a department. OFFICER or ADMIN. */
export async function assignIssue(
  issueId: string,
  input: { assignedTo?: string | null; departmentId?: string | null },
) {
  const user = await requireRole("OFFICER", "ADMIN");
  const issue = await loadIssue(issueId);
  assertCanAct(user, issue.departmentId);

  if (input.assignedTo === undefined && input.departmentId === undefined) {
    throw new ValidationError("Provide assignedTo or departmentId");
  }

  return dbPool.transaction(async (tx) => {
    const [updated] = await tx
      .update(issues)
      .set({
        ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
        ...(input.departmentId !== undefined
          ? { departmentId: input.departmentId }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(issues.id, issueId))
      .returning();

    // Two distinct events, because "routed to Roads" and "given to an officer"
    // read differently on a public timeline.
    if (input.departmentId !== undefined) {
      await tx.insert(issueHistory).values({
        issueId,
        actorId: user.id,
        event: "DEPARTMENT_CHANGED",
      });
    }
    if (input.assignedTo !== undefined) {
      await tx.insert(issueHistory).values({
        issueId,
        actorId: user.id,
        event: "ASSIGNED",
      });
    }

    return updated;
  });
}

/** Changes priority. OFFICER or ADMIN. */
export async function setPriority(
  issueId: string,
  input: { priority: IssuePriority },
) {
  const user = await requireRole("OFFICER", "ADMIN");
  const issue = await loadIssue(issueId);
  assertCanAct(user, issue.departmentId);

  if (issue.priority === input.priority) {
    throw new ValidationError(`Priority is already ${input.priority}`);
  }

  return dbPool.transaction(async (tx) => {
    const [updated] = await tx
      .update(issues)
      .set({ priority: input.priority, updatedAt: new Date() })
      .where(eq(issues.id, issueId))
      .returning();

    await tx.insert(issueHistory).values({
      issueId,
      actorId: user.id,
      event: "PRIORITY_CHANGED",
      oldPriority: issue.priority,
      newPriority: input.priority,
    });

    return updated;
  });
}

/**
 * Applies the AI suggestions to an issue — the officer's "accept" action.
 *
 * This is the ONLY path by which an ai_* value becomes a real field. The
 * officer may accept all of it, or override any part in the same call. Either
 * way `aiReviewedAt` is stamped, so the dashboard can show what has been
 * reviewed and what is still waiting on a human.
 *
 * Recorded in the timeline as a normal officer action, with a note naming the
 * AI as the source. A public timeline should never imply a machine decided.
 */
export async function applyTriage(
  issueId: string,
  overrides: {
    category?: IssueCategory;
    priority?: IssuePriority;
    departmentId?: string | null;
  } = {},
) {
  const user = await requireRole("OFFICER", "ADMIN");

  const issue = await db.query.issues.findFirst({
    where: { id: issueId },
    columns: {
      id: true, status: true, priority: true, departmentId: true,
      category: true, aiCategory: true, aiPriority: true, aiDepartmentId: true,
      aiConfidence: true,
    },
  });
  if (!issue) throw new NotFoundError("Issue not found");
  assertCanAct(user, issue.departmentId);

  if (!issue.aiCategory && !overrides.category) {
    throw new ValidationError("No AI suggestions to apply for this issue");
  }

  const category = overrides.category ?? issue.aiCategory ?? issue.category;
  const priority = overrides.priority ?? issue.aiPriority ?? issue.priority;
  const departmentId =
    overrides.departmentId !== undefined
      ? overrides.departmentId
      : (issue.aiDepartmentId ?? issue.departmentId);

  const accepted =
    !overrides.category && !overrides.priority && overrides.departmentId === undefined;

  return dbPool.transaction(async (tx) => {
    const [updated] = await tx
      .update(issues)
      .set({ category, priority, departmentId, aiReviewedAt: new Date(), updatedAt: new Date() })
      .where(eq(issues.id, issueId))
      .returning();

    const events: (typeof issueHistory.$inferInsert)[] = [];
    if (priority !== issue.priority) {
      events.push({
        issueId, actorId: user.id, event: "PRIORITY_CHANGED",
        oldPriority: issue.priority, newPriority: priority,
        note: accepted
          ? `Accepted AI triage (confidence ${issue.aiConfidence ?? "n/a"}%).`
          : "Set during triage review.",
      });
    }
    if (departmentId !== issue.departmentId) {
      events.push({
        issueId, actorId: user.id, event: "DEPARTMENT_CHANGED",
        note: accepted ? "Routed following AI triage." : "Routed during triage review.",
      });
    }
    if (events.length > 0) await tx.insert(issueHistory).values(events);

    return updated;
  });
}

/**
 * Links a duplicate report to a primary issue.
 *
 * Brief rule: duplicates are grouped or linked, NEVER silently deleted. Both
 * issues keep their row, their reporter, and their timeline — five reports of
 * one pothole is five affected citizens, which is exactly the signal that
 * should drive priority.
 */
export async function linkDuplicate(
  primaryIssueId: string,
  duplicateIssueId: string,
) {
  const user = await requireRole("OFFICER", "ADMIN");

  if (primaryIssueId === duplicateIssueId) {
    throw new ValidationError("An issue cannot be a duplicate of itself");
  }

  const primary = await loadIssue(primaryIssueId);
  const duplicate = await loadIssue(duplicateIssueId);
  assertCanAct(user, primary.departmentId);

  const existing = await db.query.issueDuplicates.findFirst({
    where: { primaryIssueId, duplicateIssueId },
    columns: { id: true },
  });
  if (existing) throw new ValidationError("Already linked");

  return dbPool.transaction(async (tx) => {
    const [link] = await tx
      .insert(issueDuplicates)
      .values({ primaryIssueId, duplicateIssueId, linkedBy: user.id })
      .returning();

    // Recorded on both timelines: the duplicate shows where it was grouped,
    // the primary shows that another citizen reported the same thing.
    await tx.insert(issueHistory).values([
      {
        issueId: duplicateIssueId,
        actorId: user.id,
        event: "DUPLICATE_LINKED",
        note: "Grouped with an existing report.",
      },
      {
        issueId: primaryIssueId,
        actorId: user.id,
        event: "DUPLICATE_LINKED",
        note: "Another report of the same problem was linked.",
      },
    ]);

    return { link, duplicateStatus: duplicate.status };
  });
}

/** Removes a duplicate link. Removes the LINK only — never an issue. */
export async function unlinkDuplicate(
  primaryIssueId: string,
  duplicateIssueId: string,
) {
  const user = await requireRole("OFFICER", "ADMIN");
  const primary = await loadIssue(primaryIssueId);
  assertCanAct(user, primary.departmentId);

  const deleted = await db
    .delete(issueDuplicates)
    .where(
      and(
        eq(issueDuplicates.primaryIssueId, primaryIssueId),
        eq(issueDuplicates.duplicateIssueId, duplicateIssueId),
      ),
    )
    .returning({ id: issueDuplicates.id });

  if (deleted.length === 0) throw new NotFoundError("Link not found");
  return { unlinked: true };
}
