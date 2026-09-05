/**
 * Shared column builders.
 *
 * Every table in this project composes these so that ids and audit columns
 * behave identically everywhere. If you find yourself hand-writing a
 * `created_at` on a new table, add it here instead.
 */
import { timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * Primary key: a database-generated UUID v4.
 *
 * Chosen over `serial` because sequential integer ids leak row counts and
 * make it trivial for one tenant to guess another tenant's ids.
 */
export const primaryId = () => uuid("id").primaryKey().defaultRandom();

/**
 * `created_at` / `updated_at` pair, stored with timezone.
 *
 * `withTimezone: true` stores `timestamptz`, which normalises to UTC — the only
 * safe choice once the product has users in more than one timezone.
 *
 * ponytail: `updated_at` is bumped in application code via `.set({ updatedAt: new Date() })`.
 * Move it to a database trigger if writes ever bypass the ORM.
 */
export const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
};
