/**
 * Input schemas for the issue API.
 *
 * Every route parses its input through one of these before anything reaches a
 * service. Validation lives at the trust boundary, not scattered through
 * business logic.
 */
import { z } from "zod";

import {
  issueCategory,
  issuePriority,
  issueStatus,
} from "@/db/schema/enums";

export const categorySchema = z.enum(issueCategory.enumValues);
export const prioritySchema = z.enum(issuePriority.enumValues);
export const statusSchema = z.enum(issueStatus.enumValues);

/**
 * Coordinates are optional (a desktop reporter may have no geolocation) but if
 * one is given both must be, and both must be in range — a stray 0/0 would put
 * every such issue in the Gulf of Guinea and poison the duplicate search.
 */
const coordinates = z
  .object({
    latitude: z.number().min(-90).max(90).optional(),
    longitude: z.number().min(-180).max(180).optional(),
  })
  .refine(
    (v) =>
      (v.latitude === undefined) === (v.longitude === undefined),
    { message: "latitude and longitude must be provided together" },
  );

export const createIssueSchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    description: z.string().trim().min(10).max(5000),
    category: categorySchema,
    address: z.string().trim().min(3).max(300),
    /** Set when the citizen chose to file anyway after seeing possible matches. */
    possibleDuplicateOf: z.uuid().optional(),
  })
  .and(coordinates);

export type CreateIssueInput = z.infer<typeof createIssueSchema>;

/** Only the reporter's own descriptive fields. Status/priority/assignment are workflow. */
export const updateIssueSchema = z.object({
  title: z.string().trim().min(5).max(200).optional(),
  description: z.string().trim().min(10).max(5000).optional(),
  address: z.string().trim().min(3).max(300).optional(),
});

export const listIssuesSchema = z.object({
  status: statusSchema.optional(),
  category: categorySchema.optional(),
  priority: prioritySchema.optional(),
  departmentId: z.uuid().optional(),
  /** "mine" is resolved against the session, never a client-supplied user id. */
  mine: z.coerce.boolean().optional(),
  // Capped: the backup demo dataset must not be able to request 10k rows.
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export type ListIssuesInput = z.infer<typeof listIssuesSchema>;

/** Pre-submit duplicate check — runs before an issue exists, so no id. */
export const checkDuplicatesSchema = z
  .object({
    title: z.string().trim().min(5).max(200),
    category: categorySchema,
  })
  .and(coordinates);

export const createCommentSchema = z.object({
  body: z.string().trim().min(1).max(2000),
  /** Officer-only note, kept off the public timeline. Ignored for citizens. */
  isInternal: z.boolean().default(false),
});
