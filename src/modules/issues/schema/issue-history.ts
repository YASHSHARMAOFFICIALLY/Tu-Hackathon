/**
 * Issue history — the timeline. APPEND-ONLY.
 *
 * Nothing updates or deletes a row here. That is what makes the timeline
 * trustworthy, and it is what the backup restores to prove that relationships
 * survived a round-trip.
 *
 * Every write happens inside the same transaction as the change it records
 * (see the workflow service): a status change without its history row is
 * corrupt data.
 */
import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { primaryId } from "@/db/schema/columns";
import { issueEvent, issuePriority, issueStatus } from "@/db/schema/enums";
import { user } from "@/modules/auth/schema/auth";
import { timestamp } from "drizzle-orm/pg-core";

import { issues } from "./issues";

export const issueHistory = pgTable(
  "issue_history",
  {
    id: primaryId(),

    issueId: uuid("issue_id")
      .notNull()
      // History dies with its issue — it is meaningless alone, and an orphaned
      // timeline would break the backup's referential validation.
      .references(() => issues.id, { onDelete: "cascade" }),

    /** Who acted. Null once the actor's account is gone; the event remains. */
    actorId: text("actor_id").references(() => user.id, {
      onDelete: "set null",
    }),

    event: issueEvent("event").notNull(),

    // Only populated for the event type they belong to. Nullable rather than a
    // polymorphic JSON blob, so the timeline query stays plain SQL.
    oldStatus: issueStatus("old_status"),
    newStatus: issueStatus("new_status"),
    oldPriority: issuePriority("old_priority"),
    newPriority: issuePriority("new_priority"),

    /** Free-text note, and the resolution note when the issue is resolved. */
    note: text("note"),

    // No updatedAt: rows are never modified.
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  // The timeline is always "this issue, oldest first".
  (t) => [index("issue_history_issue_idx").on(t.issueId, t.createdAt)],
);

export type IssueHistoryEntry = typeof issueHistory.$inferSelect;
export type NewIssueHistoryEntry = typeof issueHistory.$inferInsert;
