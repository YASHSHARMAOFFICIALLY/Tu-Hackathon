/**
 * Duplicate links between issues.
 *
 * The brief is explicit: "Duplicate reports should be grouped or linked, NOT
 * silently deleted." So a duplicate keeps its own row, its own reporter, and
 * its own timeline — this table only records that it describes the same
 * real-world problem as a primary issue.
 *
 * That also preserves the civic signal: five reports of one pothole means five
 * citizens affected, which is exactly what should drive priority.
 */
import { check, index, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

import { primaryId, timestamps } from "@/db/schema/columns";
import { user } from "@/modules/auth/schema/auth";

import { issues } from "./issues";

export const issueDuplicates = pgTable(
  "issue_duplicates",
  {
    id: primaryId(),

    /** The canonical issue the work is tracked against. */
    primaryIssueId: uuid("primary_issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),

    /** The report that describes the same problem. Still a real issue. */
    duplicateIssueId: uuid("duplicate_issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),

    /** Who made the link — a citizen at submission, or an officer during triage. */
    linkedBy: text("linked_by").references(() => user.id, {
      onDelete: "set null",
    }),

    ...timestamps,
  },
  (t) => [
    // The same pair must not be linked twice, or counts double.
    uniqueIndex("issue_duplicates_pair_idx").on(
      t.primaryIssueId,
      t.duplicateIssueId,
    ),
    // Listing "all reports of this problem" is the common read.
    index("issue_duplicates_primary_idx").on(t.primaryIssueId),
    // An issue cannot be its own duplicate. Enforced in the database because a
    // service-layer check can be bypassed by a restore or a manual fix-up.
    check(
      "issue_duplicates_not_self",
      sql`${t.primaryIssueId} <> ${t.duplicateIssueId}`,
    ),
  ],
);

export type IssueDuplicate = typeof issueDuplicates.$inferSelect;
export type NewIssueDuplicate = typeof issueDuplicates.$inferInsert;
