/**
 * Issue serialisation — the privacy boundary.
 *
 * The brief requires that personal information stays private. Rather than
 * trusting every route to remember, ALL issue responses go through these two
 * functions:
 *
 *   toPublicIssue      — anonymous and citizen views. No reporter identity, no
 *                        precise coordinates, no internal comments.
 *   toAuthorityIssue   — OFFICER/ADMIN views. Adds reporter identity and
 *                        internal notes, because triage needs to contact people.
 *
 * If a new field is added to `issues`, it does NOT appear in a response until
 * it is added here. That default is the point.
 */
import type { Attachment, Comment, Department, Issue, IssueHistoryEntry } from "@/db/schema";

type Actor = { id: string; name: string; image: string | null } | null;

export type IssueWithRelations = Issue & {
  department?: Department | null;
  reporter?: Actor;
  assignee?: Actor;
  history?: IssueHistoryEntry[];
  comments?: (Comment & { author?: Actor })[];
  attachments?: Attachment[];
};

/**
 * Coordinates rounded to ~1km. A citizen reporting "broken street light" from
 * their doorstep should not have their home pinpointed on a public map, but the
 * area still has to be visible for the report to be useful.
 */
function coarse(value: number | null): number | null {
  return value === null ? null : Math.round(value * 100) / 100;
}

/** A display name that is never the person's real identity. */
function publicActor(actor: Actor): { name: string } | null {
  if (!actor) return null;
  // First name only, so a timeline reads naturally without exposing full
  // identity. Never the email, never the id.
  return { name: actor.name.split(" ")[0] ?? "Citizen" };
}

export function toPublicIssue(issue: IssueWithRelations) {
  return {
    id: issue.id,
    number: issue.number,
    title: issue.title,
    description: issue.description,
    category: issue.category,
    status: issue.status,
    priority: issue.priority,
    address: issue.address,
    latitude: coarse(issue.latitude),
    longitude: coarse(issue.longitude),
    department: issue.department
      ? { id: issue.department.id, name: issue.department.name }
      : null,
    reportedBy: publicActor(issue.reporter ?? null),
    resolutionNote: issue.resolutionNote,
    resolvedAt: issue.resolvedAt,
    createdAt: issue.createdAt,
    updatedAt: issue.updatedAt,
    history: issue.history?.map((h) => ({
      event: h.event,
      oldStatus: h.oldStatus,
      newStatus: h.newStatus,
      note: h.note,
      createdAt: h.createdAt,
    })),
    // Internal notes are filtered out here, not in the query, so a caller that
    // forgets to filter still cannot leak them.
    comments: issue.comments
      ?.filter((c) => !c.isInternal)
      .map((c) => ({
        id: c.id,
        body: c.body,
        author: publicActor(c.author ?? null),
        createdAt: c.createdAt,
      })),
    attachments: issue.attachments?.map((a) => ({
      id: a.id,
      url: a.url,
      fileType: a.fileType,
    })),
  };
}

export type PublicIssue = ReturnType<typeof toPublicIssue>;

/** Authority view: full identity and internal notes. OFFICER/ADMIN only. */
export function toAuthorityIssue(issue: IssueWithRelations) {
  return {
    ...toPublicIssue(issue),
    latitude: issue.latitude,
    longitude: issue.longitude,
    reportedBy: issue.reporter ?? null,
    assignedTo: issue.assignee ?? null,
    assignedToId: issue.assignedTo ?? null,
    departmentId: issue.departmentId,
    /*
     * AI suggestions, and ONLY on this side of the boundary.
     *
     * A model's guess at a priority is not a fact about the report, and putting
     * it on the public shape would publish "this machine thinks your hazard is
     * LOW" as though the city had decided it. An officer sees the suggestion,
     * accepts or overrides it, and what the citizen sees is the decision.
     *
     * `aiReviewedAt` is the whole point of the distinction: it separates "a
     * human has looked at this" from "a model guessed".
     */
    ai: {
      category: issue.aiCategory ?? null,
      priority: issue.aiPriority ?? null,
      priorityScore: issue.aiPriorityScore ?? null,
      departmentId: issue.aiDepartmentId ?? null,
      summary: issue.aiSummary ?? null,
      reasoning: issue.aiReasoning ?? null,
      confidence: issue.aiConfidence ?? null,
      reviewedAt: issue.aiReviewedAt ?? null,
      photoCount: issue.aiPhotoCount ?? 0,
    },
    comments: issue.comments?.map((c) => ({
      id: c.id,
      body: c.body,
      isInternal: c.isInternal,
      author: c.author ?? null,
      createdAt: c.createdAt,
    })),
  };
}
