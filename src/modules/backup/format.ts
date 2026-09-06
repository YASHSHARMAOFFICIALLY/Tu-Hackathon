/**
 * Backup file format — the contract between export and restore.
 *
 * WEB-C16: "Allow an authorised user to export project records as JSON and
 * restore them into an empty copy of the app."
 *
 * Two rules define this file:
 *
 * 1. NOTHING SECRET IS EXPORTED. No OAuth tokens, no sessions, no verification
 *    challenges. `account` rows hold live Google access/refresh tokens — a
 *    backup containing them is far worse than a leaked password hash, and the
 *    brief requires personal information to stay private.
 *
 * 2. THE FORMAT IS VERSIONED. A backup taken on day 1 must still import on
 *    day 3 after the schema moved. `version` is checked before anything else,
 *    and a file from the future is refused rather than half-imported.
 */
import { z } from "zod";

import {
  issueCategory,
  issueEvent,
  issuePriority,
  issueStatus,
  userRole,
} from "@/db/schema/enums";

/**
 * Bump when the shape changes, and add a migration step in `validate.ts`.
 *
 * v1 → v2: added the AI triage fields to issues. A v1 file still imports; the
 * migration fills the new fields with null, which is exactly what an issue
 * looks like before triage runs.
 */
export const FORMAT_VERSION = 2;

export const FORMAT_NAME = "public-issue-tracker";

// Dates arrive as ISO strings in JSON and must come back as Date objects.
const dateish = z.coerce.date();
const nullableDate = z.coerce.date().nullable().optional();

const departmentSchema = z.object({
  id: z.uuid(),
  name: z.string().min(1),
  description: z.string().nullable().optional(),
  createdAt: dateish,
  updatedAt: dateish,
});

/**
 * Users are exported with their ORIGINAL ids so every foreign key in the
 * restored issues resolves. Their `account` rows are NOT exported, so on the
 * fresh copy they sign in with Google again and Better Auth links them back to
 * this row by verified email (trustedProviders: ["google"],
 * allowDifferentEmails: false).
 *
 * Result: the backup carries zero credentials and the restored app still works.
 */
const userSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean().default(false),
  image: z.string().nullable().optional(),
  role: z.enum(userRole.enumValues).default("CITIZEN"),
  departmentId: z.uuid().nullable().optional(),
  displayName: z.string().nullable().optional(),
  createdAt: dateish,
  updatedAt: dateish,
});

const issueSchema = z.object({
  id: z.uuid(),
  number: z.number().int().positive(),
  title: z.string(),
  description: z.string(),
  category: z.enum(issueCategory.enumValues),
  address: z.string(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  status: z.enum(issueStatus.enumValues),
  priority: z.enum(issuePriority.enumValues),
  reportedBy: z.string().nullable().optional(),
  assignedTo: z.string().nullable().optional(),
  departmentId: z.uuid().nullable().optional(),
  resolutionNote: z.string().nullable().optional(),
  resolvedAt: nullableDate,

  // --- v2: AI triage suggestions ------------------------------------------
  // Optional so a v1 file (taken before AI existed) still parses. The
  // `embedding` column is deliberately NOT here: it is derived data, it would
  // bloat the file by an order of magnitude, and it is recomputed on demand.
  aiCategory: z.enum(issueCategory.enumValues).nullable().optional(),
  aiPriority: z.enum(issuePriority.enumValues).nullable().optional(),
  aiPriorityScore: z.number().int().nullable().optional(),
  aiDepartmentId: z.uuid().nullable().optional(),
  aiSummary: z.string().nullable().optional(),
  aiReasoning: z.string().nullable().optional(),
  aiConfidence: z.number().int().nullable().optional(),
  aiReviewedAt: nullableDate,
  aiPhotoCount: z.number().int().nullable().optional(),

  createdAt: dateish,
  updatedAt: dateish,
});

const issueHistorySchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  actorId: z.string().nullable().optional(),
  event: z.enum(issueEvent.enumValues),
  oldStatus: z.enum(issueStatus.enumValues).nullable().optional(),
  newStatus: z.enum(issueStatus.enumValues).nullable().optional(),
  oldPriority: z.enum(issuePriority.enumValues).nullable().optional(),
  newPriority: z.enum(issuePriority.enumValues).nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: dateish,
});

const commentSchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  authorId: z.string().nullable().optional(),
  body: z.string(),
  isInternal: z.boolean().default(false),
  createdAt: dateish,
  updatedAt: dateish,
});

const attachmentSchema = z.object({
  id: z.uuid(),
  issueId: z.uuid(),
  uploadedBy: z.string().nullable().optional(),
  url: z.string(),
  fileType: z.string().nullable().optional(),
  createdAt: dateish,
  updatedAt: dateish,
});

const issueDuplicateSchema = z.object({
  id: z.uuid(),
  primaryIssueId: z.uuid(),
  duplicateIssueId: z.uuid(),
  linkedBy: z.string().nullable().optional(),
  createdAt: dateish,
  updatedAt: dateish,
});

export const backupSchema = z.object({
  format: z.literal(FORMAT_NAME),
  version: z.number().int().positive(),
  createdAt: z.string(),
  applicationVersion: z.string().optional(),
  data: z.object({
    departments: z.array(departmentSchema),
    users: z.array(userSchema),
    issues: z.array(issueSchema),
    issueHistory: z.array(issueHistorySchema),
    comments: z.array(commentSchema),
    attachments: z.array(attachmentSchema),
    issueDuplicates: z.array(issueDuplicateSchema),
  }),
});

export type Backup = z.infer<typeof backupSchema>;
export type BackupData = Backup["data"];

/**
 * Insert order. Foreign keys point backwards along this list, so restoring in
 * this order never references a row that does not exist yet.
 */
export const TABLE_ORDER = [
  "departments",
  "users",
  "issues",
  "issueHistory",
  "comments",
  "attachments",
  "issueDuplicates",
] as const satisfies readonly (keyof BackupData)[];

/**
 * Tables deliberately absent from every backup, and why. Exported so the
 * redaction test can assert against this list rather than a copy of it.
 */
export const NEVER_EXPORTED = {
  account: "holds live Google access and refresh tokens",
  session: "active login tokens",
  verification: "short-lived auth challenges",
  rate_limit: "operational counters, meaningless after a restore",
} as const;
