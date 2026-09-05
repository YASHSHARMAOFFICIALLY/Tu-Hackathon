/**
 * Backup restore — the graded operation.
 *
 * WEB-C16 is checked by: export sample records, clear or use a fresh copy,
 * import them, verify the restored data.
 *
 * The whole restore runs inside ONE transaction on the WebSocket pool. If any
 * row fails, everything rolls back and the database is exactly as it was — the
 * alternative is a half-restored database that nobody can reason about, which
 * is worse than no restore at all.
 *
 * This is why `src/db/pool.ts` exists: the HTTP client cannot do this.
 */
import { sql } from "drizzle-orm";

import { dbPool } from "@/db/pool";
import {
  attachments,
  comments,
  departments,
  issueDuplicates,
  issueHistory,
  issues,
  profiles,
  user,
} from "@/db/schema";
import { ValidationError } from "@/lib/http";

import { type Backup } from "./format";
import { summarise, type BackupSummary } from "./validate";

export type RestoreMode =
  /** Refuse if the database already holds product data. The safe default. */
  | "empty-only"
  /** Wipe product tables first, inside the same transaction. */
  | "replace";

export type RestoreResult = {
  mode: RestoreMode;
  restored: BackupSummary["counts"];
  total: number;
};

/**
 * Batch size for inserts. Postgres has a parameter limit per statement
 * (65535); at ~18 columns per issue row, 500 rows is comfortably inside it and
 * still only a handful of statements for a demo-sized dataset.
 */
const CHUNK = 500;

async function insertChunked<T>(
  rows: T[],
  insert: (chunk: T[]) => Promise<unknown>,
): Promise<void> {
  for (let i = 0; i < rows.length; i += CHUNK) {
    await insert(rows.slice(i, i + CHUNK));
  }
}

export async function restoreBackup(
  backup: Backup,
  mode: RestoreMode = "empty-only",
): Promise<RestoreResult> {
  const summary = summarise(backup);
  const { data } = backup;

  return dbPool.transaction(async (tx) => {
    const [{ count: existingIssues }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(issues);

    if (mode === "empty-only" && existingIssues > 0) {
      throw new ValidationError(
        `Database is not empty (${existingIssues} issues). Restore into a fresh copy, or use mode "replace" to overwrite.`,
      );
    }

    if (mode === "replace") {
      // Reverse FK order. Children first so no delete violates a constraint.
      // Inside the transaction: a failed restore does not leave a wiped database.
      await tx.delete(issueDuplicates);
      await tx.delete(attachments);
      await tx.delete(comments);
      await tx.delete(issueHistory);
      await tx.delete(issues);
      await tx.delete(profiles);
      // `user` rows are deleted last and cascade to account/session, which are
      // not in the backup — those users re-link on their next Google sign-in.
      await tx.delete(user);
    }

    // FK order: every reference points at something already inserted.
    await insertChunked(data.departments, (chunk) =>
      tx.insert(departments).values(chunk),
    );

    // A backup user becomes two rows: the auth-owned `user`, and the product
    // `profiles` row carrying role and department.
    await insertChunked(data.users, (chunk) =>
      tx.insert(user).values(
        chunk.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          emailVerified: u.emailVerified,
          image: u.image ?? null,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })),
      ),
    );
    await insertChunked(data.users, (chunk) =>
      tx.insert(profiles).values(
        chunk.map((u) => ({
          userId: u.id,
          role: u.role,
          departmentId: u.departmentId ?? null,
          displayName: u.displayName ?? null,
          createdAt: u.createdAt,
          updatedAt: u.updatedAt,
        })),
      ),
    );

    await insertChunked(data.issues, (chunk) => tx.insert(issues).values(chunk));
    await insertChunked(data.issueHistory, (chunk) =>
      tx.insert(issueHistory).values(chunk),
    );
    await insertChunked(data.comments, (chunk) =>
      tx.insert(comments).values(chunk),
    );
    await insertChunked(data.attachments, (chunk) =>
      tx.insert(attachments).values(chunk),
    );
    await insertChunked(data.issueDuplicates, (chunk) =>
      tx.insert(issueDuplicates).values(chunk),
    );

    // `issues.number` is a bigserial. Restoring explicit numbers does NOT move
    // its sequence, so the next new issue would collide with a restored one.
    // Fast-forward the sequence to the highest restored number.
    if (data.issues.length > 0) {
      await tx.execute(sql`
        select setval(
          pg_get_serial_sequence('issues', 'number'),
          (select max(number) from issues)
        )
      `);
    }

    return { mode, restored: summary.counts, total: summary.total };
  });
}
