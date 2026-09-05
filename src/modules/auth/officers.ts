import { inArray } from "drizzle-orm";

import { db } from "@/db";
import { profiles } from "@/db/schema";
import { user } from "@/modules/auth/schema/auth";

import { requireRole } from "./permissions";

/**
 * The people an issue can be assigned to.
 *
 * OFFICER/ADMIN only, and not because the names are secret — the assignee's
 * first name already appears on the public timeline. It is that the *staff list*
 * is a different thing from a name in a timeline: an anonymous endpoint
 * returning every official and their department is a directory, and directories
 * get scraped.
 *
 * Returns the department id alongside each officer so the assignment control
 * can offer the right people first without a second query.
 */
export async function listOfficers() {
  await requireRole("OFFICER", "ADMIN");

  const rows = await db
    .select({
      id: profiles.userId,
      role: profiles.role,
      displayName: profiles.displayName,
      departmentId: profiles.departmentId,
    })
    .from(profiles)
    .where(inArray(profiles.role, ["OFFICER", "ADMIN"]));

  if (rows.length === 0) return [];

  // The account name lives on `user`, the role on `profiles`. Two tables, one
  // extra round trip rather than a join, because the set is small and the join
  // would drag Better Auth's table into this module's shape.
  const names = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, rows.map((r) => r.id)));

  const nameById = new Map(names.map((n) => [n.id, n.name]));

  return rows
    .map((row) => ({
      id: row.id,
      name: row.displayName ?? nameById.get(row.id) ?? "Unnamed officer",
      role: row.role,
      departmentId: row.departmentId,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
