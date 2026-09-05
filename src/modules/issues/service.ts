/**
 * Issue business logic.
 *
 * Services own permission checks and rules; route handlers only translate HTTP.
 * Nothing here imports Request or Response — that is what lets the backup
 * module reuse these functions in Phase 7.
 */
import { and, eq, ilike, or, SQL } from "drizzle-orm";

import { db } from "@/db";
import { dbPool } from "@/db/pool";
import { comments, issueDuplicates, issueHistory, issues } from "@/db/schema";
import {
  getCurrentUser,
  requireRole,
  type CurrentUser,
} from "@/modules/auth/permissions";
import { NotFoundError, ValidationError } from "@/lib/http";
import { enrichIssue } from "@/modules/ai/enrich";

import type {
  CreateIssueInput,
  ListIssuesInput,
} from "./validation";

/**
 * Creates an issue, its opening history entry, and any duplicate link — all in
 * one transaction. An issue without its CREATED event would render as a
 * timeline that starts from nowhere.
 */
export async function createIssue(input: CreateIssueInput) {
  const user = await requireRole("CITIZEN", "OFFICER", "ADMIN");

  const issue = await dbPool.transaction(async (tx) => {
    const [issue] = await tx
      .insert(issues)
      .values({
        title: input.title,
        description: input.description,
        category: input.category,
        address: input.address,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        reportedBy: user.id,
      })
      .returning();

    await tx.insert(issueHistory).values({
      issueId: issue.id,
      actorId: user.id,
      event: "CREATED",
      newStatus: "SUBMITTED",
    });

    // The citizen saw possible matches and filed anyway — record the link
    // rather than blocking them. The brief says group or link, never delete.
    if (input.possibleDuplicateOf) {
      const primary = await tx.query.issues.findFirst({
        where: { id: input.possibleDuplicateOf },
        columns: { id: true },
      });
      if (!primary) {
        throw new ValidationError("possibleDuplicateOf does not exist");
      }

      await tx.insert(issueDuplicates).values({
        primaryIssueId: primary.id,
        duplicateIssueId: issue.id,
        linkedBy: user.id,
      });

      await tx.insert(issueHistory).values({
        issueId: issue.id,
        actorId: user.id,
        event: "DUPLICATE_LINKED",
        note: `Reported as related to an existing issue.`,
      });
    }

    return issue;
  });

  // AI triage and embedding run AFTER the transaction commits, deliberately
  // unawaited: the report is already saved, and a slow or failing model must
  // never delay or reject a citizen reporting a hazard.
  void enrichIssue(issue.id);

  return issue;
}

/** Filtered, paginated list. Public — anonymous callers get results too. */
export async function listIssues(input: ListIssuesInput) {
  const user = await getCurrentUser();

  // "mine" resolves against the session. A client-supplied user id here would
  // let anyone enumerate another person's reports.
  if (input.mine && !user) return { issues: [], total: 0 };

  // Drizzle v1's relational API takes an object filter, not raw SQL.
  //
  // `q` is the one condition that is not an equality, so it is expressed with
  // OR over three columns. The `%` wrappers are the only interpolation: the
  // needle itself rides as a bound parameter, never as SQL text.
  const needle = input.q ? `%${input.q}%` : null;
  const where = {
    ...(needle
      ? {
          OR: [
            { title: { ilike: needle } },
            { description: { ilike: needle } },
            { address: { ilike: needle } },
          ],
        }
      : {}),
    ...(input.status ? { status: input.status } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.priority ? { priority: input.priority } : {}),
    ...(input.departmentId ? { departmentId: input.departmentId } : {}),
    ...(input.mine && user ? { reportedBy: user.id } : {}),
  };

  // The same filter expressed as SQL for the count. Kept next to the object
  // above so the two cannot drift apart unnoticed.
  const conditions: SQL[] = [];
  if (needle)
    conditions.push(
      or(
        ilike(issues.title, needle),
        ilike(issues.description, needle),
        ilike(issues.address, needle),
      )!,
    );
  if (input.status) conditions.push(eq(issues.status, input.status));
  if (input.category) conditions.push(eq(issues.category, input.category));
  if (input.priority) conditions.push(eq(issues.priority, input.priority));
  if (input.departmentId)
    conditions.push(eq(issues.departmentId, input.departmentId));
  if (input.mine && user) conditions.push(eq(issues.reportedBy, user.id));

  const [rows, total] = await Promise.all([
    db.query.issues.findMany({
      where,
      with: {
        department: true,
        reporter: { columns: { id: true, name: true, image: true } },
        // The register shows the first photo as the card's thumbnail. Fetched
        // with the list rather than per card: twelve cards would otherwise be
        // twelve more round-trips.
        attachments: true,
      },
      orderBy: { createdAt: "desc" },
      limit: input.limit,
      offset: input.offset,
    }),
    db.$count(issues, conditions.length ? and(...conditions) : undefined),
  ]);

  return { issues: rows, total };
}

