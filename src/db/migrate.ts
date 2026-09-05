/**
 * Applies every pending migration in ./src/db/migrations to the database in DATABASE_URL.
 *
 * Run locally with `bun run db:migrate`; run in CI/deploy before the new build
 * starts serving traffic.
 *
 * WARNING: the Neon HTTP driver does not support transactions, so a migration
 * that fails halfway is NOT rolled back — the database is left in a partial
 * state that you must repair by hand. This is the reason migration SQL is
 * generated, committed, and reviewed rather than pushed straight from a schema.
 */
import { drizzle } from "drizzle-orm/neon-http";
import { migrate } from "drizzle-orm/neon-http/migrator";

import { env } from "@/env";

const db = drizzle(env.DATABASE_URL);

await migrate(db, { migrationsFolder: "./src/db/migrations" });
console.log("Migrations applied.");
