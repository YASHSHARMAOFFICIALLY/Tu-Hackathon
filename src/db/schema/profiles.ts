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
import { pgTable, text } from "drizzle-orm/pg-core";

import { user } from "./auth";
import { timestamps } from "./columns";

export const profiles = pgTable("profiles", {
  userId: text("user_id")
    .primaryKey()
    .references(() => user.id, { onDelete: "cascade" }),

  // Product columns go here. Example placeholder — replace with real ones once
  // the product topic is settled:
  displayName: text("display_name"),

  ...timestamps,
});

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
