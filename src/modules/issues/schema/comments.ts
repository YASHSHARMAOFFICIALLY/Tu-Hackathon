/**
 * Comments on an issue.
 *
 * `isInternal` separates officer-only notes from what the public sees. The
 * brief requires that personal information stays private, and an officer
 * discussing a reporter's details must not appear on the public timeline.
 * Public queries filter on this column; it is not a UI concern.
 */
import { index, pgTable, text, uuid, boolean } from "drizzle-orm/pg-core";

import { primaryId, timestamps } from "@/db/schema/columns";
import { user } from "@/modules/auth/schema/auth";

import { issues } from "./issues";

export const comments = pgTable(
  "comments",
  {
    id: primaryId(),

    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),

    authorId: text("author_id").references(() => user.id, {
      onDelete: "set null",
    }),

    body: text("body").notNull(),

    /** True = visible only to OFFICER/ADMIN. Defaults to public. */
    isInternal: boolean("is_internal").notNull().default(false),

    ...timestamps,
  },
  (t) => [index("comments_issue_idx").on(t.issueId, t.createdAt)],
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