/** One issue with its full timeline. */
export async function getIssue(id: string) {
  const issue = await db.query.issues.findFirst({
    where: { id },
    with: {
      department: true,
      reporter: { columns: { id: true, name: true, image: true } },
      assignee: { columns: { id: true, name: true, image: true } },
      history: true,
      comments: {
        with: { author: { columns: { id: true, name: true, image: true } } },
      },
      attachments: true,
    },
  });

  if (!issue) throw new NotFoundError("Issue not found");
  return issue;
}

/**
 * One issue by its human-facing number — the public tracking path.
 *
 * A citizen holds "#1024", never a UUID, so the tracker and the public API both
 * come through here rather than each writing the lookup themselves. Returns
 * null instead of throwing: "no report with that number" is a normal answer to
 * a typed-in number, not an exceptional one.
 */
export async function getIssueByNumber(number: number) {
  if (!Number.isInteger(number) || number < 1) return null;

  const issue = await db.query.issues.findFirst({
    where: { number },
    with: {
      department: true,
      reporter: { columns: { id: true, name: true, image: true } },
      history: true,
      comments: {
        with: { author: { columns: { id: true, name: true, image: true } } },
      },
      attachments: true,
    },
  });

  return issue ?? null;
}

/** Only the reporter (or an admin) may edit the descriptive fields. */
export async function updateIssue(
  id: string,
  input: { title?: string; description?: string; address?: string },
) {
  const user = await requireRole("CITIZEN", "OFFICER", "ADMIN");

  const existing = await db.query.issues.findFirst({
    where: { id },
    columns: { id: true, reportedBy: true, status: true },
  });
  if (!existing) throw new NotFoundError("Issue not found");

  if (existing.reportedBy !== user.id && user.role !== "ADMIN") {
    throw new ValidationError("You can only edit issues you reported");
  }
  // Editing the description of something already resolved would rewrite history.
  if (existing.status === "RESOLVED" || existing.status === "REJECTED") {
    throw new ValidationError("A closed issue cannot be edited");
  }

  const [updated] = await db
    .update(issues)
    .set({ ...input, updatedAt: new Date() })
    .where(eq(issues.id, id))
    .returning();

  return updated;
}

/** Adds a comment. Internal notes require OFFICER or ADMIN. */
export async function addComment(
  issueId: string,
  input: { body: string; isInternal: boolean },
) {
  const user: CurrentUser = await requireRole("CITIZEN", "OFFICER", "ADMIN");

  const issue = await db.query.issues.findFirst({
    where: { id: issueId },
    columns: { id: true },
  });
  if (!issue) throw new NotFoundError("Issue not found");

  // A citizen cannot post an internal note, whatever the request body says.
  const isInternal =
    input.isInternal && (user.role === "OFFICER" || user.role === "ADMIN");

  return dbPool.transaction(async (tx) => {
    const [comment] = await tx
      .insert(comments)
      .values({ issueId, authorId: user.id, body: input.body, isInternal })
      .returning();

    // Public comments show on the timeline; internal ones do not.
    if (!isInternal) {
      await tx.insert(issueHistory).values({
        issueId,
        actorId: user.id,
        event: "COMMENTED",
      });
    }

    return comment;
  });
}
