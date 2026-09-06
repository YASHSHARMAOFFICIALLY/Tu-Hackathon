/**
 * Who holds which role, and the one path that changes it.
 *
 * `seed-admin.ts` promotes the first ADMIN from a terminal, deliberately: there
 * must be no self-service path to ADMIN. That reasoning covers bootstrapping and
 * nothing else. Delegation, an admin appointing an officer to a department, is
 * not self-service, and leaving it to hand-written SQL made the whole officer
 * half of the product unreachable from the running app.
 *
 * Everything here is ADMIN only, and the interesting part is a pure predicate so
 * the rules can be asserted without seeding a database.
 */
import { eq } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import type { UserRole } from "@/db/schema";
import { NotFoundError, ValidationError } from "@/lib/http";

import { requireAdmin } from "./permissions";

export type Person = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  departmentId: string | null;
  departmentName: string | null;
  displayName: string | null;
  joinedAt: Date;
};

/**
 * Everyone with an account, newest first.
 *
 * ADMIN only, and not for tidiness: this is every resident's name and email
 * address in one response. `listOfficers` exists next door and stays separate
 * because it answers a different question (who can an issue go to) for a wider
 * audience (any officer).
 */
export async function listPeople(): Promise<Person[]> {
  await requireAdmin();

  const rows = await db.query.profiles.findMany({
    columns: { userId: true, role: true, departmentId: true, displayName: true },
    with: {
      user: { columns: { name: true, email: true, createdAt: true } },
      department: { columns: { name: true } },
    },
  });

  return rows
    .map((row) => ({
      id: row.userId,
      name: row.user?.name ?? "Unnamed account",
      email: row.user?.email ?? "",
      role: row.role,
      departmentId: row.departmentId,
      departmentName: row.department?.name ?? null,
      displayName: row.displayName,
      joinedAt: row.user?.createdAt ?? new Date(0),
    }))
    .sort((a, b) => b.joinedAt.getTime() - a.joinedAt.getTime());
}

/**
 * The rules of a role change, with no database and no session behind them.
 *
 * Returns the reason it is refused, or null when it is allowed. Same shape as
 * `explainAssignment` in the issue workflow, for the same reason: every branch
 * gets a test that costs nothing to run.
 */
export function explainRoleChange(
  actorId: string,
  targetId: string,
  role: UserRole,
  departmentId: string | null,
): string | null {
  // An admin who can demote themselves can lock every admin out of the product.
  // Blocking it also removes the need to count the remaining admins: only an
  // admin reaches this code, and they always survive their own write.
  if (actorId === targetId) {
    return "You cannot change your own role. Ask another administrator.";
  }
  if (role === "OFFICER" && departmentId === null) {
    return "An officer needs a department: they can only act on its issues.";
  }
  if (role !== "OFFICER" && departmentId !== null) {
    return "Only officers belong to a department.";
  }
  return null;
}

/**
 * Set someone's role, and the department that comes with it.
 *
 * Role and department move together in one call because they are one decision:
 * an officer without a department cannot assign, route or act on anything
 * (`explainAssignment` refuses them), so a two-step UI would ship a broken
 * officer between the steps.
 *
 * Returns the whole list rather than the changed row: the caller is a table that
 * has just gone stale, and one query answers that better than a row the client
 * has to splice in.
 */
export async function setPersonRole(input: {
  userId: string;
  role: UserRole;
  departmentId: string | null;
}): Promise<Person[]> {
  const actor = await requireAdmin();

  const departmentId = input.role === "OFFICER" ? input.departmentId : null;

  const refusal = explainRoleChange(
    actor.id,
    input.userId,
    input.role,
    departmentId,
  );
  if (refusal) throw new ValidationError(refusal);

  const updated = await db
    .update(profiles)
    .set({ role: input.role, departmentId, updatedAt: new Date() })
    .where(eq(profiles.userId, input.userId))
    .returning({ userId: profiles.userId });

  if (updated.length === 0) throw new NotFoundError("No such person");

  return listPeople();
}
