/**
 * Evidence attached to an issue — photos of the pothole, proof of resolution.
 *
 * Stores a URL or object-storage key, NEVER file bytes. Two reasons: Postgres
 * is the wrong place for binaries, and the JSON backup would become unusable if
 * every photo were base64'd into it.
 */
import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";

import { primaryId, timestamps } from "@/db/schema/columns";
import { user } from "@/modules/auth/schema/auth";

import { issues } from "./issues";

export const attachments = pgTable(
  "attachments",
  {
    id: primaryId(),

    issueId: uuid("issue_id")
      .notNull()
      .references(() => issues.id, { onDelete: "cascade" }),

    uploadedBy: text("uploaded_by").references(() => user.id, {
      onDelete: "set null",
    }),

    /** Public URL or storage key. The app never serves bytes from the database. */
    url: text("url").notNull(),
    /** MIME type, e.g. image/jpeg. */
    fileType: text("file_type"),

    ...timestamps,
  },
  (t) => [index("attachments_issue_idx").on(t.issueId)],
);

export type Attachment = typeof attachments.$inferSelect;
export type NewAttachment = typeof attachments.$inferInsert;
