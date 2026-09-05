/**
 * Seeds the department list. Idempotent — safe to run repeatedly.
 *
 * Usage: bun run db:seed:departments
 */
import { db } from "@/db";
import { departments } from "./schema/departments";

const DEPARTMENTS = [
  { name: "Roads", description: "Potholes, damaged roads, street signage" },
  { name: "Water Supply", description: "Leaks, shortages, contamination" },
  { name: "Electricity", description: "Street lights, outages, exposed wiring" },
  { name: "Sanitation", description: "Waste collection, drainage, public toilets" },
  { name: "Public Safety", description: "Unsafe structures, obstructions, hazards" },
] as const;

const rows = await db
  .insert(departments)
  .values([...DEPARTMENTS])
  // The unique index on name makes this a no-op on re-run rather than an error.
  .onConflictDoNothing()
  .returning({ name: departments.name });

console.log(
  rows.length === 0
    ? "Departments already seeded."
    : `Seeded ${rows.length}: ${rows.map((r) => r.name).join(", ")}`,
);
