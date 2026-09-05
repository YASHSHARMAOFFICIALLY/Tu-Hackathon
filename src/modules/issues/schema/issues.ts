/**
 * Issues — the core record of the product.
 *
 * Covers four MVP checklist items at once: complaint submission, location and
 * category, department assignment, and priority level.
 */
import { sql } from "drizzle-orm";
import {
  bigserial,
  doublePrecision,
  index,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { primaryId, timestamps } from "@/db/schema/columns";
import { issueCategory, issuePriority, issueStatus } from "@/db/schema/enums";
import { departments } from "@/modules/departments/schema/departments";
import { user } from "@/modules/auth/schema/auth";

export const issues = pgTable(
  "issues",
  {
    id: primaryId(),

    /**
     * Human-facing reference ("Issue #1024"). UUIDs are right for the primary
     * key — sequential ids leak how many reports exist and are trivial to
     * enumerate — but nobody reads a UUID aloud during a demo.
     */
    number: bigserial("number", { mode: "number" }).notNull().unique(),

    title: text("title").notNull(),
    description: text("description").notNull(),
    category: issueCategory("category").notNull(),

    // Location: free-text address plus optional coordinates. Coordinates are
    // nullable because a citizen may report from a desktop with no geolocation,
    // and the brief requires location, not precise coordinates.
    address: text("address").notNull(),
    latitude: doublePrecision("latitude"),
    longitude: doublePrecision("longitude"),

    status: issueStatus("status").notNull().default("SUBMITTED"),
    priority: issuePriority("priority").notNull().default("MEDIUM"),

    /**
     * Who reported it. `set null` on delete, not cascade: deleting a user must
     * not erase the public record of a civic issue, and the brief forbids
     * silently destroying reports.
     */
    reportedBy: text("reported_by").references(() => user.id, {
      onDelete: "set null",
    }),

    /** Officer currently responsible. Null until triaged. */
    assignedTo: text("assigned_to").references(() => user.id, {
      onDelete: "set null",
    }),

    /** Owning department. Null until an authorised user assigns one. */
    departmentId: uuid("department_id").references(() => departments.id, {
      onDelete: "set null",
    }),

    /**
     * Resolution note or evidence. The brief requires that resolution include
     * one — the service layer rejects a move to RESOLVED without it. Kept on
     * the issue (not only in history) so the current resolution is one read
     * away for the public view.
     */
    resolutionNote: text("resolution_note"),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),

    ...timestamps,
  },
  (t) => [
    // The dashboard groups by status and department; the public list filters by
    // status; "my issues" filters by reporter; every list sorts newest first.
    index("issues_status_idx").on(t.status),
    index("issues_department_idx").on(t.departmentId),
    index("issues_reported_by_idx").on(t.reportedBy),
    index("issues_assigned_to_idx").on(t.assignedTo),
    index("issues_created_at_idx").on(t.createdAt.desc()),
    // Pre-submit duplicate search filters on category first, then compares text.
    index("issues_category_idx").on(t.category),
    // Trigram index for the title similarity half of that search. Requires the
    // pg_trgm extension, enabled in the same migration.
    index("issues_title_trgm_idx").using(
      "gin",
      sql`${t.title} gin_trgm_ops`,
    ),
  ],
);

export type Issue = typeof issues.$inferSelect;
export type NewIssue = typeof issues.$inferInsert;
