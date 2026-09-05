/**
 * Format migration tests.
 *
 * The claim this backs: "our backup format is versioned, so a backup taken
 * before a schema change still imports." That is a sentence worth being able to
 * prove on stage — here it is, as a v1 document (exported before AI existed)
 * importing cleanly on the v2 schema.
 */
import { describe, expect, test } from "bun:test";

import { FORMAT_VERSION } from "./format";
import { validateBackup } from "./validate";

const DEPT = "11111111-1111-4111-8111-111111111111";
const ISSUE = "22222222-2222-4222-8222-222222222222";

/** Exactly what version 1 produced — no ai_* fields at all. */
const v1Backup = {
  format: "public-issue-tracker",
  version: 1,
  createdAt: "2026-09-05T10:30:00.000Z",
  applicationVersion: "0.1.0",
  data: {
    departments: [
      { id: DEPT, name: "Roads", description: null,
        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
    ],
    users: [
      { id: "user_1", name: "Anita Sharma", email: "anita@example.com",
        emailVerified: true, image: null, role: "CITIZEN", departmentId: null,
        displayName: "Anita",
        createdAt: "2026-09-01T00:00:00.000Z", updatedAt: "2026-09-01T00:00:00.000Z" },
    ],
    issues: [
      { id: ISSUE, number: 1, title: "Huge pothole near university gate",
        description: "Large pothole causing traffic problems.",
        category: "ROADS", address: "Tezpur University Gate",
        latitude: 26.7, longitude: 92.79, status: "IN_PROGRESS", priority: "HIGH",
        reportedBy: "user_1", assignedTo: null, departmentId: DEPT,
        resolutionNote: null, resolvedAt: null,
        createdAt: "2026-09-02T00:00:00.000Z", updatedAt: "2026-09-03T00:00:00.000Z" },
    ],
    issueHistory: [], comments: [], attachments: [], issueDuplicates: [],
  },
};

describe("v1 → v2 migration", () => {
  test("a v1 backup still validates on the v2 schema", () => {
    const migrated = validateBackup(structuredClone(v1Backup));
    expect(migrated.version).toBe(2);
    expect(migrated.data.issues).toHaveLength(1);
  });

  test("AI fields are filled with null, matching an un-triaged issue", () => {
    const migrated = validateBackup(structuredClone(v1Backup));
    const issue = migrated.data.issues[0];

    expect(issue.aiCategory).toBeNull();
    expect(issue.aiPriority).toBeNull();
    expect(issue.aiPriorityScore).toBeNull();
    expect(issue.aiSummary).toBeNull();
    expect(issue.aiConfidence).toBeNull();
  });

  test("the original data is untouched by the migration", () => {
    const issue = validateBackup(structuredClone(v1Backup)).data.issues[0];

    expect(issue.id).toBe(ISSUE);
    expect(issue.title).toBe("Huge pothole near university gate");
    expect(issue.status).toBe("IN_PROGRESS");
    expect(issue.priority).toBe("HIGH");
    expect(issue.departmentId).toBe(DEPT);
    expect(issue.reportedBy).toBe("user_1");
  });

  test("a backup from a FUTURE version is refused, not half-imported", () => {
    const future = { ...structuredClone(v1Backup), version: FORMAT_VERSION + 1 };
    expect(() => validateBackup(future)).toThrow(/understands up to/);
  });

  test("the embedding column is not part of the format", () => {
    const migrated = validateBackup(structuredClone(v1Backup));
    expect(JSON.stringify(migrated)).not.toContain("embedding");
  });
});
