/**
 * Backup validation — everything that must pass BEFORE a single row is written.
 *
 * Three layers, in order, each cheaper than the one after it:
 *   1. shape    — is this even our format, and a version we understand?
 *   2. types    — does every row match the schema? (zod)
 *   3. graph    — does every foreign key resolve INSIDE this file?
 *
 * Layer 3 is the one that matters for a restore into an empty database: there
 * is nothing else for a reference to point at, so a backup whose issues cite a
 * missing department would fail halfway through the insert. Catching it here
 * turns a corrupt half-restore into a clear 400 with the offending row named.
 */
import { ValidationError } from "@/lib/http";

import {
  backupSchema,
  FORMAT_NAME,
  FORMAT_VERSION,
  type Backup,
  type BackupData,
} from "./format";

export type BackupSummary = {
  version: number;
  createdAt: string;
  counts: Record<keyof BackupData, number>;
  total: number;
};

/** Row counts, for the preview screen shown before a restore is confirmed. */
export function summarise(backup: Backup): BackupSummary {
  const counts = Object.fromEntries(
    Object.entries(backup.data).map(([table, rows]) => [table, rows.length]),
  ) as Record<keyof BackupData, number>;

  return {
    version: backup.version,
    createdAt: backup.createdAt,
    counts,
    total: Object.values(counts).reduce((a, b) => a + b, 0),
  };
}

/**
 * Parses and fully validates an untrusted payload.
 * Throws ValidationError with a message a human can act on; never returns
 * partially-valid data.
 */
export function validateBackup(payload: unknown): Backup {
  if (payload === null || typeof payload !== "object") {
    throw new ValidationError("Backup must be a JSON object");
  }

  const candidate = payload as Record<string, unknown>;

  // Check format and version BEFORE the schema: a v2 file will fail the v1
  // schema with dozens of confusing field errors, when the real problem is one
  // number.
  if (candidate.format !== FORMAT_NAME) {
    throw new ValidationError(
      `Not a ${FORMAT_NAME} backup (found format: ${JSON.stringify(candidate.format ?? null)})`,
    );
  }

  const version = candidate.version;
  if (typeof version !== "number" || !Number.isInteger(version)) {
    throw new ValidationError("Backup version must be an integer");
  }
  if (version > FORMAT_VERSION) {
    throw new ValidationError(
      `Backup is version ${version}; this app understands up to ${FORMAT_VERSION}. Upgrade the app before restoring.`,
    );
  }

  const migrated = migrate(candidate, version);

  const parsed = backupSchema.safeParse(migrated);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ValidationError(
      `Invalid backup at ${first.path.join(".") || "(root)"}: ${first.message}`,
    );
  }

  assertReferentialIntegrity(parsed.data.data);
  return parsed.data;
}

/**
 * Upgrades an older file to the current shape.
 *
 * Empty today because version 1 is current. The seam exists so that when the
 * schema moves mid-hackathon, day-1 backups keep importing: add a step per
 * version and the chain runs in order.
 */
function migrate(backup: Record<string, unknown>, from: number) {
  let current = backup;
  for (let v = from; v < FORMAT_VERSION; v++) {
    const step = MIGRATIONS[v];
    if (!step) {
      throw new ValidationError(
        `No migration from backup version ${v} to ${v + 1}`,
      );
    }
    current = step(current);
  }
  return current;
}

const MIGRATIONS: Record<
  number,
  (backup: Record<string, unknown>) => Record<string, unknown>
> = {
  /**
   * v1 → v2: the AI triage fields were added to issues.
   *
   * Nothing to compute — an issue exported before AI existed simply has no
   * suggestions, which is the same state as an issue whose triage has not run
   * yet. Setting them explicitly to null (rather than leaving them absent)
   * keeps the migrated document identical in shape to a native v2 file.
   */
  1: (backup) => {
    const data = backup.data as Record<string, unknown[]>;
    return {
      ...backup,
      version: 2,
      data: {
        ...data,
        issues: (data.issues ?? []).map((issue) => ({
          ...(issue as Record<string, unknown>),
          aiCategory: null,
          aiPriority: null,
          aiPriorityScore: null,
          aiDepartmentId: null,
          aiSummary: null,
          aiReasoning: null,
          aiConfidence: null,
          aiReviewedAt: null,
        })),
      },
    };
  },
};

/**
 * Every foreign key must resolve inside the payload.
 *
 * Reported with the offending row so the failure is actionable — "issue
 * a1b2… references department dep_999, which is not in this backup" beats
 * "insert failed".
 */
export function assertReferentialIntegrity(data: BackupData): void {
  const departmentIds = new Set(data.departments.map((d) => d.id));
  const userIds = new Set(data.users.map((u) => u.id));
  const issueIds = new Set(data.issues.map((i) => i.id));

  const fail = (
    table: string,
    rowId: string,
    field: string,
    value: string,
    target: string,
  ): never => {
    throw new ValidationError(
      `${table} ${rowId} references ${target} ${value} via ${field}, which is not in this backup.`,
    );
  };

  const checkOptional = (
    value: string | null | undefined,
    set: Set<string>,
    table: string,
    rowId: string,
    field: string,
    target: string,
  ) => {
    // Null is legitimate — reportedBy is ON DELETE SET NULL — so only a present
    // value that resolves nowhere is an error.
    if (value != null && !set.has(value)) fail(table, rowId, field, value, target);
  };

  for (const u of data.users) {
    checkOptional(u.departmentId, departmentIds, "user", u.id, "departmentId", "department");
  }

  for (const i of data.issues) {
    checkOptional(i.departmentId, departmentIds, "issue", i.id, "departmentId", "department");
    checkOptional(i.reportedBy, userIds, "issue", i.id, "reportedBy", "user");
    checkOptional(i.assignedTo, userIds, "issue", i.id, "assignedTo", "user");
  }

  for (const h of data.issueHistory) {
    if (!issueIds.has(h.issueId))
      fail("issue history", h.id, "issueId", h.issueId, "issue");
    checkOptional(h.actorId, userIds, "issue history", h.id, "actorId", "user");
  }

  for (const c of data.comments) {
    if (!issueIds.has(c.issueId))
      fail("comment", c.id, "issueId", c.issueId, "issue");
    checkOptional(c.authorId, userIds, "comment", c.id, "authorId", "user");
  }

  for (const a of data.attachments) {
    if (!issueIds.has(a.issueId))
      fail("attachment", a.id, "issueId", a.issueId, "issue");
    checkOptional(a.uploadedBy, userIds, "attachment", a.id, "uploadedBy", "user");
  }

  for (const d of data.issueDuplicates) {
    if (!issueIds.has(d.primaryIssueId))
      fail("duplicate link", d.id, "primaryIssueId", d.primaryIssueId, "issue");
    if (!issueIds.has(d.duplicateIssueId))
      fail("duplicate link", d.id, "duplicateIssueId", d.duplicateIssueId, "issue");
    if (d.primaryIssueId === d.duplicateIssueId) {
      throw new ValidationError(
        `Duplicate link ${d.id} points an issue at itself.`,
      );
    }
    checkOptional(d.linkedBy, userIds, "duplicate link", d.id, "linkedBy", "user");
  }
}
