/**
 * The WEB-C16 claim, as tests.
 *
 * "Export sample records, clear or use a fresh copy, import them and verify the
 * restored data." That is exactly what these do, against the real database.
 *
 * DESTRUCTIVE: these wipe and restore every product table in whatever database
 * DATABASE_URL points at. They are therefore SKIPPED by default and only run
 * when ALLOW_DESTRUCTIVE_TESTS=1:
 *
 *     bun run test:backup
 *
 * Point that at a Neon branch, never at a database you care about. A guard is
 * cheaper than the one time someone runs `bun test` against demo data an hour
 * before judging.
 */
import { afterAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { dbPool } from "@/db/pool";
import {
  attachments, comments, departments, issueDuplicates,
  issueHistory, issues, profiles, user,
} from "@/db/schema";
import { exportBackup } from "./export";
import { restoreBackup } from "./restore";
import { validateBackup } from "./validate";

const TAG = "roundtrip_" + Date.now();

/**
 * Opt-in guard. `describe.skipIf` keeps the file compiling and visible in the
 * test list, so nobody forgets these exist.
 */
const DESTRUCTIVE_ALLOWED = process.env.ALLOW_DESTRUCTIVE_TESTS === "1";
const describeDestructive = describe.skipIf(!DESTRUCTIVE_ALLOWED);

/** Seeds a small but relationally complete dataset. */
async function seed() {
  const [dept] = await db.insert(departments).values({
    name: `Roads ${TAG}`, description: "Test department",
  }).returning();

  await db.insert(user).values({
    id: `${TAG}_citizen`, name: "Anita Sharma", email: `${TAG}@example.com`,
    emailVerified: true, updatedAt: new Date(),
  });
  await db.insert(profiles).values({
    userId: `${TAG}_citizen`, role: "CITIZEN", displayName: "Anita",
  });

  const [primary] = await db.insert(issues).values({
    title: "Huge pothole near university gate",
    description: "Large pothole causing traffic problems.",
    category: "ROADS", address: "Tezpur University Gate",
    latitude: 26.7012, longitude: 92.7987,
    reportedBy: `${TAG}_citizen`, departmentId: dept.id, priority: "HIGH",
  }).returning();

  const [dupe] = await db.insert(issues).values({
    title: "Big pothole at university entrance",
    description: "Same pothole, reported again.",
    category: "ROADS", address: "University Entrance",
    reportedBy: `${TAG}_citizen`, departmentId: dept.id,
  }).returning();

  await db.insert(issueHistory).values([
    { issueId: primary.id, actorId: `${TAG}_citizen`, event: "CREATED", newStatus: "SUBMITTED" },
    { issueId: primary.id, event: "STATUS_CHANGED", oldStatus: "SUBMITTED", newStatus: "ACKNOWLEDGED" },
  ]);
  await db.insert(comments).values({
    issueId: primary.id, authorId: `${TAG}_citizen`, body: "Still not fixed.",
  });
  await db.insert(attachments).values({
    issueId: primary.id, url: "https://example.com/pothole.jpg", fileType: "image/jpeg",
  });
  await db.insert(issueDuplicates).values({
    primaryIssueId: primary.id, duplicateIssueId: dupe.id, linkedBy: `${TAG}_citizen`,
  });

  return { deptId: dept.id, primaryId: primary.id, dupeId: dupe.id };
}

async function wipe() {
  await dbPool.transaction(async (tx) => {
    await tx.delete(issueDuplicates);
    await tx.delete(attachments);
    await tx.delete(comments);
    await tx.delete(issueHistory);
    await tx.delete(issues);
    await tx.delete(profiles);
    await tx.delete(user);
    await tx.delete(departments);
  });
}

afterAll(async () => {
  if (DESTRUCTIVE_ALLOWED) await wipe();
});

describeDestructive("export → wipe → restore", () => {
  test("restores every row and every relationship", async () => {
    await wipe();
    const seeded = await seed();

    const before = await exportBackup();
    expect(before.data.issues).toHaveLength(2);
    expect(before.data.issueDuplicates).toHaveLength(1);

    // Serialize and re-parse: this is what actually crosses the wire, so dates
    // become strings and must survive coming back.
    const onDisk = JSON.parse(JSON.stringify(before));

    await wipe();
    expect(await db.$count(issues)).toBe(0);

    const validated = validateBackup(onDisk);
    const result = await restoreBackup(validated, "empty-only");
    expect(result.total).toBe(before.data.departments.length + before.data.users.length + 2 + 2 + 1 + 1 + 1);

    const after = await exportBackup();

    // Same rows, same ids, same relationships.
    expect(after.data.issues).toHaveLength(2);
    expect(after.data.users).toHaveLength(1);
    expect(after.data.issueHistory).toHaveLength(2);
    expect(after.data.comments).toHaveLength(1);
    expect(after.data.attachments).toHaveLength(1);
    expect(after.data.issueDuplicates).toHaveLength(1);

    const restored = after.data.issues.find((i) => i.id === seeded.primaryId);
    expect(restored?.title).toBe("Huge pothole near university gate");
    expect(restored?.priority).toBe("HIGH");
    expect(restored?.reportedBy).toBe(`${TAG}_citizen`);
    expect(restored?.departmentId).toBe(seeded.deptId);

    // The duplicate link survived, pointing at both original issues.
    expect(after.data.issueDuplicates[0].primaryIssueId).toBe(seeded.primaryId);
    expect(after.data.issueDuplicates[0].duplicateIssueId).toBe(seeded.dupeId);
  }, 30_000);

  test("the issue number sequence is fast-forwarded, so new issues do not collide", async () => {
    const maxRestored = Math.max(
      ...(await db.select({ n: issues.number }).from(issues)).map((r) => r.n),
    );

    const [fresh] = await db.insert(issues).values({
      title: "A new report after the restore",
      description: "Checks that bigserial did not rewind.",
      category: "OTHER", address: "Somewhere",
    }).returning();

    expect(fresh.number).toBeGreaterThan(maxRestored);
    await db.delete(issues).where(eq(issues.id, fresh.id));
  }, 30_000);
});

describeDestructive("a failed restore writes nothing", () => {
  test("a corrupt row rolls the whole restore back", async () => {
    await wipe();
    await seed();
    const good = JSON.parse(JSON.stringify(await exportBackup()));
    await wipe();

    // Corrupt ONE row deep in the file: an issue pointing at a department that
    // is not in the backup. Everything before it is perfectly valid.
    const corrupt = structuredClone(good);
    corrupt.data.issues[1].departmentId = "99999999-9999-4999-8999-999999999999";

    expect(() => validateBackup(corrupt)).toThrow(/departmentId/);

    // Nothing was written — validation runs before the transaction opens.
    expect(await db.$count(issues)).toBe(0);
    expect(await db.$count(departments)).toBe(0);
    expect(await db.$count(user)).toBe(0);
  }, 30_000);

  test("a failure INSIDE the transaction also leaves the database untouched", async () => {
    await wipe();
    await seed();
    const good = JSON.parse(JSON.stringify(await exportBackup()));
    await wipe();

    // Passes every validation layer, but violates a database constraint: two
    // issues sharing one primary key. Referential validation cannot catch this,
    // so it fails mid-INSERT — exactly the case the transaction exists for.
    const corrupt = validateBackup(structuredClone(good));
    corrupt.data.issues[1].id = corrupt.data.issues[0].id;

    await expect(restoreBackup(corrupt, "empty-only")).rejects.toThrow();

    expect(await db.$count(issues)).toBe(0);
    expect(await db.$count(departments)).toBe(0);
    expect(await db.$count(user)).toBe(0);
    expect(await db.$count(issueHistory)).toBe(0);
  }, 30_000);

  test("empty-only refuses to overwrite a database that has data", async () => {
    await wipe();
    await seed();
    const backup = validateBackup(JSON.parse(JSON.stringify(await exportBackup())));

    await expect(restoreBackup(backup, "empty-only")).rejects.toThrow(/not empty/);

    // The existing data is still there, untouched.
    expect(await db.$count(issues)).toBe(2);
  }, 30_000);
});
