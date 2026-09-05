/**
 * Profiles — product data about a user that Better Auth does not own.
 *
 * The boundary: `user` (in auth.ts) is generated and migrated by the auth
 * library — plan, onboarding state, org membership and anything else product-
 * specific goes here instead, so a Better Auth upgrade can never conflict with
 * your columns.
 *
 * One row per user, created on first sign-in. The primary key IS the auth user
 * id (text, not uuid — Better Auth generates its own ids), which makes the
 * one-to-one relationship impossible to violate: no separate unique index
 * needed, and no way to end up with two profiles for one account.
 */
import { pgTable, text, uuid } from "drizzle-orm/pg-core";

import { departments } from "@/modules/departments/schema/departments";

import { user } from "./auth";
import { timestamps } from "@/db/schema/columns";
import { userRole } from "@/db/schema/enums";

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),

  /**
   * Authorization role. Lives here, not on the auth-owned `user` table, because
   * the Better Auth CLI regenerates that file and would overwrite it.
   *
   * Everyone starts as a CITIZEN. Promotion is deliberate — see
   * `src/db/seed-admin.ts`. There is no self-service path to OFFICER or ADMIN.
   */
  role: userRole("role").notNull().default("CITIZEN"),

  /**
   * Which department an OFFICER acts for. Null for citizens and admins.
   * Officers are scoped to their own department's issues.
   */
  departmentId: uuid("department_id").references(() => departments.id, {
    onDelete: "set null",
  }),

  /** Public-facing name. Kept separate from the Google profile name so a user
   * can be shown publicly without exposing their real identity — the brief
   * requires that personal information stays private. */
  displayName: text("display_name"),

  ...timestamps,
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
