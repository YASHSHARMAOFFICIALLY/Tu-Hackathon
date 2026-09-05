/**
 * Departments — the authority units that own issues (Roads, Water Supply, ...).
 *
 * Seeded, not user-generated: the set is small, stable, and referenced by
 * officers and issues alike.
 */
import { pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { primaryId, timestamps } from "@/db/schema/columns";

export const departments = pgTable(
  "departments",
  {
    id: primaryId(),
    name: text("name").notNull(),
    description: text("description"),
    ...timestamps,
  },
  // Two departments with the same name would make assignment ambiguous for
  // officers and meaningless in the dashboard breakdown.
  (t) => [uniqueIndex("departments_name_idx").on(t.name)],
);

export type Department = typeof departments.$inferSelect;
export type NewDepartment = typeof departments.$inferInsert;
